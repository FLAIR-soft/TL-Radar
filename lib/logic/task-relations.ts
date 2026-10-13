import type { Label, TaskPause } from '@/lib/db/types';
import { lastPausedBy } from './tasks';

// Форма строки задачи из одного SQL-запроса с боковыми соединениями
// (lib/db/queries/tasks.ts): связи приходят JSON-массивами, счётчики числами.
// Ту же форму раньше давал PostgREST через embedded-ресурсы.
export type EmbeddedTaskRelations = {
  id: string;
  task_pauses: TaskPause[];
  task_assignees: { assignee_email: string }[];
  task_labels: { label_id: string }[];
  // Дашборд берёт комментарии строками — на карточке показывается превью
  // последнего. Архиву достаточно счётчика, поэтому запрос там легче.
  task_comments?: { id: string; body: string; author: string | null; created_at: string }[];
  comment_count?: number;
  task_checklist_items?: { id: string; title: string; done: boolean; position: number }[];
  watcher_count?: number;
};

export type ChecklistPreviewItem = { id: string; title: string; done: boolean };
export type LastComment = { id: string; body: string; author: string | null; createdAt: string };

export type TaskRelationMaps = {
  pausesByTask: Map<string, TaskPause[]>;
  pausedByNameByTask: Map<string, string | null>;
  assigneeNamesByTask: Map<string, string[]>;
  assigneeEmailsByTask: Map<string, string[]>;
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
  nameByEmail: Map<string, string>,
  labelById: Map<string, Label>
): TaskRelationMaps {
  const pausesByTask = new Map<string, TaskPause[]>();
  const pausedByNameByTask = new Map<string, string | null>();
  const assigneeNamesByTask = new Map<string, string[]>();
  const assigneeEmailsByTask = new Map<string, string[]>();
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
    pausedByNameByTask.set(t.id, pausedById ? nameByEmail.get(pausedById) ?? null : null);

    const assigneeEmails = t.task_assignees.map((a) => a.assignee_email);
    assigneeEmailsByTask.set(t.id, assigneeEmails);
    // Человек, добавленный по почте и ещё не заходивший, имени не имеет —
    // показываем адрес, а не выбрасываем его из списка исполнителей.
    assigneeNamesByTask.set(t.id, assigneeEmails.map((e) => nameByEmail.get(e) ?? e));

    if (t.comment_count !== undefined) commentCountsByTask.set(t.id, t.comment_count);
    if (t.task_comments) {
      const rows = t.task_comments;
      if (t.comment_count === undefined) commentCountsByTask.set(t.id, rows.length);
      // SQL отдаёт комментарии по возрастанию created_at — последний в конце.
      const newest = rows[rows.length - 1];
      if (newest) {
        lastCommentByTask.set(t.id, {
          id: newest.id,
          body: newest.body,
          author: newest.author,
          createdAt: newest.created_at,
        });
      }
    }
    if (t.task_checklist_items) {
      const done = t.task_checklist_items.filter((c) => c.done).length;
      checklistProgressByTask.set(t.id, { done, total: t.task_checklist_items.length });
      // Порядок задан в SQL (order by position), пересортировка не нужна.
      checklistItemsByTask.set(
        t.id,
        t.task_checklist_items.map((c) => ({ id: c.id, title: c.title, done: c.done }))
      );
    }
    if (t.watcher_count !== undefined) {
      watcherCountsByTask.set(t.id, t.watcher_count);
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
    assigneeEmailsByTask,
    commentCountsByTask,
    checklistProgressByTask,
    checklistItemsByTask,
    watcherCountsByTask,
    lastCommentByTask,
    labelIdsByTask,
    labelsByTask,
  };
}
