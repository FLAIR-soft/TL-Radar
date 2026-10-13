'use server';

import { revalidatePath } from 'next/cache';
import { row, rows } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getLocale } from '@/lib/i18n/locale';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { LABEL_COLORS } from '@/lib/logic/label-colors';
import type { Label } from '@/lib/db/types';

// Ветки «не вошёл → errors.unauthorized» больше нет: за шлюзом MIDAS
// неаутентифицированный посетитель сюда не доходит, а getCurrentUser()
// бросает исключение, если заголовка с почтой нет. Язык — из куки.
async function requireAuth() {
  const user = await getCurrentUser();
  const dict = getDictionary(await getLocale());
  return { user, dict };
}

export async function getLabels(): Promise<Label[]> {
  return rows<Label>(`select * from labels where deleted_at is null order by name`);
}

export async function createLabel(name: string, color: string): Promise<{ error?: string; label?: Label }> {
  const { user, dict } = await requireAuth();

  const trimmed = name.trim();
  if (!trimmed) return { error: dict.labels.errors.missingName };
  if (!(LABEL_COLORS as readonly string[]).includes(color)) return { error: dict.labels.errors.missingName };

  let label: Label | null;
  try {
    label = await row<Label>(
      `insert into labels (name, color, created_by) values ($1, $2, $3) returning *`,
      [trimmed, color, user.email]
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : dict.labels.errors.missingName };
  }

  if (!label) return { error: dict.labels.errors.missingName };

  revalidatePath('/dashboard');
  revalidatePath('/archive');
  return { label };
}
