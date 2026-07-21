'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { THEME_COOKIE, type Theme } from '@/lib/theme/cookie';

export async function setTheme(theme: Theme) {
  if (theme !== 'light' && theme !== 'dark') return;

  const cookieStore = await cookies();
  cookieStore.set(THEME_COOKIE, theme, { path: '/', maxAge: 60 * 60 * 24 * 365 });

  revalidatePath('/', 'layout');
  revalidatePath('/login', 'layout');
  revalidatePath('/dashboard', 'layout');
}
