'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { logActivity } from '@/lib/logic/activity-log';
import type { Priority } from '@/lib/supabase/types';

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

export interface ProjectFormState {
  error: string | null;
}

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];

function readProjectFields(formData: FormData) {
  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const location = String(formData.get('location') || '').trim();
  const ownerId = String(formData.get('ownerId') || '').trim();
  const icon = String(formData.get('icon') || '').trim();
  const priorityRaw = String(formData.get('priority') || '').trim();
  return {
    name,
    description: description || null,
    location: location || null,
    owner_id: ownerId || null,
    icon: icon || null,
    priority: ((PRIORITIES as string[]).includes(priorityRaw) ? priorityRaw : null) as Priority | null,
  };
}

export async function createProject(
  _prevState: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  const { supabase, userId, dict } = await requireAuth();
  const fields = readProjectFields(formData);

  if (!fields.name) {
    return { error: dict.projects.errors.missingName };
  }

  const { data: project, error } = await supabase
    .from('projects')
    .insert({ ...fields, created_by: userId })
    .select('id')
    .single();

  if (error || !project) {
    return { error: error?.message ?? dict.projects.errors.missingName };
  }

  await logActivity(supabase, 'project', project.id, 'created', userId, { name: fields.name });

  revalidatePath('/projects');
  revalidatePath('/dashboard/new');
  return { error: null };
}

export async function editProject(
  projectId: string,
  _prevState: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  const { supabase, userId, dict } = await requireAuth();
  const fields = readProjectFields(formData);

  if (!fields.name) {
    return { error: dict.projects.errors.missingName };
  }

  const { error } = await supabase.from('projects').update(fields).eq('id', projectId);

  if (error) {
    return { error: error.message };
  }

  await logActivity(supabase, 'project', projectId, 'updated', userId, { name: fields.name });

  revalidatePath('/projects');
  revalidatePath('/dashboard/new');
  return { error: null };
}

export async function deleteProject(projectId: string) {
  const { supabase, userId } = await requireAuth();
  await supabase
    .from('projects')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', projectId);
  await logActivity(supabase, 'project', projectId, 'deleted', userId);
  revalidatePath('/projects');
  revalidatePath('/dashboard/new');
}
