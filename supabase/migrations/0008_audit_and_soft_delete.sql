-- Accountability: kto imenno izmenil status/zadachu, i myagkoye udaleniye
-- vmesto fizicheskogo stiraniya stroki (chtoby ostavalas' istoriya).
alter table tasks add column updated_by uuid references profiles(id);
alter table tasks add column deleted_at timestamptz;

-- Kto vruchnuyu postavil/snyal pauzu; null, esli auto = true (avtopauza v 16:00).
alter table task_pauses add column created_by uuid references profiles(id);
