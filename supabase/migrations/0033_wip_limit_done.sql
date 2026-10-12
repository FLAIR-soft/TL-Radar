-- Redizayn v2, etap 9: chetvyortoye pole WIP-limitov — «Erledigt».
-- Ishodnaya 0029 razreshala tol'ko tri statusa kolonок kanbana; maket
-- (design/redesign-v2/screens/06-admin-light.png) pokazyvayet chetyre.
-- Peresozdayem CHECK i dobavlyaem stroku s null (bez ogranicheniya).
--
-- ПРАВКА (design/plan-2026-08/PLAN.md, этап 5): поле для 'done' убрано из
-- WipLimitsForm.tsx. Колонки «Erledigt» в канбане не существует —
-- завершённые задачи сразу уезжают в архив, и setStatus вообще не проверяет
-- лимит для 'done' (проверка ограничена waiting/in_progress/paused) — то
-- есть настройка ничего не делала, только выглядела рабочей. Эта миграция
-- НЕ откатывается и строка 'done' из wip_limits НЕ удаляется: данные
-- безвредны, а откат на боевой базе — риск ради нуля.
alter table wip_limits drop constraint wip_limits_status_check;
alter table wip_limits add constraint wip_limits_status_check
  check (status in ('waiting', 'in_progress', 'paused', 'done'));

insert into wip_limits (status, limit_count) values ('done', null)
  on conflict (status) do nothing;
