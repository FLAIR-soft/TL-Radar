import { rows } from '@/lib/db/client';
import type { Task } from '@/lib/db/types';
import type { EmbeddedTaskRelations } from '@/lib/logic/task-relations';

export type TaskWithRelations = Task & EmbeddedTaskRelations;

// Связи задачи забираются одним запросом, а не по одному на каждую задачу.
// Раньше это делал PostgREST через embedded-ресурсы; на чистом Postgres —
// боковые соединения с агрегацией в JSON. Свойство обязано сохраниться:
// водопад запросов на каждую карточку однажды убрали сознательно.
const RELATIONS = `
  coalesce(pz.items, '[]'::json) as task_pauses,
  coalesce(asg.items, '[]'::json) as task_assignees,
  coalesce(lb.items, '[]'::json) as task_labels,
  coalesce(w.n, 0) as watcher_count
`;

const RELATION_JOINS = `
  left join lateral (
    select json_agg(to_jsonb(p) order by p.paused_at) as items
    from task_pauses p where p.task_id = t.id
  ) pz on true
  left join lateral (
    select json_agg(json_build_object('assignee_email', a.assignee_email) order by a.added_at) as items
    from task_assignees a where a.task_id = t.id and a.removed_at is null
  ) asg on true
  left join lateral (
    select json_agg(json_build_object('label_id', tl.label_id)) as items
    from task_labels tl where tl.task_id = t.id
  ) lb on true
  left join lateral (
    select count(*)::int as n from task_watchers tw where tw.task_id = t.id
  ) w on true
`;

// Дашборду нужны не только счётчики: на карточке показывается превью
// последнего комментария и первых пунктов чек-листа.
const DETAIL_RELATIONS = `
  coalesce(cm.items, '[]'::json) as task_comments,
  coalesce(cl.items, '[]'::json) as task_checklist_items
`;

const DETAIL_JOINS = `
  left join lateral (
    select json_agg(json_build_object(
             'id', c.id, 'body', c.body, 'author', c.author, 'created_at', c.created_at
           ) order by c.created_at) as items
    from task_comments c where c.task_id = t.id and c.deleted_at is null
  ) cm on true
  left join lateral (
    select json_agg(json_build_object(
             'id', i.id, 'title', i.title, 'done', i.done, 'position', i.position
           ) order by i.position) as items
    from task_checklist_items i where i.task_id = t.id and i.deleted_at is null
  ) cl on true
`;

/** Активные задачи для борда, таблицы и календаря. */
export function loadActiveTasks(): Promise<TaskWithRelations[]> {
  return rows<TaskWithRelations>(`
    select t.*, ${RELATIONS}, ${DETAIL_RELATIONS}
    from tasks t
    ${RELATION_JOINS}
    ${DETAIL_JOINS}
    where t.deleted_at is null and t.status <> 'done'
    order by t.created_at
  `);
}

/** Одна задача со всеми связями — для панели задачи. */
export async function loadTask(id: string): Promise<TaskWithRelations | null> {
  const result = await rows<TaskWithRelations>(`
    select t.*, ${RELATIONS}, ${DETAIL_RELATIONS}
    from tasks t
    ${RELATION_JOINS}
    ${DETAIL_JOINS}
    where t.id = $1 and t.deleted_at is null
  `, [id]);
  return result[0] ?? null;
}

/**
 * Завершённые задачи для архива. Комментарии и чек-листы здесь не нужны
 * построчно — только счётчик комментариев, поэтому запрос легче.
 */
export function loadArchivedTasks(): Promise<TaskWithRelations[]> {
  return rows<TaskWithRelations>(`
    select t.*, ${RELATIONS},
           coalesce(cmc.n, 0) as comment_count
    from tasks t
    ${RELATION_JOINS}
    left join lateral (
      select count(*)::int as n from task_comments c
      where c.task_id = t.id and c.deleted_at is null
    ) cmc on true
    where t.deleted_at is null and t.status = 'done'
    order by t.completed_at desc nulls last
  `);
}
