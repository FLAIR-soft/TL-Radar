-- Вход теперь по юзернейму + паролю (имя/фамилия остаются только для
-- отображения и выбора исполнителя на задачу — не участвуют в авторизации).
alter table profiles add column username text;

-- Бэкфилл существующих аккаунтов: нормализованное имя + короткий суффикс
-- от id, чтобы гарантированно не столкнуться с form/uniqueness ниже, не
-- разбираясь в ручной дедупликации для горстки существующих строк.
update profiles
set username = coalesce(nullif(regexp_replace(lower(name), '[^a-z0-9]+', '', 'g'), ''), 'user')
  || substr(replace(id::text, '-', ''), 1, 6)
where username is null;

alter table profiles alter column username set not null;
alter table profiles add constraint profiles_username_key unique (username);
alter table profiles add constraint profiles_username_format check (username ~ '^[a-z0-9_.]{3,32}$');
