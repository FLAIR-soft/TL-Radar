'use client';

import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null
  );
}

// Overlay'am (SlideOver, komandnaya paletra, panel' uvedomleniy) nuzhen
// focus trap, poka oni otkryty: Tab/Shift+Tab ne dolzhen uvodit' fokus na
// element pod overlay'em, a posle zakrytiya fokus dolzhen vernut'sya tomu
// elementu, s kotorogo overlay byl otkryt (obychno — knopke-triggeru).
// `active` peredayotsya kak `phase !== 'closed'` iz useAnimatedUnmount, chtoby
// trap ostavalsya deystvuyushchim i vo vremya animatsii zakrytiya.
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const items = focusableIn(container);
    (items[0] ?? container).focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !container) return;
      const current = focusableIn(container);
      if (current.length === 0) {
        e.preventDefault();
        return;
      }
      const first = current[0];
      const last = current[current.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [active]);

  return containerRef;
}
