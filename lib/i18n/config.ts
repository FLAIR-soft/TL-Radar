import type { Locale } from '@/lib/supabase/types';

export const locales: Locale[] = ['de', 'en', 'ru'];
export const defaultLocale: Locale = 'de';

export const localeNames: Record<Locale, string> = {
  de: 'DE',
  en: 'EN',
  ru: 'RU',
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as string[]).includes(value);
}
