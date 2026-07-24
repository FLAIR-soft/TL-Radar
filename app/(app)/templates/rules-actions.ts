'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { computeNextRunAt } from '@/lib/logic/recurring';
import type { RecurringFrequency } from '@/lib/supabase/types';

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

const FREQUENCIES: RecurringFrequency[] = ['daily', 'weekly', 'monthly'];

export interface RecurringRuleFormState {
  error: string | null;
}

// Pravila (Etap 8) sozdayut zadachi tol'ko iz shablona (Etap 7) po
// raspisaniyu — uchityvayem tol'ko rabochiye dni, po soglasovaniyu s
// zakazchikom pered realizatsiyey.
export async function createRecurringRule(
  _prevState: RecurringRuleFormState,
  formData: FormData
): Promise<RecurringRuleFormState> {
  const { supabase, userId, dict } = await requireAuth();

  const templateId = String(formData.get('templateId') || '').trim();
  const frequencyRaw = String(formData.get('frequency') || '').trim();

  if (!templateId) return { error: dict.recurring.errors.missingTemplate };
  if (!(FREQUENCIES as string[]).includes(frequencyRaw)) return { error: dict.recurring.errors.missingFrequency };
  const frequency = frequencyRaw as RecurringFrequency;

  let weekday: number | null = null;
  let dayOfMonth: number | null = null;

  if (frequency === 'weekly') {
    weekday = Number(String(formData.get('weekday') || '').trim());
    if (!weekday || weekday < 1 || weekday > 5) return { error: dict.recurring.errors.missingWeekday };
  }
  if (frequency === 'monthly') {
    dayOfMonth = Number(String(formData.get('dayOfMonth') || '').trim());
    if (!dayOfMonth || dayOfMonth < 1 || dayOfMonth > 31) return { error: dict.recurring.errors.missingDayOfMonth };
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const nextRunAt = computeNextRunAt(frequency, weekday, dayOfMonth, todayKey);

  const { error } = await supabase.from('recurring_rules').insert({
    template_id: templateId,
    frequency,
    weekday,
    day_of_month: dayOfMonth,
    next_run_at: nextRunAt,
    active: true,
    created_by: userId,
  });

  if (error) return { error: error.message };

  revalidatePath('/templates');
  return { error: null };
}

export async function toggleRecurringRule(id: string, active: boolean): Promise<void> {
  const { supabase } = await requireAuth();
  await supabase.from('recurring_rules').update({ active }).eq('id', id);
  revalidatePath('/templates');
}

export async function deleteRecurringRule(id: string): Promise<void> {
  const { supabase } = await requireAuth();
  await supabase.from('recurring_rules').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  revalidatePath('/templates');
}
