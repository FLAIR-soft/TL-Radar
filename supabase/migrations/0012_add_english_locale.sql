-- Добавляем английский (en) как четвёртый поддерживаемый язык интерфейса.
alter table profiles drop constraint profiles_locale_check;
alter table profiles
  add constraint profiles_locale_check check (locale in ('ru', 'de', 'el', 'en'));
