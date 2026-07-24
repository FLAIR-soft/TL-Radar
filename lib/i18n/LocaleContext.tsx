'use client';

import { createContext, useContext } from 'react';
import type { Locale } from '@/lib/supabase/types';
import type { Dictionary } from './get-dictionary';

const LocaleContext = createContext<{ locale: Locale; dict: Dictionary } | null>(null);

export function LocaleProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={{ locale, dict }}>{children}</LocaleContext.Provider>;
}

export function useDictionary(): Dictionary {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useDictionary must be used within a LocaleProvider');
  return ctx.dict;
}

export function useLocale(): Locale {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider');
  return ctx.locale;
}
