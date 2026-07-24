'use client';

import { useTransition } from 'react';
import type { Locale } from '@/lib/supabase/types';
import { locales, localeNames } from '@/lib/i18n/config';
import { useLocale } from '@/lib/i18n/LocaleContext';
import { setLocale } from '@/lib/i18n/actions';

export function LanguageSwitcher() {
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="lang-switcher" aria-busy={isPending}>
      {locales.map((l: Locale) => (
        <button
          key={l}
          type="button"
          className={`lang-btn ${locale === l ? 'active' : ''}`}
          disabled={isPending}
          onClick={() => startTransition(() => setLocale(l))}
        >
          {localeNames[l]}
        </button>
      ))}
    </div>
  );
}
