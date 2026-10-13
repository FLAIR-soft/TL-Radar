'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Bell, BellRing, UserPlus, UserMinus, MessageSquare, CalendarClock, AtSign } from 'lucide-react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { fmtDateTime } from '@/lib/logic/tasks';
import { useAnimatedUnmount } from '@/lib/hooks/useAnimatedUnmount';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';
import type { Dictionary } from '@/lib/i18n/get-dictionary';
import type { NotificationView } from '@/lib/logic/notifications';
import type { NotificationType } from '@/lib/db/types';
import {
  desktopPermission,
  desktopPermissionOnServer,
  lastSeenAt,
  rememberSeen,
  requestDesktopPermission,
  showDesktopNotification,
  subscribeDesktopPermission,
} from '@/lib/notifications/desktop';

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

const POLL_MS = 30000;

// Fetch обычного Route Handler (app/api/notifications), а не Server Action:
// это не должно пересекаться с RSC/router-механикой других Server Actions
// (например, с redirect после создания проекта) — это была настоящая проблема,
// пойманная e2e-тестами (см. коммит).
//
// Счётчик живёт на опросе раз в 30 секунд. Supabase Realtime, на котором он
// держался раньше (postgres_changes INSERT по notifications, 0030), в MIDAS
// нет: моментального обновления в открытой вкладке больше не будет, badge
// отстаёт в худшем случае на интервал опроса. Опрос идёт только в видимой
// вкладке (document.visibilityState) — скрытая вкладка в базу не ходит, а при
// возвращении на неё счётчик обновляется сразу, по событию visibilitychange.
export function NotificationBell() {
  const dict = useDictionary();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationView[] | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const permission = useSyncExternalStore(
    subscribeDesktopPermission,
    desktopPermission,
    desktopPermissionOnServer
  );
  // Счётчик из прошлого опроса: тост показываем только когда он вырос.
  const lastCount = useRef<number | null>(null);
  const { phase, onAnimationEnd } = useAnimatedUnmount(open);
  const panelRef = useFocusTrap<HTMLDivElement>(phase !== 'closed');

  useEffect(() => {
    let cancelled = false;

    // Новые уведомления с прошлого раза — показываем системным тостом.
    // Не больше трёх за опрос: вернувшись после отпуска, человек не должен
    // разбирать стопку окон Windows.
    async function toastNew() {
      if (desktopPermission() !== 'granted') return;
      const since = lastSeenAt();
      try {
        const data = await fetch('/api/notifications?full=1').then((r) => r.json());
        const fresh: NotificationView[] = (data.items ?? [])
          .filter((n: NotificationView) => !n.read_at && n.created_at > since)
          .slice(0, 3);
        if (!fresh.length) return;
        for (const n of fresh) {
          showDesktopNotification(dict.notifications.title, describe(n, dict), n.task_id ?? n.id);
        }
        rememberSeen(fresh[0].created_at);
      } catch {
        /* сеть моргнула — тост не показался, счётчик всё равно обновится */
      }
    }

    function fetchCount() {
      fetch('/api/notifications')
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          const next = data.count ?? 0;
          if (lastCount.current !== null && next > lastCount.current) void toastNew();
          lastCount.current = next;
          setCount(next);
        })
        .catch(() => {});
    }
    function pollIfVisible() {
      if (document.visibilityState === 'visible') fetchCount();
    }

    fetchCount();

    const interval = setInterval(pollIfVisible, POLL_MS);
    document.addEventListener('visibilitychange', pollIfVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', pollIfVisible);
    };
  }, [dict]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (phase !== 'open') return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [phase]);

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

  async function handleEnableDesktop() {
    const result = await requestDesktopPermission();
    // Всё, что пришло до включения, уже не новость — иначе первое же
    // срабатывание опроса высыпет тосты по старым уведомлениям.
    if (result === 'granted') rememberSeen(new Date().toISOString());
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
        aria-haspopup="dialog"
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
      {phase !== 'closed' && (
        <div
          ref={panelRef}
          className={`notif-panel ${phase === 'closing' ? 'is-closing' : ''}`}
          onAnimationEnd={onAnimationEnd}
          role="dialog"
          aria-label={dict.notifications.title}
        >
          <div className="notif-panel-head">
            <span>{dict.notifications.title}</span>
            <button type="button" className="link-btn" onClick={handleMarkAll} data-testid="notif-mark-all">
              {dict.notifications.markAllRead}
            </button>
          </div>
          {/* Разрешение спрашиваем по нажатию, а не при загрузке страницы:
              браузеры отклоняют такой запрос, а Chrome потом блокирует
              и повторные попытки. */}
          {permission === 'default' && (
            <button type="button" className="notif-enable" onClick={handleEnableDesktop}>
              <BellRing size={14} strokeWidth={1.75} />
              {dict.notifications.enableDesktop}
            </button>
          )}
          {permission === 'denied' && (
            <p className="notif-enable-note">{dict.notifications.desktopBlocked}</p>
          )}
          {items === null ? (
            <div className="empty-note loading-row">
              <span className="loading-spinner" />
              {dict.notifications.loading}
            </div>
          ) : items.length === 0 ? (
            <div className="empty-note">{dict.notifications.empty}</div>
          ) : (
            <div className="notif-list">
              {items.map((n, i) => {
                const Icon = TYPE_ICON[n.type];
                const href = n.taskStatus === 'done' ? '/archive' : '/dashboard';
                return (
                  <Link
                    key={n.id}
                    href={href}
                    className={`notif-row ${n.read_at ? '' : 'notif-unread'}`}
                    onClick={() => handleItemClick(n)}
                    data-testid="notification-row"
                    style={{ animationDelay: `${i * 25}ms` }}
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
