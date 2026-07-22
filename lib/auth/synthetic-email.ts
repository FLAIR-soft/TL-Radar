import { createHash } from 'node:crypto';

// Supabase Auth всегда требует email как идентификатор входа — это внутренний
// механизм. Пользователь его не видит: вход выполняется по юзернейму+паролю,
// а email под капотом детерминированно выводится из нормализованного юзернейма.
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function deriveSyntheticEmail(username: string): string {
  const hash = createHash('sha256').update(normalizeUsername(username)).digest('hex').slice(0, 24);
  return `u${hash}@tl-radar.internal`;
}

// Зеркалит check-constraint profiles_username_format (0015_add_username.sql).
const USERNAME_PATTERN = /^[a-z0-9_.]{3,32}$/;

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(normalizeUsername(username));
}
