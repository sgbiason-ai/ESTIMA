// src/hooks/useDevisMoe.js
import { useState, useEffect, useCallback } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { generateId } from '../utils/helpers';
import { useToast } from '../contexts/ToastContext';

const col  = (cId) => collection(db, 'companies', cId, 'devisMoe');
const dref = (cId, id) => doc(db, 'companies', cId, 'devisMoe', id);

// ─── Phases loi MOP ─────────────────────────────────────────────────────────
export const PHASES_LOI_MOP = [
  { id: 'esq',  code: 'ESQ',  label: 'Esquisse',                                          actif: false },
  { id: 'avp',  code: 'AVP',  label: 'Avant-Projet',                                      actif: true  },
  { id: 'pro',  code: 'PRO',  label: 'Projet',                                             actif: true  },
  { id: 'act',  code: 'ACT',  label: "Assistance à la passation des marchés de travaux",   actif: true  },
  { id: 'visa', code: 'VISA', label: "Visa des études d'exécution",                        actif: true  },
  { id: 'det',  code: 'DET',  label: "Direction de l'exécution des travaux",               actif: true  },
  { id: 'aor',  code: 'AOR',  label: 'Assistance aux opérations de réception',             actif: true  },
  { id: 'opc',  code: 'OPC',  label: 'Ordonnancement, Pilotage et Coordination',           actif: false },
];

const DEFAULT_CATEGORIES = [
  { id: 'cdp', label: 'Chef de projet', tauxHoraire: 95 },
  { id: 'ing', label: 'Ingénieur',      tauxHoraire: 75 },
  { id: 'tec', label: 'Technicien',     tauxHoraire: 55 },
];

/** Retourne les catégories (label+taux) pour un membre donné du groupement */
export const getCategoriesForAssignee = (draft, assigneeKey) =>
  draft.categoriesParMembre?.[assigneeKey] || draft.categories || DEFAULT_CATEGORIES;

/** Construit la map complète { mandataire: [...cats], cotId: [...cats] } ou { mandataire: [...], notreEntreprise: [...] } */
export const buildCategoriesMap = (draft) => {
  const keys = draft.moeType === 'cotraitant'
    ? ['mandataire', 'notreEntreprise']
    : ['mandataire', ...(draft.cotraitants || []).map(c => c.id)];
  return Object.fromEntries(keys.map(k => [k, getCategoriesForAssignee(draft, k)]));
};

// ─── Construction des données phase d'un lot ────────────────────────────────
export const buildLotPhases = (phases, categories) => ({
  repartitionPhases: phases.filter(p => p.actif).map(p => ({ phaseId: p.id, pourcentage: '' })),
  phasesTemps: phases.filter(p => p.actif).map(p => ({
    phaseId: p.id,
    temps: Object.fromEntries(categories.map(c => [c.id, ''])),
  })),
});

// ─── Modèle vide d'un cotraitant ─────────────────────────────────────────────
export const createEmptyCotraitant = () => ({
  id: generateId(),
  nom: '',
  siret: '',
  adresse: '',
  codePostal: '',
  ville: '',
  telephone: '',
  email: '',
});

