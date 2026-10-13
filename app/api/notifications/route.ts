import { NextResponse } from 'next/server';
import { exec, row, rows } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/auth/current-user';
import type { NotificationView } from '@/lib/logic/notifications';
import type { NotificationType, TaskStatus } from '@/lib/db/types';

const LIST_LIMIT = 30;

// Строка выборки списка: уведомление плюс название и статус задачи одним
// запросом. Раньше это отдавала функция get_my_notifications (0031); она
// опиралась на auth.uid(), в новой базе её нет, и джойн написан здесь.
type NotificationRow = {
  id: string;
  recipient_email: string;
  type: NotificationType;
  task_id: string | null;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
  task_title: string | null;
  task_status: TaskStatus | null;
};

// Обычный Route Handler, а не Server Action: колокольчик опрашивает счётчик
// каждые 30 секунд фоново, и это не должно пересекаться с router/RSC-механикой
// Server Actions (например, с revalidatePath другого действия в этот момент) —
// обычный fetch() полностью независим от неё, в отличие от вызова 'use server'
// функции прямо из клиентского компонента.
export async function GET(request: Request) {
  const user = await getCurrentUser();

  const { searchParams } = new URL(request.url);
  const full = searchParams.get('full') === '1';

  // RLS больше нет: получателя фильтруем сами. Раньше это делала политика, и
  // без явного условия каждый видел бы чужие уведомления.
  //
  // Счётчик и полный список друг от друга не зависят — одна волна через
  // Promise.all вместо последовательных await.
  const [unread, list] = await Promise.all([
    row<{ count: number }>(
      `select count(*)::int as count
       from notifications
       where recipient_email = $1 and read_at is null`,
      [user.email]
    ),
    full
      ? rows<NotificationRow>(
          `select n.id, n.recipient_email, n.type, n.task_id, n.payload, n.read_at, n.created_at,
                  t.title as task_title, t.status::text as task_status
           from notifications n
           left join tasks t on t.id = n.task_id
           where n.recipient_email = $1
           order by n.created_at desc
           limit $2`,
          [user.email, LIST_LIMIT]
        )
      : Promise.resolve([] as NotificationRow[]),
  ]);

  const items: NotificationView[] = list.map((n) => ({
    id: n.id,
    recipient_email: n.recipient_email,
    type: n.type,
    task_id: n.task_id,
    payload: n.payload,
    read_at: n.read_at,
    created_at: n.created_at,
    taskTitle: n.task_title,
    taskStatus: n.task_status,
  }));

  return NextResponse.json({ count: unread?.count ?? 0, items });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  const body = await request.json();
  const now = new Date().toISOString();

  // Условие по получателю обязательно: оно и подтверждает право пометить
  // уведомление прочитанным. Раньше это же делала политика RLS.
  if (body.action === 'markRead' && typeof body.id === 'string') {
    await exec(
      `update notifications set read_at = $1::timestamptz
       where id = $2::uuid and recipient_email = $3 and read_at is null`,
      [now, body.id, user.email]
    );
  } else if (body.action === 'markAll') {
    await exec(
      `update notifications set read_at = $1::timestamptz
       where recipient_email = $2 and read_at is null`,
      [now, user.email]
    );
  }

  return NextResponse.json({ ok: true });
}
