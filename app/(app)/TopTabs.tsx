'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { UserRole } from '@/lib/supabase/types';

export function TopTabs({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const tabs = [{ href: '/dashboard', label: 'Дешборд' }];
  if (role === 'editor') tabs.push({ href: '/dashboard/new', label: 'Новая задача' });
  tabs.push({ href: '/archive', label: 'Архив' });

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
