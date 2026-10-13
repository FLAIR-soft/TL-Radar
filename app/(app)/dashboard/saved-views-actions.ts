'use server';

import { revalidatePath } from 'next/cache';
import { exec } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getLocale } from '@/lib/i18n/locale';
import { getDictionary } from '@/lib/i18n/get-dictionary';

// Прежний redirect('/login') убран: за шлюзом MIDAS неаутентифицированный
// посетитель сюда не доходит, а getCurrentUser() бросает исключение, если
// заголовка с почтой нет. Язык берётся из куки, а не из профиля.
async function requireAuth() {
  const user = await getCurrentUser();
  const dict = getDictionary(await getLocale());
  return { user, dict };
}

// Sokhranyayem tselikom stroku zaprosa dashboard'a (filtry + rezhim
// otobrazheniya) — pri primenenii predstavleniya prosto perekhodim na
// /dashboard?<qs>, bez otdel'nogo razbora kazhdogo parametra.
export async function saveView(name: string, qs: string): Promise<{ error?: string }> {
  const { user, dict } = await requireAuth();
  const trimmed = name.trim();
  if (!trimmed) return { error: dict.savedViews.errors.missingName };

  try {
    await exec(
      `insert into saved_views (email, name, filters) values ($1, $2, $3::jsonb)`,
      [user.email, trimmed, JSON.stringify({ qs })]
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : dict.savedViews.errors.missingName };
  }

  revalidatePath('/dashboard');
  return {};
}

export async function deleteSavedView(id: string): Promise<void> {
  const { user } = await requireAuth();
  // Раньше «только свои представления» держала политика RLS; её больше нет,
  // поэтому владелец проверяется прямо в условии запроса.
  await exec(
    `update saved_views set deleted_at = $1 where id = $2 and email = $3`,
    [new Date().toISOString(), id, user.email]
  );
  revalidatePath('/dashboard');
}
