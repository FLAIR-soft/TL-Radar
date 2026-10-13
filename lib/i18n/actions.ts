'use server';

import { revalidatePath } from 'next/cache';
import { exec } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/auth/current-user';
import { isLocale } from '@/lib/i18n/config';

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;

  const { email } = await getCurrentUser();
  await exec(`update people set locale = $1 where email = $2`, [locale, email]);

  // Словарь выбирается на сервере, поэтому перерисовать нужно всё дерево,
  // а не только страницу.
  revalidatePath('/', 'layout');
}
