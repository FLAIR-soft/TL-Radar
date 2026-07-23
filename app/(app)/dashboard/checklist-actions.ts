'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { logActivity } from '@/lib/logic/activity-log';
import type { TaskChecklistItem } from '@/lib/supabase/types';

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

// Zapros po trebovaniyu (slaid-bar zagruzhayet tol'ko pri otkrytii) — tak zhe
// kak getTaskComments/getActivityLog.
export async function getChecklistItems(taskId: string): Promise<TaskChecklistItem[]> {
  const auth = await requireAuth();
  if (!auth) return [];

  const { data } = await auth.supabase
    .from('task_checklist_items')
    .select('*')
    .eq('task_id', taskId)
    .is('deleted_at', null)
    .order('position', { ascending: true });

  return data ?? [];
}

export async function addChecklistItem(taskId: string, formData: FormData): Promise<{ error?: string }> {
  const auth = await requireAuth();
  if (!auth) return { error: getDictionary('de').checklist.errors.unauthorized };
  const { supabase, userId, dict } = auth;

  const title = String(formData.get('title') || '').trim();
  if (!title) {
    return { error: dict.checklist.errors.empty };
  }

  const { data: last } = await supabase
    .from('task_checklist_items')
    .select('position')
    .eq('task_id', taskId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: item, error } = await supabase
    .from('task_checklist_items')
    .insert({ task_id: taskId, title, position: (last?.position ?? -1) + 1 })
    .select('id')
    .single();

  if (error || !item) {
    return { error: error?.message ?? dict.checklist.errors.empty };
  }

  await logActivity(supabase, 'task', taskId, 'checklist_item_added', userId, { title });

  revalidatePath('/dashboard');
  revalidatePath('/archive');
  return {};
}

// Otmetka done ne menyayet status zadachi i ne trogayet uchyot vremeni —
// eto prosto update polya done, nikakoy dopolnitel'noy logiki.
export async function toggleChecklistItem(id: string, done: boolean): Promise<{ error?: string }> {
  const auth = await requireAuth();
  if (!auth) return { error: getDictionary('de').checklist.errors.unauthorized };

  await auth.supabase.from('task_checklist_items').update({ done }).eq('id', id);

  revalidatePath('/dashboard');
  revalidatePath('/archive');
  return {};
}

export async function deleteChecklistItem(id: string): Promise<{ error?: string }> {
  const auth = await requireAuth();
  if (!auth) return { error: getDictionary('de').checklist.errors.unauthorized };

  await auth.supabase
    .from('task_checklist_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  revalidatePath('/dashboard');
  revalidatePath('/archive');
  return {};
}

// Pereupryadochivaniye strelkami (bez DnD, po roadmapu): menyayem position
// mestami s sosedom v nuzhnuyu storonu.
export async function moveChecklistItem(taskId: string, id: string, direction: 'up' | 'down'): Promise<{ error?: string }> {
  const auth = await requireAuth();
  if (!auth) return { error: getDictionary('de').checklist.errors.unauthorized };
  const { supabase } = auth;

  const { data: items } = await supabase
    .from('task_checklist_items')
    .select('id, position')
    .eq('task_id', taskId)
    .is('deleted_at', null)
    .order('position', { ascending: true });

  if (!items) return {};

  const index = items.findIndex((i) => i.id === id);
  const neighborIndex = direction === 'up' ? index - 1 : index + 1;
  if (index === -1 || neighborIndex < 0 || neighborIndex >= items.length) return {};

  const current = items[index];
  const neighbor = items[neighborIndex];

  await Promise.all([
    supabase.from('task_checklist_items').update({ position: neighbor.position }).eq('id', current.id),
    supabase.from('task_checklist_items').update({ position: current.position }).eq('id', neighbor.id),
  ]);

  revalidatePath('/dashboard');
  revalidatePath('/archive');
  return {};
}
