import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Obychnyy Route Handler, a ne Server Action — po obraztsu app/api/notifications:
// TaskDetailPanel uzhe vyzyvayet neskol'ko 'use server' funktsiy odnovremenno
// pri otkrytii (logs/comments/checklist), i dobavleniye k nim eshcho odnogo
// Server Action zdes' vyzyvalo redkuyu, no real'nuyu gonku — otvet etogo
// deystviya inogda prikhodil posle createTemplateFromTask i otkatyval
// router-keshi /templates nazad k ustarevshemu sostoyaniyu (revalidatePath
// slovno "ne srabatyval"). Plain fetch() polnost'yu nezavisim ot etoy
// RSC/router-mekhaniki Server Actions.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ watching: false });

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');
  if (!taskId) return NextResponse.json({ watching: false });

  const { data } = await supabase
    .from('task_watchers')
    .select('task_id')
    .eq('task_id', taskId)
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json({ watching: !!data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ watching: false }, { status: 401 });

  const body = await request.json();
  const taskId = String(body.taskId || '');
  if (!taskId) return NextResponse.json({ watching: false }, { status: 400 });

  const { data: existing } = await supabase
    .from('task_watchers')
    .select('task_id')
    .eq('task_id', taskId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from('task_watchers').delete().eq('task_id', taskId).eq('user_id', user.id);
    return NextResponse.json({ watching: false });
  }

  await supabase.from('task_watchers').insert({ task_id: taskId, user_id: user.id });
  return NextResponse.json({ watching: true });
}
