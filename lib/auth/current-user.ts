import { cache } from 'react';
import { headers } from 'next/headers';
import { exec } from '@/lib/db/client';

export type CurrentUser = {
  /** Почта в нижнем регистре. Ключ пользователя во всей системе. */
  email: string;
  /** Отображаемое имя из Entra, либо почта, если имени нет. */
  displayName: string;
};

/**
 * Кто сейчас работает. Личность приходит от шлюза MIDAS заголовком, своего
 * логина у приложения нет: неаутентифицированный посетитель до него не доходит.
 *
 * Почта приводится к нижнему регистру намеренно. Документация MIDAS обещает
 * lowercase, но на деле приходит `R.Holovachov@mifcom.de` (проверено на
 * этапе 0). Без нормализации один и тот же человек записался бы в базу
 * дважды и потерял доступ к своим задачам.
 *
 * React.cache() держит результат в пределах одного рендера, поэтому layout и
 * страница внутри него не делают два похода в базу.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const h = await headers();

  // Локально шлюза нет и заголовка не будет — тогда берём почту разработчика.
  // В продакшене заголовок есть всегда.
  const raw = h.get('x-auth-request-email') ?? process.env.DEV_USER_EMAIL ?? '';
  const email = raw.trim().toLowerCase();

  if (!email) {
    throw new Error(
      'Нет заголовка x-auth-request-email. За шлюзом MIDAS он приходит всегда; ' +
      'локально задайте DEV_USER_EMAIL.'
    );
  }

  const displayName =
    h.get('x-auth-request-display-name')?.trim() ||
    h.get('x-auth-request-preferred-username')?.trim() ||
    email;

  // Человек заводится сам при первом заходе. Имя обновляется, если его
  // сменили в Entra; строка, созданная «добавлением по почте», получает имя
  // в момент первого входа этого человека.
  await exec(
    `insert into people (email, display_name, last_seen_at)
     values ($1, $2, now())
     on conflict (email) do update
       set display_name = excluded.display_name,
           last_seen_at = now()`,
    [email, displayName]
  );

  return { email, displayName };
});
