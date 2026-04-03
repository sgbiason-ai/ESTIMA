// src/sentry.js
// Configuration Sentry — monitoring d'erreurs en production
//
// Pour activer : créer un compte sur https://sentry.io (plan gratuit = 5000 erreurs/mois)
// puis remplacer le DSN ci-dessous par celui de votre projet.

import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';

export const initSentry = () => {
  if (!SENTRY_DSN) {
    if (import.meta.env.DEV) {
      console.info('[Sentry] DSN non configuré — monitoring désactivé.');
    }
    return;
  }

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
};

// Export pour usage dans ErrorBoundary et hooks
export { Sentry };
