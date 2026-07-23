'use client';

import { useEffect, useState } from 'react';

export type AnimatedUnmountPhase = 'open' | 'closing' | 'closed';

// Overlay'am (SlideOver, panel'i uvedomleniy/palitry, elementy spiskov) nuzhno
// ostat'sya v DOM yeshcho odin animatsionnyy tsikl posle `open` -> false, chtoby
// sygrat' animatsiyu zakrytiya, a ne prosto ischeznut'. animationend — osnovnoy
// triggger razmontirovaniya; taymaut-fallback (v effekte, otmenyayetsya cleanup'om
// pri smene phase) strakhuyet sluchai, kogda animatsiya ne igraet
// (prefers-reduced-motion, animation-duration:0 i t.p.).
// Povtornoye otkrytiye do zaversheniya zakrytiya (bystryy toggle) srazu
// otmenyayet 'closing' i vozvrashchayet 'open' — bez "zombi"-sloyov.
export function useAnimatedUnmount(open: boolean, fallbackMs = 300): {
  phase: AnimatedUnmountPhase;
  onAnimationEnd: (e: React.AnimationEvent) => void;
} {
  const [phase, setPhase] = useState<AnimatedUnmountPhase>(open ? 'open' : 'closed');
  const [prevOpen, setPrevOpen] = useState(open);

  // "Adjusting state when a prop changes" (React docs): setState during
  // render instead of in an effect, so the phase flips in the same commit
  // as `open` rather than a tick later.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setPhase('open');
    } else {
      setPhase((prev) => (prev === 'closed' ? 'closed' : 'closing'));
    }
  }

  useEffect(() => {
    if (phase !== 'closing') return;
    const id = setTimeout(() => setPhase('closed'), fallbackMs);
    return () => clearTimeout(id);
  }, [phase, fallbackMs]);

  function onAnimationEnd(e: React.AnimationEvent) {
    // Elements replay this same animationend on the *entrance* animation too
    // (e.g. reopening right after a close plays fadeIn again) — only the
    // closing animation should trigger unmount.
    if (e.target !== e.currentTarget) return;
    setPhase((prev) => (prev === 'closing' ? 'closed' : prev));
  }

  return { phase, onAnimationEnd };
}
