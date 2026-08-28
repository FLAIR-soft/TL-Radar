-- Этап 3 оптимизации: GET /api/notifications?full=1 раньше грузил
-- notifications, затем отдельным запросом tasks по task_id — 2
-- последовательных обращения к БД. task_id намеренно без FK (см. 0020:
-- полиморфная ссылка, уведомление не должно ломаться при изменениях
-- задачи), поэтому обычный PostgREST-embed (select=*,tasks(...)) тут не
-- выразим — вместо этого один SQL-запрос через RPC с обычным LEFT JOIN,
-- отсутствие FK-констрейнта это не меняет: если задача когда-нибудь
-- пропадёт, task_title/task_status просто станут null.
create or replace function get_my_notifications(p_limit int default 30)
returns table (
  id uuid,
  recipient_id uuid,
  type text,
  task_id uuid,
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz,
  task_title text,
  task_status text
)
language sql
stable
security invoker
set search_path = public
as $$
  select n.id, n.recipient_id, n.type, n.task_id, n.payload, n.read_at, n.created_at,
         t.title as task_title, t.status::text as task_status
  from notifications n
  left join tasks t on t.id = n.task_id
  where n.recipient_id = auth.uid()
  order by n.created_at desc
  limit p_limit;
$$;

grant execute on function get_my_notifications(int) to authenticated;
