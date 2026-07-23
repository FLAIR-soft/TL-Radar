import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { NotificationView } from '@/lib/supabase/types';

const LIST_LIMIT = 30;

// Obychnyy Route Handler, a ne Server Action: bell opraivaet count kazhdyye
// 30 sekund fonovo, i eto ne dolzhno peresekat'sya s router/RSC-mekhanikoy
// Server Actions (naprimer, revalidatePath drugogo deystviya v etot moment) —
// obychnyy fetch() polnost'yu nezavisim ot etogo, v otlichiye ot vyzova
// 'use server' funktsii pryamo iz klientskogo komponenta.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ count: 0, items: [] });

  const { searchParams } = new URL(request.url);
  const full = searchParams.get('full') === '1';

  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', user.id)
    .is('read_at', null);

  if (!full) {
    return NextResponse.json({ count: count ?? 0, items: [] });
  }

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', user.id)
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT);

  let items: NotificationView[] = [];
  if (notifications?.length) {
    const taskIds = [...new Set(notifications.map((n) => n.task_id))];
    const { data: tasks } = await supabase.from('tasks').select('id, title, status').in('id', taskIds);
    const taskById = new Map((tasks ?? []).map((t) => [t.id, t]));
    items = notifications.map((n) => ({
      ...n,
      taskTitle: taskById.get(n.task_id)?.title ?? null,
      taskStatus: taskById.get(n.task_id)?.status ?? null,
    }));
  }

  return NextResponse.json({ count: count ?? 0, items });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await request.json();
  const now = new Date().toISOString();

  if (body.action === 'markRead' && typeof body.id === 'string') {
    await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('id', body.id)
      .eq('recipient_id', user.id)
      .is('read_at', null);
  } else if (body.action === 'markAll') {
    await supabase.from('notifications').update({ read_at: now }).eq('recipient_id', user.id).is('read_at', null);
  }

  return NextResponse.json({ ok: true });
}
