// src/hooks/useProjectDocStore.js
//
// Sauvegarde PAR PROJET du contenu d'un document (CCTP / RC / CCAP) dans une
// sous-collection dédiée :
//   companies/{companyId}/projects/{projectId}/{moduleKey}/data  →  { content, updatedAt }
//
// Chargement (précédence) :
//   1. contenu sauvegardé du PROJET s'il existe ;
//   2. sinon le GABARIT maître (`master`) comme point de départ.
//
// Sauvegarde : autosave debounced à chaque modification du contenu. Le gabarit
// maître n'est jamais touché ici (il a son propre bouton « Gabarit »).
//
// Calqué sur le précédent RAO (projects/{id}/rao/data) et usePriceAnalysis.

import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const useProjectDocStore = ({ companyId, projectId, moduleKey, master, debounceMs = 1500 }) => {
  const [data, setData] = useState([]);
  const [docSaveStatus, setDocSaveStatus] = useState('idle'); // idle | saving | saved | error

  // undefined = pas encore récupéré ; null = aucun doc projet ; array = contenu
  const [projectDoc, setProjectDoc] = useState(undefined);

  const initializedForRef = useRef(null);   // projet pour lequel `data` a été initialisé
  const skipSaveRef = useRef(false);        // n'autosave pas le setData d'initialisation
  const debounceRef = useRef(null);

  // 1. Lecture du doc projet (à chaque changement de projet/module).
  //    Pattern « active » par invocation : robuste au double-montage StrictMode
  //    (le 1er fetch est annulé par le cleanup, le 2e aboutit et fixe l'état).
  useEffect(() => {
    if (!companyId || !projectId) return;
    let active = true;
    setProjectDoc(undefined);
    (async () => {
      try {
        const ref = doc(db, 'companies', companyId, 'projects', projectId, moduleKey, 'data');
        const snap = await getDoc(ref);
        if (!active) return;
        const content = snap.exists() ? snap.data().content : null;
        setProjectDoc(Array.isArray(content) ? content : null);
      } catch (e) {
        console.error(`[useProjectDocStore:${moduleKey}] lecture échouée`, e);
        if (active) setProjectDoc(null);
      }
    })();
    return () => { active = false; };
  }, [companyId, projectId, moduleKey]);

  // 2. Initialisation de `data` : projet prioritaire, sinon gabarit maître
  useEffect(() => {
    if (!projectId) return;
    if (projectDoc === undefined) return;            // on attend la lecture
    if (initializedForRef.current === projectId) return;

    if (projectDoc) {
      skipSaveRef.current = true;
      setData(projectDoc);
      initializedForRef.current = projectId;
    } else if (master && master.length > 0) {
      // Pas de contenu projet → on amorce avec le gabarit (copie profonde).
      skipSaveRef.current = true;
      setData(JSON.parse(JSON.stringify(master)));
      initializedForRef.current = projectId;
    }
    // Sinon (pas de doc projet ET gabarit pas encore chargé / vide) : on attend
    // que `master` arrive (chargement async des ressources).
  }, [projectDoc, master, projectId]);

  // 3. Autosave debounced vers la sous-collection du projet
  useEffect(() => {
    if (!companyId || !projectId) return;
    if (initializedForRef.current !== projectId) return;
    if (skipSaveRef.current) { skipSaveRef.current = false; return; }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setDocSaveStatus('saving');
    debounceRef.current = setTimeout(async () => {
      try {
        const ref = doc(db, 'companies', companyId, 'projects', projectId, moduleKey, 'data');
        await setDoc(ref, { content: data, updatedAt: new Date().toISOString() });
        setDocSaveStatus('saved');
      } catch (e) {
        console.error(`[useProjectDocStore:${moduleKey}] sauvegarde échouée`, e);
        setDocSaveStatus('error');
      }
    }, debounceMs);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [data, companyId, projectId, moduleKey, debounceMs]);

  return { data, setData, docSaveStatus };
};
