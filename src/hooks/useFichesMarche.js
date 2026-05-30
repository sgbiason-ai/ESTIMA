// src/hooks/useFichesMarche.js
// Hook CRUD pour la gestion des Fiches Marché dans Firestore
// Collection: companies/{companyId}/fichesMarche/{ficheId}

import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, doc, getDoc, setDoc, deleteDoc, onSnapshot, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { generateId } from '../utils/helpers';
import { useToast } from '../contexts/ToastContext';

// ─── Helpers chemins ─────────────────────────────────────────────────────────
const col  = (companyId) => collection(db, 'companies', companyId, 'fichesMarche');
const dref = (companyId, id) => doc(db, 'companies', companyId, 'fichesMarche', id);

// ─── Modèle vide d'une entreprise (réutilisé pour mandataire, co-traitants, MOE)
export const createEmptyEntreprise = () => ({
  nomCommercial: '',
  denominationSociale: '',
  adresse: '',
  codePostal: '',
  ville: '',
  telephone: '',
  telecopie: '',
  email: '',
  siret: '',
});

// ─── Modèle vide d'une Fiche Marché ─────────────────────────────────────────
export const createEmptyFiche = () => ({
  id: generateId(),
  nom: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),

  // Section A — Pouvoir adjudicateur / Maître d'ouvrage
  sectionA: {
    designation: '',
    adresse: '',
    codePostal: '',
    ville: '',
    telephone: '',
    telecopie: '',
    email: '',
    representant: '',
    qualite: '',
  },

  // Section B — Titulaire du marché
  // Supporte entreprise seule ou groupement (2 ou 3 entreprises)
  sectionB: {
    type: 'seul',                       // 'seul' | 'groupement'
    typeGroupement: 'solidaire',        // 'solidaire' | 'conjoint'
    mandataire: createEmptyEntreprise(), // Entreprise seule ou mandataire du groupement
    cotraitants: [],                    // 0 à 2 co-traitants (tableau d'entreprises)
  },

  // Section C — Maître d'œuvre (pré-rempli PAPYRUS)
  sectionC: {
    nomCommercial: 'PAPYRUS',
    denominationSociale: 'SARL PAPYRUS',
    adresse: '21-23, route de la Pradine\nAnciennes Ecoles',
    codePostal: '81500',
    ville: 'BANNIERES',
    telephone: '05 63 34 10 78',
    telecopie: '',
    email: 'contact@papyrus-be.fr',
    siret: '503 721 375 00023',
  },

  // Section D — Objet du marché
  sectionD: {
    objet: '',
    referenceMarche: '',
    dateNotification: '',
    dureeExecution: '',
    uniteDuree: 'mois',
    adresseExecution: '',
    lots: [],
  },

  // Documents EXE par entreprise (marchés allotis)
  exeParEntreprise: {},
});

// ─── Hook ────────────────────────────────────────────────────────────────────
export const useFichesMarche = (user, companyId) => {
  const toast = useToast();

  const [fiches, setFiches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFicheId, setSelectedFicheIdRaw] = useState(null);
  const prefsLoadedRef = useRef(false);

  // Wrap setter pour persister la sélection dans les prefs user (Firestore)
  const setSelectedFicheId = useCallback((id) => {
    setSelectedFicheIdRaw(id);
    if (user?.uid) {
      setDoc(
        doc(db, 'users', user.uid, 'preferences', 'modules'),
        { docAdmin: id || null, updatedAt: serverTimestamp() },
        { merge: true }
      ).catch(() => {});
    }
  }, [user]);

  // ── Chargement initial + écoute temps réel ────────────────────────────────
  useEffect(() => {
    if (!user || !companyId) return;

    setIsLoading(true);

    const unsubscribe = onSnapshot(
      query(col(companyId), orderBy('createdAt', 'desc'), limit(100)),
      async (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setFiches(data);
        setIsLoading(false);

        // Auto-sélection de la dernière fiche ouverte (prefs Firestore), au 1er chargement
        if (!prefsLoadedRef.current && user?.uid) {
          prefsLoadedRef.current = true;
          try {
            const prefsSnap = await getDoc(doc(db, 'users', user.uid, 'preferences', 'modules'));
            const lastId = prefsSnap.exists() ? prefsSnap.data().docAdmin : null;
            if (lastId && data.some((f) => f.id === lastId)) {
              setSelectedFicheIdRaw(lastId);
            }
          } catch { /* ignore */ }
        }
      },
      (error) => {
        console.error('Erreur chargement fiches marché:', error);
        toast.error('Erreur de chargement des fiches marché');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, companyId]);

  // ── Fiche sélectionnée ────────────────────────────────────────────────────
  const selectedFiche = fiches.find((f) => f.id === selectedFicheId) || null;

  // ── Créer une nouvelle fiche ──────────────────────────────────────────────
  const createFiche = useCallback(async (nom = 'Nouveau marché') => {
    if (!companyId) return null;

    try {
      const fiche = createEmptyFiche();
      fiche.nom = nom;

      await setDoc(dref(companyId, fiche.id), fiche);
      setSelectedFicheId(fiche.id);
      toast.success('Fiche marché créée');
      return fiche;
    } catch (error) {
      console.error('Erreur création fiche:', error);
      toast.error('Erreur lors de la création');
      return null;
    }
  }, [companyId]);

  // ── Sauvegarder (mettre à jour) une fiche ────────────────────────────────
  const saveFiche = useCallback(async (ficheData) => {
    if (!companyId || !ficheData?.id) return false;

    try {
      const updated = {
        ...ficheData,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(dref(companyId, ficheData.id), updated);
      toast.success('Fiche marché sauvegardée');
      return true;
    } catch (error) {
      console.error('Erreur sauvegarde fiche:', error);
      toast.error('Erreur lors de la sauvegarde');
      return false;
    }
  }, [companyId]);

  // ── Dupliquer une fiche ───────────────────────────────────────────────────
  const duplicateFiche = useCallback(async (ficheId) => {
    if (!companyId) return null;

    const source = fiches.find((f) => f.id === ficheId);
    if (!source) return null;

    try {
      const newFiche = {
        ...JSON.parse(JSON.stringify(source)),
        id: generateId(),
        nom: `${source.nom} (copie)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(dref(companyId, newFiche.id), newFiche);
      setSelectedFicheId(newFiche.id);
      toast.success('Fiche marché dupliquée');
      return newFiche;
    } catch (error) {
      console.error('Erreur duplication fiche:', error);
      toast.error('Erreur lors de la duplication');
      return null;
    }
  }, [companyId, fiches]);

  // ── Supprimer une fiche ───────────────────────────────────────────────────
  const deleteFiche = useCallback(async (ficheId) => {
    if (!companyId || !ficheId) return false;

    try {
      await deleteDoc(dref(companyId, ficheId));

      // Si c'était la fiche sélectionnée, on désélectionne
      if (selectedFicheId === ficheId) {
        setSelectedFicheId(null);
      }

      toast.success('Fiche marché supprimée');
      return true;
    } catch (error) {
      console.error('Erreur suppression fiche:', error);
      toast.error('Erreur lors de la suppression');
      return false;
    }
  }, [companyId, selectedFicheId]);

  return {
    fiches,
    isLoading,
    selectedFiche,
    selectedFicheId,
    setSelectedFicheId,
    createFiche,
    saveFiche,
    duplicateFiche,
    deleteFiche,
  };
};
