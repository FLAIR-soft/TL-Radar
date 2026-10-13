'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { exec, row, rows, tx } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canEditTask } from '@/lib/auth/task-access';
import { getLocaleCookie } from '@/lib/i18n/cookie';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { isWithinWorkHours, completedLateBy } from '@/lib/logic/tasks';
import { logActivity } from '@/lib/logic/activity-log';
import { notifyMany } from '@/lib/logic/notifications';
import type { TaskStatus, Priority, Task } from '@/lib/db/types';

// Проверять вход здесь больше нечего: за шлюзом MIDAS неаутентифицированный
// посетитель до приложения не доходит, а getCurrentUser() бросает исключение,
// если заголовка с почтой нет. Язык берётся из куки, а не из профиля:
// таблицы profiles с настройками больше нет.
async function requireAuth() {
  const user = await getCurrentUser();
  const dict = getDictionary(await getLocaleCookie());
  return { user, dict };
}

// Правила из этапа 6 живут в триггерах базы, а не только в интерфейсе, —
// поэтому их нарушение приходит сюда исключением драйвера. У каждого правила
// свой SQLSTATE (миграция 0003), по нему и выбираем фразу из словаря:
// текст самого исключения приходит из Postgres по-русски и в немецком
// интерфейсе выглядел бы чужеродно.
function guardMessage(e: unknown, dict: ReturnType<typeof getDictionary>): string {
  const code = (e as { code?: string } | null)?.code;
  if (code === 'TL001') return dict.taskCard.deadlineImmutable;
  if (code === 'TL002') return dict.taskCard.lateReasonRequired;
  return e instanceof Error ? e.message : dict.taskForm.errors.missingFields;
}

export interface TaskFormState {
  error: string | null;
}

// Идентификатор шаблона приходит из адресной строки через скрытое поле формы.
// PostgREST на нечитаемый uuid отвечал «ничего не найдено», а драйвер pg
// бросает ошибку разбора — поэтому заведомо неверное значение отсекается до
// запроса: как и раньше, чек-лист просто не копируется.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];

function readPriority(formData: FormData): Priority | null {
  const raw = String(formData.get('priority') || '').trim();
  return (PRIORITIES as string[]).includes(raw) ? (raw as Priority) : null;
}

function readTaskFields(formData: FormData) {
  const estimatedRaw = String(formData.get('estimatedMinutes') || '').trim();
  const estimatedMinutes = estimatedRaw ? Number(estimatedRaw) : null;

  return {
    title: String(formData.get('title') || '').trim(),
    description: String(formData.get('description') || '').trim(),
    location: String(formData.get('location') || '').trim(),
    deadline: (String(formData.get('deadline') || '').trim() || null) as string | null,
    project_id: (String(formData.get('projectId') || '').trim() || null) as string | null,
    estimated_minutes: estimatedMinutes && estimatedMinutes > 0 ? Math.round(estimatedMinutes) : null,
    icon: (String(formData.get('icon') || '').trim() || null) as string | null,
    priority: readPriority(formData),
  };
}

// Имя поля формы не меняется (AssigneeSelect по-прежнему пишет hidden-input
// с name="assigneeIds") — теперь в нём лежит почта человека, а не uuid.
function readAssigneeEmails(formData: FormData): string[] {
  return formData
    .getAll('assigneeIds')
    .map((v) => String(v).trim())
    .filter(Boolean);
}

function readLabelIds(formData: FormData): string[] {
  return formData
    .getAll('labelIds')
    .map((v) => String(v).trim())
    .filter(Boolean);
}

