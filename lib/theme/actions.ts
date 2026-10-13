'use server';

import { revalidatePath } from 'next/cache';
import { exec } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/auth/current-user';
import type { Theme } from '@/lib/theme/theme';

export async function setTheme(theme: Theme) {
  if (theme !== 'light' && theme !== 'dark') return;

  const { email } = await getCurrentUser();
  await exec(`update people set theme = $1 where email = $2`, [theme, email]);

  // data-theme стоит на <html> из корневого layout — перерисовывать нужно
  // всё дерево.
  revalidatePath('/', 'layout');
}
