import React, { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X, Wifi } from 'lucide-react';
import { APP_VERSION } from '../../data/changelog';

const LS_VERSION_KEY = 'estima_last_app_version';

function cleanRuntimeCachesIfMajorBump(previous, current) {
  if (!previous || previous === current) return;
  const [pMaj, pMin] = previous.split('.').map(Number);
  const [cMaj, cMin] = current.split('.').map(Number);
  const majorBump = cMaj > pMaj || (cMaj === pMaj && cMin > pMin);
  if (!majorBump) return;
  if (typeof caches === 'undefined') return;
  const runtimeCaches = ['map-tiles-cache', 'google-fonts-cache', 'gstatic-fonts-cache'];
  runtimeCaches.forEach((name) => {
    caches.delete(name).catch(() => {});
  });
}

export default function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;
      setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
    },
  });

  useEffect(() => {
    const previous = localStorage.getItem(LS_VERSION_KEY);
    cleanRuntimeCachesIfMajorBump(previous, APP_VERSION);
    localStorage.setItem(LS_VERSION_KEY, APP_VERSION);
  }, []);

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white border border-gray-200/60 rounded-2xl shadow-2xl backdrop-blur-xl p-4 flex items-start gap-3">
        <div className={`p-2 rounded-xl ${needRefresh ? 'bg-blue-50' : 'bg-emerald-50'}`}>
          {needRefresh ? (
            <RefreshCw size={18} strokeWidth={1.5} className="text-blue-600" />
          ) : (
            <Wifi size={18} strokeWidth={1.5} className="text-emerald-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-tight">
            {needRefresh ? 'Nouvelle version disponible' : 'Prêt pour le mode hors-ligne'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 leading-snug">
            {needRefresh
              ? 'Rechargez pour activer les dernières améliorations.'
              : "L'application fonctionnera sans connexion."}
          </p>
          {needRefresh && (
            <button
              onClick={() => updateServiceWorker(true)}
              className="mt-3 w-full bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold py-2 px-4 rounded-xl shadow-sm transition-all active:scale-[0.97]"
            >
              Recharger maintenant
            </button>
          )}
        </div>
        <button
          onClick={close}
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Fermer"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
