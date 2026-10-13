'use server';

import { rows } from '@/lib/db/client';
import type { ActivityEntityType, ActivityLog } from '@/lib/db/types';

// Чтение журнала по запросу (слайд-панель загружает его только при открытии,
// а не заранее для всех задач/проектов на странице) — отдельно от logActivity
// (запись), которая вызывается из других server actions.
//
// Прежняя проверка «есть ли пользователь» была проверкой сессии Supabase, а не
// правом на эти строки: журнал не делится по людям, его видели все вошедшие.
// За шлюзом MIDAS неаутентифицированный посетитель сюда не доходит, поэтому
// отдельной проверки не осталось.
export async function getActivityLog(
  entityType: ActivityEntityType,
  entityId: string
): Promise<ActivityLog[]> {
  return rows<ActivityLog>(
    `select * from activity_log
     where entity_type = $1::text and entity_id = $2::uuid
     order by created_at desc`,
    [entityType, entityId]
  );
}
