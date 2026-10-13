import { exec } from '@/lib/db/client';
import type { Notification, NotificationType, TaskStatus } from '@/lib/db/types';

/**
 * Уведомление вместе с названием и статусом задачи — ровно то, что показывает
 * колокольчик. Раньше этот вид отдавала функция get_my_notifications (0031),
 * и тип жил рядом с остальными типами Supabase. Функция опиралась на
 * auth.uid() и в новую базу не переехала, поэтому тип стоит здесь, рядом с
 * остальной логикой уведомлений; сам левый джойн к tasks теперь написан
 * обычным SQL в app/api/notifications.
 */
export type NotificationView = Notification & {
  taskTitle: string | null;
  taskStatus: TaskStatus | null;
};

// Запись уведомлений нескольким получателям сразу, исключая автора действия
// (назначившего, написавшего комментарий и т.п.) — по образцу logActivity,
// ошибки вставки не должны ломать основное действие.
//
// Раньше ошибку глотал сам клиент Supabase: он возвращал её значением, а
// вызывающий код его не проверял. Драйвер pg вместо этого бросает исключение,
// поэтому глотание стало явным — иначе упавшая вставка уведомления отменяла
// бы уже выполненное назначение или комментарий.
export async function notifyMany(
  recipientEmails: string[],
  actorEmail: string | null,
  type: NotificationType,
  taskId: string,
  payload?: Record<string, unknown>
): Promise<void> {
  const targets = [...new Set(recipientEmails)].filter((email) => email !== actorEmail);
  if (!targets.length) return;

  try {
    await exec(
      `insert into notifications (recipient_email, type, task_id, payload)
       select r.email, $2::text, $3::uuid, $4::jsonb
       from unnest($1::text[]) as r(email)`,
      [targets, type, taskId, payload ?? null]
    );
  } catch (e) {
    console.error('notifyMany: уведомления не записаны', e);
  }
}
