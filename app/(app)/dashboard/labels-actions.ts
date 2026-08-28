'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { LABEL_COLORS } from '@/lib/logic/label-colors';
import type { Label } from '@/lib/supabase/types';

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('locale').eq('id', user.id).single();
  const dict = getDictionary(profile?.locale ?? 'de');

  return { supabase, userId: user.id, dict };
}

export async function getLabels(): Promise<Label[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('labels').select('*').is('deleted_at', null).order('name');
  return data ?? [];
}

export async function createLabel(name: string, color: string): Promise<{ error?: string; label?: Label }> {
  const auth = await requireAuth();
  if (!auth) return { error: getDictionary('de').labels.errors.unauthorized };
  const { supabase, userId, dict } = auth;

  const trimmed = name.trim();
  if (!trimmed) return { error: dict.labels.errors.missingName };
  if (!(LABEL_COLORS as readonly string[]).includes(color)) return { error: dict.labels.errors.missingName };

  const { data, error } = await supabase
    .from('labels')
    .insert({ name: trimmed, color, created_by: userId })
    .select('*')
    .single();

  if (error || !data) return { error: error?.message ?? dict.labels.errors.missingName };

  revalidatePath('/dashboard');
  revalidatePath('/archive');
  return { label: data };
}
