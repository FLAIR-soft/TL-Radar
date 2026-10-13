'use client';

import { useOptimistic, useTransition } from 'react';
import { Sun, Moon } from 'lucide-react';
import type { Theme } from '@/lib/theme/theme';
import { setTheme } from '@/lib/theme/actions';

export function ThemeToggle({ theme }: { theme: Theme }) {
  const [isPending, startTransition] = useTransition();
  // Тема приходит с сервера, но переключаться должна мгновенно: запись в базу
  // и перерисовка дерева занимают сотни миллисекунд, и всё это время кнопка
  // показывала бы старое состояние. useOptimistic сам вернётся к серверному
  // значению, когда переход закончится, — отдельного состояния не нужно.
  const [current, showTheme] = useOptimistic<Theme>(theme);

  function toggle() {
    const next: Theme = current === 'dark' ? 'light' : 'dark';
    // Атрибут на <html> меняем сами — стили переключаются в том же кадре.
    document.documentElement.dataset.theme = next;
    startTransition(() => {
      showTheme(next);
      return setTheme(next);
    });
  }

  const label = current === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={label}
      aria-busy={isPending}
      title={label}
      onClick={toggle}
    >
      {current === 'dark' ? <Sun size={17} strokeWidth={1.75} /> : <Moon size={17} strokeWidth={1.75} />}
    </button>
  );
}
