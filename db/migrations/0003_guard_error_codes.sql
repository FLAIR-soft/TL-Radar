-- Этап 6, доработка по итогам проверки на стенде.
--
-- Триггеры из 0002 срабатывали правильно, но наружу шёл текст исключения
-- из базы — по-русски, в немецком интерфейсе. Интерфейс трёхъязычный,
-- поэтому сообщение должно приходить из словаря, а не из Postgres.
--
-- Разводим два правила по собственным SQLSTATE: приложение опознаёт код,
-- а не разбирает текст. Класс «TL» свободен, встроенные коды его не занимают.
--   TL001 — дедлайн менять нельзя
--   TL002 — просрочка без объяснения
--
-- Сами проверки не меняются, меняется только errcode. Триггеры пересоздавать
-- не нужно: create or replace подменяет тело уже привязанной функции.

create or replace function tasks_deadline_guard() returns trigger
language plpgsql as $$
begin
  if old.deadline is not null and new.deadline is distinct from old.deadline then
    raise exception
      'Дедлайн изменить нельзя: он фиксируется при постановке задачи (% -> %)',
      old.deadline, new.deadline
      using errcode = 'TL001';
  end if;
  return new;
end;
$$;

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
      using errcode = 'TL002';
  end if;
  return new;
end;
$$;
