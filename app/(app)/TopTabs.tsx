'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import type { UserRole } from '@/lib/supabase/types';
import { canViewStats } from '@/lib/logic/access';

export function TopTabs({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const dict = useDictionary();
  const tabs = [
    { href: '/dashboard', label: dict.topbar.dashboard },
    { href: '/dashboard/new', label: dict.topbar.newTask },
    { href: '/archive', label: dict.topbar.archive },
    { href: '/projects', label: dict.topbar.projects },
    { href: '/templates', label: dict.topbar.templates },
    ...(canViewStats(role) ? [{ href: '/analytics', label: dict.topbar.analytics }] : []),
    ...(role === 'admin' ? [{ href: '/admin', label: dict.topbar.admin }] : []),
  ];

  return (
    <div className="tabs">
      {tabs.map((t) => {
        // /dashboard/new has its own tab again (redesign v2, stage 1 — K1),
        // so it owns the active state there and /dashboard must not also
        // light up on that path. The button on Task-Manager stays as a
        // second way in.
        const active =
          t.href === '/dashboard'
            ? pathname === t.href
            : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link key={t.href} href={t.href} className={`tab ${active ? 'active' : ''}`}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
