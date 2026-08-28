export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Приглушённые пастельные фоны для аватаров пользователей без своего цвета
// (Admin, список пользователей) — детерминированный выбор по id, чтобы один
// и тот же человек всегда получал один и тот же оттенок.
const AVATAR_PALETTE = ['#e0e7ff', '#fce7f3', '#dcfce7', '#fef3c7', '#e0f2fe', '#f3e8ff', '#fee2e2', '#ecfccb'];

export function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}
