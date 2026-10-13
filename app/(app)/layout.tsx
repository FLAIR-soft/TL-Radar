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
                  {/* Два файла вместо одного с currentColor: в логотипе есть
                      фирменный красный, который не должен перекрашиваться
                      вместе с остальным. Ненужный вариант скрыт по теме.
                      next/image здесь не нужен: SVG он не оптимизирует и
                      пропускает как есть, а файлы по полтора килобайта. */}
                  {/* eslint-disable @next/next/no-img-element */}
                  <img
                    className="topbar-logo topbar-logo-light"
                    src="/mifcom-logo-black.svg"
                    alt="MIFCOM"
                  />
                  <img
                    className="topbar-logo topbar-logo-dark"
                    src="/mifcom-logo-white.svg"
                    alt="MIFCOM"
                  />
                  {/* eslint-enable @next/next/no-img-element */}
                  <span className="topbar-brand-sep" aria-hidden="true" />
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