export async function createTask(_prevState: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const { user, dict } = await requireAuth();
  const fields = readTaskFields(formData);
  const assigneeEmails = readAssigneeEmails(formData);
  const labelIds = readLabelIds(formData);

  if (!fields.title) {
    return { error: dict.taskForm.errors.missingFields };
  }
  if (!assigneeEmails.length) {
    return { error: dict.taskForm.errors.missingAssignee };
  }

  const now = new Date().toISOString();

  // Задача и её исполнители пишутся одной транзакцией: форма не даёт создать
  // задачу без исполнителя, и база не должна получить такую строку, если
  // вторая вставка не прошла.
  let taskId: string;
  try {
    taskId = await tx(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `insert into tasks (title, description, location, deadline, project_id,
                            estimated_minutes, icon, priority, status, created_by, updated_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, 'waiting', $9, $9)
         returning id`,
        [
          fields.title,
          fields.description,
          fields.location,
          fields.deadline,
          fields.project_id,
          fields.estimated_minutes,
          fields.icon,
          fields.priority,
          user.email,
        ]
      );
      const id = inserted.rows[0].id;

      await client.query(
        `insert into task_assignees (task_id, assignee_email, added_at, added_by)
         select $1::uuid, email, $3::timestamptz, $4::text
         from unnest($2::text[]) as email`,
        [id, assigneeEmails, now, user.email]
      );

      return id;
    });
  } catch (e) {
    return { error: guardMessage(e, dict) };
  }

  await logActivity('task', taskId, 'created', user.email, { title: fields.title });
  for (const assigneeId of assigneeEmails) {
    await logActivity('task', taskId, 'assignee_added', user.email, { assigneeId });
  }
  await notifyMany(assigneeEmails, user.email, 'assigned', taskId, { title: fields.title });

  if (labelIds.length) {
    await exec(
      `insert into task_labels (task_id, label_id, added_by)
       select $1::uuid, label_id, $3::text
       from unnest($2::uuid[]) as label_id`,
      [taskId, labelIds, user.email]
    );
  }

  // Sozdaniye iz shablona (Etap 7): kopiruyem chek-list shablona v novuyu
  // zadachu — izmeneniye shablona posle etogo uzhe ne vliyayet na zadachu.
  const templateId = String(formData.get('templateId') || '').trim();
  if (templateId && UUID_RE.test(templateId)) {
    const template = await row<{ checklist: string[] | null }>(
      `select checklist from task_templates where id = $1`,
      [templateId]
    );

    const checklist = template?.checklist ?? [];
    for (let i = 0; i < checklist.length; i++) {
      await exec(
        `insert into task_checklist_items (task_id, title, position) values ($1, $2, $3)`,
        [taskId, checklist[i], i]
      );
      await logActivity('task', taskId, 'checklist_item_added', user.email, { title: checklist[i] });
    }
  }

  revalidatePath('/dashboard');
  redirect('/dashboard');
}

// Bystroye sozdaniye zadachi iz command palette (Etap 9) — tol'ko nazvaniye,
// avtor srazu naznachayetsya ispolnitelem. V otlichiye ot createTask,
// vyzyvayetsya napryamuyu iz klientskogo komponenta (ne cherez <form
// action>), poetomu bez redirect() — palette sama reshayet, kuda perekhodit'.
export async function quickCreateTask(title: string): Promise<{ error?: string; taskId?: string }> {
  const { user, dict } = await requireAuth();
  const trimmed = title.trim();
  if (!trimmed) return { error: dict.taskForm.errors.missingFields };

  const now = new Date().toISOString();

  let taskId: string;
  try {
    taskId = await tx(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `insert into tasks (title, status, created_by, updated_by)
         values ($1, 'waiting', $2, $2)
         returning id`,
        [trimmed, user.email]
      );
      const id = inserted.rows[0].id;

      await client.query(
        `insert into task_assignees (task_id, assignee_email, added_at, added_by)
         values ($1, $2, $3, $4)`,
        [id, user.email, now, user.email]
      );

      return id;
    });
  } catch (e) {
    return { error: guardMessage(e, dict) };
  }

  await logActivity('task', taskId, 'created', user.email, { title: trimmed });

  revalidatePath('/dashboard');
  return { taskId };
}

