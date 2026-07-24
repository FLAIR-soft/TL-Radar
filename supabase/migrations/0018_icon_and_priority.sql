-- Иконка (свободный ключ из курируемого набора на фронте, без check —
-- набор будет расти, и менять миграцию каждый раз неудобно) и приоритет
-- (фиксированная шкала) для задач и проектов.
alter table tasks add column icon text;
alter table tasks add column priority text check (priority in ('low', 'medium', 'high', 'urgent'));

alter table projects add column icon text;
alter table projects add column priority text check (priority in ('low', 'medium', 'high', 'urgent'));
