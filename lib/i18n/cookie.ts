import { cookies } from 'next/headers';
import { defaultLocale, isLocale } from './config';
import type { Locale } from '@/lib/supabase/types';

export const LOCALE_COOKIE = 'locale';

export async function getLocaleCookie(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
}
