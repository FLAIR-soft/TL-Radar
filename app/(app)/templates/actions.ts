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

  const { data: profile } = await supabase.from('profiles').select('locale').eq('id', user.id).single();
  const dict = getDictionary(profile?.locale ?? 'de');

  return { supabase, userId: user.id, dict };
}

// Shablony (Etap 7) sozdayutsya tol'ko iz sushchestvuyushchey zadachi — sam
// shablon posle sozdaniya izmenit' nel'zya (tol'ko spisok + myagkoye
// udaleniye), po roadmapu.
export async function createTemplateFromTask(taskId: string): Promise<{ error?: string }> {
  const { supabase, userId, dict } = await requireAuth();

  const { data: task } = await supabase
    .from('tasks')
    .select('title, description, location, estimated_minutes, priority, icon, project_id')
    .eq('id', taskId)
    .single();

  if (!task) return { error: dict.templates.errors.taskNotFound };

  const { data: checklistItems } = await supabase
    .from('task_checklist_items')
    .select('title')
    .eq('task_id', taskId)
    .is('deleted_at', null)
    .order('position', { ascending: true });

  const checklist = (checklistItems ?? []).map((i) => i.title);

  const { error } = await supabase.from('task_templates').insert({
    title: task.title,
    description: task.description || null,
    location: task.location || null,
    estimated_minutes: task.estimated_minutes,
    priority: task.priority,
    icon: task.icon,
    project_id: task.project_id,
    checklist: checklist.length ? checklist : null,
    created_by: userId,
  });

  if (error) return { error: error.message };

  revalidatePath('/templates');
  return {};
}

export async function deleteTemplate(id: string): Promise<void> {
  const { supabase } = await requireAuth();

  await supabase.from('task_templates').update({ deleted_at: new Date().toISOString() }).eq('id', id);

  revalidatePath('/templates');
}