// Проверка права обязана быть на сервере: спрятать кнопку недостаточно,
// серверное действие вызывается напрямую.
export async function editTaskFields(
  taskId: string,
  _prevState: TaskFormState,
  formData: FormData
): Promise<TaskFormState> {
  const { user, dict } = await requireAuth();

  if (!(await canEditTask(taskId, user.email))) {
    return { error: dict.taskCard.notAllowed };
  }
  const fields = readTaskFields(formData);
  const assigneeEmails = readAssigneeEmails(formData);
  const labelIds = readLabelIds(formData);

  if (!fields.title) {
    return { error: dict.taskForm.errors.missingFields };
  }
  if (!assigneeEmails.length) {
    return { error: dict.taskForm.errors.missingAssignee };
  }

  try {
    await exec(
      `update tasks
          set title = $1,
              description = $2,
              location = $3,
              deadline = $4,
              project_id = $5,
              estimated_minutes = $6,
              icon = $7,
              priority = $8,
              updated_by = $9
        where id = $10`,
      [
        fields.title,
        fields.description,
        fields.location,
        fields.deadline,
        fields.project_id,
        fields.estimated_minutes,
        fields.icon,
        fields.priority,
        user.email,
        taskId,
      ]
    );
  } catch (e) {
    return { error: guardMessage(e, dict) };
  }

  await logActivity('task', taskId, 'updated', user.email, { title: fields.title });

  const current = await rows<{ id: string; assignee_email: string }>(
    `select id, assignee_email from task_assignees
      where task_id = $1 and removed_at is null`,
    [taskId]
  );

  const currentEmails = new Set(current.map((a) => a.assignee_email));
  const newEmails = new Set(assigneeEmails);
  const now = new Date().toISOString();

  const toRemove = current.filter((a) => !newEmails.has(a.assignee_email));
  const toAdd = assigneeEmails.filter((email) => !currentEmails.has(email));

  if (toRemove.length) {
    await exec(
      `update task_assignees
          set removed_at = $1, removed_by = $2
        where id = any($3::uuid[])`,
      [now, user.email, toRemove.map((a) => a.id)]
    );
    for (const a of toRemove) {
      await logActivity('task', taskId, 'assignee_removed', user.email, { assigneeId: a.assignee_email });
    }
    await notifyMany(
      toRemove.map((a) => a.assignee_email),
      user.email,
      'unassigned',
      taskId,
      { title: fields.title }
    );
  }
  if (toAdd.length) {
    await exec(
      `insert into task_assignees (task_id, assignee_email, added_at, added_by)
       select $1::uuid, email, $3::timestamptz, $4::text
       from unnest($2::text[]) as email`,
      [taskId, toAdd, now, user.email]
    );
    for (const assigneeId of toAdd) {
      await logActivity('task', taskId, 'assignee_added', user.email, { assigneeId });
    }
    await notifyMany(toAdd, user.email, 'assigned', taskId, { title: fields.title });
  }

  const currentLabels = await rows<{ label_id: string }>(
    `select label_id from task_labels where task_id = $1`,
    [taskId]
  );
  const currentLabelIds = new Set(currentLabels.map((l) => l.label_id));
  const newLabelIds = new Set(labelIds);
  const labelsToRemove = [...currentLabelIds].filter((id) => !newLabelIds.has(id));
  const labelsToAdd = labelIds.filter((id) => !currentLabelIds.has(id));

  if (labelsToRemove.length) {
    await exec(
      `delete from task_labels where task_id = $1 and label_id = any($2::uuid[])`,
      [taskId, labelsToRemove]
    );
  }
  if (labelsToAdd.length) {
    await exec(
      `insert into task_labels (task_id, label_id, added_by)
       select $1::uuid, label_id, $3::text
       from unnest($2::uuid[]) as label_id`,
      [taskId, labelsToAdd, user.email]
    );
  }

  revalidatePath('/dashboard');
  redirect('/dashboard');
}

export async function deleteTask(taskId: string) {
  const { user } = await requireAuth();

  if (!(await canEditTask(taskId, user.email))) return;

  await exec(
    `update tasks set deleted_at = $1, updated_by = $2 where id = $3`,
    [new Date().toISOString(), user.email, taskId]
  );
  await logActivity('task', taskId, 'deleted', user.email);
  revalidatePath('/dashboard');
  revalidatePath('/archive');
}

