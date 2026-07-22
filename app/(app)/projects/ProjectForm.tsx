'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { IconPicker } from '@/components/IconPicker';
import { PrioritySelect } from '@/components/PrioritySelect';
import type { ProjectFormState } from './actions';

const initialState: ProjectFormState = { error: null };

export function ProjectForm({
  action,
  editing,
  profiles,
  onSaved,
  onCancel,
}: {
  action: (prevState: ProjectFormState, formData: FormData) => Promise<ProjectFormState>;
  editing: {
    name: string;
    description: string;
    location: string;
    ownerId: string;
    icon: string;
    priority: string;
  } | null;
  profiles: { id: string; name: string }[];
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const dict = useDictionary();
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      if (editing) {
        onSaved?.();
      } else {
        formRef.current?.reset();
      }
    }
    wasPending.current = pending;
  }, [pending, state.error, editing, onSaved]);

  return (
    <form ref={formRef} className="form-card project-form" action={formAction}>
      {state.error && <div className="error-note">{state.error}</div>}
      <div className="field">
        <label>{dict.projects.nameLabel}</label>
        <div className="title-with-icon">
          <IconPicker name="icon" defaultValue={editing?.icon ?? null} />
          <input type="text" name="name" defaultValue={editing?.name} placeholder={dict.projects.namePlaceholder} required />
        </div>
      </div>
      <div className="row2">
        <div className="field">
          <label>{dict.projects.locationLabel}</label>
          <input
            type="text"
            name="location"
            defaultValue={editing?.location}
            placeholder={dict.projects.locationPlaceholder}
          />
        </div>
        <div className="field">
          <label>{dict.projects.ownerLabel}</label>
          <select name="ownerId" defaultValue={editing?.ownerId ?? ''}>
            <option value="">{dict.projects.noOwner}</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label>{dict.priority.label}</label>
        <PrioritySelect name="priority" defaultValue={editing?.priority ?? null} />
      </div>
      <div className="field">
        <label>{dict.projects.descriptionLabel}</label>
        <textarea
          name="description"
          defaultValue={editing?.description}
          placeholder={dict.projects.descriptionPlaceholder}
        />
      </div>
      <div className="form-actions">
        <button className="btn btn-primary" disabled={pending} type="submit">
          {pending && <span className="btn-spinner" />}
          {editing ? dict.projects.saveButton : dict.projects.addButton}
        </button>
        {editing && (
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={pending}>
            {dict.projects.cancel}
          </button>
        )}
      </div>
    </form>
  );
}
