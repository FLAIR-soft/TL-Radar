import { Radar } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getLocale } from '@/lib/i18n/locale';
import { getInitials } from '@/lib/logic/initials';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { LocaleProvider } from '@/lib/i18n/LocaleContext';
import { getTheme } from '@/lib/theme/theme';
import { TopTabs } from './TopTabs';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { CommandPalette } from '@/components/CommandPalette';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { ToastProvider } from '@/components/ToastProvider';
import { DialogProvider } from '@/components/DialogProvider';
import { signOut } from './actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Личность приходит от шлюза MIDAS. Неаутентифицированный посетитель до
  // приложения не доходит, проверять и перенаправлять некого.
  const user = await getCurrentUser();

  const name = user.displayName;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const theme = await getTheme();

  return (
    <LocaleProvider locale={locale} dict={dict}>
      <ToastProvider>
        <DialogProvider>
          <ServiceWorkerRegister />
          <div className="app-root">
            <div className="topbar">
              <div className="topbar-left">
                <div className="topbar-brand">
                  <span className="topbar-brand-icon">
                    <Radar size={20} strokeWidth={2.25} />
                  </span>
                  <span className="topbar-brand-name">TL-Organizer</span>
                </div>
                <TopTabs />
              </div>
              <div className="who">
                <CommandPalette />
                <NotificationBell />
                <ThemeToggle theme={theme} />
                <LanguageSwitcher />
                <div className="topbar-profile">
                  <span className="topbar-avatar">{getInitials(name)}</span>
                  <span className="topbar-profile-name">{name}</span>
                  <form action={signOut}>
                    <button className="topbar-logout" type="submit">
                      {dict.topbar.logout}
                    </button>
                  </form>
                </div>
              </div>
            </div>
            <main>{children}</main>
          </div>
        </DialogProvider>
      </ToastProvider>
    </LocaleProvider>
  );
}
