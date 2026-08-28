'use client';

import { useState } from 'react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { PRIORITY_COLOR } from '@/lib/logic/priority';
import type { Priority } from '@/lib/supabase/types';

const OPTIONS: Priority[] = ['low', 'medium', 'high', 'urgent'];

// Четыре сегментные кнопки вместо выпадающего списка (редизайн v2, этап 10,
// скрин 07). Значение уходит в форму тем же скрытым input'ом с тем же name,
// поэтому серверный экшен не меняется. Повторное нажатие снимает выбор —
// «без приоритета» остаётся достижимым, как пустой option в селекте.
export function PrioritySegmented({ name, defaultValue }: { name: string; defaultValue: string | null }) {
  const dict = useDictionary();
  const [value, setValue] = useState(defaultValue ?? '');

  return (
    <div className="priority-segmented" role="group" aria-label={dict.priority.label}>
      <input type="hidden" name={name} value={value} />
      {OPTIONS.map((p) => (
        <button
          key={p}
          type="button"
          className={`priority-segment ${value === p ? 'is-active' : ''}`}
          style={{ ['--segment-color' as string]: PRIORITY_COLOR[p] }}
          aria-pressed={value === p}
          onClick={() => setValue((prev) => (prev === p ? '' : p))}
          data-testid={`priority-${p}`}
        >
          {dict.priority[p]}
        </button>
      ))}
    </div>
  );
}
