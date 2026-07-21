'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import type { TaskStatus } from '@/lib/supabase/types';

async function requireEditor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, locale')
    .eq('id', user.id)
    .single();

  const dict = getDictionary(profile?.locale ?? 'de');

  if (!profile || (profile.role !== 'editor' && profile.role !== 'admin')) {
    throw new Error(dict.taskForm.errors.notAuthorized);
  }

  return { supabase, userId: user.id, dict };
}

export interface TaskFormState {
  error: string | null;
}

function readTaskFields(formData: FormData) {
  return {
    person: String(formData.get('person') || '').trim(),
    title: String(formData.get('title') || '').trim(),
    description: String(formData.get('description') || '').trim(),
    location: String(formData.get('location') || '').trim(),
    deadline: (String(formData.get('deadline') || '').trim() || null) as string | null,
  };
}

export async function createTask(_prevState: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const { supabase, userId, dict } = await requireEditor();
  const fields = readTaskFields(formData);

  if (!fields.person || !fields.title) {
    return { error: dict.taskForm.errors.missingFields };
  }

  const { error } = await supabase.from('tasks').insert({
    ...fields,
    status: 'waiting',
    created_by: userId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/dashboard');
  redirect('/dashboard');
}

export async function editTaskFields(
  taskId: string,
  _prevState: TaskFormState,
  formData: FormData
): Promise<TaskFormState> {
  const { supabase, dict } = await requireEditor();
  const fields = readTaskFields(formData);

  if (!fields.person || !fields.title) {
    return { error: dict.taskForm.errors.missingFields };
  }

  const { error } = await supabase.from('tasks').update(fields).eq('id', taskId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/dashboard');
  redirect('/dashboard');
}

export async function deleteTask(taskId: string) {
  const { supabase } = await requireEditor();
  await supabase.from('tasks').delete().eq('id', taskId);
  revalidatePath('/dashboard');
  revalidatePath('/archive');
}

export async function setStatus(taskId: string, newStatus: TaskStatus) {
  const { supabase } = await requireEditor();

  const { data: task } = await supabase
    .from('tasks')
    .select('status, started_at')
    .eq('id', taskId)
    .single();

  if (!task) return;

  const now = new Date().toISOString();
  const update: { status: TaskStatus; started_at?: string; completed_at?: string } = {
    status: newStatus,
  };

  if (newStatus === 'in_progress' && !task.started_at) {
    update.started_at = now;
  }

  if (task.status === 'in_progress' && newStatus === 'paused') {
    await supabase.from('task_pauses').insert({ task_id: taskId, paused_at: now, resumed_at: null, auto: false });
  }

  if (task.status === 'paused' && newStatus === 'in_progress') {
    const { data: openPause } = await supabase
      .from('task_pauses')
      .select('id')
      .eq('task_id', taskId)
      .is('resumed_at', null)
      .order('paused_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (openPause) {
      await supabase.from('task_pauses').update({ resumed_at: now }).eq('id', openPause.id);
    }
  }

  if (newStatus === 'done') {
    const { data: openPause } = await supabase
      .from('task_pauses')
      .select('id')
      .eq('task_id', taskId)
      .is('resumed_at', null)
      .order('paused_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (openPause) {
      await supabase.from('task_pauses').update({ resumed_at: now }).eq('id', openPause.id);
    }
    update.completed_at = now;
    if (!task.started_at) update.started_at = now;
  }

  await supabase.from('tasks').update(update).eq('id', taskId);

  revalidatePath('/dashboard');
  if (newStatus === 'done') revalidatePath('/archive');
}
