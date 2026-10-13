// Этап 8. Всплывающие уведомления Windows через Notification API браузера.
//
// Почта через MIDAS отменена, нужен системный тост. Пока приложение открыто
// во вкладке, никакой серверной инфраструктуры для этого не требуется: тост
// рисует сам браузер. Случай «приложение закрыто» — это уже Web Push, он
// требует исходящего интернета из контейнера; проверка этого вынесена
// в /api/health (раздел outbound).
//
// Момент последнего показанного уведомления держим в localStorage. Куки
// шлюз MIDAS вырезает, а здесь это и не нужно: речь о конкретном браузере
// на конкретной машине, а не о выборе человека.

const LAST_SEEN_KEY = 'tlo_notifications_last_seen';

export type DesktopPermission = 'unsupported' | 'default' | 'granted' | 'denied';

// Подписка для useSyncExternalStore: разрешение — внешнее по отношению
// к React состояние, и читать его в эффекте значит вызывать лишний рендер.
// Снимок — обычная строка, поэтому ссылочная стабильность соблюдается сама.
const listeners = new Set<() => void>();

export function subscribeDesktopPermission(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function desktopPermission(): DesktopPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as DesktopPermission;
}

/** На сервере объекта Notification нет — отдаём «не поддерживается». */
export function desktopPermissionOnServer(): DesktopPermission {
  return 'unsupported';
}

/**
 * Запрашивать разрешение можно только в ответ на действие человека: браузеры
 * отклоняют запрос при загрузке страницы, а Chrome после такого ещё и
 * блокирует повторные попытки.
 */
export async function requestDesktopPermission(): Promise<DesktopPermission> {
  if (desktopPermission() === 'unsupported') return 'unsupported';
  try {
    const result = (await Notification.requestPermission()) as DesktopPermission;
    listeners.forEach((l) => l());
    return result;
  } catch {
    return 'denied';
  }
}

export function lastSeenAt(): string {
  try {
    return localStorage.getItem(LAST_SEEN_KEY) ?? new Date().toISOString();
  } catch {
    // Приватное окно или запрещённое хранилище: считаем, что всё уже видели,
    // иначе при каждом заходе посыплются тосты по старым уведомлениям.
    return new Date().toISOString();
  }
}

export function rememberSeen(iso: string): void {
  try {
    localStorage.setItem(LAST_SEEN_KEY, iso);
  } catch {
    /* хранилище недоступно — ничего страшного, тост просто покажется снова */
  }
}

/**
 * Показывает тост. Клик по нему возвращает человека во вкладку с приложением.
 * tag склеивает повторы по одной задаче, чтобы десять комментариев не дали
 * десять уведомлений подряд.
 */
export function showDesktopNotification(title: string, body: string, tag: string): void {
  if (desktopPermission() !== 'granted') return;
  try {
    const n = new Notification(title, { body, tag, icon: '/icon-192.png' });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* браузер может отказать — молча, уведомление не критично */
  }
}
