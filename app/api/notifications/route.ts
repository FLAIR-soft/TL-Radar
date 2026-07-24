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

  // get_my_notifications() (0031) otdayot notifications + task title/status
  // odnim zaprosom cherez server-side LEFT JOIN — u task_id namerenno net FK
  // (0020, polimorfnaya ssylka), poetomu obychnyy PostgREST-embed zdes' ne
  // vyrazim. count i polnyy spisok nezavisimy drug ot druga — odna volna
  // cherez Promise.all vmesto posledovatel'nykh await.
  const [{ count }, { data: rows }] = await Promise.all([
    supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', user.id).is('read_at', null),
    full ? supabase.rpc('get_my_notifications', { p_limit: LIST_LIMIT }) : Promise.resolve({ data: null }),
  ]);

  const items: NotificationView[] = (rows ?? []).map((n) => ({
    id: n.id,
    recipient_id: n.recipient_id,
    type: n.type,
    task_id: n.task_id,
    payload: n.payload,
    read_at: n.read_at,
    created_at: n.created_at,
    taskTitle: n.task_title,
    taskStatus: n.task_status,
  }));

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
