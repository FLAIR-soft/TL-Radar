'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/get-dictionary';

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('locale').eq('id', user.id).single();
  const dict = getDictionary(profile?.locale ?? 'de');

  return { supabase, userId: user.id, dict };
}

// Sokhranyayem tselikom stroku zaprosa dashboard'a (filtry + rezhim
// otobrazheniya) — pri primenenii predstavleniya prosto perekhodim na
// /dashboard?<qs>, bez otdel'nogo razbora kazhdogo parametra.
export async function saveView(name: string, qs: string): Promise<{ error?: string }> {
  const { supabase, userId, dict } = await requireAuth();
  const trimmed = name.trim();
  if (!trimmed) return { error: dict.savedViews.errors.missingName };

  const { error } = await supabase.from('saved_views').insert({
    user_id: userId,
    name: trimmed,
    filters: { qs },
  });

  if (error) return { error: error.message };
  revalidatePath('/dashboard');
  return {};
}

export async function deleteSavedView(id: string): Promise<void> {
  const { supabase } = await requireAuth();
  await supabase.from('saved_views').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  revalidatePath('/dashboard');
}
