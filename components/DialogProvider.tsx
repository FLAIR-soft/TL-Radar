'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, HelpCircle, Trash2 } from 'lucide-react';
import { useDictionary } from '@/lib/i18n/LocaleContext';

// Свой диалог вместо confirm() и prompt() браузера.
//
// Нативные окна рисует браузер: своя типографика, своя кнопка «ОК», имя
// хоста в заголовке и никакой темы приложения. В Chrome они ещё и блокируют
// поток, поэтому анимации на фоне замирают. Здесь то же поведение —
// обещание, которое разрешается ответом, — но в оформлении приложения.
//
// Раскладка и анимация взяты у командной палитры (.cmdk-*), чтобы всплывающие
// слои приложения выглядели одинаково.

const EXIT_MS = 150; // совпадает с .dialog-backdrop.is-closing в globals.css

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PromptOptions extends ConfirmOptions {
  placeholder?: string;
  defaultValue?: string;
  /** Пустой ответ не принимается: кнопка подтверждения остаётся выключенной. */
  required?: boolean;
  multiline?: boolean;
}

interface DialogApi {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Возвращает текст или null, если человек отказался. */
  prompt: (options: PromptOptions) => Promise<string | null>;
}

type Request =
  | ({ kind: 'confirm' } & ConfirmOptions)
  | ({ kind: 'prompt' } & PromptOptions);

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within DialogProvider');
  return ctx;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const dict = useDictionary();
  const [request, setRequest] = useState<Request | null>(null);
  const [value, setValue] = useState('');
  const [closing, setClosing] = useState(false);
  const resolver = useRef<((answer: string | null) => void) | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  const settle = useCallback((answer: string | null) => {
    setClosing(true);
    const resolve = resolver.current;
    resolver.current = null;
    window.setTimeout(() => {
      setRequest(null);
      setClosing(false);
      setValue('');
      resolve?.(answer);
      // Фокус возвращается туда, откуда диалог открыли: иначе после закрытия
      // он уезжает в начало страницы и клавиатурная навигация теряет место.
      returnFocusTo.current?.focus();
      returnFocusTo.current = null;
    }, EXIT_MS);
  }, []);

  const open = useCallback((next: Request): Promise<string | null> => {
    returnFocusTo.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setValue(next.kind === 'prompt' ? (next.defaultValue ?? '') : '');
    setRequest(next);
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const api = useMemo<DialogApi>(
    () => ({
      confirm: (options) => open({ kind: 'confirm', ...options }).then((a) => a !== null),
      prompt: (options) => open({ kind: 'prompt', ...options }),
    }),
    [open]
  );

  // Фокус внутри диалога: Esc закрывает, Tab по кругу не выпускает наружу.
  useEffect(() => {
    if (!request) return;
    firstFieldRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        settle(null);
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input, textarea, [href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [request, settle]);

  const trimmed = value.trim();
  const blocked = request?.kind === 'prompt' && !!request.required && !trimmed;

  function submit() {
    if (!request) return;
    if (request.kind === 'confirm') return settle('');
    if (blocked) return;
    settle(trimmed);
  }

  const Icon = request?.danger ? Trash2 : request?.kind === 'prompt' ? HelpCircle : AlertTriangle;

  return (
    <DialogContext.Provider value={api}>
      {children}
      {request &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={`dialog-backdrop${closing ? ' is-closing' : ''}`}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) settle(null);
            }}
          >
            <div
              className={`dialog-panel${closing ? ' is-closing' : ''}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="dialog-title"
              ref={panelRef}
            >
              <div className="dialog-head">
                <span className={`dialog-icon${request.danger ? ' dialog-icon-danger' : ''}`}>
                  <Icon size={18} strokeWidth={2} />
                </span>
                <div className="dialog-head-text">
                  <h2 className="dialog-title" id="dialog-title">
                    {request.title}
                  </h2>
                  {request.description && <p className="dialog-description">{request.description}</p>}
                </div>
              </div>

              {request.kind === 'prompt' &&
                (request.multiline ? (
                  <textarea
                    className="dialog-field"
                    ref={firstFieldRef as React.RefObject<HTMLTextAreaElement>}
                    rows={3}
                    value={value}
                    placeholder={request.placeholder}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter отправляет, перенос строки — Shift+Enter:
                      // поле на три строки, а ответ обычно в одну.
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        submit();
                      }
                    }}
                  />
                ) : (
                  <input
                    className="dialog-field"
                    ref={firstFieldRef as React.RefObject<HTMLInputElement>}
                    type="text"
                    value={value}
                    placeholder={request.placeholder}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        submit();
                      }
                    }}
                  />
                ))}

              <div className="dialog-actions">
                <button type="button" className="btn btn-ghost" onClick={() => settle(null)}>
                  {request.cancelLabel ?? dict.dialog.cancel}
                </button>
                <button
                  type="button"
                  className={`btn ${request.danger ? 'btn-danger' : 'btn-dark'}`}
                  disabled={blocked}
                  onClick={submit}
                  ref={
                    request.kind === 'confirm'
                      ? (firstFieldRef as React.RefObject<HTMLButtonElement>)
                      : undefined
                  }
                >
                  {request.confirmLabel ?? dict.dialog.confirm}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </DialogContext.Provider>
  );
}
