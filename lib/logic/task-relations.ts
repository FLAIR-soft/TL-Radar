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
  // Дашборд выбирает комментарии строками (нужен текст последнего для превью
  // на карточке), другие страницы — агрегатом task_comments(count). Считаем
  // оба варианта, чтобы карты собирались одинаково.
  task_comments?: { count?: number; id?: string; body?: string; author_id?: string | null; created_at?: string }[];
  // На дашборде выбираются с заголовками (для превью чек-листа на карточке),
  // в архиве embed'а нет вовсе — отсюда необязательные поля.
  task_checklist_items?: { id?: string; title?: string; done: boolean; position?: number }[];
  task_watchers?: { count: number }[];
};

export type ChecklistPreviewItem = { id: string; title: string; done: boolean };
export type LastComment = { id: string; body: string; authorId: string | null; createdAt: string };

export type TaskRelationMaps = {
  pausesByTask: Map<string, TaskPause[]>;
  pausedByNameByTask: Map<string, string | null>;
  assigneeNamesByTask: Map<string, string[]>;
  assigneeIdsByTask: Map<string, string[]>;
  commentCountsByTask: Map<string, number>;
  checklistProgressByTask: Map<string, { done: number; total: number }>;
  checklistItemsByTask: Map<string, ChecklistPreviewItem[]>;
  watcherCountsByTask: Map<string, number>;
  lastCommentByTask: Map<string, LastComment>;
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
  const checklistItemsByTask = new Map<string, ChecklistPreviewItem[]>();
  const watcherCountsByTask = new Map<string, number>();
  const lastCommentByTask = new Map<string, LastComment>();
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
      const rows = t.task_comments;
      commentCountsByTask.set(t.id, rows[0]?.count ?? rows.length);
      const newest = rows
        .filter((c): c is { id: string; body: string; author_id: string | null; created_at: string } => !!c.id && !!c.created_at)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
      if (newest) {
        lastCommentByTask.set(t.id, {
          id: newest.id,
          body: newest.body,
          authorId: newest.author_id ?? null,
          createdAt: newest.created_at,
        });
      }
    }
    if (t.task_checklist_items) {
      const done = t.task_checklist_items.filter((c) => c.done).length;
      checklistProgressByTask.set(t.id, { done, total: t.task_checklist_items.length });
      checklistItemsByTask.set(
        t.id,
        t.task_checklist_items
          .filter((c): c is { id: string; title: string; done: boolean; position?: number } => !!c.id && !!c.title)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((c) => ({ id: c.id, title: c.title, done: c.done }))
      );
    }
    if (t.task_watchers) {
      watcherCountsByTask.set(t.id, t.task_watchers[0]?.count ?? 0);
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
    checklistItemsByTask,
    watcherCountsByTask,
    lastCommentByTask,
    labelIdsByTask,
    labelsByTask,
  };
}
