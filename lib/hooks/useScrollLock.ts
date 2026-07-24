'use client';

import { useEffect } from 'react';

// Poka polnoekrannyy modal'nyy overlay (backdrop na ves' viewport) otkryt,
// stranitsa pod nim ne dolzhna prokruchivat'sya — inache kolyoso mysh'yu/
// touch-skroll nad "shchelyami" backdrop'a (ili prosto skroll klaviaturoy)
// dvigayet fon, kotoryy vizual'no ne menyaetsya, no posle zakrytiya overlay'ya
// okazyvayetsya v neozhidannoy pozitsii. Kompensiruyem shirinu scrollbar'a
// padding'om, chtoby layout ne "prygal" pri isчeznovenii skrollbara.
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const { body } = document;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
  }, [active]);
}
