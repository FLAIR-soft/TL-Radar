import { createHash } from 'node:crypto';

// Supabase Auth всегда требует email как идентификатор входа — это внутренний
// механизм. Пользователь его не видит: вход выполняется по имени+фамилии+паролю,
// а email под капотом детерминированно выводится из нормализованного имени.
function normalizeNamePart(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function deriveSyntheticEmail(firstName: string, lastName: string): string {
  const key = `${normalizeNamePart(firstName)}|${normalizeNamePart(lastName)}`;
  const hash = createHash('sha256').update(key).digest('hex').slice(0, 24);
  return `u${hash}@tl-radar.internal`;
}
