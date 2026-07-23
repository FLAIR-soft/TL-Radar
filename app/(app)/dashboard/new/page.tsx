import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createTask, editTaskFields } from '../actions';
import { TaskForm } from './TaskForm';

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; template?: string }>;
}) {
  const { edit, template: templateId } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profiles }, { data: activeProjects }, { data: templateList }] = await Promise.all([
    supabase.from('profiles').select('id, name').order('name'),
    supabase.from('projects').select('id, name').is('deleted_at', null).order('name'),
    supabase.from('task_templates').select('id, title').is('deleted_at', null).order('title'),
  ]);
  const assignees = profiles ?? [];
  const projects = activeProjects ?? [];
  const templates = templateList ?? [];

  if (!edit) {
    let editingFromTemplate = null;
    if (templateId) {
      const { data: template } = await supabase
        .from('task_templates')
        .select('*')
        .eq('id', templateId)
        .is('deleted_at', null)
        .single();
      if (template) {
        editingFromTemplate = {
          title: template.title,
          description: template.description ?? '',
          location: template.location ?? '',
          deadline: '',
          assigneeIds: [user!.id],
          projectId: template.project_id ?? '',
          estimatedMinutes: template.estimated_minutes ? String(template.estimated_minutes) : '',
          icon: template.icon ?? '',
          priority: template.priority ?? '',
        };
      }
    }

    return (
      <TaskForm
        key={templateId ?? 'new'}
        action={createTask}
        editing={editingFromTemplate}
        templates={templates}
        templateId={templateId ?? null}
        assignees={assignees}
        projects={projects}
        currentUserId={user!.id}
      />
    );
  }

  const { data: task } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', edit)
    .is('deleted_at', null)
    .single();
  if (!task) notFound();

  const { data: currentAssignees } = await supabase
    .from('task_assignees')
    .select('assignee_id')
    .eq('task_id', task.id)
    .is('removed_at', null);

  return (
    <TaskForm
      action={editTaskFields.bind(null, task.id)}
      editing={{
        title: task.title,
        description: task.description ?? '',
        location: task.location ?? '',
        deadline: task.deadline ?? '',
        assigneeIds: (currentAssignees ?? []).map((a) => a.assignee_id),
        projectId: task.project_id ?? '',
        estimatedMinutes: task.estimated_minutes ? String(task.estimated_minutes) : '',
        icon: task.icon ?? '',
        priority: task.priority ?? '',
      }}
      assignees={assignees}
      projects={projects}
      currentUserId={user!.id}
    />
  );
}
