-- Удаление пользователя (admin.auth.admin.deleteUser) каскадно удаляет
-- profiles-запись (см. 0001: profiles.id references auth.users on delete
-- cascade), но без этой миграции сама операция упала бы с ошибкой внешнего
-- ключа везде, где на profiles(id) ссылаются задачи/проекты/паузы —
-- история должна остаться, только с "автор неизвестен" вместо блокировки.
alter table tasks drop constraint tasks_created_by_fkey;
alter table tasks
  add constraint tasks_created_by_fkey foreign key (created_by) references profiles(id) on delete set null;

alter table tasks drop constraint tasks_updated_by_fkey;
alter table tasks
  add constraint tasks_updated_by_fkey foreign key (updated_by) references profiles(id) on delete set null;

alter table task_pauses drop constraint task_pauses_created_by_fkey;
alter table task_pauses
  add constraint task_pauses_created_by_fkey foreign key (created_by) references profiles(id) on delete set null;

alter table projects drop constraint projects_created_by_fkey;
alter table projects
  add constraint projects_created_by_fkey foreign key (created_by) references profiles(id) on delete set null;

alter table projects drop constraint projects_owner_id_fkey;
alter table projects
  add constraint projects_owner_id_fkey foreign key (owner_id) references profiles(id) on delete set null;

alter table task_assignees drop constraint task_assignees_added_by_fkey;
alter table task_assignees
  add constraint task_assignees_added_by_fkey foreign key (added_by) references profiles(id) on delete set null;

alter table task_assignees drop constraint task_assignees_removed_by_fkey;
alter table task_assignees
  add constraint task_assignees_removed_by_fkey foreign key (removed_by) references profiles(id) on delete set null;

-- assignee_id ne nullable — udalyonny pol'zovatel' ne mozhet ostavat'sya
-- naznachennym na zadachu, poetomu udalyaem samu stroku naznacheniya.
alter table task_assignees drop constraint task_assignees_assignee_id_fkey;
alter table task_assignees
  add constraint task_assignees_assignee_id_fkey foreign key (assignee_id) references profiles(id) on delete cascade;
