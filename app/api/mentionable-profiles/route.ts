import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Obychnyy Route Handler, a ne Server Action — po tem zhe prichinam, chto i
// app/api/watch: CommentList uzhe smontirovan vnutri TaskDetailPanel, gde
// odnovremenno idut neskol'ko drugikh 'use server' vyzovov (logs/checklist),
// i eshcho odin Server Action zdes' uvelichival shans na tu zhe gonku s
// revalidatePath drugogo deystviya (naprimer, createTemplateFromTask).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ profiles: [] });

  const { data } = await supabase.from('profiles').select('id, name, username').order('name');
  return NextResponse.json({ profiles: data ?? [] });
}
