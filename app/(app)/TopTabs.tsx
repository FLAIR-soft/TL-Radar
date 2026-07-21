'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDictionary } from '@/lib/i18n/LocaleContext';

export function TopTabs() {
  const pathname = usePathname();
  const dict = useDictionary();
  const tabs = [
    { href: '/dashboard', label: dict.topbar.dashboard },
    { href: '/dashboard/new', label: dict.topbar.newTask },
    { href: '/archive', label: dict.topbar.archive },
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
