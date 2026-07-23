-- Планировщик повторяющихся задач: раз в час дёргаем Edge Function
-- recurring-tasks (по образцу 0002/0021). Сама функция решает, наступило
-- ли начало рабочего окна по Мюнхену (07:30-08:30) — частый вызов
-- безопасен, next_run_at сдвигается сразу после создания задачи.
select cron.schedule(
  'recurring-tasks-tl-radar',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://kjfinktcnqzizhtssuoc.supabase.co/functions/v1/recurring-tasks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'tl_radar_service_role_key'
      )
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
