import type { Locale } from '@/lib/supabase/types';
import type { Dictionary } from './dictionaries/ru';
import ru from './dictionaries/ru';
import de from './dictionaries/de';
import el from './dictionaries/el';

const dictionaries: Record<Locale, Dictionary> = { ru, de, el };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
