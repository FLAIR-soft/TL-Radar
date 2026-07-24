'use client';

import { useDictionary } from '@/lib/i18n/LocaleContext';

export function PrioritySelect({ name, defaultValue }: { name: string; defaultValue: string | null }) {
  const dict = useDictionary();
  return (
    <select name={name} defaultValue={defaultValue ?? ''}>
      <option value="">{dict.priority.none}</option>
      <option value="low">{dict.priority.low}</option>
      <option value="medium">{dict.priority.medium}</option>
      <option value="high">{dict.priority.high}</option>
      <option value="urgent">{dict.priority.urgent}</option>
    </select>
  );
}
