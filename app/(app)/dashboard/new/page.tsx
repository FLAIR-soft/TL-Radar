import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createTask, editTaskFields } from '../actions';
import { TaskForm } from './TaskForm';

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profiles }, { data: activeProjects }] = await Promise.all([
    supabase.from('profiles').select('id, name').order('name'),
    supabase.from('projects').select('id, name').is('deleted_at', null).order('name'),
  ]);
  const assignees = profiles ?? [];
  const projects = activeProjects ?? [];

  if (!edit) {
    return (
      <TaskForm
        action={createTask}
        editing={null}
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

  return (
    <TaskForm
      action={editTaskFields.bind(null, task.id)}
      editing={{
        title: task.title,
        description: task.description ?? '',
        location: task.location ?? '',
        deadline: task.deadline ?? '',
        assigneeId: task.assignee_id ?? '',
        projectId: task.project_id ?? '',
      }}
      assignees={assignees}
      projects={projects}
      currentUserId={user!.id}
    />
  );
}
