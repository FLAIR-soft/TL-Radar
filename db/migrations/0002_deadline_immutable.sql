-- Этап 6: дедлайн неизменен, просрочка требует объяснения.
--
-- Запрет стоит в базе, а не только в интерфейсе: серверное действие можно
-- вызвать напрямую, а прямой запрос к базе — тем более. Единственное место,
-- где правило нельзя обойти, — сама таблица.

-- 1. Дедлайн фиксируется при постановке задачи и дальше не меняется.
--    Проставить его задаче, созданной без срока, можно один раз.
create or replace function tasks_deadline_guard() returns trigger
language plpgsql as $$
begin
  if old.deadline is not null and new.deadline is distinct from old.deadline then
    raise exception
      'Дедлайн изменить нельзя: он фиксируется при постановке задачи (% -> %)',
      old.deadline, new.deadline
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger tasks_deadline_immutable
  before update on tasks
  for each row execute function tasks_deadline_guard();

-- 2. Просроченную задачу нельзя закрыть молча.
--    Срок истекает в 16:00 по Мюнхену в свою дату — тот же час отсечки, что
--    у рабочего окна и у пометки «просрочена» в интерфейсе. Перевод времени
--    делает сам Postgres через at time zone, летнее и зимнее учитываются.
create or replace function tasks_late_reason_guard() returns trigger
language plpgsql as $$
begin
  if new.status = 'done'
     and new.deadline is not null
     and new.completed_at is not null
     and (new.completed_at at time zone 'Europe/Berlin') > (new.deadline + time '16:00')
     and coalesce(btrim(new.late_reason), '') = ''
  then
    raise exception
      'Задача завершена позже срока — нужно объяснение (late_reason)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger tasks_late_reason_required
  before insert or update on tasks
  for each row execute function tasks_late_reason_guard();