// lateReason нужен только при завершении просроченной задачи: закрыть её
// молча нельзя ни отсюда, ни прямым запросом — в базе стоит триггер.
export async function setStatus(
  taskId: string,
  newStatus: TaskStatus,
  lateReason?: string
): Promise<{ error?: string }> {
  const { user, dict } = await requireAuth();

  if (!(await canEditTask(taskId, user.email))) {
    return { error: dict.taskCard.notAllowed };
  }

  if (!isWithinWorkHours()) {
    return { error: dict.taskCard.outsideWorkHours };
  }

  const task = await row<{ status: TaskStatus; started_at: string | null; deadline: string | null }>(
    `select status, started_at, deadline from tasks where id = $1`,
    [taskId]
  );

  if (!task) return {};

  if (task.status !== newStatus && (newStatus === 'waiting' || newStatus === 'in_progress' || newStatus === 'paused')) {
    const limitRow = await row<{ limit_count: number | null }>(
      `select limit_count from wip_limits where status = $1`,
      [newStatus]
    );
    if (limitRow?.limit_count !== null && limitRow?.limit_count !== undefined) {
      const counted = await row<{ n: number }>(
        `select count(*)::int as n from tasks where status = $1 and deleted_at is null`,
        [newStatus]
      );
      if ((counted?.n ?? 0) >= limitRow.limit_count) {
        return { error: dict.wipLimits.errors.limitReached };
      }
    }
  }

  const now = new Date().toISOString();

  // Срок истекает в 16:00 по Мюнхену в свою дату. Считаем той же функцией,
  // что рисует бейдж опоздания, чтобы правило было одно на всё приложение.
  const reason = (lateReason ?? '').trim();
  const lateBy =
    newStatus === 'done'
      ? completedLateBy({ deadline: task.deadline, completed_at: now } as Task)
      : null;
  if (lateBy !== null && !reason) {
    return { error: dict.taskCard.lateReasonRequired };
  }

  // Открыть паузу при уходе в paused; закрыть открытую — при возврате в работу
  // и при завершении. started_at ставится только если его ещё не было,
  // completed_at — только при переходе в done.
  const opensPause = task.status === 'in_progress' && newStatus === 'paused';
  const closesPause = (task.status === 'paused' && newStatus === 'in_progress') || newStatus === 'done';
  const startsNow = (newStatus === 'in_progress' || newStatus === 'done') && !task.started_at;
  const completesNow = newStatus === 'done';

  // Смена статуса и работа с паузой обязаны произойти вместе: наполовину
  // применённый переход ломает весь учёт времени по задаче. Если сработал
  // триггер базы, возвращаем фразу из словаря, а не роняем действие в 500.
  const guardError = await tx(async (client) => {
    if (opensPause) {
      await client.query(
        `insert into task_pauses (task_id, paused_at, resumed_at, auto, created_by)
         values ($1, $2, null, false, $3)`,
        [taskId, now, user.email]
      );
    }

    if (closesPause) {
      await client.query(
        `update task_pauses
            set resumed_at = $1
          where id = (
            select id from task_pauses
             where task_id = $2 and resumed_at is null
             order by paused_at desc
             limit 1
          )`,
        [now, taskId]
      );
    }

    await client.query(
      `update tasks
          set status = $1,
              updated_by = $2,
              started_at = coalesce(started_at, $3::timestamptz),
              completed_at = coalesce($4::timestamptz, completed_at),
              late_reason = coalesce($6, late_reason)
        where id = $5`,
      [newStatus, user.email, startsNow ? now : null, completesNow ? now : null, taskId,
       reason || null]
    );
  }).then(
    () => null,
    (e: unknown) => guardMessage(e, dict)
  );

  if (guardError) return { error: guardError };

  await logActivity('task', taskId, 'status_changed', user.email, {
    from: task.status,
    to: newStatus,
  });

  revalidatePath('/dashboard');
  if (newStatus === 'done') revalidatePath('/archive');
  return {};
}
