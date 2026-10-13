'use server';

import { revalidatePath } from 'next/cache';
import { exec, row, rows, tx } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canEditTask, canEditChecklistItem } from '@/lib/auth/task-access';
import { getLocale } from '@/lib/i18n/locale';
import { getDictionary } from '@/lib/i18n/get-dictionary';

// Чек-лист — часть содержимого задачи, поэтому правило то же: менять может
// назначенный или создатель. Проверка на сервере, не только в интерфейсе.
async function denied() {
  const dict = getDictionary(await getLocale());
  return { error: dict.taskCard.notAllowed };
}

import { logActivity } from '@/lib/logic/activity-log';
import type { TaskChecklistItem } from '@/lib/db/types';

// Прежняя проверка «есть ли пользователь» была проверкой сессии Supabase:
// за шлюзом MIDAS неаутентифицированный посетитель сюда не доходит, а
// getCurrentUser() бросает исключение, если заголовка с почтой нет. Поэтому
// ветки «не вошёл → errors.unauthorized» больше нет. Язык — из куки.
async function requireAuth() {
  const user = await getCurrentUser();
  const dict = getDictionary(await getLocale());
  return { user, dict };
}

// Zapros po trebovaniyu (slaid-bar zagruzhayet tol'ko pri otkrytii) — tak zhe
// kak getTaskComments/getActivityLog.
export async function getChecklistItems(taskId: string): Promise<TaskChecklistItem[]> {
  await getCurrentUser();

  return rows<TaskChecklistItem>(
    `select * from task_checklist_items
      where task_id = $1 and deleted_at is null
      order by position`,
    [taskId]
  );
}

export async function addChecklistItem(taskId: string, formData: FormData): Promise<{ error?: string }> {
  const { user, dict } = await requireAuth();

  if (!(await canEditTask(taskId, user.email))) {
    return { error: dict.taskCard.notAllowed };
  }

  const title = String(formData.get('title') || '').trim();
  if (!title) {
    return { error: dict.checklist.errors.empty };
  }

  // Позиция — следующая за максимальной (удалённые пункты тоже учитываются,
  // как и раньше): считается тем же запросом, что и вставка.
  let item: { id: string } | null;
  try {
    item = await row<{ id: string }>(
      `insert into task_checklist_items (task_id, title, position)
       values ($1, $2, coalesce(
         (select max(position) from task_checklist_items where task_id = $1), -1) + 1)
       returning id`,
      [taskId, title]
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : dict.checklist.errors.empty };
  }

  if (!item) {
    return { error: dict.checklist.errors.empty };
  }

  await logActivity('task', taskId, 'checklist_item_added', user.email, { title });

  revalidatePath('/dashboard');
  revalidatePath('/archive');
  return {};
}

// Otmetka done ne menyayet status zadachi i ne trogayet uchyot vremeni —
// eto prosto update polya done, nikakoy dopolnitel'noy logiki.
export async function toggleChecklistItem(id: string, done: boolean): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!(await canEditChecklistItem(id, user.email))) return denied();

  await exec(`update task_checklist_items set done = $1 where id = $2`, [done, id]);

  revalidatePath('/dashboard');
  revalidatePath('/archive');
  return {};
}

export async function deleteChecklistItem(id: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!(await canEditChecklistItem(id, user.email))) return denied();

  await exec(
    `update task_checklist_items set deleted_at = $1 where id = $2`,
    [new Date().toISOString(), id]
  );

  revalidatePath('/dashboard');
  revalidatePath('/archive');
  return {};
}

// Pereupryadochivaniye strelkami (bez DnD, po roadmapu): menyayem position
// mestami s sosedom v nuzhnuyu storonu.
export async function moveChecklistItem(taskId: string, id: string, direction: 'up' | 'down'): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!(await canEditTask(taskId, user.email))) return denied();

  const items = await rows<{ id: string; position: number }>(
    `select id, position from task_checklist_items
      where task_id = $1 and deleted_at is null
      order by position`,
    [taskId]
  );

  const index = items.findIndex((i) => i.id === id);
  const neighborIndex = direction === 'up' ? index - 1 : index + 1;
  if (index === -1 || neighborIndex < 0 || neighborIndex >= items.length) return {};

  const current = items[index];
  const neighbor = items[neighborIndex];

  // Обе половины обмена — одной транзакцией: иначе при сбое между ними два
  // пункта получат одинаковую позицию.
  await tx(async (client) => {
    await client.query(`update task_checklist_items set position = $1 where id = $2`, [
      neighbor.position,
      current.id,
    ]);
    await client.query(`update task_checklist_items set position = $1 where id = $2`, [
      current.position,
      neighbor.id,
    ]);
  });

  revalidatePath('/dashboard');
  revalidatePath('/archive');
  return {};
}
