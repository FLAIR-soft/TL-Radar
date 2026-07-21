'use client';

import { useEffect, useState } from 'react';
import { effectiveNow } from '@/lib/logic/tasks';

// Re-renders the calling component every `intervalMs` so live timers stay fresh.
// Returns the 16:00-Berlin-capped "now" to compute elapsed durations against.
export function useNowTick(intervalMs = 30000): Date {
  const [now, setNow] = useState<Date>(() => effectiveNow());

  useEffect(() => {
    const id = setInterval(() => setNow(effectiveNow()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
