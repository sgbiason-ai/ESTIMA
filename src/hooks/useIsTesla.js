// src/hooks/useIsTesla.js
// Detecte le navigateur Tesla (Chromium/QtWebEngine) ou le parametre URL ?tesla=1
import { useState, useEffect } from 'react';

export function useIsTesla() {
  const [isTesla, setIsTesla] = useState(() => detectTesla());

  useEffect(() => {
    setIsTesla(detectTesla());
  }, []);

  return isTesla;
}

function detectTesla() {
  // 1. Parametre URL ?tesla=1 (pour tester depuis n'importe quel navigateur)
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tesla') === '1') return true;
  } catch { /* ignore */ }

  const ua = navigator.userAgent || '';

  // 2. UA explicite "Tesla" (firmwares recents)
  if (/Tesla/i.test(ua)) return true;

  // 3. User-Agent Chromium nu sur Linux X11, sans mention de distro
  // UA Tesla : "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ... Chrome/xxx Safari/537.36"
  // ATTENTION : les tablettes Android en "site desktop" ont le meme UA.
  // On distingue par la largeur d'ecran : Tesla 17" >= 1600px CSS, tablettes < 1600px.
  if (/X11; Linux x86_64/.test(ua) && /Chrome\/\d/.test(ua)
    && !/Ubuntu|Fedora|Debian|SUSE|Mint|Arch|CrOS|Android/.test(ua)) {
    const w = typeof window !== 'undefined' ? window.innerWidth : 0;
    if (w >= 1600) return true;
  }
  return false;
}
