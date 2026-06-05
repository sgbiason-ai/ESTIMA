// src/hooks/useEstimRapide.js
//
// CRUD Firestore du module Estimation Rapide.
// Pattern calqué sur useDevisMoe (collection + prefs user + toast).
import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, doc, getDoc, setDoc, deleteDoc, onSnapshot, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { generateId } from '../utils/helpers';
import { useToast } from '../contexts/ToastContext';
import { createEstimateFromTemplate, createEstimateFromCustomTemplate } from '../data/estimRapideTemplates';
import { estimateToProject } from '../utils/estimRapideToProject';
import { recalculateProject } from '../utils/projectCalculations';

const estimCol = (cId) => collection(db, 'companies', cId, 'quickEstimates');
const estimRef = (cId, id) => doc(db, 'companies', cId, 'quickEstimates', id);
const tplCol = (cId) => collection(db, 'companies', cId, 'estimTemplates');
const tplRef = (cId, id) => doc(db, 'companies', cId, 'estimTemplates', id);

export const useEstimRapide = (user, companyId) => {
  const toast = useToast();
  const [estimates, setEstimates] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedIdRaw] = useState(null);
  const prefsLoadedRef = useRef(false);

  // Persiste la sélection dans les prefs user (Firestore)
  const setSelectedId = useCallback((id) => {
    setSelectedIdRaw(id);
    if (user?.uid) {
      setDoc(
        doc(db, 'users', user.uid, 'preferences', 'modules'),
        { estimRapide: id || null, updatedAt: serverTimestamp() },
        { merge: true }
      ).catch(() => {});
    }
  }, [user]);

  // ── Liste des estimations rapides ──
  useEffect(() => {
    if (!user || !companyId) return;
    setIsLoading(true);
    const unsub = onSnapshot(
      query(estimCol(companyId), orderBy('createdAt', 'desc'), limit(100)),
      async (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setEstimates(data);
        setIsLoading(false);

        // Auto-sélection de la dernière estimation (prefs Firestore), au 1er chargement
        if (!prefsLoadedRef.current && user?.uid) {
          prefsLoadedRef.current = true;
          try {
            const prefsSnap = await getDoc(doc(db, 'users', user.uid, 'preferences', 'modules'));
            const lastId = prefsSnap.exists() ? prefsSnap.data().estimRapide : null;
            if (lastId && data.some(d => d.id === lastId)) setSelectedIdRaw(lastId);
          } catch { /* ignore */ }
        }
      },
      (err) => {
        console.error('Erreur chargement estimations rapides:', err);
        toast.error('Erreur de chargement des estimations');
        setIsLoading(false);
      }
    );
    return () => unsub();
  }, [user, companyId]);

  // ── Modèles utilisateur ──
  useEffect(() => {
    if (!user || !companyId) return;
    const unsub = onSnapshot(
      query(tplCol(companyId), orderBy('createdAt', 'desc'), limit(100)),
      (snap) => setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.error('Erreur chargement modèles estimation:', err)
    );
    return () => unsub();
  }, [user, companyId]);

  const selected = estimates.find(e => e.id === selectedId) || null;

  // ── CRUD estimations ──
  const createEstimate = useCallback(async (templateId = 'vierge', name = 'Nouvelle estimation') => {
    if (!companyId) return null;
    try {
      const est = createEstimateFromTemplate(templateId, { name });
      await setDoc(estimRef(companyId, est.id), est);
      setSelectedId(est.id);
      toast.success('Estimation créée');
      return est;
    } catch (e) { console.error(e); toast.error('Erreur lors de la création'); return null; }
  }, [companyId]);

  const createFromCustomTemplate = useCallback(async (customTemplate, name = 'Nouvelle estimation') => {
    if (!companyId || !customTemplate) return null;
    try {
      const est = createEstimateFromCustomTemplate(customTemplate, { name });
      await setDoc(estimRef(companyId, est.id), est);
      setSelectedId(est.id);
      toast.success('Estimation créée depuis le modèle');
      return est;
    } catch (e) { console.error(e); toast.error('Erreur lors de la création'); return null; }
  }, [companyId]);

  const saveEstimate = useCallback(async (data) => {
    if (!companyId || !data?.id) return false;
    try {
      await setDoc(estimRef(companyId, data.id), { ...data, updatedAt: new Date().toISOString() });
      return true;
    } catch (e) { console.error(e); toast.error('Erreur lors de la sauvegarde'); return false; }
  }, [companyId]);

  const duplicateEstimate = useCallback(async (id) => {
    const src = estimates.find(e => e.id === id);
    if (!src) return null;
    try {
      const copy = {
        ...JSON.parse(JSON.stringify(src)),
        id: generateId(),
        name: `${src.name || 'Estimation'} (copie)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(estimRef(companyId, copy.id), copy);
      setSelectedId(copy.id);
      toast.success('Estimation dupliquée');
      return copy;
    } catch (e) { console.error(e); toast.error('Erreur lors de la duplication'); return null; }
  }, [companyId, estimates]);

  const deleteEstimate = useCallback(async (id) => {
    if (!companyId || !id) return false;
    try {
      await deleteDoc(estimRef(companyId, id));
      if (selectedId === id) setSelectedId(null);
      toast.success('Estimation supprimée');
      return true;
    } catch (e) { console.error(e); toast.error('Erreur lors de la suppression'); return false; }
  }, [companyId, selectedId]);

  // ── Modèles personnalisés (« Enregistrer comme modèle ») ──
  const saveAsTemplate = useCallback(async (estimate, name) => {
    if (!companyId || !estimate) return null;
    try {
      const tpl = {
        id: generateId(),
        name: name || estimate.name || 'Modèle',
        lots: JSON.parse(JSON.stringify(estimate.lots || [])),
        createdAt: new Date().toISOString(),
      };
      await setDoc(tplRef(companyId, tpl.id), tpl);
      toast.success('Modèle enregistré');
      return tpl;
    } catch (e) { console.error(e); toast.error("Erreur lors de l'enregistrement du modèle"); return null; }
  }, [companyId]);

  const deleteTemplate = useCallback(async (id) => {
    if (!companyId || !id) return false;
    try {
      await deleteDoc(tplRef(companyId, id));
      toast.success('Modèle supprimé');
      return true;
    } catch (e) { console.error(e); toast.error('Erreur lors de la suppression'); return false; }
  }, [companyId]);

  // ── Passerelle → projet ESTIMA détaillé ──
  const convertToProject = useCallback(async (estimate) => {
    if (!companyId || !estimate) return null;
    try {
      const project = estimateToProject(estimate);
      const { updatedChapters, sourceIds } = recalculateProject(project.chapters);
      const finalProject = { ...project, chapters: updatedChapters, sourceIds, lastSaved: new Date().toISOString() };
      await setDoc(doc(db, 'companies', companyId, 'projects', finalProject.id), finalProject);
      // Mémorise le projet comme actif pour ESTIMA (ouverture directe)
      if (user?.uid) {
        await setDoc(
          doc(db, 'users', user.uid, 'preferences', 'modules'),
          { estima: finalProject.id, updatedAt: serverTimestamp() },
          { merge: true }
        );
      }
      toast.success('Projet ESTIMA créé à partir de l\'estimation');
      return finalProject.id;
    } catch (e) { console.error(e); toast.error('Erreur lors de la conversion'); return null; }
  }, [companyId, user]);

  return {
    estimates, templates, isLoading, selected, selectedId, setSelectedId,
    createEstimate, createFromCustomTemplate, saveEstimate, duplicateEstimate, deleteEstimate,
    saveAsTemplate, deleteTemplate, convertToProject,
  };
};
