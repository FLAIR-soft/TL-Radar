'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { createProject, type ProjectFormState } from './actions';

const initialState: ProjectFormState = { error: null };

export function NewProjectForm() {
  const dict = useDictionary();
  const [state, formAction, pending] = useActionState(createProject, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      formRef.current?.reset();
    }
    wasPending.current = pending;
  }, [pending, state.error]);

  return (
    <form ref={formRef} className="project-new-form" action={formAction}>
      {state.error && <div className="error-note">{state.error}</div>}
      <input type="text" name="name" placeholder={dict.projects.namePlaceholder} required />
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending && <span className="btn-spinner" />}
        {dict.projects.addButton}
      </button>
    </form>
  );
}
