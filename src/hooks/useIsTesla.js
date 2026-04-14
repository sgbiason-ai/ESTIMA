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

  // 2. User-Agent Tesla : Chromium nu sur Linux X11, sans mention de distro
  // UA Tesla : "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ... Chrome/xxx Safari/537.36"
  // Pas de "Tesla" dans le UA, mais c'est un Linux X11 sans Ubuntu/Fedora/etc.
  const ua = navigator.userAgent || '';
  if (/Tesla/i.test(ua)) return true;
  if (/X11; Linux x86_64/.test(ua) && /Chrome\/\d/.test(ua)
    && !/Ubuntu|Fedora|Debian|SUSE|Mint|Arch|CrOS|Android/.test(ua)) {
    return true;
  }
  return false;
}
