'use client';

import { useEffect, useRef, useState } from 'react';

export type AnimatedUnmountPhase = 'open' | 'closing' | 'closed';

// Overlay'am (SlideOver, panel'i uvedomleniy/palitry, elementy spiskov) nuzhno
// ostat'sya v DOM yeshcho odin animatsionnyy tsikl posle `open` -> false, chtoby
// sygrat' animatsiyu zakrytiya, a ne prosto ischeznut'. animationend — osnovnoy
// triggger razmontirovaniya; taymaut-fallback (v effekte, otmenyayetsya cleanup'om
// pri smene phase) strakhuyet sluchai, kogda animatsiya ne igraet
// (prefers-reduced-motion, animation-duration:0 i t.p.).
// Povtornoye otkrytiye do zaversheniya zakrytiya (bystryy toggle) srazu
// otmenyayet 'closing' i vozvrashchayet 'open' — bez "zombi"-sloyov.
//
// `phaseRef` derzhit tekushchuyu fazu sinkhronno, v obkhod React-ovogo
// funktsional'nogo obnovleniya setState(prev => ...): pri mnogokratnykh
// bystrykh rerenderakh (neskol'ko SlideOver'ov na stranitse, entrance- i
// exit-animatsii vplotnuyu drug k drugu) React mozhet povtorno primenit'
// uzhe otrabotavshiy updater-callback iz onAnimationEnd k ustarevshemu
// bazovomu sostoyaniyu (nabljudayemo: prev prikhodit 'open', khotya fazum
// uzhe realno byla 'closing') — eto tikho otkatyvaet fazu nazad i panel'
// zastrevaet otkrytoy navsegda. Chteniye/zapis' cherez ref immunna k etomu,
// potomu chto ne zavisit ot argumenta, kotoryy React peredayot povtorno.
export function useAnimatedUnmount(open: boolean, fallbackMs = 300): {
  phase: AnimatedUnmountPhase;
  onAnimationEnd: (e: React.AnimationEvent) => void;
} {
  const [phase, setPhase] = useState<AnimatedUnmountPhase>(open ? 'open' : 'closed');
  const [prevOpen, setPrevOpen] = useState(open);
  const phaseRef = useRef(phase);

  // "Adjusting state when a prop changes" (React docs): setState during
  // render instead of in an effect, so the phase flips in the same commit
  // as `open` rather than a tick later. Reads `phase` (the render-scope
  // value, not the ref) and passes setPhase a plain value — never a
  // function updater — see the note above on why.
  if (open !== prevOpen) {
    setPrevOpen(open);
    setPhase(open ? 'open' : phase === 'closed' ? 'closed' : 'closing');
  }

  // Refs can't be written during render (React rule), so sync it in an
  // effect. onAnimationEnd only needs it to be accurate by the time a real
  // user-triggered animationend can fire, which is always after this runs.
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (phase !== 'closing') return;
    const id = setTimeout(() => {
      setPhase('closed');
    }, fallbackMs);
    return () => clearTimeout(id);
  }, [phase, fallbackMs]);

  function onAnimationEnd(e: React.AnimationEvent) {
    // Elements replay this same animationend on the *entrance* animation too
    // (e.g. reopening right after a close plays fadeIn again) — only unmount
    // if we're actually mid-close right now (checked via ref, see above).
    if (e.target !== e.currentTarget) return;
    if (phaseRef.current === 'closing') {
      setPhase('closed');
      phaseRef.current = 'closed';
    }
  }

  return { phase, onAnimationEnd };
}
