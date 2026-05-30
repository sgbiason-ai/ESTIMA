// src/hooks/useProjectManager.js
import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { generateId } from '../utils/helpers';
import { recalculateProject } from '../utils/projectCalculations';

// Legacy localStorage key — conservé pour migration one-shot vers Firestore prefs.
const lastProjectKey = (companyId) => `last_active_project_id__${companyId}`;

export const useProjectManager = (user, companyId) => {
  const [project, setProject] = useState({
    id: 'draft_project',
    name: '',
    chapters: [],
    tranches: [],
    sourceIds: [],
  });
  const [projectVersion, setProjectVersion] = useState(0);

  // ─── CHARGEMENT INITIAL ────────────────────────────────────────────────────

  useEffect(() => {
    if (!user || !companyId) return;

    const loadProject = async () => {
      try {
        // 1. Lire la pref Firestore
        const prefsRef = doc(db, 'users', user.uid, 'preferences', 'modules');
        const prefsSnap = await getDoc(prefsRef);
        let lastActiveId = prefsSnap.exists() ? prefsSnap.data().estima : null;

        // 2. Migration one-shot : si pas de pref Firestore mais localStorage présent → migrer
        if (!lastActiveId) {
          const legacyId = localStorage.getItem(lastProjectKey(companyId));
          if (legacyId) {
            lastActiveId = legacyId;
            try {
              await setDoc(
                prefsRef,
                { estima: legacyId, updatedAt: serverTimestamp() },
                { merge: true }
              );
              localStorage.removeItem(lastProjectKey(companyId));
            } catch (e) {
              console.warn('[useProjectManager] Migration prefs échouée:', e.message);
            }
          }
        }

        const projectId = lastActiveId || 'draft_project';
        const docRef  = doc(db, 'companies', companyId, 'projects', projectId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setProject(docSnap.data());
          setProjectVersion(v => v + 1);
          return;
        }

        // Projet mémorisé supprimé → clear pref + fallback draft
        if (lastActiveId) {
          try { await setDoc(prefsRef, { estima: null }, { merge: true }); } catch { /* ignore */ }
          const fallbackRef  = doc(db, 'companies', companyId, 'projects', 'draft_project');
          const fallbackSnap = await getDoc(fallbackRef);
          if (fallbackSnap.exists()) {
            setProject(fallbackSnap.data());
            setProjectVersion(v => v + 1);
          }
        }
      } catch (e) {
        console.error('[useProjectManager] Erreur chargement projet:', e.message);
      }
    };

    loadProject();
  }, [user, companyId]);

  // ─── SAUVEGARDE ───────────────────────────────────────────────────────────

  // ─── AUDIT TRAIL ─────────────────────────────────────────────────────────────
  // Compare les champs de premier niveau pour détecter ce qui a changé.
  // Ne stocke jamais le contenu complet (trop volumineux) — seulement les clés.
  const computeChangedFields = (previous, current) => {
    if (!previous) return ['création du projet'];
    const changed = [];
    const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
    // Champs à ignorer (méta ou trop verbeux)
    const IGNORE = new Set(['lastSaved', 'updatedBy', 'schemaVersion', 'sourceIds']);
    keys.forEach(k => {
      if (IGNORE.has(k)) return;
      const prev = JSON.stringify(previous[k]);
      const curr = JSON.stringify(current[k]);
      if (prev !== curr) changed.push(k);
    });
    return changed.length > 0 ? changed : ['aucun changement détecté'];
  };

  const handleSaveProject = async (projectData) => {
    if (!projectData || !user || !companyId) return;

    const projectId = projectData.id || 'draft_project';

    // Mémoriser le dernier projet ouvert (Firestore prefs, sync multi-device)
    try {
      await setDoc(
        doc(db, 'users', user.uid, 'preferences', 'modules'),
        { estima: projectId, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (e) {
      console.warn('[useProjectManager] MAJ pref estima échouée:', e.message);
    }

    const { __isNew, ...projectToStore } = projectData;

    const now = new Date().toISOString();

    // Sauvegarde principale avec retry (backoff exponentiel)
    const maxRetries = 3;
    let lastErr;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await setDoc(doc(db, 'companies', companyId, 'projects', projectId), {
          ...projectToStore,
          id: projectId,
          lastSaved: now,
          updatedBy: user.email,
        });
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        console.warn(`[useProjectManager] Tentative ${attempt + 1}/${maxRetries + 1} échouée:`, e.message);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, attempt), 8000)));
        }
      }
    }
    if (lastErr) {
      console.error('[useProjectManager] Échec sauvegarde après retries:', lastErr.message);
      throw lastErr;
    }

    // ── Audit trail — snapshot léger dans history/
    // Ne stocke pas le projet complet (trop volumineux).
    // En cas d'erreur, la sauvegarde principale n'est pas affectée.
    try {
      const changedFields = computeChangedFields(
        { name: projectToStore.name, client: projectToStore.client },
        projectToStore
      );
      await addDoc(
        collection(db, 'companies', companyId, 'projects', projectId, 'history'),
        {
          savedAt:     now,
          savedBy:     user.email,
          projectName: projectToStore.name || '',
          changedFields,
          snapshot: {
            name:          projectToStore.name          || '',
            client:        projectToStore.client        || '',
            scoringConfig: projectToStore.scoringConfig || null,
            tranches:      (projectToStore.tranches     || []).map(t => ({ id: t.id, name: t.name })),
            hasPSE:        !!projectToStore.hasPSE,
            companiesCount: (projectToStore.analysis?.companies || []).length,
          },
        }
      );
    } catch (e) {
      console.warn('[audit] Impossible d\'ecrire dans history:', e.message);
    }
  };

  // ─── ACTIONS PROJET ────────────────────────────────────────────────────────

  const resetProject = () => {
    setProject({
      id: generateId(),
      name: '',
      chapters: [{ id: 'c1', title: 'TRAVAUX PREPARATOIRES', children: [], type: 'chapter', isOption: false }],
      tranches: [],
      sourceIds: [],
      __isNew: true,
    });
    setProjectVersion(v => v + 1);
  };

  const updateProjectName = (newName) => {
    setProject(prev => ({ ...prev, name: String(newName || '').toUpperCase() }));
  };

  const addChapter = () => {
    const newChap = { id: generateId(), title: 'NOUVEAU CHAPITRE', children: [], type: 'chapter', isOption: false };
    setProject(prev => ({ ...prev, chapters: [...prev.chapters, newChap] }));
    setProjectVersion(v => v + 1);
  };

  const addSubChapter = (parentId) => {
    const newSub = { id: generateId(), title: 'NOUVEAU SOUS-CHAPITRE', children: [], type: 'chapter', isOption: false };
    const updateRecursive = (items) =>
      items.map(item => {
        if (item.id === parentId) return { ...item, children: [...(item.children || []), newSub] };
        if (item.children) return { ...item, children: updateRecursive(item.children) };
        return item;
      });
    setProject(prev => ({ ...prev, chapters: updateRecursive(prev.chapters) }));
    setProjectVersion(v => v + 1);
  };

  const addItemToProject = (bpuItem, parentId = null, selection = null) => {
    const newLine = {
      type: 'item',
      id: `line_${generateId()}`,
      uid: String(bpuItem.id ?? bpuItem.uid ?? ''),
      designation: bpuItem.designation || '',
      unit: bpuItem.unit || '',
      price: Number(bpuItem.price || 0),
      qty: 0,
      formula: '',
      quantities: {},
      quantitiesFormula: {},
      bpuNum: bpuItem.bpuNum ?? '',
      isFixed: !!bpuItem.isFixed,
    };

    setProject(prev => {
      const targetParentId =
        parentId ||
        (selection?.type === 'chapter' || selection?.type === 'subchapter' ? selection.id : null) ||
        (prev.chapters?.[0]?.id || null);

      if (!targetParentId) {
        console.warn('Aucun chapitre disponible.');
        return prev;
      }

      const insertRecursive = (nodes) =>
        nodes.map(node => {
          if (node.id === targetParentId) return { ...node, children: [...(node.children || []), newLine] };
          if (node.children) return { ...node, children: insertRecursive(node.children) };
          return node;
        });

      return { ...prev, chapters: insertRecursive(prev.chapters || []) };
    });
    setProjectVersion(v => v + 1);
  };

  // ─── MOTEUR DE CALCUL ─────────────────────────────────────────────────────

  // Moteur de recalcul (résolution des formules + somme des tranches) :
  // fonction pure importée depuis projectCalculations.js, testée via
  // projectCalculations.test.js. Utilisée au call site plus bas (updateProjectItem).

  // ─── UPDATE ITEM ──────────────────────────────────────────────────────────

  const updateProjectItem = (parentId, uid, field, value) => {
    const toNumber = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

    if (parentId === 'root' && uid === 'root') {
      if (field === 'tranche_rename') {
        setProject(prev => ({
          ...prev,
          tranches: prev.tranches.map(t => t.id === value.id ? { ...t, name: value.name } : t),
        }));
      } else {
        setProject(prev => ({ ...prev, [field]: value }));
      }
      setProjectVersion(v => v + 1);
      return;
    }

    setProject(prev => {
      let chaptersClone = prev.chapters;

      if (parentId === 'root') {
        chaptersClone = prev.chapters.map(c => c.id === uid ? { ...c, [field]: value } : c);
      } else {
        const updateRecursive = (items) =>
          items.map(it => {
            if (it.id === uid) {
              if (field === 'qty_tranche') {
                const { trancheId, value: qtyValue, clearAllFormulas } = value;
                const isFormula = typeof qtyValue === 'string' && qtyValue.startsWith('=');
                let newQuantitiesFormula = { ...(it.quantitiesFormula || {}) };
                let newQuantities = { ...(it.quantities || {}) };
                if (isFormula) {
                  // Une formule avec dépendance ({ref}) se propage sur toutes les tranches.
                  // Une constante pure (=6+4) reste sur la tranche active uniquement.
                  const hasDeps = /\{[^}]+\}/.test(qtyValue);
                  if (hasDeps) {
                    prev.tranches.forEach(t => { newQuantitiesFormula[t.id] = qtyValue; });
                  } else {
                    newQuantitiesFormula[trancheId] = qtyValue;
                  }
                } else if (clearAllFormulas) {
                  prev.tranches.forEach(t => { newQuantitiesFormula[t.id] = ''; });
                  newQuantities[trancheId] = toNumber(qtyValue);
                } else {
                  newQuantities[trancheId] = toNumber(qtyValue);
                  newQuantitiesFormula[trancheId] = '';
                }
                return { ...it, quantities: newQuantities, quantitiesFormula: newQuantitiesFormula };
              }
              if (field === 'qty') {
                const isFormula = typeof value === 'string' && value.startsWith('=');
                return { ...it, qty: isFormula ? 0 : toNumber(value), formula: isFormula ? value : '' };
              }
              if (field === 'price') return { ...it, [field]: toNumber(value) };
              return { ...it, [field]: value };
            }
            if (it.children) return { ...it, children: updateRecursive(it.children) };
            return it;
          });
        chaptersClone = updateRecursive(prev.chapters);
      }

      const { updatedChapters, sourceIds } = recalculateProject(chaptersClone, prev.tranches);
      return { ...prev, chapters: updatedChapters, sourceIds };
    });

    setProjectVersion(v => v + 1);
  };

  // ─── DRAG & DROP ──────────────────────────────────────────────────────────

  const handleDragEnd = (result) => {
    const { source, destination, type } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const newProject = JSON.parse(JSON.stringify(project));

    if (type === 'CHAPTER') {
      const [removed] = newProject.chapters.splice(source.index, 1);
      newProject.chapters.splice(destination.index, 0, removed);
      setProject(newProject);
      setProjectVersion(v => v + 1);
      return;
    }

    const findChildrenById = (nodes, containerId) => {
      for (const node of nodes) {
        if (String(node.id) === String(containerId)) {
          if (!node.children) node.children = [];
          return node.children;
        }
        if (node.children && node.children.length > 0) {
          const found = findChildrenById(node.children, containerId);
          if (found) return found;
        }
      }
      return null;
    };

    const sourceChildren = findChildrenById(newProject.chapters, source.droppableId);
    const destChildren   = findChildrenById(newProject.chapters, destination.droppableId);

    if (!sourceChildren || !destChildren) return;

    const [movedItem] = sourceChildren.splice(source.index, 1);
    destChildren.splice(destination.index, 0, movedItem);

    setProject(newProject);
    setProjectVersion(v => v + 1);
  };

  return {
    project, setProject, projectVersion, handleSaveProject, resetProject,
    updateProjectName, addChapter, addSubChapter, addItemToProject, updateProjectItem, handleDragEnd,
  };
};