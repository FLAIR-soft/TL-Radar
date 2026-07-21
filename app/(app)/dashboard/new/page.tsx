import { redirect, notFound } from 'next/navigation';
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();

  if (profile?.role !== 'editor' && profile?.role !== 'admin') {
    redirect('/dashboard');
  }

  if (!edit) {
    return <TaskForm action={createTask} editing={null} />;
  }

  const { data: task } = await supabase.from('tasks').select('*').eq('id', edit).single();
  if (!task) notFound();

  return (
    <TaskForm
      action={editTaskFields.bind(null, task.id)}
      editing={{
        person: task.person,
        title: task.title,
        description: task.description ?? '',
        location: task.location ?? '',
        deadline: task.deadline ?? '',
      }}
    />
  );
}
