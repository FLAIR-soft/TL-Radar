'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { isLocale } from '@/lib/i18n/config';
import { LOCALE_COOKIE } from '@/lib/i18n/cookie';

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;

  // Язык больше не хранится в профиле: таблицы profiles нет.
  // ВНИМАНИЕ: за шлюзом MIDAS куки вырезаются, поэтому выбор языка сейчас
  // не переживает перезагрузку. Переезд в localStorage — этап 7.
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365 });

  revalidatePath('/dashboard', 'layout');
}
