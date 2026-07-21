'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { isLocale } from '@/lib/i18n/config';
import { LOCALE_COOKIE } from '@/lib/i18n/cookie';

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase.from('profiles').update({ locale }).eq('id', user.id);
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365 });

  revalidatePath('/dashboard', 'layout');
}
