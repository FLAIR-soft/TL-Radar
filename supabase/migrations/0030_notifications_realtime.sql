-- Этап 3 оптимизации: NotificationBell переходит с поллинга (каждые 30с)
-- на Realtime postgres_changes. RLS (notifications_select_own, 0020) уже
-- ограничивает видимость recipient_id = auth.uid() — Realtime использует
-- те же политики, дополнительных прав не требуется.
alter publication supabase_realtime add table notifications;
