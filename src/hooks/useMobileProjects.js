// src/hooks/useMobileProjects.js
//
// Charge la liste de tous les projets depuis Firestore.
// Utilisé uniquement par la vue mobile pour l'écran d'accueil.
// Chemin : companies/{companyId}/projects/

import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const useMobileProjects = (user, companyId) => {
  const [projects, setProjects]     = useState([]);
  const [folders, setFolders]       = useState([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [error, setError]           = useState(null);

  const fetchProjects = useCallback(async () => {
    if (!user || !companyId) return;
    setIsLoading(true);
    setError(null);

    try {
      // Charge projets et dossiers en parallèle
      const [projSnap, foldersSnap] = await Promise.all([
        getDocs(collection(db, 'companies', companyId, 'projects')),
        getDocs(collection(db, 'companies', companyId, 'folders')),
      ]);

      const list = projSnap.docs
        .map(d => {
          const data = d.data();
          return {
            id:        d.id,
            name:      data.name || '(Sans nom)',
            client:    data.client || '',
            lastSaved: data.lastSaved || '',
            updatedBy: data.updatedBy || '',
            tranches:  data.tranches || [],
            hasPSE:    !!data.hasPSE,
            hasRao:    false, // sera mis à jour après vérification subcollection
            folderId:  data.folderId || null,
            chaptersCount: (data.chapters || []).length,
            itemsCount:    countItems(data.chapters || []),
            statut: data.lastSaved ? 'sauvegardé' : 'brouillon',
          };
        })
        .filter(p => p.name && p.name !== '(Sans nom)')
        .sort((a, b) => (b.lastSaved || '').localeCompare(a.lastSaved || ''));

      const folderList = foldersSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));

      setProjects(list);
      setFolders(folderList);

      // Vérifier en arrière-plan quels projets ont des données RAO (subcollection rao/data)
      // On fait ça après le rendu initial pour ne pas bloquer l'affichage
      const raoChecks = list.map(async (p) => {
        try {
          const raoRef = doc(db, 'companies', companyId, 'projects', p.id, 'rao', 'data');
          const raoSnap = await getDoc(raoRef);
          return { id: p.id, hasRao: raoSnap.exists() };
        } catch {
          return { id: p.id, hasRao: false };
        }
      });
      const raoResults = await Promise.all(raoChecks);
      const raoMap = {};
      raoResults.forEach(r => { raoMap[r.id] = r.hasRao; });

      // Mettre à jour les projets avec le flag RAO
      setProjects(prev => prev.map(p => ({ ...p, hasRao: !!raoMap[p.id] })));

    } catch (e) {
      console.error('[Mobile] Erreur chargement projets:', e);
      setError('Impossible de charger les projets.');
    } finally {
      setIsLoading(false);
    }
  }, [user, companyId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Charge un projet complet par son ID (+ subcollections analysis & rao)
  const loadProject = useCallback(async (projectId) => {
    if (!companyId) return null;
    try {
      const snap = await getDoc(doc(db, 'companies', companyId, 'projects', projectId));
      if (!snap.exists()) return null;
      const data = snap.data();
      // Charger analysis/data et rao/data en parallèle
      const [analysisSnap, raoSnap] = await Promise.all([
        getDoc(doc(db, 'companies', companyId, 'projects', projectId, 'analysis', 'data')).catch(() => null),
        getDoc(doc(db, 'companies', companyId, 'projects', projectId, 'rao', 'data')).catch(() => null),
      ]);
      if (analysisSnap?.exists()) data.analysis = analysisSnap.data();
      if (raoSnap?.exists() && raoSnap.data().rao) data.rao = raoSnap.data().rao;
      return data;
    } catch (e) {
      console.error('[Mobile] Erreur chargement projet:', e);
      return null;
    }
  }, [companyId]);

  return { projects, folders, isLoading, error, refetch: fetchProjects, loadProject };
};

// Compte récursivement les items dans l'arbre
function countItems(nodes) {
  let count = 0;
  const traverse = (items) => {
    items.forEach(n => {
      if (n.type === 'item') count++;
      if (n.children) traverse(n.children);
    });
  };
  traverse(nodes);
  return count;
}
