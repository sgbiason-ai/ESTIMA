// src/hooks/useDatabase.js
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';
import { generateId } from '../utils/helpers';
import { useDialog } from '../contexts/DialogContext';
import { useToast } from '../contexts/ToastContext';

// ─── Helpers chemins ─────────────────────────────────────────────────────────
// Toutes les données sont isolées sous /companies/{companyId}/...
const col  = (companyId, name)     => collection(db, 'companies', companyId, name);
const dref = (companyId, name, id) => doc(db, 'companies', companyId, name, id);

export const useDatabase = (user, companyId) => {
  const { confirm } = useDialog();
  const toast = useToast();

  const [bpu, setBpu]               = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits]           = useState([]);
  const [databaseVersion, setDatabaseVersion] = useState(0);
  const [isLoading, setIsLoading]   = useState(true);
  const [isBpuLoaded, setIsBpuLoaded] = useState(false);

  // ─── CHARGEMENT INITIAL ────────────────────────────────────────────────────

  useEffect(() => {
    if (!user || !companyId) return;

    // Réinitialise le cache BPU quand on change d'entreprise
    setIsBpuLoaded(false);
    setBpu([]);

    const fetchLightData = async () => {
      try {
        setIsLoading(true);

        const catSnap = await getDocs(col(companyId, 'categories'));
        const catData = catSnap.docs.map(d => d.data());
        if (catData.length === 0) {
          const defaults = [
            { id: 'cat1', name: 'TERRASSEMENT' },
            { id: 'cat2', name: 'RÉSEAUX HUMIDES' },
          ];
          await Promise.all(defaults.map(c => setDoc(dref(companyId, 'categories', c.id), c)));
          setCategories(defaults);
        } else {
          setCategories(catData);
        }

        const unitSnap = await getDocs(col(companyId, 'units'));
        const unitData = unitSnap.docs.map(d => d.data());
        if (unitData.length > 0) {
          setUnits(unitData);
        } else {
          const defaultUnits = [
            { symbol: 'u',   label: 'Unité' },
            { symbol: 'm³',  label: 'Mètre cube' },
            { symbol: 'ml',  label: 'Mètre linéaire' },
            { symbol: 'm²',  label: 'Mètre carré' },
            { symbol: 't',   label: 'Tonne' },
            { symbol: 'ens', label: 'Ensemble' },
          ];
          await Promise.all(defaultUnits.map(u => setDoc(dref(companyId, 'units', u.symbol), u)));
          setUnits(defaultUnits);
        }
      } catch (error) {
        console.error('Erreur chargement Firebase :', error);
        toast.error('Impossible de charger les données. Vérifiez votre connexion.', { title: 'Erreur réseau' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchLightData();
  }, [user, companyId]);

  // ─── CHARGEMENT BPU À LA DEMANDE ──────────────────────────────────────────

  const loadBpu = useCallback(async () => {
    if (isBpuLoaded || !companyId) return;
    try {
      setIsLoading(true);
      const bpuSnap = await getDocs(col(companyId, 'bpu'));
      setBpu(bpuSnap.docs.map(d => d.data()));
      setIsBpuLoaded(true);
    } catch (error) {
      console.error('Erreur chargement BPU :', error);
      toast.error('Impossible de charger la base de prix.', { title: 'Erreur' });
    } finally {
      setIsLoading(false);
    }
  }, [isBpuLoaded, companyId]);

  const forceRefresh = useCallback(async () => {
    if (!companyId) return;
    try {
      setIsLoading(true);
      const [bpuSnap, catSnap, unitSnap] = await Promise.all([
        getDocs(col(companyId, 'bpu')),
        getDocs(col(companyId, 'categories')),
        getDocs(col(companyId, 'units')),
      ]);
      setBpu(bpuSnap.docs.map(d => d.data()));
      setCategories(catSnap.docs.map(d => d.data()));
      setUnits(unitSnap.docs.map(d => d.data()));
      setIsBpuLoaded(true);
      setDatabaseVersion(v => v + 1);
    } catch (error) {
      console.error('Erreur actualisation :', error);
      setIsBpuLoaded(false);
      toast.error('Impossible d\'actualiser les données.', { title: 'Erreur' });
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  // ─── ACTIONS BPU ──────────────────────────────────────────────────────────

  const addToBpu = async (item) => {
    if (!companyId) return;
    const newItem = { ...item, id: generateId(), updatedAt: new Date().toISOString() };
    const prevBpu = bpu;
    setBpu(prev => [...prev, newItem]);
    setDatabaseVersion(v => v + 1);
    try {
      await setDoc(dref(companyId, 'bpu', newItem.id), newItem);
      toast.success('Article ajouté à la bibliothèque.');
    } catch {
      setBpu(prevBpu);
      setDatabaseVersion(v => v + 1);
      toast.error("L'article n'a pas pu être sauvegardé sur le Cloud.", { title: 'Erreur sauvegarde' });
    }
  };

  const updateBpuItem = async (id, fields) => {
    if (!companyId) return;
    const updated = { ...fields, updatedAt: new Date().toISOString() };
    const prevBpu = bpu;
    setBpu(prev => prev.map(i => i.id === id ? { ...i, ...updated } : i));
    setDatabaseVersion(v => v + 1);
    try {
      await updateDoc(dref(companyId, 'bpu', id), updated);
    } catch {
      setBpu(prevBpu);
      setDatabaseVersion(v => v + 1);
      toast.error('Modification non sauvegardée sur le Cloud.', { title: 'Erreur sauvegarde' });
    }
  };

  const deleteFromBpu = async (id) => {
    if (!companyId) return;
    const prevBpu = bpu;
    setBpu(prev => prev.filter(i => i.id !== id));
    setDatabaseVersion(v => v + 1);
    try {
      await deleteDoc(dref(companyId, 'bpu', id));
      toast.success('Article supprimé.');
    } catch {
      setBpu(prevBpu);
      setDatabaseVersion(v => v + 1);
      toast.error('Suppression non synchronisée sur le Cloud.', { title: 'Erreur' });
    }
  };

  const clearBpu = async () => {
    if (!companyId) return;
    const ok = await confirm(
      'Vider toute la base de prix ? Cette action est irréversible sur le Cloud.',
      { title: 'Vider la base', danger: true, confirmLabel: 'Tout supprimer' }
    );
    if (!ok) return;
    setBpu([]);
    toast.success('Base de prix vidée.');
  };

  // ─── ACTIONS CATÉGORIES ───────────────────────────────────────────────────

  const addCategory = async (name) => {
    if (!companyId) return;
    const newCat = { id: generateId(), name: name.toUpperCase() };
    const prevCategories = categories;
    setCategories(prev => [...prev, newCat]);
    try {
      await setDoc(dref(companyId, 'categories', newCat.id), newCat);
      toast.success(`Dossier "${newCat.name}" créé.`);
    } catch {
      setCategories(prevCategories);
      toast.error('Dossier non sauvegardé sur le Cloud.', { title: 'Erreur' });
    }
  };

  const deleteCategory = async (id) => {
    if (!companyId) return;
    const ok = await confirm("Supprimer ce dossier ? Les articles ne seront pas supprimés.", {
      title: 'Supprimer le dossier',
      danger: true,
      confirmLabel: 'Supprimer',
    });
    if (!ok) return;
    const prevCategories = categories;
    const prevBpu = bpu;
    setCategories(prev => prev.filter(c => c.id !== id));
    setBpu(prev => prev.map(item => item.categoryId === id ? { ...item, categoryId: null } : item));
    setDatabaseVersion(v => v + 1);
    try {
      await deleteDoc(dref(companyId, 'categories', id));
      toast.success('Dossier supprimé.');
    } catch {
      setCategories(prevCategories);
      setBpu(prevBpu);
      setDatabaseVersion(v => v + 1);
      toast.error('Suppression non synchronisée.', { title: 'Erreur' });
    }
  };

  const renameCategory = async (id, newName) => {
    if (!companyId) return;
    const name = newName.toUpperCase();
    const prevCategories = categories;
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name } : c));
    try {
      await updateDoc(dref(companyId, 'categories', id), { name });
    } catch {
      setCategories(prevCategories);
      toast.error('Renommage non sauvegardé.', { title: 'Erreur' });
    }
  };

  const assignCategoryToItem = async (itemId, catId) => {
    if (!companyId) return;
    const idToFind = String(itemId);
    const prevBpu = bpu;
    setBpu(prev => prev.map(item =>
      String(item.id) === idToFind ? { ...item, categoryId: catId } : item
    ));
    setDatabaseVersion(v => v + 1);
    try {
      await updateDoc(dref(companyId, 'bpu', idToFind), { categoryId: catId });
    } catch {
      setBpu(prevBpu);
      setDatabaseVersion(v => v + 1);
      toast.error('Catégorie non sauvegardée.', { title: 'Erreur' });
    }
  };

  // ─── ACTIONS UNITÉS ───────────────────────────────────────────────────────

  const saveUnit = async (symb, lab) => {
    if (!companyId) return;
    const newItem = { symbol: symb, label: lab };
    const prevUnits = units;
    setUnits(prev => {
      const exists = prev.find(u => u.symbol === newItem.symbol);
      return exists ? prev.map(u => u.symbol === newItem.symbol ? newItem : u) : [...prev, newItem];
    });
    try {
      await setDoc(dref(companyId, 'units', newItem.symbol), newItem);
      toast.success(`Unité "${symb}" sauvegardée.`);
    } catch {
      setUnits(prevUnits);
      toast.error('Unité non sauvegardée sur le Cloud.', { title: 'Erreur' });
    }
  };

  const deleteUnit = async (symbol) => {
    if (!companyId) return;
    const prevUnits = units;
    setUnits(prev => prev.filter(u => u.symbol !== symbol));
    try {
      await deleteDoc(dref(companyId, 'units', symbol));
      toast.success(`Unité "${symbol}" supprimée.`);
    } catch {
      setUnits(prevUnits);
      toast.error('Suppression non synchronisée.', { title: 'Erreur' });
    }
  };

  // ─── IMPORTS ──────────────────────────────────────────────────────────────

  const importFromExcel = (file) => {
    if (!companyId) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const newItems = jsonData
          .map((row) => {
            if (!row || !row[0]) return null;
            return {
              id: generateId(),
              designation: row[0],
              description: row[1] || '',
              unit: row[2] || 'u',
              price: Number(row[3]) || 0,
              categoryId: null,
              updatedAt: new Date().toISOString(),
            };
          })
          .filter(Boolean);

        const prevBpu = bpu;
        setBpu(prev => [...prev, ...newItems]);
        setDatabaseVersion(v => v + 1);
        try {
          await Promise.all(newItems.map(item => setDoc(dref(companyId, 'bpu', item.id), item)));
          toast.success(`${newItems.length} article(s) importé(s) avec succès.`, { title: 'Import terminé' });
        } catch {
          setBpu(prevBpu);
          setDatabaseVersion(v => v + 1);
          toast.error("L'import n'a pas pu être sauvegardé sur le Cloud.", { title: 'Erreur sauvegarde' });
        }
      } catch {
        toast.error('Impossible de lire le fichier Excel.', { title: 'Erreur import' });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportDatabase = async (importedData) => {
    if (!companyId) return;
    if (!importedData || (!importedData.bpu && !importedData.categories)) {
      toast.error('Le fichier importé est invalide ou vide.', { title: 'Import impossible' });
      return;
    }
    const ok = await confirm('Importer et écraser les données existantes sur le Cloud ?', {
      title: 'Importer la base',
      danger: true,
      confirmLabel: 'Importer',
    });
    if (!ok) return;

    try {
      setIsLoading(true);
      if (importedData.categories) {
        await Promise.all(importedData.categories.map(cat => setDoc(dref(companyId, 'categories', cat.id), cat)));
        setCategories(importedData.categories);
      }
      if (importedData.units) {
        await Promise.all(importedData.units.map(unit => setDoc(dref(companyId, 'units', unit.symbol), unit)));
        setUnits(importedData.units);
      }
      if (importedData.bpu) {
        const cleanedItems = importedData.bpu.map(item => ({
          ...item,
          id: String(item.id || generateId()),
          updatedAt: new Date().toISOString(),
        }));
        await Promise.all(cleanedItems.map(item => setDoc(dref(companyId, 'bpu', item.id), item)));
        setBpu(cleanedItems);
      }
      setDatabaseVersion(v => v + 1);
      toast.success('Base de données importée avec succès !', { title: 'Import terminé' });
    } catch (error) {
      console.error('Erreur import base :', error);
      toast.error("Une erreur est survenue pendant l'import.", { title: 'Erreur' });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    bpu, setBpu,
    categories, setCategories,
    units,
    databaseVersion,
    isLoading,
    loadBpu, isBpuLoaded, forceRefresh,
    addToBpu, updateBpuItem, deleteFromBpu, clearBpu,
    addCategory, deleteCategory, renameCategory, assignCategoryToItem,
    saveUnit, deleteUnit,
    importFromExcel, handleImportDatabase,
  };
};