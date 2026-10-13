'use server';

import { revalidatePath } from 'next/cache';
import { exec } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getLocaleCookie } from '@/lib/i18n/cookie';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { computeNextRunAt } from '@/lib/logic/recurring';
import type { RecurringFrequency } from '@/lib/db/types';

// Проверять вход здесь больше нечего: за шлюзом MIDAS неаутентифицированный
// посетитель до приложения не доходит, а getCurrentUser() бросает исключение,
// если заголовка с почтой нет. Язык берётся из куки, а не из профиля.
async function requireAuth() {
  const user = await getCurrentUser();
  const dict = getDictionary(await getLocaleCookie());
  return { user, dict };
}

const FREQUENCIES: RecurringFrequency[] = ['daily', 'weekly', 'monthly'];

export interface RecurringRuleFormState {
  error: string | null;
}

// Pravila (Etap 8) sozdayut zadachi tol'ko iz shablona (Etap 7) po
// raspisaniyu — uchityvayem tol'ko rabochiye dni, po soglasovaniyu s
// zakazchikom pered realizatsiyey. Ispolnitelya poka net: pg_cron ostalsya v
// Supabase, zapusk pravil poyavitsya na etape 8.
export async function createRecurringRule(
  _prevState: RecurringRuleFormState,
  formData: FormData
): Promise<RecurringRuleFormState> {
  const { user, dict } = await requireAuth();

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

  try {
    await exec(
      `insert into recurring_rules
         (template_id, frequency, weekday, day_of_month, next_run_at, active, created_by)
       values ($1, $2, $3, $4, $5, true, $6)`,
      [templateId, frequency, weekday, dayOfMonth, nextRunAt, user.email]
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : dict.recurring.errors.missingTemplate };
  }

  revalidatePath('/templates');
  return { error: null };
}

export async function toggleRecurringRule(id: string, active: boolean): Promise<void> {
  await getCurrentUser();
  await exec(`update recurring_rules set active = $2 where id = $1`, [id, active]);
  revalidatePath('/templates');
}

export async function deleteRecurringRule(id: string): Promise<void> {
  await getCurrentUser();
  await exec(`update recurring_rules set deleted_at = now() where id = $1`, [id]);
  revalidatePath('/templates');
}
