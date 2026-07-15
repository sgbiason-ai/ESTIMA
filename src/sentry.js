// src/sentry.js
// Configuration Sentry — monitoring d'erreurs en production
//
// Pour activer : créer un compte sur https://sentry.io (plan gratuit = 5000 erreurs/mois)
// puis remplacer le DSN ci-dessous par celui de votre projet.
//
// Façade LAZY : le SDK @sentry/react (~80 KB gzip) est chargé en dynamique
// après le démarrage pour ne pas peser sur le chemin critique du bundle
// initial. Les erreurs capturées avant la fin du chargement sont mises en
// file et rejouées dès que le SDK est prêt.

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';

let sdk = null;       // module @sentry/react une fois chargé et initialisé
const pending = [];   // appels capturés avant le chargement du SDK

export const initSentry = () => {
  if (!SENTRY_DSN) {
    if (import.meta.env.DEV) {
      console.info('[Sentry] DSN non configuré — monitoring désactivé.');
    }
    return;
  }

  import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: import.meta.env.MODE, // 'development' | 'production'
        enabled: import.meta.env.PROD,

        // Capture 20% des transactions pour le monitoring de performance
        tracesSampleRate: 0.2,

        // Ne pas envoyer les erreurs réseau transitoires (Firebase offline)
        beforeSend(event) {
          const msg = event.exception?.values?.[0]?.value || '';
          if (msg.includes('Failed to get document') || msg.includes('offline')) {
            return null; // Ignorer les erreurs réseau Firebase
          }
          return event;
        },

        // Nettoyage des données sensibles
        beforeBreadcrumb(breadcrumb) {
          // Ne pas logger les URLs contenant des tokens
          if (breadcrumb.data?.url?.includes('token=')) {
            breadcrumb.data.url = '[REDACTED]';
          }
          return breadcrumb;
        },
      });
      sdk = Sentry;
      pending.splice(0).forEach((call) => call(Sentry));
    })
    .catch(() => {
      // SDK non chargé (offline, adblock…) — l'app fonctionne sans monitoring
    });
};

// Façade minimaliste pour ErrorBoundary et hooks : seule captureException est
// utilisée hors de ce module. Étendre ici si d'autres APIs Sentry deviennent
// nécessaires (toujours via la file `pending` pour rester lazy-safe).
export const Sentry = {
  captureException(...args) {
    if (sdk) { sdk.captureException(...args); return; }
    if (SENTRY_DSN) pending.push((S) => S.captureException(...args));
  },
};
