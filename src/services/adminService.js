// src/services/adminService.js
//
// Wrappers httpsCallable pour les Cloud Functions d'administration.
// Region : europe-west9 (Paris).

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase';

const functions = getFunctions(app, 'europe-west9');

const callableBackfillEmails = httpsCallable(functions, 'backfillMemberEmails', { timeout: 120000 });

/**
 * Renseigne email/displayName des profils /users depuis Firebase Auth.
 * Réservé au super-admin (vérifié côté serveur).
 * @returns {Promise<{ total: number, updated: number, orphans: string[] }>}
 */
export const backfillMemberEmails = async () => {
  try {
    const { data } = await callableBackfillEmails({});
    return data;
  } catch (err) {
    const message = err?.message || 'Erreur inconnue.';
    throw new Error(message, { cause: { code: err?.code || 'unknown', original: err } });
  }
};
