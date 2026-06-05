// src/hooks/useDatabase.js
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
// XLSX chargé dynamiquement dans importFromExcel() pour éviter 425 KB au démarrage
import { generateId } from '../utils/helpers';
import { useDialog } from '../contexts/DialogContext';
import { useToast } from '../contexts/ToastContext';

// ─── Helpers chemins ─────────────────────────────────────────────────────────
// Toutes les données sont isolées sous /companies/{companyId}/...
const col  = (companyId, name)     => collection(db, 'companies', companyId, name);
const dref = (companyId, name, id) => doc(db, 'companies', companyId, name, id);

// Firestore interdit le caractère '/' dans les Document IDs (séparateur de chemin).
// On l'encode en '∕' (U+2215, division slash) pour permettre des symboles type "1/2 J".
// Le champ `symbol` dans le document conserve la valeur exacte tapée par l'utilisateur.
const unitDocId = (symbol) => String(symbol).replace(/\//g, '∕');

export const useDatabase = (user, companyId) => {
  const { confirm } = useDialog();
  const toast = useToast();

  const [bpu, setBpu]               = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits]           = useState([]);
  const [blocs, setBlocs]           = useState([]);

  // 16 couleurs bien distinctes (couvre 5-15 dossiers sans doublon)
  const CAT_COLORS = [
    '#3b82f6', // bleu
    '#f59e0b', // ambre
    '#8b5cf6', // violet
    '#10b981', // émeraude
    '#ef4444', // rouge
    '#06b6d4', // cyan
    '#ec4899', // rose
    '#84cc16', // lime
    '#f97316', // orange
    '#6366f1', // indigo
    '#14b8a6', // sarcelle
    '#92400e', // brun
    '#0ea5e9', // ciel
    '#d946ef', // fuchsia
    '#64748b', // ardoise
    '#059669', // vert foncé
  ];
  const isValidHex = (c) => /^#[0-9a-fA-F]{6}$/.test(c);

  // Assigner des couleurs uniques aux catégories qui n'en ont pas
  const ensureCategoryColors = useCallback(async (cats) => {
    const toFix = cats.filter(c => !c.color || !isValidHex(c.color));
    if (toFix.length === 0 || !companyId) return cats;
    // Couleurs déjà prises
    const usedColors = new Set(cats.filter(c => isValidHex(c.color)).map(c => c.color));
    const available = CAT_COLORS.filter(c => !usedColors.has(c));
    let idx = 0;
    const updated = cats.map(c => {
      if (c.color && isValidHex(c.color)) return c;
      const color = idx < available.length ? available[idx] : CAT_COLORS[(usedColors.size + idx) % CAT_COLORS.length];
      idx++;
      return { ...c, color };
    });
    // Persister en base
    await Promise.all(
      updated.filter((c, i) => c.color !== cats[i].color).map(c => setDoc(dref(companyId, 'categories', c.id), c))
    ).catch(() => {});
    return updated;
  }, [companyId]);
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
            { id: 'cat1', name: 'TERRASSEMENT', color: CAT_COLORS[0] },
            { id: 'cat2', name: 'RÉSEAUX HUMIDES', color: CAT_COLORS[1] },
          ];
          await Promise.all(defaults.map(c => setDoc(dref(companyId, 'categories', c.id), c)));
          setCategories(defaults);
        } else {
          const withColors = await ensureCategoryColors(catData);
          setCategories(withColors);
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

        const blocSnap = await getDocs(col(companyId, 'blocs'));
        setBlocs(blocSnap.docs.map(d => d.data()));
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
      const [bpuSnap, catSnap, unitSnap, blocSnap] = await Promise.all([
        getDocs(col(companyId, 'bpu')),
        getDocs(col(companyId, 'categories')),
        getDocs(col(companyId, 'units')),
        getDocs(col(companyId, 'blocs')),
      ]);
      setBpu(bpuSnap.docs.map(d => d.data()));
      const catData = catSnap.docs.map(d => d.data());
      setCategories(await ensureCategoryColors(catData));
      setUnits(unitSnap.docs.map(d => d.data()));
      setBlocs(blocSnap.docs.map(d => d.data()));
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
    const colorIdx = categories.length % CAT_COLORS.length;
    const newCat = { id: generateId(), name: name.toUpperCase(), color: CAT_COLORS[colorIdx] };
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
      await setDoc(dref(companyId, 'units', unitDocId(newItem.symbol)), newItem);
      toast.success(`Unité "${symb}" sauvegardée.`);
    } catch (e) {
      console.error('[saveUnit] erreur Firestore:', e);
      setUnits(prevUnits);
      toast.error('Unité non sauvegardée sur le Cloud.', { title: 'Erreur' });
    }
  };

  const deleteUnit = async (symbol) => {
    if (!companyId) return;
    const prevUnits = units;
    setUnits(prev => prev.filter(u => u.symbol !== symbol));
    try {
      await deleteDoc(dref(companyId, 'units', unitDocId(symbol)));
      toast.success(`Unité "${symbol}" supprimée.`);
    } catch {
      setUnits(prevUnits);
      toast.error('Suppression non synchronisée.', { title: 'Erreur' });
    }
  };

  // ─── ACTIONS BLOCS ────────────────────────────────────────────────────────
  // Un bloc = { id, name, articleIds: [bpuId...], updatedAt }.
  // Références dynamiques : les articles sont résolus depuis le BPU courant
  // au moment de l'insertion dans l'estimation (prix/désignation à jour).

  const addBloc = async (name, unit = '', articles = []) => {
    if (!companyId) return null;
    const newBloc = { id: generateId(), name: (name || '').trim(), unit: unit || '', articles, updatedAt: new Date().toISOString() };
    const prevBlocs = blocs;
    setBlocs(prev => [...prev, newBloc]);
    try {
      await setDoc(dref(companyId, 'blocs', newBloc.id), newBloc);
      toast.success(`Bloc "${newBloc.name}" créé.`);
    } catch {
      setBlocs(prevBlocs);
      toast.error('Bloc non sauvegardé sur le Cloud.', { title: 'Erreur' });
    }
    return newBloc;
  };

  const updateBloc = async (id, fields) => {
    if (!companyId) return;
    const updated = { ...fields, updatedAt: new Date().toISOString() };
    const prevBlocs = blocs;
    setBlocs(prev => prev.map(b => b.id === id ? { ...b, ...updated } : b));
    try {
      await updateDoc(dref(companyId, 'blocs', id), updated);
    } catch {
      setBlocs(prevBlocs);
      toast.error('Bloc non sauvegardé sur le Cloud.', { title: 'Erreur' });
    }
  };

  const deleteBloc = async (id) => {
    if (!companyId) return;
    const prevBlocs = blocs;
    setBlocs(prev => prev.filter(b => b.id !== id));
    try {
      await deleteDoc(dref(companyId, 'blocs', id));
      toast.success('Bloc supprimé.');
    } catch {
      setBlocs(prevBlocs);
      toast.error('Suppression non synchronisée.', { title: 'Erreur' });
    }
  };

  // ─── IMPORTS ──────────────────────────────────────────────────────────────

  const MAX_IMPORT_ROWS = 5000;
  const MAX_DESIGNATION_LENGTH = 500;

  const importFromExcel = (file) => {
    if (!companyId) return;

    // Validation type de fichier
    const ext = (file.name || '').split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      toast.error('Format non supporté. Utilisez un fichier .xlsx, .xls ou .csv.', { title: 'Fichier invalide' });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        // Limite du nombre de lignes
        if (jsonData.length > MAX_IMPORT_ROWS) {
          toast.error(`Le fichier contient ${jsonData.length} lignes (max ${MAX_IMPORT_ROWS}). Réduisez le fichier.`, { title: 'Fichier trop volumineux' });
          return;
        }

        let skipped = 0;
        const newItems = jsonData
          .map((row) => {
            if (!row || !row[0]) return null;

            // Validation designation
            const designation = String(row[0] ?? '').trim();
            if (!designation || designation.length > MAX_DESIGNATION_LENGTH) { skipped++; return null; }

            // Validation description
            const description = String(row[1] ?? '').trim().slice(0, 1000);

            // Validation unite
            const unit = String(row[2] ?? 'u').trim().slice(0, 20) || 'u';

            // Validation prix
            const price = Number(row[3]);
            if (!isFinite(price) || price < 0) { skipped++; return null; }

            return {
              id: generateId(),
              designation,
              description,
              unit,
              price,
              categoryId: null,
              updatedAt: new Date().toISOString(),
            };
          })
          .filter(Boolean);

        if (newItems.length === 0) {
          toast.warning(`Aucun article valide trouvé dans le fichier.${skipped > 0 ? ` ${skipped} ligne(s) ignorée(s).` : ''}`, { title: 'Import vide' });
          return;
        }

        const prevBpu = bpu;
        setBpu(prev => [...prev, ...newItems]);
        setDatabaseVersion(v => v + 1);
        try {
          await Promise.all(newItems.map(item => setDoc(dref(companyId, 'bpu', item.id), item)));
          const msg = `${newItems.length} article(s) importé(s).${skipped > 0 ? ` ${skipped} ligne(s) ignorée(s) (données invalides).` : ''}`;
          toast.success(msg, { title: 'Import terminé' });
        } catch {
          setBpu(prevBpu);
          setDatabaseVersion(v => v + 1);
          toast.error("L'import n'a pas pu être sauvegardé sur le Cloud.", { title: 'Erreur sauvegarde' });
        }
      } catch {
        toast.error('Impossible de lire le fichier Excel. Vérifiez le format.', { title: 'Erreur import' });
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
    blocs,
    addBloc, updateBloc, deleteBloc,
    databaseVersion,
    isLoading,
    loadBpu, isBpuLoaded, forceRefresh,
    addToBpu, updateBpuItem, deleteFromBpu, clearBpu,
    addCategory, deleteCategory, renameCategory, assignCategoryToItem,
    saveUnit, deleteUnit,
    importFromExcel, handleImportDatabase,
  };
};