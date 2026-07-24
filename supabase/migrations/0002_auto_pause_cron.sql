-- Планировщик автопаузы: раз в 15 минут дёргаем Edge Function auto-pause.
-- Сама функция решает, действовать ей или нет (см. supabase/functions/auto-pause),
-- поэтому частый вызов безопасен и не создаёт дублей.
--
-- Service role ключ для авторизации вызова хранится в Supabase Vault под именем
-- 'tl_radar_service_role_key' (заведён отдельно, не в миграции — секреты в git не кладём).

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'auto-pause-tl-radar',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://kjfinktcnqzizhtssuoc.supabase.co/functions/v1/auto-pause',
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
