'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { AssigneeSelect } from './AssigneeSelect';
import { LabelSelect } from './LabelSelect';
import { IconPicker } from '@/components/IconPicker';
import { PrioritySelect } from '@/components/PrioritySelect';
import type { TaskFormState } from '../actions';
import type { Label } from '@/lib/supabase/types';

const initialState: TaskFormState = { error: null };

export function TaskForm({
  action,
  editing,
  assignees,
  projects,
  labels,
  currentUserId,
  templates = [],
  templateId = null,
}: {
  action: (prevState: TaskFormState, formData: FormData) => Promise<TaskFormState>;
  editing: {
    title: string;
    description: string;
    location: string;
    deadline: string;
    assigneeIds: string[];
    labelIds: string[];
    projectId: string;
    estimatedMinutes: string;
    icon: string;
    priority: string;
  } | null;
  assignees: { id: string; name: string }[];
  projects: { id: string; name: string; color?: string | null }[];
  labels: Label[];
  currentUserId: string;
  templates?: { id: string; title: string }[];
  templateId?: string | null;
}) {
  const dict = useDictionary();
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialState);
  // Prefill'd from a template on the "new task" page still counts as
  // creating (not editing) — only editing an existing task (via ?edit=,
  // no templateId ever passed then) shows the edit-specific copy.
  const isEditingExisting = !!editing && !templateId;

  return (
    <div className="page-fade">
      <h2 className="section-title">{isEditingExisting ? dict.taskForm.editTitle : dict.taskForm.newTitle}</h2>
      <p className="section-sub">{dict.taskForm.subtitle}</p>
      <div className="form-card">
        <form action={formAction}>
          {state.error && <div className="error-note">{state.error}</div>}
          {templates.length > 0 && (
            <div className="field">
              <label>{dict.templates.useTemplate}</label>
              <select
                value={templateId ?? ''}
                onChange={(e) => router.push(e.target.value ? `/dashboard/new?template=${e.target.value}` : '/dashboard/new')}
              >
                <option value="">{dict.templates.noTemplate}</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          {templateId && <input type="hidden" name="templateId" value={templateId} />}
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
          <div className="field">
            <label>{dict.labels.title}</label>
            <LabelSelect labels={labels} defaultSelected={editing?.labelIds ?? []} />
          </div>
          <div className="row2">
            <div className="field">
              <label>{dict.taskForm.project}</label>
              <select name="projectId" defaultValue={editing?.projectId ?? ''}>
                <option value="">{dict.taskForm.noProject}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id} style={p.color ? { color: p.color } : undefined}>
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
              {isEditingExisting ? dict.taskForm.submitEdit : dict.taskForm.submitNew}
            </button>
            {isEditingExisting && (
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
