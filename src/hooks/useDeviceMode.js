// src/hooks/useDeviceMode.js
//
// Detection device + layout a utiliser (mobile ou desktop).
// Tablettes (Samsung Galaxy Tab S10 FE, iPad, etc.) sont reconnues meme
// quand le navigateur demande le "site desktop" (UA sans Android/iPhone).
//
// Retourne :
//   - isPhone      : telephone (largeur < 768 OU UA phone)
//   - isTablet     : tablette (touch + largeur 768-1366 sans UA phone)
//   - isDesktop    : PC / Mac sans touch
//   - layoutMode   : 'mobile' | 'desktop' (prend en compte l'override localStorage)
//   - forceLayout  : (mode | null) => void  -- persiste dans localStorage
//
import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'estima_force_layout'; // 'mobile' | 'desktop' | null

function hasTouch() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function isPhoneUA() {
  return /iPhone|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

function isTabletUA() {
  // iPad (y compris iPadOS qui utilise un UA Mac depuis iOS 13)
  if (/iPad/i.test(navigator.userAgent)) return true;
  if (/Macintosh/i.test(navigator.userAgent) && hasTouch()) return true;
  // Android tablet : UA contient "Android" sans "Mobile"
  if (/Android/i.test(navigator.userAgent) && !/Mobile/i.test(navigator.userAgent)) return true;
  return false;
}

function detectDevice() {
  const width = window.innerWidth;
  const touch = hasTouch();
  const phoneUA = isPhoneUA();
  const tabletUA = isTabletUA();

  // Phone : UA phone OU largeur < 768 avec touch
  if (phoneUA) return 'phone';
  if (touch && width < 768) return 'phone';

  // Tablet : UA tablet OU device tactile de taille intermediaire
  // (inclut Tab S10 FE meme quand Chrome demande "site desktop")
  if (tabletUA) return 'tablet';
  if (touch && width >= 768 && width <= 1366) return 'tablet';

  return 'desktop';
}

function readOverride() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'mobile' || v === 'desktop' ? v : null;
  } catch {
    return null;
  }
}

export function useDeviceMode() {
  const [device, setDevice] = useState(() => detectDevice());
  const [override, setOverride] = useState(() => readOverride());

  useEffect(() => {
    const update = () => setDevice(detectDevice());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  const forceLayout = useCallback((mode) => {
    try {
      if (mode === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, mode);
    } catch { /* ignore */ }
    setOverride(mode);
  }, []);

  // Layout par defaut selon device
  const defaultLayout = device === 'desktop' ? 'desktop' : 'mobile';
  const layoutMode = override || defaultLayout;

  return {
    isPhone:   device === 'phone',
    isTablet:  device === 'tablet',
    isDesktop: device === 'desktop',
    device,
    layoutMode,
    override,
    forceLayout,
  };
}
