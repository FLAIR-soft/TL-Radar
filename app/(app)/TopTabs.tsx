'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { UserRole } from '@/lib/supabase/types';
import { useDictionary } from '@/lib/i18n/LocaleContext';

export function TopTabs({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const dict = useDictionary();
  const tabs = [{ href: '/dashboard', label: dict.topbar.dashboard }];
  if (role === 'editor') tabs.push({ href: '/dashboard/new', label: dict.topbar.newTask });
  tabs.push({ href: '/archive', label: dict.topbar.archive });

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
