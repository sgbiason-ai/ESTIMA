// src/utils/lazyWithReload.js
//
// Wrapper autour de React.lazy qui gère les chunks Vite obsoletes apres deploy.
//
// Probleme : un user qui a charge l'ancien index.html (cache navigateur ou Service
// Worker) tente de fetch un chunk dont le hash a change → import() rejette avec
// "Failed to fetch dynamically imported module". L'app crashe (ErrorBoundary).
//
// Strategie : intercepter ce type d'erreur, desinstaller le SW, vider les caches,
// et recharger la page (qui recupere le nouvel index.html avec les bons hashes).
// Un flag sessionStorage evite la boucle infinie si le heal lui-meme echoue.
//
// Le flag est partage avec public/sw-heal.js (qui gere les <script>/<link> errors
// au niveau global). Voir aussi : useRegisterSW dans UpdatePrompt.jsx pour la
// banniere "Nouvelle version disponible".

import { lazy } from 'react';

const HEAL_FLAG = 'estima_sw_heal_attempt';

const CHUNK_ERR_RX = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

function healAndReload(reason) {
  if (sessionStorage.getItem(HEAL_FLAG)) return Promise.resolve(false);
  sessionStorage.setItem(HEAL_FLAG, reason || 'lazy');
  const tasks = [];
  if ('serviceWorker' in navigator) {
    tasks.push(
      navigator.serviceWorker.getRegistrations()
        .then((rs) => Promise.all(rs.map((r) => r.unregister())))
        .catch(() => {})
    );
  }
  if (typeof caches !== 'undefined') {
    tasks.push(
      caches.keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .catch(() => {})
    );
  }
  return Promise.all(tasks).then(() => {
    location.reload();
    return true;
  });
}

export default function lazyWithReload(importer) {
  return lazy(() =>
    importer().catch((err) => {
      const msg = err?.message || '';
      if (!CHUNK_ERR_RX.test(msg)) throw err;
      return healAndReload('lazy:chunk').then((healed) => {
        if (healed) {
          // reload() est en cours, on retourne une promise pendante pour ne pas
          // afficher le fallback Suspense pendant le rechargement
          return new Promise(() => {});
        }
        // Heal deja tente cette session → on rejette pour declencher ErrorBoundary
        throw err;
      });
    })
  );
}
