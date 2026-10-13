'use server';

import { revalidatePath } from 'next/cache';
import { exec, row, rows } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getLocaleCookie } from '@/lib/i18n/cookie';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import type { Task } from '@/lib/db/types';

// Проверять вход здесь больше нечего: за шлюзом MIDAS неаутентифицированный
// посетитель до приложения не доходит, а getCurrentUser() бросает исключение,
// если заголовка с почтой нет. Язык берётся из куки, а не из профиля.
async function requireAuth() {
  const user = await getCurrentUser();
  const dict = getDictionary(await getLocaleCookie());
  return { user, dict };
}

type TemplateSource = Pick<
  Task,
  'title' | 'description' | 'location' | 'estimated_minutes' | 'priority' | 'icon' | 'project_id'
>;

// Shablony (Etap 7) sozdayutsya tol'ko iz sushchestvuyushchey zadachi — sam
// shablon posle sozdaniya izmenit' nel'zya (tol'ko spisok + myagkoye
// udaleniye), po roadmapu.
export async function createTemplateFromTask(taskId: string): Promise<{ error?: string }> {
  const { user, dict } = await requireAuth();

  const task = await row<TemplateSource>(
    `select title, description, location, estimated_minutes, priority, icon, project_id
       from tasks
      where id = $1`,
    [taskId]
  );

  if (!task) return { error: dict.templates.errors.taskNotFound };

  const checklistItems = await rows<{ title: string }>(
    `select title
       from task_checklist_items
      where task_id = $1 and deleted_at is null
      order by position`,
    [taskId]
  );

  const checklist = checklistItems.map((i) => i.title);

  // checklist — теперь text[], а не jsonb: драйвер pg принимает обычный
  // массив строк и сам превращает его в массив Postgres.
  try {
    await exec(
      `insert into task_templates
         (title, description, location, estimated_minutes, priority, icon, project_id, checklist, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        task.title,
        task.description || null,
        task.location || null,
        task.estimated_minutes,
        task.priority,
        task.icon,
        task.project_id,
        checklist.length ? checklist : null,
        user.email,
      ]
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : dict.templates.errors.missingTitle };
  }

  revalidatePath('/templates');
  return {};
}

// Сохранение шаблона прямо из формы «Neue Aufgabe» (скрин 07): задачи ещё
// нет, поэтому поля берутся из самой формы. Те же имена полей, что и у
// создания задачи, — форма одна.
export async function createTemplateFromFields(formData: FormData): Promise<{ error?: string }> {
  const { user, dict } = await requireAuth();

  const title = String(formData.get('title') ?? '').trim();
  if (!title) return { error: dict.templates.errors.missingTitle };

  const estimatedRaw = String(formData.get('estimatedMinutes') ?? '').trim();
  const estimated = estimatedRaw ? Number(estimatedRaw) : null;

  const priorityRaw = String(formData.get('priority') ?? '');
  const priority = (['low', 'medium', 'high', 'urgent'] as const).find((p) => p === priorityRaw) ?? null;

  try {
    await exec(
      `insert into task_templates
         (title, description, location, estimated_minutes, priority, icon, project_id, checklist, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        title,
        String(formData.get('description') ?? '').trim() || null,
        String(formData.get('location') ?? '').trim() || null,
        estimated !== null && Number.isFinite(estimated) && estimated > 0 ? estimated : null,
        priority,
        String(formData.get('icon') ?? '') || null,
        String(formData.get('projectId') ?? '') || null,
        null,
        user.email,
      ]
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : dict.templates.errors.missingTitle };
  }

  revalidatePath('/templates');
  return {};
}

export async function deleteTemplate(id: string): Promise<void> {
  await getCurrentUser();

  await exec(`update task_templates set deleted_at = now() where id = $1`, [id]);

  revalidatePath('/templates');
}
