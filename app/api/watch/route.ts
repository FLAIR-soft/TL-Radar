import { NextResponse } from 'next/server';
import { exec, row } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/auth/current-user';

// Обычный Route Handler, а не Server Action — по образцу app/api/notifications:
// TaskDetailPanel и так вызывает несколько 'use server' функций одновременно
// при открытии (журнал/комментарии/чеклист), и ещё одно Server Action здесь
// вызывало редкую, но настоящую гонку — ответ этого действия иногда приходил
// после createTemplateFromTask и откатывал router-кеши /templates назад, к
// устаревшему состоянию (revalidatePath словно «не срабатывал»). Обычный
// fetch() полностью независим от этой RSC/router-механики Server Actions.
export async function GET(request: Request) {
  const user = await getCurrentUser();

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');
  if (!taskId) return NextResponse.json({ watching: false });

  // Наблюдателя ищем по текущему пользователю явно: RLS, которая раньше
  // прятала чужие строки, больше нет.
  const existing = await row<{ task_id: string }>(
    `select task_id from task_watchers where task_id = $1::uuid and email = $2`,
    [taskId, user.email]
  );

  return NextResponse.json({ watching: !!existing });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  const body = await request.json();
  const taskId = String(body.taskId || '');
  if (!taskId) return NextResponse.json({ watching: false }, { status: 400 });

  const existing = await row<{ task_id: string }>(
    `select task_id from task_watchers where task_id = $1::uuid and email = $2`,
    [taskId, user.email]
  );

  if (existing) {
    await exec(
      `delete from task_watchers where task_id = $1::uuid and email = $2`,
      [taskId, user.email]
    );
    return NextResponse.json({ watching: false });
  }

  // on conflict do nothing — на случай двойного нажатия: раньше ошибку
  // уникальности глотал клиент Supabase, и ответ всё равно был watching: true.
  await exec(
    `insert into task_watchers (task_id, email) values ($1::uuid, $2)
     on conflict (task_id, email) do nothing`,
    [taskId, user.email]
  );
  return NextResponse.json({ watching: true });
}
