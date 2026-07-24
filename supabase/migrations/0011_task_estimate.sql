-- Оценка времени на задачу (Этап 5). Необязательное поле, используется
-- только для индикатора «оценка vs факт» на карточке — переиспользует
-- существующий accumulatedInProgressDuration(), новой бизнес-логики
-- по учёту времени не вводит.
alter table tasks add column estimated_minutes integer
  check (estimated_minutes is null or estimated_minutes > 0);