// Couleurs associées aux cotraitants (index 0, 1, 2)
export const COTRAITANT_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500', activeBg: 'bg-blue-500', activeText: 'text-white' },
  { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500', activeBg: 'bg-teal-500', activeText: 'text-white' },
  { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500', activeBg: 'bg-violet-500', activeText: 'text-white' },
];

export const MANDATAIRE_COLOR = { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500', activeBg: 'bg-amber-500', activeText: 'text-white' };

// ─── Tâches mode temps passé ─────────────────────────────────────────────────
export const createEmptyTache = (phaseId, label = '', assigneeKeys = null) => ({
  id: generateId(),
  phaseId,
  label,
  // Si assigneeKeys fourni → format nested { mandataire: { cdp: '', ... }, cotId: { ... } }
  // Sinon → format flat { cdp: '', ing: '', ... }
  temps: assigneeKeys
    ? Object.fromEntries(assigneeKeys.map(k => [k, {}]))
    : {},
});

export const TACHE_TEMPLATES = [
  { label: 'Réunion de présentation', phases: ['esq', 'avp'] },
  { label: 'DICT et report sur plan', phases: ['pro', 'det'] },
  { label: 'Étude préliminaire', phases: ['esq', 'avp'] },
  { label: 'Étude technique détaillée', phases: ['pro'] },
  { label: 'Rédaction du DCE', phases: ['pro', 'act'] },
  { label: 'Analyse des offres', phases: ['act'] },
  { label: 'Visa des plans d\'exécution', phases: ['visa'] },
  { label: 'Suivi d\'exécution chantier', phases: ['det'] },
  { label: 'Réunion de chantier', phases: ['det'] },
  { label: 'OPR — Opérations préalables', phases: ['aor'] },
  { label: 'Levée des réserves', phases: ['aor'] },
  { label: 'Coordination OPC', phases: ['opc'] },
  { label: 'Rédaction de compte rendu', phases: ['det', 'aor'] },
  { label: 'Note de calcul', phases: ['pro'] },
  { label: 'Plan d\'implantation', phases: ['pro', 'det'] },
];

// ─── Modèle vide d'un lot ────────────────────────────────────────────────────
export const createEmptyLot = (numero, phases, categories) => ({
  id: generateId(),
  numero: String(numero),
  designation: '',
  assigneA: 'mandataire',
  montantTravauxHT: '',
  ...buildLotPhases(phases, categories),
});

// ─── Numérotation automatique D26-001 ────────────────────────────────────────
export const getNextNumero = (devisList) => {
  const yy = String(new Date().getFullYear() % 100).padStart(2, '0');
  const prefix = `D${yy}-`;
  const existing = devisList
    .map(d => d.numero)
    .filter(n => n && n.startsWith(prefix))
    .map(n => parseInt(n.slice(prefix.length), 10))
    .filter(n => !isNaN(n));
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
};

// ─── Modèle vide d'un devis ──────────────────────────────────────────────────
export const createEmptyDevis = () => {
  const phases = PHASES_LOI_MOP.map(p => ({ ...p }));
  const categories = DEFAULT_CATEGORIES.map(c => ({ ...c }));
  return {
    id: generateId(),
    nom: '',
    reference: '',
    dateDevis: new Date().toISOString().slice(0, 10),
    objet: '',
    tva: 20,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    client: { designation: '', adresse: '', codePostal: '', ville: '', contact: '' },
    moeType: 'seul',
    mandataire: {
      nom: 'PAPYRUS',
      siret: '503 721 375 00023',
      adresse: '21-23, route de la Pradine\n81500 BANNIÈRES',
    },
    notreEntreprise: {
      nom: 'PAPYRUS',
      siret: '503 721 375 00023',
      adresse: '21-23, route de la Pradine\n81500 BANNIÈRES',
    },
    cotraitants: [],
    methode: 'pourcentage',
    phasesMode: 'loi_mop',
    phases,
    tauxHonorairesGlobal: '',
    categories,
    taches: [],            // mode temps passé : tâches avec phaseId + heures par catégorie
    customTemplates: null, // null = TACHE_TEMPLATES par défaut, sinon array custom
    lots: [],              // mode pourcentage : lots avec répartition % par phase
  };
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useDevisMoe = (user, companyId) => {
  const toast = useToast();
  const [devisList, setDevisList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (!user || !companyId) return;
    setIsLoading(true);
    const unsub = onSnapshot(col(companyId), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setDevisList(data);
      setIsLoading(false);
    }, (err) => {
      console.error('Erreur chargement devis MOE:', err);
      toast.error('Erreur de chargement des devis');
      setIsLoading(false);
    });
    return () => unsub();
  }, [user, companyId]);

  const selected = devisList.find(d => d.id === selectedId) || null;

  const createDevis = useCallback(async (nom = 'Nouveau devis') => {
    if (!companyId) return null;
    try {
      const d = createEmptyDevis();
      d.nom = nom;
      d.numero = getNextNumero(devisList);
      await setDoc(dref(companyId, d.id), d);
      setSelectedId(d.id);
      toast.success('Devis créé');
      return d;
    } catch (e) { console.error(e); toast.error('Erreur lors de la création'); return null; }
  }, [companyId]);

  const saveDevis = useCallback(async (data) => {
    if (!companyId || !data?.id) return false;
    try {
      await setDoc(dref(companyId, data.id), { ...data, updatedAt: new Date().toISOString() });
      return true;
    } catch (e) { console.error(e); toast.error('Erreur lors de la sauvegarde'); return false; }
  }, [companyId]);

  const duplicateDevis = useCallback(async (id) => {
    const src = devisList.find(d => d.id === id);
    if (!src) return null;
    try {
      const copy = { ...JSON.parse(JSON.stringify(src)), id: generateId(), nom: `${src.nom} (copie)`, numero: getNextNumero(devisList), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await setDoc(dref(companyId, copy.id), copy);
      setSelectedId(copy.id);
      toast.success('Devis dupliqué');
      return copy;
    } catch (e) { console.error(e); toast.error('Erreur lors de la duplication'); return null; }
  }, [companyId, devisList]);

  const deleteDevis = useCallback(async (id) => {
    if (!companyId || !id) return false;
    try {
      await deleteDoc(dref(companyId, id));
      if (selectedId === id) setSelectedId(null);
      toast.success('Devis supprimé');
      return true;
    } catch (e) { console.error(e); toast.error('Erreur lors de la suppression'); return false; }
  }, [companyId, selectedId]);

  return { devisList, isLoading, selected, selectedId, setSelectedId, createDevis, saveDevis, duplicateDevis, deleteDevis };
};
