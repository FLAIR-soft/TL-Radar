import type { createClient } from '@/lib/supabase/server';
import type { ActivityEntityType, ActivityEventType } from '@/lib/supabase/types';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Zapis' odnogo sobytiya v zhurnal (Etap 3: tol'ko zapis', UI dobavitsya
// otdel'no). Oshibki insert ne dolzhny lomat' osnovnoye deystviye (sozdaniye/
// izmeneniye zadachi ili proekta) — poetomu oshibka zdes' prosto proglatyvaetsya.
export async function logActivity(
  supabase: SupabaseServerClient,
  entityType: ActivityEntityType,
  entityId: string,
  eventType: ActivityEventType,
  actorId: string | null,
  detail?: Record<string, unknown>
): Promise<void> {
  await supabase.from('activity_log').insert({
    entity_type: entityType,
    entity_id: entityId,
    event_type: eventType,
    actor_id: actorId,
    detail: detail ?? null,
  });
}
