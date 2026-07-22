'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { AssigneeFilterSelect } from './AssigneeFilterSelect';

export function TaskFilterBar({
  profiles,
  projects,
}: {
  profiles: { id: string; name: string }[];
  projects: { id: string; name: string }[];
}) {
  const dict = useDictionary();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const firstRender = useRef(true);

  // startTransition marks these router.replace calls as interruptible: if the
  // user types again (or resets) before an earlier navigation lands, React
  // drops the stale one instead of letting it win a race and flicker the URL
  // back to an old filter value.
  function navigate(params: URLSearchParams) {
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  // Debounced push of the search text into the URL, so every keystroke
  // doesn't trigger a server round-trip or spam browser history.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const id = setTimeout(() => updateParam('q', q || null), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Search text is local state (debounced); every other control writes
  // straight to the URL, which is the single source of truth for filters.
  const assigneeIds = searchParams.getAll('assignee');
  const projectId = searchParams.get('project') ?? '';
  const priority = searchParams.get('priority') ?? '';
  const deadline = searchParams.get('deadline') ?? '';

  function updateParam(name: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(name, value);
    else params.delete(name);
    navigate(params);
  }

  function updateAssignees(ids: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('assignee');
    for (const id of ids) params.append('assignee', id);
    navigate(params);
  }

  const hasActiveFilters = q || assigneeIds.length > 0 || projectId || priority || deadline;

  function reset() {
    setQ('');
    navigate(new URLSearchParams());
  }

  return (
    <div className="filter-bar">
      <div className="filter-search">
        <Search size={16} strokeWidth={1.75} />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={dict.filters.searchPlaceholder}
        />
      </div>
      <AssigneeFilterSelect
        assignees={profiles}
        value={assigneeIds}
        onChange={updateAssignees}
        placeholder={dict.filters.assigneePlaceholder}
      />
      <select value={projectId} onChange={(e) => updateParam('project', e.target.value || null)}>
        <option value="">{dict.filters.allProjects}</option>
        <option value="none">{dict.filters.noProject}</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select value={priority} onChange={(e) => updateParam('priority', e.target.value || null)}>
        <option value="">{dict.filters.allPriorities}</option>
        <option value="low">{dict.priority.low}</option>
        <option value="medium">{dict.priority.medium}</option>
        <option value="high">{dict.priority.high}</option>
        <option value="urgent">{dict.priority.urgent}</option>
      </select>
      <select value={deadline} onChange={(e) => updateParam('deadline', e.target.value || null)}>
        <option value="">{dict.filters.anyDeadline}</option>
        <option value="has">{dict.filters.hasDeadline}</option>
        <option value="overdue">{dict.filters.overdueOnly}</option>
      </select>
      {hasActiveFilters && (
        <button type="button" className="filter-reset" onClick={reset} data-testid="reset-filters">
          <X size={14} strokeWidth={2} />
          {dict.filters.reset}
        </button>
      )}
    </div>
  );
}
