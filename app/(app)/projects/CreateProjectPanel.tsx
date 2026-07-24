'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { SlideOver } from '@/components/SlideOver';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { createProject } from './actions';
import { ProjectForm } from './ProjectForm';

export function CreateProjectPanel({ profiles }: { profiles: { id: string; name: string }[] }) {
  const dict = useDictionary();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => setOpen(true)}
        data-testid="open-create-project"
      >
        <Plus size={16} strokeWidth={1.75} />
        {dict.projects.addButton}
      </button>
      <SlideOver open={open} onClose={() => setOpen(false)} title={dict.projects.addButton}>
        <ProjectForm action={createProject} editing={null} profiles={profiles} onSaved={() => setOpen(false)} />
      </SlideOver>
    </>
  );
}
