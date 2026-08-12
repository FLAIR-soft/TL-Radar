'use client';

import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useAnimatedUnmount } from '@/lib/hooks/useAnimatedUnmount';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';
import { useScrollLock } from '@/lib/hooks/useScrollLock';

export function SlideOver({
  open,
  onClose,
  title,
  headerActions,
  subheader,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Кнопки слева от крестика (наблюдать, сохранить как шаблон). */
  headerActions?: React.ReactNode;
  /** Ряд под заголовком — например, пилюли статуса и приоритета. */
  subheader?: React.ReactNode;
  children: React.ReactNode;
}) {
  // Portal to document.body: ancestors that have any animation/transform
  // applied (e.g. .page-fade's fadeSlideIn, held via animation-fill-mode)
  // become the containing block for position:fixed descendants otherwise,
  // which breaks full-viewport overlays like this one. Safe without a
  // mount-check: `open` only ever flips true from a client click handler,
  // never on the initial (server-matching) render.
  const { phase, onAnimationEnd } = useAnimatedUnmount(open);
  const titleId = useId();
  const active = phase !== 'closed';
  const panelRef = useFocusTrap<HTMLDivElement>(active);
  useScrollLock(active);

  useEffect(() => {
    if (phase !== 'open') return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [phase, onClose]);

  if (phase === 'closed') return null;

  const closing = phase === 'closing';

  return createPortal(
    <div className={`slideover-backdrop ${closing ? 'is-closing' : ''}`} onClick={onClose}>
      <div
        ref={panelRef}
        className={`slideover-panel ${closing ? 'is-closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={onAnimationEnd}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="slideover-header">
          <div className="slideover-header-main">
            <h3 className="slideover-title" id={titleId}>
              {title}
            </h3>
            {subheader}
          </div>
          <div className="slideover-header-actions">
            {headerActions}
            <button className="icon-btn" onClick={onClose} aria-label="Close" data-testid="slideover-close">
              <X size={18} strokeWidth={1.75} />
            </button>
          </div>
        </div>
        <div className="slideover-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
