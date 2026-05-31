// src/hooks/useProjectArchives.js
import { useState, useEffect, useCallback } from 'react';
import { doc, setDoc, getDocs, deleteDoc, collection, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { generateId } from '../utils/helpers';

/**
 * Hook de gestion des archives projet.
 * Chaque archive est un snapshot figé du projet à un instant T,
 * stocké dans : companies/{companyId}/projects/{projectId}/archives/{archiveId}
 */
export const useProjectArchives = (user, companyId, project) => {
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeArchive, setActiveArchive] = useState(null); // Archive en cours de visualisation

  const projectId = project?.id;

  // ─── CHARGER LES ARCHIVES ──────────────────────────────────────────
  const loadArchives = useCallback(async () => {
    if (!companyId || !projectId) return;
    setLoading(true);
    try {
      const archivesRef = collection(db, 'companies', companyId, 'projects', projectId, 'archives');
      const q = query(archivesRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setArchives(list);
    } catch (e) {
      console.warn('[archives] Erreur chargement:', e.message);
    } finally {
      setLoading(false);
    }
  }, [companyId, projectId]);

  useEffect(() => {
    loadArchives();
  }, [loadArchives]);

  // ─── CALCULER LE PROCHAIN INDICE ──────────────────────────────────
  const getNextIndex = (phase) => {
    const existing = archives.filter(a => a.phase === phase);
    if (existing.length === 0) return 1;
    const maxIdx = Math.max(...existing.map(a => a.index || 0));
    return maxIdx + 1;
  };

  // Indice lettre cartouche BTP : 1→A, 2→B, … 26→Z, 27→AA.
  const indexToLetter = (index) => {
    let n = Math.max(1, Number(index) || 1);
    let label = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      label = String.fromCharCode(65 + rem) + label;
      n = Math.floor((n - 1) / 26);
    }
    return label;
  };

  // ─── CALCULER LE TOTAL HT ─────────────────────────────────────────
  const computeTotalHT = (chapters) => {
    let total = 0;
    const walk = (nodes) => {
      (nodes || []).forEach(n => {
        if (n.type === 'item' && !n.isOption) {
          total += (Number(n.qty) || 0) * (Number(n.price) || 0);
        }
        if (n.children) walk(n.children);
      });
    };
    walk(chapters);
    return total;
  };

  // ─── COMPTER LES ARTICLES ─────────────────────────────────────────
  const countItems = (chapters) => {
    let count = 0;
    const walk = (nodes) => {
      (nodes || []).forEach(n => {
        if (n.type === 'item') count++;
        if (n.children) walk(n.children);
      });
    };
    walk(chapters);
    return count;
  };

  // ─── CRÉER UNE ARCHIVE ────────────────────────────────────────────
  // meta (optionnel) : { subject, recipient, status, note } — métadonnées d'émission.
  const createArchive = async (phase, meta = {}) => {
    if (!companyId || !projectId || !project || !user) {
      throw new Error('Données manquantes pour créer l\'archive');
    }

    const index = getNextIndex(phase);
    // Indice lettre (cartouche BTP) : DCE-A, DCE-B, EXE-A…
    const label = `${phase}-${indexToLetter(index)}`;
    const archiveId = `archive_${generateId()}`;
    const now = new Date().toISOString();

    // Snapshot complet du projet (sans les méta internes)
    const { __isNew, lastSaved: _lastSaved, updatedBy: _updatedBy, ...projectSnapshot } = project;

    const archiveDoc = {
      id: archiveId,
      phase,
      index,
      label,
      createdAt: now,
      createdBy: user.email,
      projectName: project.name || '',
      totalHT: computeTotalHT(project.chapters),
      itemsCount: countItems(project.chapters),
      chaptersCount: (project.chapters || []).length,
      // ── Métadonnées d'émission ──
      subject: (meta.subject || '').trim(),
      recipient: (meta.recipient || '').trim(),
      status: meta.status || 'emis', // 'emis' | 'brouillon'
      note: (meta.note || '').trim(),
      emittedAt: now,
      projectSnapshot,
    };

    await setDoc(
      doc(db, 'companies', companyId, 'projects', projectId, 'archives', archiveId),
      archiveDoc
    );

    // Rafraîchir la liste locale
    setArchives(prev => [archiveDoc, ...prev]);

    return archiveDoc;
  };

  // ─── SUPPRIMER UNE ARCHIVE ──────────────────────────────────────
  const deleteArchive = async (archiveId) => {
    if (!companyId || !projectId || !archiveId) return;
    await deleteDoc(doc(db, 'companies', companyId, 'projects', projectId, 'archives', archiveId));
    setArchives(prev => prev.filter(a => a.id !== archiveId));
    // Si l'archive supprimée est celle affichée, la fermer
    if (activeArchive?.id === archiveId) setActiveArchive(null);
  };

  // ─── VISUALISER UNE ARCHIVE ───────────────────────────────────────
  const viewArchive = (archive) => {
    setActiveArchive(archive);
  };

  const closeArchive = () => {
    setActiveArchive(null);
  };

  return {
    archives,
    loading,
    activeArchive,
    createArchive,
    deleteArchive,
    viewArchive,
    closeArchive,
    loadArchives,
  };
};
