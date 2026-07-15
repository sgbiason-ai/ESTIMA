// src/hooks/useTakeoffAssociations.js
//
// Associations du métré DXF sauvegardées PAR PROJET dans le cloud, rattachées au
// FICHIER DXF (clé = nom + taille). Recharger le même fichier — dans une autre
// session ou sur un autre poste — restaure ses associations.
//
//   companies/{companyId}/projects/{projectId}/takeoff/data
//     → { associations: { [dxfKey]: { mappings, scaleToMeters, applyMode, updatedAt } } }
//
// Le fichier DXF lui-même (volumineux) reste en IndexedDB local (dxfPersistence.js) ;
// seules les associations (légères) vont dans Firestore. Calqué sur useProjectDocStore.

import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/** Clé stable d'un fichier DXF (nom + taille). */
export const dxfFileKey = (file) => (file ? `${file.name}::${file.size}` : null);

export function useTakeoffAssociations(companyId, projectId) {
  // null = lecture en cours ; objet = chargé (éventuellement vide).
  const [associations, setAssociations] = useState(null);
  const ref = useRef({});

  useEffect(() => {
    if (!companyId || !projectId) {
      ref.current = {};
      setAssociations({});
      return undefined;
    }
    let active = true;
    setAssociations(null);
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'companies', companyId, 'projects', projectId, 'takeoff', 'data'));
        if (!active) return;
        const loaded = (snap.exists() && snap.data().associations) || {};
        ref.current = loaded;
        setAssociations(loaded);
      } catch (e) {
        console.error('[takeoff] lecture des associations échouée', e);
        if (active) { ref.current = {}; setAssociations({}); }
      }
    })();
    return () => { active = false; };
  }, [companyId, projectId]);

  const saveAssociations = useCallback((dxfKey, data) => {
    if (!companyId || !projectId || !dxfKey) return;
    const next = { ...ref.current, [dxfKey]: { ...data, updatedAt: new Date().toISOString() } };
    ref.current = next;
    setAssociations(next);
    setDoc(
      doc(db, 'companies', companyId, 'projects', projectId, 'takeoff', 'data'),
      { associations: next, updatedAt: new Date().toISOString() },
      { merge: true },
    ).catch((e) => console.error('[takeoff] sauvegarde des associations échouée', e));
  }, [companyId, projectId]);

  return { associations, saveAssociations };
}
