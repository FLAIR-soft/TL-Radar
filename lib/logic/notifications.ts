import type { createClient } from '@/lib/supabase/server';
import type { NotificationType } from '@/lib/supabase/types';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Zapis' uvedomleniy neskol'kim poluchatelyam srazu, isklyuchaya avtora
// deystviya (naznachivshego/napisavshego kommentariy i t.p.) — po obraztsu
// logActivity, oshibki insert ne dolzhny lomat' osnovnoye deystviye.
export async function notifyMany(
  supabase: SupabaseServerClient,
  recipientIds: string[],
  actorId: string | null,
  type: NotificationType,
  taskId: string,
  payload?: Record<string, unknown>
): Promise<void> {
  const targets = [...new Set(recipientIds)].filter((id) => id !== actorId);
  if (!targets.length) return;

  await supabase.from('notifications').insert(
    targets.map((recipient_id) => ({
      recipient_id,
      type,
      task_id: taskId,
      payload: payload ?? null,
    }))
  );
}
