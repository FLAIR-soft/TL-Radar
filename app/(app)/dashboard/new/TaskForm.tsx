'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { AssigneeSelect } from './AssigneeSelect';
import { IconPicker } from '@/components/IconPicker';
import { PrioritySelect } from '@/components/PrioritySelect';
import type { TaskFormState } from '../actions';

const initialState: TaskFormState = { error: null };

export function TaskForm({
  action,
  editing,
  assignees,
  projects,
  currentUserId,
}: {
  action: (prevState: TaskFormState, formData: FormData) => Promise<TaskFormState>;
  editing: {
    title: string;
    description: string;
    location: string;
    deadline: string;
    assigneeIds: string[];
    projectId: string;
    estimatedMinutes: string;
    icon: string;
    priority: string;
  } | null;
  assignees: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  currentUserId: string;
}) {
  const dict = useDictionary();
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="page-fade">
      <h2 className="section-title">{editing ? dict.taskForm.editTitle : dict.taskForm.newTitle}</h2>
      <p className="section-sub">{dict.taskForm.subtitle}</p>
      <div className="form-card">
        <form action={formAction}>
          {state.error && <div className="error-note">{state.error}</div>}
          <div className="field">
            <label>{dict.taskForm.title}</label>
            <div className="title-with-icon">
              <IconPicker name="icon" defaultValue={editing?.icon ?? null} />
              <input
                type="text"
                name="title"
                defaultValue={editing?.title}
                placeholder={dict.taskForm.titlePlaceholder}
              />
            </div>
          </div>
          <div className="field">
            <label>{dict.taskForm.assignees}</label>
            <AssigneeSelect
              assignees={assignees}
              defaultSelected={editing ? editing.assigneeIds : [currentUserId]}
            />
          </div>
          <div className="row2">
            <div className="field">
              <label>{dict.taskForm.project}</label>
              <select name="projectId" defaultValue={editing?.projectId ?? ''}>
                <option value="">{dict.taskForm.noProject}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{dict.taskForm.deadline}</label>
              <input type="date" name="deadline" defaultValue={editing?.deadline} />
            </div>
          </div>
          <div className="field">
            <label>{dict.priority.label}</label>
            <PrioritySelect name="priority" defaultValue={editing?.priority ?? null} />
          </div>
          <div className="field">
            <label>{dict.taskForm.estimate}</label>
            <input
              type="number"
              name="estimatedMinutes"
              min={1}
              step={1}
              defaultValue={editing?.estimatedMinutes}
              placeholder={dict.taskForm.estimatePlaceholder}
            />
          </div>
          <div className="field">
            <label>{dict.taskForm.location}</label>
            <input
              type="text"
              name="location"
              defaultValue={editing?.location}
              placeholder={dict.taskForm.locationPlaceholder}
            />
          </div>
          <div className="field">
            <label>{dict.taskForm.description}</label>
            <textarea
              name="description"
              defaultValue={editing?.description}
              placeholder={dict.taskForm.descriptionPlaceholder}
            />
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" disabled={pending} type="submit">
              {pending && <span className="btn-spinner" />}
              {editing ? dict.taskForm.submitEdit : dict.taskForm.submitNew}
            </button>
            {editing && (
              <Link href="/dashboard" className="btn btn-ghost">
                {dict.taskForm.cancel}
              </Link>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
