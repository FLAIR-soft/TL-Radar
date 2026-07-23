'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { logActivity } from '@/lib/logic/activity-log';
import { notifyMany } from '@/lib/logic/notifications';
import type { TaskComment } from '@/lib/supabase/types';

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, locale')
    .eq('id', user.id)
    .single();

  const dict = getDictionary(profile?.locale ?? 'de');

  return { supabase, userId: user.id, isAdmin: profile?.role === 'admin', dict };
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
export async function getTaskComments(taskId: string): Promise<TaskCommentsResult> {
  const auth = await requireAuth();
  if (!auth) return { comments: [], currentUserId: null, isAdmin: false };
  const { supabase, userId, isAdmin } = auth;

  const { data } = await supabase
    .from('task_comments')
    .select('*')
    .eq('task_id', taskId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  return { comments: data ?? [], currentUserId: userId, isAdmin };
}

export async function addComment(taskId: string, formData: FormData): Promise<{ error?: string }> {
  const auth = await requireAuth();
  if (!auth) return { error: 'unauthorized' };
  const { supabase, userId, dict } = auth;

  const body = String(formData.get('body') || '').trim();
  if (!body) {
    return { error: dict.comments.errors.empty };
  }

  const { data: comment, error } = await supabase
    .from('task_comments')
    .insert({ task_id: taskId, author_id: userId, body })
    .select('id')
    .single();

  if (error || !comment) {
    return { error: error?.message ?? dict.comments.errors.empty };
  }

  await logActivity(supabase, 'task', taskId, 'comment_added', userId, { commentId: comment.id });

  const { data: assignees } = await supabase
    .from('task_assignees')
    .select('assignee_id')
    .eq('task_id', taskId)
    .is('removed_at', null);
  await notifyMany(
    supabase,
    (assignees ?? []).map((a) => a.assignee_id),
    userId,
    'comment',
    taskId,
    { preview: body.slice(0, 140) }
  );

  revalidatePath('/dashboard');
  revalidatePath('/archive');
  return {};
}

export async function deleteComment(commentId: string): Promise<{ error?: string }> {
  const auth = await requireAuth();
  if (!auth) return { error: 'unauthorized' };
  const { supabase, userId, isAdmin, dict } = auth;

  const { data: comment } = await supabase
    .from('task_comments')
    .select('author_id')
    .eq('id', commentId)
    .single();

  if (!comment) return {};
  if (comment.author_id !== userId && !isAdmin) {
    return { error: dict.comments.errors.notAllowed };
  }

  await supabase.from('task_comments').update({ deleted_at: new Date().toISOString() }).eq('id', commentId);

  revalidatePath('/dashboard');
  revalidatePath('/archive');
  return {};
}
