-- Язык интерфейса привязан к аккаунту: немецкий (de) — основной выбор по умолчанию,
-- пользователь переключает его в топбаре, и выбор сохраняется за ним на любом устройстве.
alter table profiles
  add column locale text not null default 'de'
  constraint profiles_locale_check check (locale in ('ru', 'de', 'el'));
