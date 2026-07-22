import type { Task, Priority } from '@/lib/supabase/types';
import { isOverdue } from './tasks';

export type DeadlineFilter = 'any' | 'has' | 'overdue';

export interface TaskFilters {
  q: string;
  assigneeIds: string[];
  projectId: string | null;
  priority: Priority | null;
  deadline: DeadlineFilter;
}

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];
const DEADLINE_FILTERS: DeadlineFilter[] = ['any', 'has', 'overdue'];

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseTaskFilters(searchParams: SearchParamsRecord): TaskFilters {
  const q = (firstValue(searchParams.q) ?? '').trim();

  const assigneeRaw = searchParams.assignee;
  const assigneeIds = Array.isArray(assigneeRaw) ? assigneeRaw : assigneeRaw ? [assigneeRaw] : [];

  const projectId = firstValue(searchParams.project) || null;

  const priorityRaw = firstValue(searchParams.priority);
  const priority = priorityRaw && (PRIORITIES as string[]).includes(priorityRaw) ? (priorityRaw as Priority) : null;

  const deadlineRaw = firstValue(searchParams.deadline);
  const deadline = (DEADLINE_FILTERS as string[]).includes(deadlineRaw ?? '') ? (deadlineRaw as DeadlineFilter) : 'any';

  return { q, assigneeIds, projectId, priority, deadline };
}

export function hasActiveFilters(filters: TaskFilters): boolean {
  return (
    filters.q.length > 0 ||
    filters.assigneeIds.length > 0 ||
    !!filters.projectId ||
    !!filters.priority ||
    filters.deadline !== 'any'
  );
}

// Filtratsiya vsegda na servere (Server Component chitayet searchParams i
// vyzyvayet eto pri render'e) — nikakogo kliyentskogo useEffect/fetch.
export function matchesTaskFilters(task: Task, taskAssigneeIds: string[], filters: TaskFilters): boolean {
  if (filters.q) {
    const haystack = `${task.title} ${task.description ?? ''}`.toLowerCase();
    if (!haystack.includes(filters.q.toLowerCase())) return false;
  }

  if (filters.assigneeIds.length > 0 && !filters.assigneeIds.some((id) => taskAssigneeIds.includes(id))) {
    return false;
  }

  if (filters.projectId) {
    if (filters.projectId === 'none') {
      if (task.project_id) return false;
    } else if (task.project_id !== filters.projectId) {
      return false;
    }
  }

  if (filters.priority && task.priority !== filters.priority) return false;

  if (filters.deadline === 'has' && !task.deadline) return false;
  if (filters.deadline === 'overdue' && !isOverdue(task)) return false;

  return true;
}
