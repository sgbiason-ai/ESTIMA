// src/hooks/useAppResources.js
//
// Ressources partagées au sein d'une entreprise :
//   CCTP maître, RC maître, branding.
//
// Chemin Firestore : companies/{companyId}/resources/{docId}
// Chaque entreprise a ses propres documents — isolation totale.

import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_BRANDING } from '../data/branding';
import { useToast } from '../contexts/ToastContext';

export const useAppResources = (user, companyId) => {
  const toast = useToast();

  const [masterCctp,     setMasterCctp]     = useState([]);
  const [masterRc,       setMasterRc]       = useState([]);
  const [masterBranding, setMasterBranding] = useState(DEFAULT_BRANDING);
  const [resourcesLoading, setResourcesLoading] = useState(false);

  // Chemin de base : companies/{companyId}/resources/
  const resDoc = (docId) => doc(db, 'companies', companyId, 'resources', docId);

  useEffect(() => {
    if (!user || !companyId) return;

    const fetchResources = async () => {
      setResourcesLoading(true);
      try {
        const [cctpSnap, brandSnap, rcSnap] = await Promise.all([
          getDoc(resDoc('master_cctp')),
          getDoc(resDoc('branding')),
          getDoc(resDoc('master_rc')),
        ]);

        if (cctpSnap.exists())  setMasterCctp(cctpSnap.data().content);
        if (brandSnap.exists()) setMasterBranding(brandSnap.data().config);
        if (rcSnap.exists())    setMasterRc(rcSnap.data().content);

      } catch (e) {
        console.error('Erreur chargement ressources:', e);
        toast.error("Impossible de charger les documents et le style.", { title: 'Erreur' });
      } finally {
        setResourcesLoading(false);
      }
    };

    fetchResources();
  }, [user, companyId]);

  const handleSaveMasterCctp = async (data) => {
    setMasterCctp(data);
    try {
      await setDoc(resDoc('master_cctp'), {
        content:   data,
        updatedAt: new Date().toISOString(),
      });
      toast.success('CCTP sauvegardé sur le Cloud.', { title: 'Sauvegarde réussie' });
    } catch (e) {
      console.error('Erreur sauvegarde CCTP:', e);
      toast.error('Impossible de sauvegarder le CCTP.', { title: 'Erreur' });
    }
  };

  const handleSaveMasterRc = async (data) => {
    setMasterRc(data);
    try {
      await setDoc(resDoc('master_rc'), {
        content:   data,
        updatedAt: new Date().toISOString(),
      });
      toast.success('Règlement de Consultation sauvegardé sur le Cloud.', { title: 'Sauvegarde réussie' });
    } catch (e) {
      console.error('Erreur sauvegarde RC:', e);
      toast.error('Impossible de sauvegarder le Règlement de Consultation.', { title: 'Erreur' });
    }
  };

  const handleSaveMasterBranding = async (data) => {
    setMasterBranding(data);
    try {
      await setDoc(resDoc('branding'), {
        config:    data,
        updatedAt: new Date().toISOString(),
      });
      toast.success("Style de l'entreprise sauvegardé.", { title: 'Sauvegarde réussie' });
    } catch (e) {
      console.error('Erreur sauvegarde branding:', e);
      toast.error('Impossible de sauvegarder le style.', { title: 'Erreur' });
    }
  };

  return {
    masterCctp,     setMasterCctp,
    masterRc,       setMasterRc,
    masterBranding, setMasterBranding,
    resourcesLoading,
    handleSaveMasterCctp,
    handleSaveMasterRc,
    handleSaveMasterBranding,
  };
};