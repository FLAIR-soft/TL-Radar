import { exec } from '@/lib/db/client';
import type { ActivityEntityType, ActivityEventType } from '@/lib/db/types';

// Запись одного события в журнал. Ошибки вставки не должны ломать основное
// действие (создание/изменение задачи или проекта) — поэтому ошибка здесь
// просто проглатывается.
//
// При Supabase это выходило само собой: клиент возвращал ошибку значением, а
// вызывающий код его не проверял. Драйвер pg бросает исключение, так что
// глотание пришлось выписать явно — смысл прежний.
export async function logActivity(
  entityType: ActivityEntityType,
  entityId: string,
  eventType: ActivityEventType,
  actorEmail: string | null,
  detail?: Record<string, unknown>
): Promise<void> {
  try {
    await exec(
      `insert into activity_log (entity_type, entity_id, event_type, actor, detail)
       values ($1::text, $2::uuid, $3::text, $4::text, $5::jsonb)`,
      [entityType, entityId, eventType, actorEmail, detail ?? null]
    );
  } catch (e) {
    console.error('logActivity: событие не записано', e);
  }
}
