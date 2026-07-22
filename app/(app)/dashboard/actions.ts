'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { isWithinWorkHours } from '@/lib/logic/tasks';
import { logActivity } from '@/lib/logic/activity-log';
import type { TaskStatus, Priority } from '@/lib/supabase/types';

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('locale')
    .eq('id', user.id)
    .single();

  const dict = getDictionary(profile?.locale ?? 'de');

  return { supabase, userId: user.id, dict };
}

export interface TaskFormState {
  error: string | null;
}

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];

function readPriority(formData: FormData): Priority | null {
  const raw = String(formData.get('priority') || '').trim();
  return (PRIORITIES as string[]).includes(raw) ? (raw as Priority) : null;
}

function readTaskFields(formData: FormData) {
  const estimatedRaw = String(formData.get('estimatedMinutes') || '').trim();
  const estimatedMinutes = estimatedRaw ? Number(estimatedRaw) : null;

  return {
    title: String(formData.get('title') || '').trim(),
    description: String(formData.get('description') || '').trim(),
    location: String(formData.get('location') || '').trim(),
    deadline: (String(formData.get('deadline') || '').trim() || null) as string | null,
    project_id: (String(formData.get('projectId') || '').trim() || null) as string | null,
    estimated_minutes: estimatedMinutes && estimatedMinutes > 0 ? Math.round(estimatedMinutes) : null,
    icon: (String(formData.get('icon') || '').trim() || null) as string | null,
    priority: readPriority(formData),
  };
}

function readAssigneeIds(formData: FormData): string[] {
  return formData
    .getAll('assigneeIds')
    .map((v) => String(v).trim())
    .filter(Boolean);
}

export async function createTask(_prevState: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const { supabase, userId, dict } = await requireAuth();
  const fields = readTaskFields(formData);
  const assigneeIds = readAssigneeIds(formData);

  if (!fields.title) {
    return { error: dict.taskForm.errors.missingFields };
  }
  if (!assigneeIds.length) {
    return { error: dict.taskForm.errors.missingAssignee };
  }

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      ...fields,
      status: 'waiting',
      created_by: userId,
      updated_by: userId,
    })
    .select('id')
    .single();

  if (error || !task) {
    return { error: error?.message ?? dict.taskForm.errors.missingFields };
  }

  const now = new Date().toISOString();
  await supabase.from('task_assignees').insert(
    assigneeIds.map((assignee_id) => ({
      task_id: task.id,
      assignee_id,
      added_at: now,
      added_by: userId,
    }))
  );

  await logActivity(supabase, 'task', task.id, 'created', userId, { title: fields.title });
  for (const assigneeId of assigneeIds) {
    await logActivity(supabase, 'task', task.id, 'assignee_added', userId, { assigneeId });
  }

  revalidatePath('/dashboard');
  redirect('/dashboard');
}

export async function editTaskFields(
  taskId: string,
  _prevState: TaskFormState,
  formData: FormData
): Promise<TaskFormState> {
  const { supabase, userId, dict } = await requireAuth();
  const fields = readTaskFields(formData);
  const assigneeIds = readAssigneeIds(formData);

  if (!fields.title) {
    return { error: dict.taskForm.errors.missingFields };
  }
  if (!assigneeIds.length) {
    return { error: dict.taskForm.errors.missingAssignee };
  }

  const { error } = await supabase
    .from('tasks')
    .update({ ...fields, updated_by: userId })
    .eq('id', taskId);

  if (error) {
    return { error: error.message };
  }

  await logActivity(supabase, 'task', taskId, 'updated', userId, { title: fields.title });

  const { data: current } = await supabase
    .from('task_assignees')
    .select('id, assignee_id')
    .eq('task_id', taskId)
    .is('removed_at', null);

  const currentIds = new Set((current ?? []).map((a) => a.assignee_id));
  const newIds = new Set(assigneeIds);
  const now = new Date().toISOString();

  const toRemove = (current ?? []).filter((a) => !newIds.has(a.assignee_id));
  const toAdd = assigneeIds.filter((id) => !currentIds.has(id));

  if (toRemove.length) {
    await supabase
      .from('task_assignees')
      .update({ removed_at: now, removed_by: userId })
      .in(
        'id',
        toRemove.map((a) => a.id)
      );
    for (const a of toRemove) {
      await logActivity(supabase, 'task', taskId, 'assignee_removed', userId, { assigneeId: a.assignee_id });
    }
  }
  if (toAdd.length) {
    await supabase.from('task_assignees').insert(
      toAdd.map((assignee_id) => ({
        task_id: taskId,
        assignee_id,
        added_at: now,
        added_by: userId,
      }))
    );
    for (const assigneeId of toAdd) {
      await logActivity(supabase, 'task', taskId, 'assignee_added', userId, { assigneeId });
    }
  }

  revalidatePath('/dashboard');
  redirect('/dashboard');
}

export async function deleteTask(taskId: string) {
  const { supabase, userId } = await requireAuth();
  await supabase
    .from('tasks')
    .update({ deleted_at: new Date().toISOString(), updated_by: userId })
    .eq('id', taskId);
  await logActivity(supabase, 'task', taskId, 'deleted', userId);
  revalidatePath('/dashboard');
  revalidatePath('/archive');
}

export async function setStatus(taskId: string, newStatus: TaskStatus): Promise<{ error?: string }> {
  const { supabase, userId, dict } = await requireAuth();

  if (!isWithinWorkHours()) {
    return { error: dict.taskCard.outsideWorkHours };
  }

  const { data: task } = await supabase
    .from('tasks')
    .select('status, started_at')
    .eq('id', taskId)
    .single();

  if (!task) return {};

  const now = new Date().toISOString();
  const update: {
    status: TaskStatus;
    started_at?: string;
    completed_at?: string;
    updated_by: string;
  } = {
    status: newStatus,
    updated_by: userId,
  };

  if (newStatus === 'in_progress' && !task.started_at) {
    update.started_at = now;
  }

  if (task.status === 'in_progress' && newStatus === 'paused') {
    await supabase
      .from('task_pauses')
      .insert({ task_id: taskId, paused_at: now, resumed_at: null, auto: false, created_by: userId });
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
  await logActivity(supabase, 'task', taskId, 'status_changed', userId, {
    from: task.status,
    to: newStatus,
  });

  revalidatePath('/dashboard');
  if (newStatus === 'done') revalidatePath('/archive');
  return {};
}
