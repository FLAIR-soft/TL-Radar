-- Проект — не только название: описание, место и ответственный за проект.
alter table projects
  add column description text,
  add column location text,
  add column owner_id uuid references profiles(id);
