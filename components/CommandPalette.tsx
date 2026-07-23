'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, usePathname } from 'next/navigation';
import { Search } from 'lucide-react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { canViewStats } from '@/lib/logic/access';
import { quickCreateTask } from '@/app/(app)/dashboard/actions';
import type { UserRole } from '@/lib/supabase/types';

export function CommandPalette({ role }: { role: UserRole }) {
  const dict = useDictionary();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function close() {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  }

  function handleQuickAdd(title: string) {
    startTransition(() => {
      quickCreateTask(title).then((result) => {
        if (result?.error) {
          alert(result.error);
          return;
        }
        const shouldNavigate = pathname !== '/dashboard';
        close();
        if (shouldNavigate) router.push('/dashboard');
      });
    });
  }

  useEffect(() => {
    function onGlobalKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener('keydown', onGlobalKey);
    return () => document.removeEventListener('keydown', onGlobalKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  function handleQueryChange(value: string) {
    setQuery(value);
    setActiveIndex(0);
  }

  const navCommands = [
    { id: 'dashboard', label: dict.topbar.dashboard, href: '/dashboard' },
    { id: 'new-task', label: dict.topbar.newTask, href: '/dashboard/new' },
    { id: 'archive', label: dict.topbar.archive, href: '/archive' },
    { id: 'projects', label: dict.topbar.projects, href: '/projects' },
    { id: 'templates', label: dict.topbar.templates, href: '/templates' },
    ...(canViewStats(role) ? [{ id: 'analytics', label: dict.topbar.analytics, href: '/analytics' }] : []),
    ...(role === 'admin' ? [{ id: 'admin', label: dict.topbar.admin, href: '/admin' }] : []),
  ];

  const trimmedQuery = query.trim();
  const filteredNav = navCommands.filter((c) => c.label.toLowerCase().includes(trimmedQuery.toLowerCase()));

  // Navigation matches come first — Enter should jump to a page the user is
  // clearly typing towards, not silently create a task titled after it.
  // Quick-add only leads when nothing on the nav list matches the query.
  const items: { id: string; label: string; run: () => void }[] = [
    ...filteredNav.map((c) => ({
      id: c.id,
      label: c.label,
      run: () => {
        router.push(c.href);
        close();
      },
    })),
    ...(trimmedQuery
      ? [
          {
            id: 'quick-add',
            label: `${dict.commandPalette.addTaskPrefix}"${trimmedQuery}"`,
            run: () => handleQuickAdd(trimmedQuery),
          },
        ]
      : []),
  ];

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[activeIndex]?.run();
    }
  }

  return (
    <>
      <button
        type="button"
        className="icon-btn cmdk-trigger"
        title="Cmd/Ctrl+K"
        onClick={() => setOpen(true)}
        data-testid="command-palette-trigger"
      >
        <Search size={17} strokeWidth={1.75} />
      </button>
      {open &&
        createPortal(
          <div className="cmdk-backdrop" onClick={close}>
            <div className="cmdk-panel" onClick={(e) => e.stopPropagation()} data-testid="command-palette">
              <div className="cmdk-input-row">
                <Search size={16} strokeWidth={1.75} />
                <input
                  ref={inputRef}
                  className="cmdk-input"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={dict.commandPalette.placeholder}
                  disabled={isPending}
                  data-testid="command-palette-input"
                />
              </div>
              <div className="cmdk-list">
                {items.length === 0 ? (
                  <div className="cmdk-empty">{dict.commandPalette.noResults}</div>
                ) : (
                  items.map((item, i) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`cmdk-item ${i === activeIndex ? 'cmdk-item-active' : ''}`}
                      onClick={() => item.run()}
                      onMouseEnter={() => setActiveIndex(i)}
                      data-testid="command-palette-option"
                    >
                      {item.label}
                    </button>
                  ))
                )}
              </div>
              <div className="cmdk-footer">{dict.commandPalette.hint}</div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
