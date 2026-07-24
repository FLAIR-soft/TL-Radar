'use client';

import { useTransition } from 'react';
import { Sun, Moon } from 'lucide-react';
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
      {theme === 'dark' ? <Sun size={17} strokeWidth={1.75} /> : <Moon size={17} strokeWidth={1.75} />}
    </button>
  );
}
