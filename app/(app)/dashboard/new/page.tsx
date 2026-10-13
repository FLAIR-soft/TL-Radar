import { notFound } from 'next/navigation';
import { row, rows } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/auth/current-user';
import { createTask, editTaskFields } from '../actions';
import { TaskForm } from './TaskForm';
import type { Label, Person, Project, Task, TaskTemplate } from '@/lib/db/types';

// Идентификаторы в адресной строке приходят от пользователя. PostgREST на
// нечитаемый uuid отвечал «ничего не найдено», а драйвер pg бросает ошибку
// разбора — поэтому заведомо неверное значение отсекается до запроса, чтобы
// страница по-прежнему отдавала 404, а не падала.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; template?: string }>;
}) {
  const { edit, template: rawTemplateId } = await searchParams;
  // Непригодный ?template= ведёт себя как его отсутствие — и форма не
  // унесёт такое значение в createTask скрытым полем.
  const templateId = rawTemplateId && UUID_RE.test(rawTemplateId) ? rawTemplateId : null;

  const user = await getCurrentUser();

  const [people, activeProjects, templateList, labelList] = await Promise.all([
    rows<Pick<Person, 'email' | 'display_name'>>(
      `select email, display_name from people order by coalesce(display_name, email)`
    ),
    rows<Pick<Project, 'id' | 'name' | 'color'>>(
      `select id, name, color from projects where deleted_at is null order by name`
    ),
    rows<Pick<TaskTemplate, 'id' | 'title'>>(
      `select id, title from task_templates where deleted_at is null order by title`
    ),
    rows<Label>(`select * from labels where deleted_at is null order by name`),
  ]);

  // Форма принимает список людей как { id, name }; идентификатором человека
  // теперь служит почта — саму форму из-за этого не переименовываем.
  const assignees = people.map((p) => ({ id: p.email, name: p.display_name ?? p.email }));
  const projects = activeProjects;
  const templates = templateList;
  const labels = labelList;

  if (!edit) {
    let editingFromTemplate = null;
    if (templateId) {
      const template = await row<TaskTemplate>(
        `select * from task_templates where id = $1 and deleted_at is null`,
        [templateId]
      );
      if (template) {
        editingFromTemplate = {
          title: template.title,
          description: template.description ?? '',
          location: template.location ?? '',
          deadline: '',
          assigneeIds: [user.email],
          labelIds: [],
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
        labels={labels}
        currentUserId={user.email}
      />
    );
  }

  if (!UUID_RE.test(edit)) notFound();

  const task = await row<Task>(`select * from tasks where id = $1 and deleted_at is null`, [edit]);
  if (!task) notFound();

  const [currentAssignees, currentLabels] = await Promise.all([
    rows<{ assignee_email: string }>(
      `select assignee_email from task_assignees where task_id = $1 and removed_at is null`,
      [task.id]
    ),
    rows<{ label_id: string }>(`select label_id from task_labels where task_id = $1`, [task.id]),
  ]);

  return (
    <TaskForm
      action={editTaskFields.bind(null, task.id)}
      editingTaskId={task.id}
      editing={{
        title: task.title,
        description: task.description ?? '',
        location: task.location ?? '',
        deadline: task.deadline ?? '',
        assigneeIds: currentAssignees.map((a) => a.assignee_email),
        labelIds: currentLabels.map((l) => l.label_id),
        projectId: task.project_id ?? '',
        estimatedMinutes: task.estimated_minutes ? String(task.estimated_minutes) : '',
        icon: task.icon ?? '',
        priority: task.priority ?? '',
      }}
      assignees={assignees}
      projects={projects}
      labels={labels}
      currentUserId={user.email}
    />
  );
}
