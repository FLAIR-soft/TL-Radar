'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Bell, UserPlus, UserMinus, MessageSquare, CalendarClock, AtSign } from 'lucide-react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { fmtDateTime } from '@/lib/logic/tasks';
import { createClient } from '@/lib/supabase/client';
import type { Dictionary } from '@/lib/i18n/get-dictionary';
import type { NotificationType, NotificationView } from '@/lib/supabase/types';

const TYPE_ICON: Record<NotificationType, typeof Bell> = {
  assigned: UserPlus,
  unassigned: UserMinus,
  comment: MessageSquare,
  mention: AtSign,
  deadline_soon: CalendarClock,
};

function describe(n: NotificationView, dict: Dictionary): string {
  const title = n.taskTitle ?? dict.notifications.unknownTask;
  switch (n.type) {
    case 'assigned':
      return `${dict.notifications.assigned}: ${title}`;
    case 'unassigned':
      return `${dict.notifications.unassigned}: ${title}`;
    case 'comment':
      return `${dict.notifications.comment}: ${title}`;
    case 'mention':
      return `${dict.notifications.mention}: ${title}`;
    case 'deadline_soon':
      return `${dict.notifications.deadlineSoon}: ${title}`;
    default:
      return title;
  }
}

const FALLBACK_POLL_MS = 30000;

// Fetch obychnogo Route Handler (app/api/notifications), a ne Server Action:
// eto ne dolzhno peresekat'sya s RSC/router-mekhanikoy drugikh Server Actions
// (naprimer, redirect posle sozdaniya proekta) — eto byla real'naya problema,
// poymannaya e2e-testami (sm. commit).
//
// Schyotchik zhivyot na Realtime (postgres_changes INSERT po notifications,
// 0030) — poll kazhdyye 30s bol'she ne nuzhen v fonovoy vkladke. Yesli
// Realtime-kanal ne podnyalsya (status !== 'SUBSCRIBED'), vklyuchayetsya
// fallback-poll, no tol'ko poka vkladka vidima (document.visibilityState).
export function NotificationBell({ userId }: { userId: string }) {
  const dict = useDictionary();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationView[] | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    function fetchCount() {
      fetch('/api/notifications')
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled) setCount(data.count ?? 0);
        })
        .catch(() => {});
    }
    function pollIfVisible() {
      if (document.visibilityState === 'visible') fetchCount();
    }

    fetchCount();

    const supabase = createClient();
    const statusRef = { current: 'CLOSED' as string };
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    function onVisibilityChange() {
      if (statusRef.current !== 'SUBSCRIBED') pollIfVisible();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` },
        () => {
          if (!cancelled) setCount((c) => c + 1);
        }
      )
      .subscribe((status) => {
        if (cancelled) return;
        statusRef.current = status;
        if (status === 'SUBSCRIBED' && fallbackInterval) {
          clearInterval(fallbackInterval);
          fallbackInterval = null;
        } else if (status !== 'SUBSCRIBED' && !fallbackInterval) {
          fallbackInterval = setInterval(pollIfVisible, FALLBACK_POLL_MS);
        }
      });

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (fallbackInterval) clearInterval(fallbackInterval);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    fetch('/api/notifications?full=1')
      .then((r) => r.json())
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]));
  }, [open]);

  function handleItemClick(n: NotificationView) {
    if (!n.read_at) {
      setCount((c) => Math.max(0, c - 1));
      fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markRead', id: n.id }),
      }).catch(() => {});
    }
    setOpen(false);
  }

  function handleMarkAll() {
    setCount(0);
    setItems((prev) => prev?.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) ?? prev);
    fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'markAll' }),
    }).catch(() => {});
  }

  return (
    <div className="notif-bell" ref={rootRef}>
      <button
        type="button"
        className="icon-btn notif-bell-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label={dict.notifications.title}
        aria-expanded={open}
        data-testid="notification-bell"
      >
        <Bell size={18} strokeWidth={1.75} />
        {count > 0 && (
          <span className="notif-badge" data-testid="notification-count">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-panel-head">
            <span>{dict.notifications.title}</span>
            <button type="button" className="link-btn" onClick={handleMarkAll} data-testid="notif-mark-all">
              {dict.notifications.markAllRead}
            </button>
          </div>
          {items === null ? (
            <div className="empty-note loading-row">
              <span className="loading-spinner" />
              {dict.notifications.loading}
            </div>
          ) : items.length === 0 ? (
            <div className="empty-note">{dict.notifications.empty}</div>
          ) : (
            <div className="notif-list">
              {items.map((n) => {
                const Icon = TYPE_ICON[n.type];
                const href = n.taskStatus === 'done' ? '/archive' : '/dashboard';
                return (
                  <Link
                    key={n.id}
                    href={href}
                    className={`notif-row ${n.read_at ? '' : 'notif-unread'}`}
                    onClick={() => handleItemClick(n)}
                    data-testid="notification-row"
                  >
                    <Icon size={16} strokeWidth={1.75} className="notif-icon" />
                    <div className="notif-body">
                      <div className="notif-desc">{describe(n, dict)}</div>
                      <div className="notif-meta mono">{fmtDateTime(n.created_at, dict.intlLocale)}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
