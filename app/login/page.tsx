import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getLocaleCookie } from '@/lib/i18n/cookie';
import { LoginForm } from './LoginForm';

export default async function LoginPage() {
  const locale = await getLocaleCookie();
  const dict = getDictionary(locale);

  return <LoginForm dict={dict} />;
}
