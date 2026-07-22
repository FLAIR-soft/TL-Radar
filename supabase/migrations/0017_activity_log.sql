-- Zhurnal sobytiy po zadacham i proektam (Etap 3 dorabotki po slidbaru):
-- poka tol'ko zapis', bez UI — sam slidbar s logom dobavitsya otdel'nym etapom.
-- entity_id ne ssylаetsya FK-yem na tasks/projects namerenno — eto polimorfnaya
-- ssylka (task ili project), a log dolzhen perezhivat' lyubyye izmeneniya
-- v etikh tablitsakh bez riska slomat' zapis' sobytiya.
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('task', 'project')),
  entity_id uuid not null,
  event_type text not null check (event_type in (
    'created', 'updated', 'status_changed', 'deleted', 'assignee_added', 'assignee_removed'
  )),
  actor_id uuid references profiles(id) on delete set null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index activity_log_entity_idx on activity_log (entity_type, entity_id, created_at);

alter table activity_log enable row level security;

-- Chitat' mogut vse avtorizovannyye (kak tasks/task_pauses); pisat' — tol'ko
-- editor/admin (te zhe, kto voobshche mozhet menyat' zadachi/proekty).
-- Update/delete politik net — zhurnal immutable, stroki tol'ko dobavlyayutsya.
create policy "activity_log_select_all" on activity_log
  for select using (auth.role() = 'authenticated');
create policy "activity_log_insert_editor" on activity_log
  for insert with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('editor','admin'))
  );
