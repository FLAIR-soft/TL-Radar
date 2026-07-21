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
    ...(canViewStats(role) ? [{ href: '/analytics', label: dict.topbar.analytics }] : []),
    ...(role === 'admin' ? [{ href: '/admin', label: dict.topbar.admin }] : []),
  ];

  return (
    <div className="tabs">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={`tab ${pathname === t.href ? 'active' : ''}`}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}
