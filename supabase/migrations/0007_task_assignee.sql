-- Кто выполняет задачу — теперь ссылка на зарегистрированного пользователя
-- (выпадающий список из profiles), а не свободный текст.
alter table tasks add column assignee_id uuid references profiles(id);
