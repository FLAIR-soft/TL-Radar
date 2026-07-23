import { cache } from 'react';
import { createClient } from './server';
import type { Profile } from './types';

// React.cache() dedupes by function + args within a single request/render
// pass, so layout.tsx and the page.tsx it wraps share one auth round-trip
// instead of each calling getUser()/profiles separately.
export const getCachedUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getCachedProfile = cache(async (userId: string): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
  return data;
});
