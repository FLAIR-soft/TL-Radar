-- Этап 7: язык и тема переезжают из кук в профиль человека.
--
-- Шлюз MIDAS снимает Set-Cookie с ответов, поэтому выбор языка и темы не
-- переживал перезагрузку. План предполагал localStorage, но у приложения
-- теперь есть и база, и личность из заголовка SSO, а это лучше по трём
-- причинам:
--   * сервер знает язык до первой отрисовки и сразу рендерит страницу на нём,
--     тогда как с localStorage пришлось бы перерисовывать текст на клиенте;
--   * тема попадает в атрибут html на сервере — вспышки светлой темы нет
--     без inline-скрипта, который пришлось бы вставлять до стилей;
--   * выбор следует за человеком на другой компьютер, а не за браузером.

alter table people
  add column if not exists locale text not null default 'de',
  add column if not exists theme  text not null default 'light';

-- Значения проверяет база: список языков и тем меняется редко, а мусор
-- в этих колонках ломал бы выбор словаря на каждой странице.
alter table people
  drop constraint if exists people_locale_check,
  add constraint people_locale_check check (locale in ('de', 'en', 'ru'));

alter table people
  drop constraint if exists people_theme_check,
  add constraint people_theme_check check (theme in ('light', 'dark'));
