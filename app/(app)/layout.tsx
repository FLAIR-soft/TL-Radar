import { redirect } from 'next/navigation';
import { Radar } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { LocaleProvider } from '@/lib/i18n/LocaleContext';
import { getThemeCookie } from '@/lib/theme/cookie';
import { TopTabs } from './TopTabs';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { CommandPalette } from '@/components/CommandPalette';
import { signOut } from './actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role, locale')
    .eq('id', user.id)
    .single();

  const name = profile?.name ?? user.email ?? 'Пользователь';
  const role = profile?.role ?? 'editor';
  const locale = profile?.locale ?? 'de';
  const dict = getDictionary(locale);
  const theme = await getThemeCookie();

  return (
    <LocaleProvider locale={locale} dict={dict}>
      <div className="app-root">
        <div className="topbar">
          <div className="topbar-left">
            <div className="topbar-brand">
              <span className="topbar-brand-icon">
                <Radar size={20} strokeWidth={2.25} />
              </span>
              <span className="topbar-brand-name">TL-Radar</span>
            </div>
            <TopTabs role={role} />
          </div>
          <div className="who">
            <CommandPalette role={role} />
            <NotificationBell />
            <ThemeToggle theme={theme} />
            <LanguageSwitcher />
            <span className="name">{name}</span>
            <form action={signOut}>
              <button className="btn btn-ghost" type="submit">
                {dict.topbar.logout}
              </button>
            </form>
          </div>
        </div>
        <main>{children}</main>
      </div>
    </LocaleProvider>
  );
}
