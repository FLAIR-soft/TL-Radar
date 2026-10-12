import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// api/health исключён намеренно: до этапа 3 updateSession редиректит на /login
// всё, где нет сессии Supabase, а за шлюзом MIDAS сессии не будет никогда.
// Диагностика должна отвечать независимо от того, что происходит с авторизацией.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|api/health|favicon.ico|manifest.webmanifest|sw.js|$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
