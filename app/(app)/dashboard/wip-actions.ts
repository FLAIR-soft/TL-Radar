'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { WipLimit, WipStatus } from '@/lib/supabase/types';

export async function getWipLimits(): Promise<WipLimit[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('wip_limits').select('*');
  return data ?? [];
}

export async function updateWipLimit(status: WipStatus, limit: number | null): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return { error: 'forbidden' };

  const { error } = await supabase
    .from('wip_limits')
    .update({ limit_count: limit && limit > 0 ? Math.round(limit) : null })
    .eq('status', status);

  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  revalidatePath('/admin');
  return {};
}
