import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getLocaleCookie } from '@/lib/i18n/cookie';
import { getThemeCookie } from '@/lib/theme/cookie';
import { LocaleProvider } from '@/lib/i18n/LocaleContext';
import { LoginForm } from './LoginForm';

export default async function LoginPage() {
  const locale = await getLocaleCookie();
  const dict = getDictionary(locale);
  const theme = await getThemeCookie();

  return (
    <LocaleProvider locale={locale} dict={dict}>
      <LoginForm dict={dict} theme={theme} />
    </LocaleProvider>
  );
}
