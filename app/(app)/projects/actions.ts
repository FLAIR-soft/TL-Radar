'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/get-dictionary';

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

function readProjectFields(formData: FormData) {
  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const location = String(formData.get('location') || '').trim();
  const ownerId = String(formData.get('ownerId') || '').trim();
  return {
    name,
    description: description || null,
    location: location || null,
    owner_id: ownerId || null,
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

  const { error } = await supabase.from('projects').insert({ ...fields, created_by: userId });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/projects');
  revalidatePath('/dashboard/new');
  return { error: null };
}

export async function editProject(
  projectId: string,
  _prevState: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  const { supabase, dict } = await requireAuth();
  const fields = readProjectFields(formData);

  if (!fields.name) {
    return { error: dict.projects.errors.missingName };
  }

  const { error } = await supabase.from('projects').update(fields).eq('id', projectId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/projects');
  revalidatePath('/dashboard/new');
  return { error: null };
}

export async function deleteProject(projectId: string) {
  const { supabase } = await requireAuth();
  await supabase
    .from('projects')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', projectId);
  revalidatePath('/projects');
  revalidatePath('/dashboard/new');
}
