-- Повторяющиеся задачи (Этап 8 роадмапа доработок): правило создаёт новую
-- задачу из шаблона (Этап 7) по расписанию. Учитываются только рабочие дни
-- (пн-пт) — решение согласовано с заказчиком перед реализацией.
create table recurring_rules (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references task_templates(id),
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  weekday int check (weekday between 1 and 5),
  day_of_month int check (day_of_month between 1 and 31),
  next_run_at date not null,
  active boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table recurring_rules enable row level security;

-- Стандартный паттерн: читать могут все авторизованные; писать
-- (включая мягкое удаление и переключение active) — только editor/admin.
create policy "recurring_rules_select_all" on recurring_rules
  for select using (auth.role() = 'authenticated');
create policy "recurring_rules_insert_editor" on recurring_rules
  for insert with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('editor','admin'))
  );
create policy "recurring_rules_update_editor" on recurring_rules
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('editor','admin'))
  );
