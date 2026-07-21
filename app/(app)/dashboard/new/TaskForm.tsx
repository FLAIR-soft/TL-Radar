'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import type { TaskFormState } from '../actions';

const initialState: TaskFormState = { error: null };

export function TaskForm({
  action,
  editing,
}: {
  action: (prevState: TaskFormState, formData: FormData) => Promise<TaskFormState>;
  editing: {
    person: string;
    title: string;
    description: string;
    location: string;
    deadline: string;
  } | null;
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
          <div className="row2">
            <div className="field">
              <label>{dict.taskForm.person}</label>
              <input
                type="text"
                name="person"
                defaultValue={editing?.person}
                placeholder={dict.taskForm.personPlaceholder}
              />
            </div>
            <div className="field">
              <label>{dict.taskForm.deadline}</label>
              <input type="date" name="deadline" defaultValue={editing?.deadline} />
            </div>
          </div>
          <div className="field">
            <label>{dict.taskForm.title}</label>
            <input
              type="text"
              name="title"
              defaultValue={editing?.title}
              placeholder={dict.taskForm.titlePlaceholder}
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
          <div className="field">
            <label>{dict.taskForm.location}</label>
            <input
              type="text"
              name="location"
              defaultValue={editing?.location}
              placeholder={dict.taskForm.locationPlaceholder}
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
