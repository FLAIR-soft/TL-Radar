-- Роль "зритель" больше не существует как концепция: все зарегистрированные
-- пользователи могут писать, редактировать и выполнять задачи. Существующие
-- viewer-профили повышаем до editor; новые регистрации всегда создаются editor.
update profiles set role = 'editor' where role = 'viewer';
alter table profiles alter column role set default 'editor';
