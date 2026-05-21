// src/services/mailService.js
//
// Wrappers httpsCallable pour les Cloud Functions d'envoi mail SMTP par utilisateur.
// Region : europe-west9 (Paris).

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase';

const functions = getFunctions(app, 'europe-west9');

const callableSaveSmtp = httpsCallable(functions, 'saveSmtpConfig');
const callableTestSmtp = httpsCallable(functions, 'testSmtp');
const callableSendCrcEmail = httpsCallable(functions, 'sendCrcEmail', { timeout: 60000 });
const callableDeleteSmtp = httpsCallable(functions, 'deleteSmtpConfig');

// Sentinel utilise par l'UI pour indiquer "mot de passe inchange" (cote serveur, ne pas re-chiffrer)
export const PWD_SENTINEL = '••••••••';

const unwrap = async (callable, payload) => {
  try {
    const { data } = await callable(payload);
    return data;
  } catch (err) {
    // err.code = 'functions/...'  err.message = message serveur (string en FR)
    const code = err?.code || 'unknown';
    const message = err?.message || 'Erreur inconnue.';
    throw new Error(message, { cause: { code, original: err } });
  }
};

export const saveSmtpConfig = (cfg) => unwrap(callableSaveSmtp, cfg);
export const testSmtpConnection = (cfg) => unwrap(callableTestSmtp, cfg || {});
export const sendCrcEmail = (payload) => unwrap(callableSendCrcEmail, payload);
export const deleteSmtpConfig = () => unwrap(callableDeleteSmtp, {});
