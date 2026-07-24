-- Etap 13 backloga: @упоминания в комментариях + наблюдатели задач.

-- Nablyudateli — lichnaya podpiska na uvedomleniya o kommentariyakh k
-- zadache, nezavisimo ot naznacheniya. Upravlyat' (dobavlyat'/ubirat')
-- mozhno tol'ko svoyu stroku, no chitat' — vse avtorizovannyye (kak
-- task_assignees v 0010): avtoru kommentariya nuzhno videt' polnyy spisok
-- nablyudateley zadachi, chtoby ikh uvedomit' — v otlichiye ot saved_views
-- (0026), eto ne chisto lichnaya nastroyka, a chast' obshchego sostoyaniya zadachi.
create table task_watchers (
  task_id uuid not null references tasks(id),
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

alter table task_watchers enable row level security;

create policy "task_watchers_select_all" on task_watchers
  for select using (auth.role() = 'authenticated');
create policy "task_watchers_insert_own" on task_watchers
  for insert with check (user_id = auth.uid());
create policy "task_watchers_delete_own" on task_watchers
  for delete using (user_id = auth.uid());

-- Novyy tip uvedomleniya 'mention': pereszdayem check-constraint (kak
-- 'comment_added' v 0019 dlya activity_log).
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('assigned', 'unassigned', 'deadline_soon', 'comment', 'mention'));
