'use server';

import { createClient } from '@/lib/supabase/server';
import type { ActivityEntityType, ActivityLog } from '@/lib/supabase/types';

// Chteniye zhurnala po zaprosu (slaid-bar zagruzhayet yego tol'ko pri otkrytii,
// a ne zaranee dlya vsekh zadach/proektov na stranitse) — otdel'no ot
// logActivity (zapis'), kotoraya vyzyvayetsya iz drugikh server actions.
export async function getActivityLog(
  entityType: ActivityEntityType,
  entityId: string
): Promise<ActivityLog[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('activity_log')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });

  return data ?? [];
}
