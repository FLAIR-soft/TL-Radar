'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getDictionary } from '@/lib/i18n/get-dictionary';

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, locale')
    .eq('id', user.id)
    .single();

  const dict = getDictionary(profile?.locale ?? 'de');

  if (profile?.role !== 'admin') redirect('/dashboard');

  return { dict, currentUserId: user.id };
}

export async function resetUserPassword(
  userId: string,
  newPassword: string
): Promise<{ error?: string }> {
  const { dict } = await requireAdmin();

  if (newPassword.length < 6) {
    return { error: dict.auth.errors.passwordTooShort };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) {
    return { error: error.message };
  }

  return {};
}

export async function deleteUser(userId: string): Promise<{ error?: string }> {
  const { dict, currentUserId } = await requireAdmin();

  if (userId === currentUserId) {
    return { error: dict.admin.errors.cannotDeleteSelf };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/admin');
  return {};
}
