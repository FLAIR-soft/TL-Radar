-- Убираем греческий как поддерживаемый язык интерфейса. Если у кого-то он
-- уже был выбран — переключаем на английский, чтобы не сломать логин/рендер
-- (на момент миграции таких аккаунтов не было, но проверка не помешает).
update profiles set locale = 'en' where locale = 'el';

alter table profiles drop constraint profiles_locale_check;
alter table profiles
  add constraint profiles_locale_check check (locale in ('ru', 'de', 'en'));
