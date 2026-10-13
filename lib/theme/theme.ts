import { getCurrentUser } from '@/lib/auth/current-user';

export type Theme = 'light' | 'dark';

/**
 * Тема для серверного рендера. Хранится в профиле (миграция 0004), потому
 * что куки за шлюзом MIDAS не доживают до браузера.
 *
 * Атрибут data-theme проставляется на <html> на сервере, поэтому светлой
 * вспышки перед тёмной темой нет и inline-скрипт до стилей не нужен.
 */
export async function getTheme(): Promise<Theme> {
  return (await getCurrentUser()).theme;
}
