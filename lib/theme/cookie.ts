import { cookies } from 'next/headers';

export const THEME_COOKIE = 'theme';
export type Theme = 'light' | 'dark';

export async function getThemeCookie(): Promise<Theme> {
  const store = await cookies();
  const value = store.get(THEME_COOKIE)?.value;
  return value === 'dark' ? 'dark' : 'light';
}
