'use client';

import { useEffect } from 'react';

// Registriruyetsya tol'ko iz avtorizovannoy (app) chasti, ne iz /login —
// browser fetchit /sw.js s tekushchimi cookie, i k etomu momentu sessiya uzhe
// yest', tak chto proxy.ts ne perenapravit etot zapros na /login.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return null;
}
