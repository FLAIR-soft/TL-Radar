-- Пользователь может обновлять собственный профиль (нужно для переключения языка интерфейса).
create policy "profiles_update_self" on profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);
