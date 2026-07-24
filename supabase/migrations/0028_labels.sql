-- Metki/tegi (Etap 14 backloga): svobodnyye, komandnyye (kak projects),
-- s tsvetom dlya pilyul' na kartochke/v tablitse. Odna zadacha mozhet imet'
-- neskol'ko metok — svyaz' mnogiye-ko-mnogim cherez task_labels, po obraztsu
-- task_assignees (0010), no bez removed_at: snyatiye metki s zadachi — eto
-- prosto udaleniye stroki, ne trebuyet istorii "kogda snyali".
create table labels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  deleted_at timestamptz
);

create table task_labels (
  task_id uuid not null references tasks(id),
  label_id uuid not null references labels(id),
  added_at timestamptz not null default now(),
  added_by uuid references profiles(id),
  primary key (task_id, label_id)
);

alter table labels enable row level security;
alter table task_labels enable row level security;

-- labels/task_labels: chitat' mogut vse avtorizovannyye; pisat' — tol'ko
-- editor/admin, kak projects i task_assignees.
create policy "labels_select_all" on labels
  for select using (auth.role() = 'authenticated');
create policy "labels_insert_editor" on labels
  for insert with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('editor','admin'))
  );
create policy "labels_update_editor" on labels
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('editor','admin'))
  );

create policy "task_labels_select_all" on task_labels
  for select using (auth.role() = 'authenticated');
create policy "task_labels_insert_editor" on task_labels
  for insert with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('editor','admin'))
  );
create policy "task_labels_delete_editor" on task_labels
  for delete using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('editor','admin'))
  );
