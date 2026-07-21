'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/lib/supabase/types';

export interface AuthFormState {
  error: string | null;
}

function friendlyAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'Неверный email или пароль.';
  if (message.includes('User already registered')) return 'Пользователь с таким email уже зарегистрирован.';
  if (message.includes('Password should be at least')) return 'Пароль слишком короткий (минимум 6 символов).';
  return message;
}

export async function signIn(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');

  if (!email || !password) {
    return { error: 'Заполните email и пароль.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  redirect('/dashboard');
}

export async function signUp(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const name = String(formData.get('name') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const role = String(formData.get('role') || 'viewer') as UserRole;

  if (!name || !email || !password) {
    return { error: 'Заполните имя, email и пароль.' };
  }
  if (role !== 'viewer' && role !== 'editor') {
    return { error: 'Некорректная роль.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }
  if (!data.user) {
    return { error: 'Не удалось создать пользователя.' };
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .insert({ id: data.user.id, name, role });

  if (profileError) {
    return { error: 'Аккаунт создан, но не удалось сохранить профиль: ' + profileError.message };
  }

  redirect('/dashboard');
}
