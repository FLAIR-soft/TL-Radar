import type { Locale } from '@/lib/supabase/types';

export const locales: Locale[] = ['de', 'ru', 'el', 'en'];
export const defaultLocale: Locale = 'de';

export const localeNames: Record<Locale, string> = {
  de: 'DE',
  ru: 'RU',
  el: 'EL',
  en: 'EN',
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as string[]).includes(value);
}
