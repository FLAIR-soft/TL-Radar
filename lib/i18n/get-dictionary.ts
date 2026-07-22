import type { Locale } from '@/lib/supabase/types';
import type { Dictionary } from './dictionaries/ru';
import ru from './dictionaries/ru';
import de from './dictionaries/de';
import en from './dictionaries/en';

const dictionaries: Record<Locale, Dictionary> = { ru, de, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
