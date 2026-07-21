'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getLocaleCookie } from '@/lib/i18n/cookie';
import { deriveSyntheticEmail } from '@/lib/auth/synthetic-email';
import type { UserRole } from '@/lib/supabase/types';

export interface AuthFormState {
  error: string | null;
}

async function friendlyAuthError(message: string): Promise<string> {
  const dict = getDictionary(await getLocaleCookie());
  if (message.includes('Invalid login credentials')) return dict.auth.errors.invalidCredentials;
  if (message.includes('User already registered')) return dict.auth.errors.userExists;
  if (message.includes('Password should be at least')) return dict.auth.errors.passwordTooShort;
  return message;
}

export async function signIn(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const firstName = String(formData.get('firstName') || '').trim();
  const lastName = String(formData.get('lastName') || '').trim();
  const password = String(formData.get('password') || '');
  const dict = getDictionary(await getLocaleCookie());

  if (!firstName || !lastName || !password) {
    return { error: dict.auth.errors.missingSignIn };
  }

  const email = deriveSyntheticEmail(firstName, lastName);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: await friendlyAuthError(error.message) };
  }

  redirect('/dashboard');
}

export async function signUp(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const firstName = String(formData.get('firstName') || '').trim();
  const lastName = String(formData.get('lastName') || '').trim();
  const password = String(formData.get('password') || '');
  const role = String(formData.get('role') || 'viewer') as UserRole;
  const dict = getDictionary(await getLocaleCookie());
  const locale = await getLocaleCookie();

  if (!firstName || !lastName || !password) {
    return { error: dict.auth.errors.missingSignUp };
  }
  if (role !== 'viewer' && role !== 'editor') {
    return { error: dict.auth.errors.invalidRole };
  }

  const name = `${firstName} ${lastName}`;
  const email = deriveSyntheticEmail(firstName, lastName);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: await friendlyAuthError(error.message) };
  }
  if (!data.user) {
    return { error: dict.auth.errors.userCreateFailed };
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .insert({ id: data.user.id, name, role, locale });

  if (profileError) {
    return { error: dict.auth.errors.profileSaveFailed + ' ' + profileError.message };
  }

  redirect('/dashboard');
}
