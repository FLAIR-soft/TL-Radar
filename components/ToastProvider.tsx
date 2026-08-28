'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, XCircle, X } from 'lucide-react';

type ToastKind = 'success' | 'error';
type Toast = { id: number; kind: ToastKind; message: string; closing?: boolean };

const AUTO_HIDE_MS = 5000;
const EXIT_MS = 200; // matches .toast.is-closing animation-duration in globals.css

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const startClose = useCallback(
    (id: number) => {
      setToasts((prev) => prev.map((t) => (t.id === id && !t.closing ? { ...t, closing: true } : t)));
      const pending = timers.current.get(id);
      if (pending) clearTimeout(pending);
      timers.current.set(id, setTimeout(() => remove(id), EXIT_MS));
    },
    [remove]
  );

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, kind, message }]);
      timers.current.set(
        id,
        setTimeout(() => startClose(id), AUTO_HIDE_MS)
      );
    },
    [startClose]
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message: string) => push('success', message),
      error: (message: string) => push('error', message),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toasts.length > 0 &&
        createPortal(
          <div className="toast-stack" role="status" aria-live="polite">
            {toasts.map((t) => {
              const Icon = t.kind === 'success' ? CheckCircle2 : XCircle;
              return (
                <div
                  key={t.id}
                  className={`toast toast-${t.kind} ${t.closing ? 'is-closing' : ''}`}
                  onClick={() => startClose(t.id)}
                  data-testid="toast"
                >
                  <Icon size={16} strokeWidth={1.75} className="toast-icon" />
                  <span className="toast-message">{t.message}</span>
                  <button
                    type="button"
                    className="toast-close"
                    onClick={(e) => {
                      e.stopPropagation();
                      startClose(t.id);
                    }}
                    aria-label="Close"
                  >
                    <X size={14} strokeWidth={1.75} />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}
