'use server';

import { revalidatePath } from 'next/cache';
import { exec, row, rows } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getLocaleCookie } from '@/lib/i18n/cookie';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { logActivity } from '@/lib/logic/activity-log';
import { notifyMany } from '@/lib/logic/notifications';
import { extractMentionedUsernames } from '@/lib/logic/mentions';
import type { TaskComment } from '@/lib/db/types';

// Ролей в новой базе нет вовсе (их держала таблица profiles), поэтому
// «админ может удалить любой комментарий» переехать было некуда: удалить
// комментарий теперь может только его автор. Флаг оставлен в ответе, чтобы не
// переписывать props CommentList, и всегда false.
const IS_ADMIN = false;

// За шлюзом MIDAS неаутентифицированный посетитель сюда не доходит, а
// getCurrentUser() бросает исключение, если заголовка с почтой нет, — ветки
// «не вошёл → errors.unauthorized» больше нет. Язык берётся из куки.
async function requireAuth() {
  const user = await getCurrentUser();
  const dict = getDictionary(await getLocaleCookie());
  return { user, dict };
}

export interface TaskCommentsResult {
  comments: TaskComment[];
  currentUserId: string | null;
  isAdmin: boolean;
}

// Zapros po trebovaniyu (slaid-bar zagruzhayet tol'ko pri otkrytii) — tak zhe
// kak getActivityLog. currentUserId/isAdmin vozvrashchayutsya vmeste s
// kommentariyami, chtoby klientskiy komponent znal, komu pokazyvat' knopku
// udaleniya, ne threadya rol' cherez vsyu tsepochku props stranits.
// (currentUserId теперь — почта, а не uuid.)
export async function getTaskComments(taskId: string): Promise<TaskCommentsResult> {
  const user = await getCurrentUser();

  const comments = await rows<TaskComment>(
    `select * from task_comments
      where task_id = $1 and deleted_at is null
      order by created_at`,
    [taskId]
  );

  return { comments, currentUserId: user.email, isAdmin: IS_ADMIN };
}

export async function addComment(taskId: string, formData: FormData): Promise<{ error?: string }> {
  const { user, dict } = await requireAuth();

  const body = String(formData.get('body') || '').trim();
  if (!body) {
    return { error: dict.comments.errors.empty };
  }

  let comment: { id: string } | null;
  try {
    comment = await row<{ id: string }>(
      `insert into task_comments (task_id, author, body) values ($1, $2, $3) returning id`,
      [taskId, user.email, body]
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : dict.comments.errors.empty };
  }

  if (!comment) {
    return { error: dict.comments.errors.empty };
  }

  await logActivity('task', taskId, 'comment_added', user.email, { commentId: comment.id });

  // Исполнители и наблюдатели — одним запросом; повторы всё равно отсеет
  // notifyMany, но union даёт их сразу без склейки двух списков в JS.
  const recipients = await rows<{ email: string }>(
    `select assignee_email as email from task_assignees
      where task_id = $1 and removed_at is null
     union
     select email from task_watchers where task_id = $1`,
    [taskId]
  );
  await notifyMany(
    recipients.map((r) => r.email),
    user.email,
    'comment',
    taskId,
    { preview: body.slice(0, 140) }
  );

  const mentionedUsernames = extractMentionedUsernames(body);
  if (mentionedUsernames.length) {
    // Юзернеймов больше нет: @упоминание сопоставляется с частью почты до
    // собачки (r.holovachov@mifcom.de → @r.holovachov).
    const mentioned = await rows<{ email: string }>(
      `select email from people where split_part(email, '@', 1) = any($1::text[])`,
      [mentionedUsernames]
    );
    if (mentioned.length) {
      await notifyMany(
        mentioned.map((p) => p.email),
        user.email,
        'mention',
        taskId,
        { preview: body.slice(0, 140) }
      );
    }
  }

  revalidatePath('/dashboard');
  revalidatePath('/archive');
  return {};
}

export async function deleteComment(commentId: string): Promise<{ error?: string }> {
  const { user, dict } = await requireAuth();

  const comment = await row<{ author: string | null }>(
    `select author from task_comments where id = $1`,
    [commentId]
  );

  if (!comment) return {};
  if (comment.author !== user.email) {
    return { error: dict.comments.errors.notAllowed };
  }

  await exec(
    `update task_comments set deleted_at = $1 where id = $2`,
    [new Date().toISOString(), commentId]
  );

  revalidatePath('/dashboard');
  revalidatePath('/archive');
  return {};
}
