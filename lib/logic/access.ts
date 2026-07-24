import type { UserRole } from '@/lib/supabase/types';

// Минимальная роль для доступа к аналитике (Этап 6). Сейчас 'editor'
// (= все зарегистрированные), но вынесено в одну именованную константу —
// решение о том, ограничивать ли аналитику ролью admin, откладывается
// на потом и не требует правок в других местах.
export const STATS_MIN_ROLE: UserRole = 'editor';

const ROLE_RANK: Record<UserRole, number> = { viewer: 0, editor: 1, admin: 2 };

export function canViewStats(role: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[STATS_MIN_ROLE];
}
