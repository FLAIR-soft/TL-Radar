import { NextResponse } from 'next/server';
import { rows } from '@/lib/db/client';
import type { Person } from '@/lib/db/types';

// Обычный Route Handler, а не Server Action — по тем же причинам, что и
// app/api/watch: CommentList уже смонтирован внутри TaskDetailPanel, где
// одновременно идут несколько других 'use server' вызовов (журнал/чеклист), и
// ещё один Server Action здесь увеличивал шанс на ту же гонку с revalidatePath
// другого действия (например, createTemplateFromTask).
//
// Прежняя проверка «есть ли пользователь» была проверкой сессии Supabase:
// список людей один на всех, своих строк у пользователя тут нет. За шлюзом
// MIDAS неаутентифицированный посетитель сюда не доходит.
export async function GET() {
  const people = await rows<Pick<Person, 'email' | 'display_name'>>(
    `select email, display_name from people order by coalesce(display_name, email)`
  );

  // Форму ответа не меняем: CommentList и lib/logic/mentions ждут
  // { id, name, username }. Идентификатором человека теперь служит почта, а
  // ручкой для @-упоминания — её левая часть: колонки username в новой схеме
  // нет, а шаблон упоминаний (@[a-z0-9_.]{3,32}) под неё и подходит.
  const profiles = people.map((p) => ({
    id: p.email,
    name: p.display_name ?? p.email,
    username: p.email.split('@')[0],
  }));

  return NextResponse.json({ profiles });
}
