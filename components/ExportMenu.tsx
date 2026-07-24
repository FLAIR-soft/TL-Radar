'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, ChevronDown } from 'lucide-react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { useAnimatedUnmount } from '@/lib/hooks/useAnimatedUnmount';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';

// CSV and XLSX used to be two permanently-visible buttons side by side —
// cheap to build, but at a glance it reads as one control with a doubled-up
// icon rather than two distinct actions. A single trigger with a small
// format-picker panel underneath (same open/close/outside-click/Escape
// pattern as NotificationBell) says "export" once and lets the format be a
// secondary choice.
export function ExportMenu({ csvHref, xlsxHref }: { csvHref: string; xlsxHref: string }) {
  const dict = useDictionary();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { phase, onAnimationEnd } = useAnimatedUnmount(open);
  const panelRef = useFocusTrap<HTMLDivElement>(phase !== 'closed');

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (phase !== 'open') return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [phase]);

  return (
    <div className="export-menu" ref={rootRef}>
      <button
        type="button"
        className="export-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="export-menu-trigger"
      >
        <Download size={14} strokeWidth={1.75} />
        {dict.export.title}
        <ChevronDown size={14} strokeWidth={1.75} />
      </button>
      {phase !== 'closed' && (
        <div
          ref={panelRef}
          className={`export-menu-panel ${phase === 'closing' ? 'is-closing' : ''}`}
          onAnimationEnd={onAnimationEnd}
          role="menu"
          aria-label={dict.export.title}
        >
          <a
            className="export-menu-item"
            role="menuitem"
            href={csvHref}
            onClick={() => setOpen(false)}
            data-testid="export-csv"
          >
            {dict.export.csv}
          </a>
          <a
            className="export-menu-item"
            role="menuitem"
            href={xlsxHref}
            onClick={() => setOpen(false)}
            data-testid="export-xlsx"
          >
            {dict.export.xlsx}
          </a>
        </div>
      )}
    </div>
  );
}
