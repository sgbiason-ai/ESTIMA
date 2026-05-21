// src/hooks/useSmtpConfig.js
//
// Hook de lecture de la config SMTP publique de l'utilisateur courant.
// Le mot de passe (chiffre) n'est jamais accessible cote client.

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

export const useSmtpConfig = () => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setConfig(null);
      setLoading(false);
      return undefined;
    }

    const ref = doc(db, `users/${uid}/preferences/smtp`);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setConfig(snap.exists() ? snap.data() : null);
        setLoading(false);
      },
      () => {
        setConfig(null);
        setLoading(false);
      }
    );

    return unsub;
  }, []);

  return {
    config,
    isConfigured: Boolean(config?.isConfigured),
    loading,
  };
};
