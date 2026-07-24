'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { SlideOver } from '@/components/SlideOver';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { createRecurringRule } from './rules-actions';
import { RecurringRuleForm } from './RecurringRuleForm';

export function CreateRecurringRulePanel({ templates }: { templates: { id: string; title: string }[] }) {
  const dict = useDictionary();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => setOpen(true)}
        data-testid="open-create-rule"
      >
        <Plus size={16} strokeWidth={1.75} />
        {dict.recurring.addButton}
      </button>
      <SlideOver open={open} onClose={() => setOpen(false)} title={dict.recurring.addButton}>
        <RecurringRuleForm action={createRecurringRule} templates={templates} onSaved={() => setOpen(false)} />
      </SlideOver>
    </>
  );
}
