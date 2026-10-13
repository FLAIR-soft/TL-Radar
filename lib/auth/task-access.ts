import { row } from '@/lib/db/client';

/**
 * Право менять задачу: её создатель и те, кто сейчас назначен исполнителем.
 *
 * Отдельного флага «может редактировать» нет намеренно — не хочешь, чтобы
 * человек менял задачу, не добавляй его исполнителем. Снятый исполнитель
 * (removed_at заполнен) право теряет, но остаётся в истории для учёта времени.
 */
export async function canEditTask(taskId: string, email: string): Promise<boolean> {
  const r = await row<{ ok: boolean }>(
    `select exists (
       select 1 from tasks t
        where t.id = $1
          and t.deleted_at is null
          and (
            t.created_by = $2
            or exists (
              select 1 from task_assignees a
               where a.task_id = t.id
                 and a.assignee_email = $2
                 and a.removed_at is null
            )
          )
     ) as ok`,
    [taskId, email]
  );
  return r?.ok ?? false;
}

/** То же самое, но задача определяется по пункту чек-листа. */
export async function canEditChecklistItem(itemId: string, email: string): Promise<boolean> {
  const r = await row<{ task_id: string }>(
    `select task_id from task_checklist_items where id = $1`,
    [itemId]
  );
  if (!r) return false;
  return canEditTask(r.task_id, email);
}
