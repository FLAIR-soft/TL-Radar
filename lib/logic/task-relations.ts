import type { Label, TaskPause } from '@/lib/supabase/types';
import { lastPausedBy } from './tasks';

// Форма строки задачи, полученной одним PostgREST-запросом с embedded
// task_pauses/task_assignees/task_labels (и опционально task_comments/
// task_checklist_items — не на всех страницах они нужны).
export type EmbeddedTaskRelations = {
  id: string;
  task_pauses: TaskPause[];
  task_assignees: { assignee_id: string }[];
  task_labels: { label_id: string }[];
  // task_comments(count) — PostgREST-агрегат, всегда один элемент [{ count }].
  task_comments?: { count: number }[];
  task_checklist_items?: { done: boolean }[];
};

export type TaskRelationMaps = {
  pausesByTask: Map<string, TaskPause[]>;
  pausedByNameByTask: Map<string, string | null>;
  assigneeNamesByTask: Map<string, string[]>;
  assigneeIdsByTask: Map<string, string[]>;
  commentCountsByTask: Map<string, number>;
  checklistProgressByTask: Map<string, { done: number; total: number }>;
  labelIdsByTask: Map<string, string[]>;
  labelsByTask: Map<string, Label[]>;
};

// Раскладывает embedded-связи из одного запроса задач в те же Map-структуры,
// которые раньше собирались из 4-5 отдельных запросов по task_id.
export function buildTaskRelationMaps(
  tasks: EmbeddedTaskRelations[],
  profileNames: Map<string, string>,
  labelById: Map<string, Label>
): TaskRelationMaps {
  const pausesByTask = new Map<string, TaskPause[]>();
  const pausedByNameByTask = new Map<string, string | null>();
  const assigneeNamesByTask = new Map<string, string[]>();
  const assigneeIdsByTask = new Map<string, string[]>();
  const commentCountsByTask = new Map<string, number>();
  const checklistProgressByTask = new Map<string, { done: number; total: number }>();
  const labelIdsByTask = new Map<string, string[]>();
  const labelsByTask = new Map<string, Label[]>();

  for (const t of tasks) {
    pausesByTask.set(t.id, t.task_pauses);
    const pausedById = lastPausedBy(t.task_pauses);
    pausedByNameByTask.set(t.id, pausedById ? profileNames.get(pausedById) ?? null : null);

    const assigneeIds = t.task_assignees.map((a) => a.assignee_id);
    assigneeIdsByTask.set(t.id, assigneeIds);
    assigneeNamesByTask.set(
      t.id,
      assigneeIds.map((id) => profileNames.get(id)).filter((n): n is string => !!n)
    );

    if (t.task_comments) {
      commentCountsByTask.set(t.id, t.task_comments[0]?.count ?? 0);
    }
    if (t.task_checklist_items) {
      const done = t.task_checklist_items.filter((c) => c.done).length;
      checklistProgressByTask.set(t.id, { done, total: t.task_checklist_items.length });
    }

    const labelIds = t.task_labels.map((l) => l.label_id);
    labelIdsByTask.set(t.id, labelIds);
    labelsByTask.set(
      t.id,
      labelIds.map((id) => labelById.get(id)).filter((l): l is Label => !!l)
    );
  }

  return {
    pausesByTask,
    pausedByNameByTask,
    assigneeNamesByTask,
    assigneeIdsByTask,
    commentCountsByTask,
    checklistProgressByTask,
    labelIdsByTask,
    labelsByTask,
  };
}
