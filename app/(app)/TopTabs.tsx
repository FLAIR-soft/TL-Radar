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
    { href: '/archive', label: dict.topbar.archive },
    { href: '/projects', label: dict.topbar.projects },
    { href: '/templates', label: dict.topbar.templates },
    ...(canViewStats(role) ? [{ href: '/analytics', label: dict.topbar.analytics }] : []),
    ...(role === 'admin' ? [{ href: '/admin', label: dict.topbar.admin }] : []),
  ];

  return (
    <div className="tabs">
      {tabs.map((t) => {
        // /dashboard/new no longer has its own tab (stage 5) — it's reached
        // via a button on Task-Manager, so that tab should still read as
        // active while creating a task there.
        const active = pathname === t.href || (t.href === '/dashboard' && pathname.startsWith('/dashboard/new'));
        return (
          <Link key={t.href} href={t.href} className={`tab ${active ? 'active' : ''}`}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
