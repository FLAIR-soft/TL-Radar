-- Redizayn v2, etap 9: chetvyortoye pole WIP-limitov — «Erledigt».
-- Ishodnaya 0029 razreshala tol'ko tri statusa kolonок kanbana; maket
-- (design/redesign-v2/screens/06-admin-light.png) pokazyvayet chetyre.
-- Peresozdayem CHECK i dobavlyaem stroku s null (bez ogranicheniya).
alter table wip_limits drop constraint wip_limits_status_check;
alter table wip_limits add constraint wip_limits_status_check
  check (status in ('waiting', 'in_progress', 'paused', 'done'));

insert into wip_limits (status, limit_count) values ('done', null)
  on conflict (status) do nothing;
