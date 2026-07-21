'use client';

import { useTransition } from 'react';
import type { Theme } from '@/lib/theme/cookie';
import { setTheme } from '@/lib/theme/actions';

export function ThemeToggle({ theme }: { theme: Theme }) {
  const [isPending, startTransition] = useTransition();
  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      className="theme-toggle"
      disabled={isPending}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => startTransition(() => setTheme(next))}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
