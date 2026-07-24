-- WIP-limity kolonok kanbana (Etap 14 backloga): po odnoy stroke na kazhdyy
-- status-kolonku, limit_count = null oznachaet "bez ogranicheniya". Global'naya
-- komandnaya nastroyka (ne lichnaya, v otlichiye ot saved_views/task_watchers) —
-- chitat' mogut vse, menyat' — tol'ko admin (stroже, chem obychnyy editor/admin
-- pattern: eto nastroyka protsessa dlya vsey komandy srazu).
create table wip_limits (
  status text primary key check (status in ('waiting', 'in_progress', 'paused')),
  limit_count integer check (limit_count is null or limit_count > 0)
);

insert into wip_limits (status, limit_count) values
  ('waiting', null),
  ('in_progress', null),
  ('paused', null);

alter table wip_limits enable row level security;

create policy "wip_limits_select_all" on wip_limits
  for select using (auth.role() = 'authenticated');
create policy "wip_limits_update_admin" on wip_limits
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );
