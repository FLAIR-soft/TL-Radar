import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Сервисный клиент — только для Server Actions / Route Handlers.
// Никогда не импортировать из клиентских компонентов.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
