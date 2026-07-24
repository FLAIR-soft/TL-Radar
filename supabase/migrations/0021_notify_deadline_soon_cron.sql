-- Планировщик уведомлений о скором дедлайне: раз в час дёргаем Edge Function
-- notify-deadline-soon (по образцу 0002/auto-pause). Сама функция решает,
-- рабочие ли сейчас часы по Мюнхену и кому уже отправлено — частый вызов
-- безопасен и не создаёт дублей.
select cron.schedule(
  'notify-deadline-soon-tl-radar',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://kjfinktcnqzizhtssuoc.supabase.co/functions/v1/notify-deadline-soon',
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
