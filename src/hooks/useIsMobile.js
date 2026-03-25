// src/hooks/useIsMobile.js
import { useState, useEffect } from 'react';

/**
 * Detecte si l'utilisateur est sur un appareil mobile.
 * Combine la detection tactile + user agent pour eviter de basculer
 * en mode desktop lors d'une rotation en paysage.
 * Le breakpoint sert uniquement de fallback si la detection echoue.
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => detectMobile(breakpoint));

  useEffect(() => {
    // Sur un vrai mobile, pas besoin d'ecouter le resize
    // car le type d'appareil ne change pas en cours de session
    const mobile = detectMobile(breakpoint);
    setIsMobile(mobile);

    // Fallback : si on ne peut pas detecter via touch/UA,
    // on ecoute les changements de taille (ex: devtools responsive)
    if (!hasTouchAndMobileUA()) {
      const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
      const handler = (e) => setIsMobile(e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [breakpoint]);

  return isMobile;
}

function hasTouchAndMobileUA() {
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  return hasTouch && mobileUA;
}

function detectMobile(breakpoint) {
  // 1. Detection fiable : ecran tactile + user agent mobile
  if (hasTouchAndMobileUA()) return true;
  // 2. Fallback par largeur (pour devtools responsive mode)
  return window.innerWidth < breakpoint;
}
