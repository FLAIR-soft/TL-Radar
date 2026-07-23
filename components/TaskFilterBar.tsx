'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X, LayoutGrid, Table2, Bookmark, Plus, Trash2 } from 'lucide-react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { AssigneeFilterSelect } from './AssigneeFilterSelect';
import { saveView, deleteSavedView } from '@/app/(app)/dashboard/saved-views-actions';

export function TaskFilterBar({
  profiles,
  projects,
  savedViews = [],
  view = 'kanban',
}: {
  profiles: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  savedViews?: { id: string; name: string; filters: { qs: string } }[];
  view?: 'kanban' | 'table';
}) {
  const dict = useDictionary();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [selectedViewId, setSelectedViewId] = useState('');
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

  function setView(next: 'kanban' | 'table') {
    updateParam('view', next === 'table' ? 'table' : null);
  }

  function applyView(qs: string) {
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  function handleSaveView() {
    const name = prompt(dict.savedViews.namePlaceholder);
    if (name === null) return;
    startTransition(() => {
      saveView(name, searchParams.toString()).then((result) => {
        if (result?.error) alert(result.error);
      });
    });
  }

  function handleDeleteSelectedView() {
    if (!selectedViewId || !confirm(dict.savedViews.deleteConfirm)) return;
    startTransition(() => {
      deleteSavedView(selectedViewId);
    });
    setSelectedViewId('');
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
      <div className="view-toggle">
        <button
          type="button"
          className={`icon-btn ${view === 'kanban' ? 'view-toggle-active' : ''}`}
          title={dict.table.viewKanban}
          onClick={() => setView('kanban')}
          data-testid="view-kanban"
        >
          <LayoutGrid size={16} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className={`icon-btn ${view === 'table' ? 'view-toggle-active' : ''}`}
          title={dict.table.viewTable}
          onClick={() => setView('table')}
          data-testid="view-table"
        >
          <Table2 size={16} strokeWidth={1.75} />
        </button>
      </div>
      <div className="saved-views">
        <Bookmark size={14} strokeWidth={1.75} />
        <select
          value={selectedViewId}
          onChange={(e) => {
            setSelectedViewId(e.target.value);
            const savedView = savedViews.find((v) => v.id === e.target.value);
            if (savedView) applyView(savedView.filters.qs);
          }}
          data-testid="saved-views-select"
        >
          <option value="">{dict.savedViews.placeholder}</option>
          {savedViews.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        {selectedViewId && (
          <button
            type="button"
            className="icon-btn"
            title={dict.savedViews.deleteTitle}
            onClick={handleDeleteSelectedView}
            data-testid="delete-view"
          >
            <Trash2 size={16} strokeWidth={1.75} />
          </button>
        )}
        <button type="button" className="icon-btn" title={dict.savedViews.saveButton} onClick={handleSaveView} data-testid="save-view">
          <Plus size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
