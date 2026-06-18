// src/views/crc/CrcView.jsx
//
// Module Compte Rendu de Reunion — orchestrateur principal.
// Interface avec ruban style Office en haut.

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ArrowLeft, ClipboardList, Plus, Trash2, Copy,
  Building2, Users, ListTree, Edit3, Eye, FileDown, Mail, FolderOpen,
  HelpCircle, Compass, Archive, UploadCloud, ArrowLeftRight,
  FileText as FileWord, X, MapPin, Minimize2, Send, AlertCircle,
} from 'lucide-react';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { deleteCrrImage } from '../../utils/crrImageStorage';
import { loadDraft, clearDraft } from '../../hooks/useRobustSave';
import { DEFAULT_BRANDING } from '../../data/branding';
import CrcLinkProjectModal from './CrcLinkProjectModal';

// Mapping projet → chantierInfo CRC
const mapProjectToChantierInfo = (proj) => ({
  nom: proj.name || '',
  lieu: proj.location || '',
  dureePreparation: proj.prepPeriod || '',
  dureeChantier: proj.duration || '',
  communeLogo: proj.clientLogo || null,
  cotraitantLogo: proj.cotraitantLogo || (Array.isArray(proj.coTraitantLogos) && proj.coTraitantLogos.length > 0 ? proj.coTraitantLogos[0] : null),
});

import { useCrrManager } from '../../hooks/useCrrManager';
import CrrHeader from '../../components/crr/CrrHeader';
import CrrParticipants from '../../components/crr/CrrParticipants';
import CrrObservations from '../../components/crr/CrrObservations';
import CrrPreview from '../../components/crr/CrrPreview';
import UnifiedParticipantsModal from '../../components/crr/UnifiedParticipantsModal';
import HelpPanel from '../../components/help/HelpPanel';
import CrcGuidedTour from '../../components/crr/CrcGuidedTour';
import { toast, confirm } from '../../utils/globalUI';

import { RibbonButton, RibbonDivider, RibbonGroup } from './CrcRibbon';
import CrcChantierPickerModal from './CrcChantierPickerModal';
import CrcMeetingTabs from './CrcMeetingTabs';
import CrcCategoriesModal from './CrcCategoriesModal';
import CrcInfoChantierModal from './CrcInfoChantierModal';
import CrcDuplicateModal from './CrcDuplicateModal';
import CrcLibraryModal from './CrcLibraryModal';
import CrcAuditModal from './CrcAuditModal';
import CrcTerrainView from './CrcTerrainView';
import CrcSendMailModal from '../../components/crr/CrcSendMailModal';
import { useSmtpConfig } from '../../hooks/useSmtpConfig';
import { usePresence, useCoEditors } from '../../hooks/usePresence';
import CoEditBanner from '../../components/common/CoEditBanner';

// ── VUE PRINCIPALE ──────────────────────────────────────────────────────────

export default function CrcView({ onBackToHub, user, companyId, onNavigateModule }) {
  const [chantiers, setChantiers] = useState([]);
  const [crrDoc, setCrrDoc] = useState(null);
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const [participantLibrary, setParticipantLibrary] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadChantiers = useCallback(async () => {
    if (!companyId) return [];
    const snap = await getDocs(collection(db, 'companies', companyId, 'crr'));
    const docs = [];
    snap.forEach((d) => docs.push({ id: d.id, ...d.data() }));
    return docs;
  }, [companyId]);

  useEffect(() => {
    if (!user || !companyId) return;
    const load = async () => {
      setLoading(true);
      try {
        const docs = await loadChantiers();
        setChantiers(docs);
        const brandSnap = await getDoc(doc(db, 'companies', companyId, 'resources', 'branding'));
        if (brandSnap.exists()) setBranding(brandSnap.data().config);
        const libSnap = await getDoc(doc(db, 'companies', companyId, 'resources', 'participantLibrary'));
        if (libSnap.exists()) setParticipantLibrary(libSnap.data().contacts || []);
        // Deep-link depuis le Workspace (pastille CR d'une affaire) : prioritaire,
        // one-shot via sessionStorage — devient aussi le chantier mémorisé.
        let lastId = null;
        try {
          const handoff = sessionStorage.getItem('estima_open_crc_chantier_id');
          if (handoff) {
            sessionStorage.removeItem('estima_open_crc_chantier_id');
            lastId = handoff;
            if (user?.uid) {
              setDoc(
                doc(db, 'users', user.uid, 'preferences', 'modules'),
                { crc: handoff, updatedAt: serverTimestamp() },
                { merge: true }
              ).catch(() => {});
            }
          }
        } catch { /* ignore */ }
        // Dernier chantier CRC : Firestore prefs + migration one-shot depuis localStorage
        if (!lastId && user?.uid) {
          const prefsRef = doc(db, 'users', user.uid, 'preferences', 'modules');
          const prefsSnap = await getDoc(prefsRef);
          lastId = prefsSnap.exists() ? prefsSnap.data().crc : null;
          if (!lastId) {
            const legacyId = localStorage.getItem(`crr_active_chantier__${companyId}`);
            if (legacyId) {
              lastId = legacyId;
              try {
                await setDoc(prefsRef, { crc: legacyId, updatedAt: serverTimestamp() }, { merge: true });
                localStorage.removeItem(`crr_active_chantier__${companyId}`);
              } catch { /* ignore */ }
            }
          }
        }
        const target = docs.find((d) => d.id === lastId) || docs[0];
        if (target) {
          // Verifier s'il y a un brouillon localStorage plus recent
          const draftKey = `draft_crr_${target.id}`;
          const draft = loadDraft(draftKey);
          const draftAt = draft?._draftAt || 0;
          const firestoreAt = target.lastSaved ? new Date(target.lastSaved).getTime() : 0;
          if (draft && draftAt > firestoreAt) {
            const { _draftAt, ...cleanDraft } = draft;
            setCrrDoc(cleanDraft);
            toast.warning('Brouillon local restauré (dernière sauvegarde non envoyée).', { duration: 6000 });
            clearDraft(draftKey);
          } else {
            if (draft) clearDraft(draftKey);
            // Sync projet lié si nécessaire
            if (target.linkedProjectId) {
              try {
                const projSnap = await getDoc(doc(db, 'companies', companyId, 'projects', target.linkedProjectId));
                if (projSnap.exists()) {
                  const mapped = mapProjectToChantierInfo(projSnap.data());
                  const merged = { ...target.crrConfig?.chantierInfo, ...mapped };
                  const synced = { ...target, crrConfig: { ...target.crrConfig, chantierInfo: merged } };
                  await setDoc(doc(db, 'companies', companyId, 'crr', target.id), synced, { merge: true });
                  setCrrDoc(synced);
                  setChantiers(prev => prev.map(c => c.id === target.id ? synced : c));
                } else {
                  setCrrDoc(target);
                }
              } catch { setCrrDoc(target); }
            } else {
              setCrrDoc(target);
            }
          }
        }
      } catch (e) {
        console.error('Erreur chargement CRR:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, companyId, loadChantiers]);

  const handleSaveCrrDoc = useCallback(
    async (data) => {
      if (!data || !companyId) return;
      const docId = data.id;
      try {
        await setDoc(doc(db, 'companies', companyId, 'crr', docId), {
          ...data,
          lastSaved: new Date().toISOString(),
          updatedBy: user?.email,
        });
        setChantiers((prev) =>
          prev.map((c) => (c.id === docId ? { ...data, lastSaved: new Date().toISOString() } : c))
        );
      } catch (err) {
        console.error('[CRC] Erreur sauvegarde:', err);
        throw err;
      }
    },
    [companyId, user]
  );

  const [showLinkModal, setShowLinkModal] = useState(false);

  const handleCreateChantier = useCallback(() => {
    setShowLinkModal(true);
  }, []);

  const handleLinkChoice = useCallback(async (linkedProject) => {
    setShowLinkModal(false);
    const newId = `crr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const chantierInfo = linkedProject
      ? { ...mapProjectToChantierInfo(linkedProject), dateDebut: '', dateFin: '' }
      : { nom: '', lieu: '', dureePreparation: '', dureeChantier: '', dateDebut: '', dateFin: '' };
    const newDoc = {
      id: newId,
      ...(linkedProject ? { linkedProjectId: linkedProject.id } : {}),
      crrConfig: {
        participantGroups: [],
        categories: [],
        legalText: '',
        chantierInfo,
      },
      crrMeetings: [],
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'companies', companyId, 'crr', newId), newDoc);
      setChantiers((prev) => [...prev, newDoc]);
      setCrrDoc(newDoc);
      if (user?.uid) {
        setDoc(
          doc(db, 'users', user.uid, 'preferences', 'modules'),
          { crc: newId, updatedAt: serverTimestamp() },
          { merge: true }
        ).catch(() => {});
      }
      setShowInfoChantierModal(true);
    } catch (err) {
      console.error('[CRC] Erreur création chantier:', err);
      toast.error('Impossible de créer le chantier.');
    }
  }, [companyId, user]);

  const handleDeleteChantier = useCallback(async (chantierId) => {
    try {
      // Purge Storage en arriere-plan pour toutes les images de l'affaire
      const target = chantiers.find((c) => c.id === chantierId);
      if (target?.crrMeetings) {
        for (const m of target.crrMeetings) {
          for (const obs of (m.observations || [])) {
            for (const img of (obs.images || [])) deleteCrrImage(img);
          }
        }
      }
      await deleteDoc(doc(db, 'companies', companyId, 'crr', chantierId));
      setChantiers((prev) => prev.filter((c) => c.id !== chantierId));
      if (crrDoc?.id === chantierId) {
        const remaining = chantiers.filter((c) => c.id !== chantierId);
        setCrrDoc(remaining[0] || null);
      }
    } catch (err) {
      console.error('[CRC] Erreur suppression chantier:', err);
      toast.error('Impossible de supprimer le chantier.');
    }
  }, [companyId, crrDoc, chantiers]);

  const handleSelectChantier = useCallback(async (c) => {
    let docToSet = c;
    // Sync auto si lié à un projet
    if (c.linkedProjectId && companyId) {
      try {
        const projSnap = await getDoc(doc(db, 'companies', companyId, 'projects', c.linkedProjectId));
        if (projSnap.exists()) {
          const mapped = mapProjectToChantierInfo(projSnap.data());
          const currentInfo = c.crrConfig?.chantierInfo || {};
          const mergedInfo = { ...currentInfo, ...mapped };
          docToSet = { ...c, crrConfig: { ...c.crrConfig, chantierInfo: mergedInfo } };
          // Persister la sync
          await setDoc(doc(db, 'companies', companyId, 'crr', c.id), docToSet, { merge: true });
          setChantiers(prev => prev.map(ch => ch.id === c.id ? docToSet : ch));
        }
      } catch (e) {
        console.warn('[CRC] Sync projet lié échouée:', e);
      }
    }
    setCrrDoc(docToSet);
    if (user?.uid) {
      setDoc(
        doc(db, 'users', user.uid, 'preferences', 'modules'),
        { crc: c.id, updatedAt: serverTimestamp() },
        { merge: true }
      ).catch(() => {});
    }
  }, [companyId, user]);

  const manager = useCrrManager({
    project: crrDoc,
    onUpdateProject: setCrrDoc,
    onSaveProject: handleSaveCrrDoc,
    masterBranding: branding,
  });

  const chantierName = manager.crrConfig.chantierInfo?.nom || '';

  // ── Présence + co-édition (alerte d'écrasement) ───────────────────────────
  usePresence({
    user, companyId, activeTab: 'crc',
    entityType: crrDoc?.id ? 'crc' : null,
    entityId: crrDoc?.id || null,
    entityName: chantierName || null,
  });
  const coEditors = useCoEditors({
    companyId, currentUserId: user?.uid,
    entityType: 'crc', entityId: crrDoc?.id || null,
  });

  const [viewMode, setViewMode] = useState('edit');
  // Tri par date PAR categorie : map { [categorie]: 'asc' | 'desc' }
  const [sortDate, setSortDate] = useState(() => {
    try { return JSON.parse(localStorage.getItem('crc_sort_dates') || '{}') || {}; }
    catch { return {}; }
  });
  const [sortCat, setSortCat] = useState(() => localStorage.getItem('crc_sort_cat') || null);
  const cycleDateSort = useCallback((cat) => setSortDate(prev => {
    const cur = prev?.[cat] || null;
    const next = cur === null ? 'asc' : cur === 'asc' ? 'desc' : null;
    const updated = { ...prev };
    if (next) updated[cat] = next; else delete updated[cat];
    localStorage.setItem('crc_sort_dates', JSON.stringify(updated));
    return updated;
  }), []);
  const cycleCatSort = useCallback(() => setSortCat(p => {
    const next = p === null ? 'asc' : p === 'asc' ? 'desc' : null;
    next ? localStorage.setItem('crc_sort_cat', next) : localStorage.removeItem('crc_sort_cat');
    return next;
  }), []);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [showInfoChantierModal, setShowInfoChantierModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showHelpPanel, setShowHelpPanel] = useState(false);
  const [showGuidedTour, setShowGuidedTour] = useState(false);
  const [showSendMailModal, setShowSendMailModal] = useState(false);
  const { config: smtpConfig, isConfigured: smtpConfigured } = useSmtpConfig();
  const [showChantierPicker, setShowChantierPicker] = useState(false);
  const [importModal, setImportModal] = useState(null);
  const importFileRef = useRef(null);

  const handleSaveLibrary = useCallback(async (contacts) => {
    setParticipantLibrary(contacts);
    if (companyId) {
      try {
        await setDoc(doc(db, 'companies', companyId, 'resources', 'participantLibrary'), { contacts });
      } catch (err) {
        console.error('[CRC] Erreur sauvegarde bibliothèque:', err);
        toast.error('Impossible de sauvegarder la bibliothèque de contacts.');
      }
    }
  }, [companyId]);

  // CR precedent pour l'audit
  const previousMeeting = manager.activeMeeting
    ? manager.meetings
        .filter((m) => m.number < manager.activeMeeting.number)
        .sort((a, b) => b.number - a.number)[0] || null
    : null;

  // Compteur d'actions en retard sur le CR actif (echeance passee + statut != done)
  const overdueCount = useMemo(() => {
    const obc = manager.observationsByCategory;
    if (!obc) return 0;
    const t = new Date();
    const todayISO = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    let n = 0;
    Object.values(obc).forEach((arr) => {
      arr.forEach((o) => {
        if (o.actionDeadline && o.actionDeadline < todayISO && o.status !== 'done') n++;
      });
    });
    return n;
  }, [manager.observationsByCategory]);

  // Date par defaut pour la duplication : date de prochaine reunion du CR actif
  const defaultDuplicateDate = (() => {
    const nextDate = manager.activeMeeting?.nextMeeting?.date;
    if (nextDate) return nextDate;
    if (!manager.activeMeeting?.date) return '';
    try {
      const d = new Date(manager.activeMeeting.date + 'T00:00:00');
      d.setDate(d.getDate() + 7);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    } catch { return ''; }
  })();

  const handleDuplicateMeeting = useCallback((newDate) => {
    manager.duplicateMeeting(newDate);
  }, [manager]);

  const handleDeleteActiveMeeting = useCallback(async () => {
    if (!manager.activeMeeting) return;
    const ok = await confirm(
      `Supprimer le CR n°${manager.activeMeeting.number} ?`,
      { title: 'Suppression', danger: true }
    );
    if (ok) manager.deleteMeeting(manager.activeMeetingId);
  }, [manager]);

  const handleExportPdf = useCallback(async () => {
    const { buildExportFilename, loadDirHandle, saveToDirectory, ensureDirPermission } = await import('../../utils/exportHelpers');
    const info = manager.crrConfig.chantierInfo || {};
    const meeting = manager.activeMeeting;

    const filename = buildExportFilename(info.exportPattern, {
      number: meeting.number, projectName: chantierName, date: meeting.date, ext: 'pdf',
    });

    // Dossier memorise (modale info chantier). Permission demandee TOT (avant la
    // generation) pour conserver l'activation utilisateur du clic.
    const dirKey = `${companyId}_${crrDoc?.id || 'default'}`;
    const dirHandle = await loadDirHandle(dirKey);
    const dirPerm = await ensureDirPermission(dirHandle);

    // Pas d'ecriture directe possible → boite "Enregistrer sous" (avant generation)
    let saveHandle = null;
    if (dirPerm !== 'granted') {
      try {
        saveHandle = await window.showSaveFilePicker({
          suggestedName: filename,
          startIn: dirHandle || 'documents',
          types: [{ description: 'Document PDF', accept: { 'application/pdf': ['.pdf'] } }],
        });
      } catch (err) {
        if (err.name === 'AbortError') { toast.info('Annule.'); return; }
        toast.error(`Erreur : ${err.message}`);
        return;
      }
    }

    // Generer le PDF (une seule fois)
    const { generatePdfCrr } = await import('../../utils/pdfCrrGenerator');
    const result = await generatePdfCrr(meeting, manager.crrConfig, chantierName, branding, { returnBlob: true, sortDate, sortCat });
    if (!result?.blob) { toast.error('Echec generation PDF.'); return; }

    const openAction = {
      label: 'Ouvrir le PDF',
      onClick: () => {
        const blobUrl = URL.createObjectURL(result.blob);
        window.open(blobUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      },
    };

    try {
      if (dirPerm === 'granted') {
        // Ecriture directe dans le dossier memorise (sans boite de dialogue)
        const ok = await saveToDirectory(dirHandle, filename, result.blob);
        if (!ok) throw new Error('ecriture dans le dossier refusee');
        toast.success(`Enregistre dans « ${dirHandle.name} » : ${filename}`, { title: 'PDF enregistre', duration: 8000, action: openAction });
      } else {
        const writable = await saveHandle.createWritable();
        await writable.write(result.blob);
        await writable.close();
        toast.success(`Sauvegarde : ${saveHandle.name}`, { title: 'PDF enregistre', duration: 8000, action: openAction });
      }
    } catch (err) {
      toast.error(`Echec ecriture : ${err.message}`);
    }
  }, [manager, chantierName, branding, companyId, crrDoc]);

  const handleExportWord = useCallback(async () => {
    const { buildExportFilename, loadDirHandle, saveToDirectory, ensureDirPermission } = await import('../../utils/exportHelpers');
    const info = manager.crrConfig.chantierInfo || {};
    const meeting = manager.activeMeeting;

    const filename = buildExportFilename(info.exportPattern, {
      number: meeting.number, projectName: chantierName, date: meeting.date, ext: 'doc',
    });

    // Dossier memorise → permission demandee TOT (avant generation).
    const dirKey = `${companyId}_${crrDoc?.id || 'default'}`;
    const dirHandle = await loadDirHandle(dirKey);
    const dirPerm = await ensureDirPermission(dirHandle);

    let saveHandle = null;
    if (dirPerm !== 'granted') {
      try {
        saveHandle = await window.showSaveFilePicker({
          suggestedName: filename,
          startIn: dirHandle || 'documents',
          types: [{ description: 'Document Word', accept: { 'application/msword': ['.doc'] } }],
        });
      } catch (err) {
        if (err.name === 'AbortError') { toast.info('Annule.'); return; }
        toast.error(`Erreur : ${err.message}`);
        return;
      }
    }

    const { generateWordCrr } = await import('../../utils/crrWordExporter');
    const result = await generateWordCrr(meeting, manager.crrConfig, chantierName, branding, { filename, returnBlob: true, sortDate, sortCat });
    if (!result?.blob) { toast.error('Echec generation Word.'); return; }

    try {
      if (dirPerm === 'granted') {
        const ok = await saveToDirectory(dirHandle, filename, result.blob);
        if (!ok) throw new Error('ecriture dans le dossier refusee');
        toast.success(`Enregistre dans « ${dirHandle.name} » : ${filename}`);
      } else {
        const writable = await saveHandle.createWritable();
        await writable.write(result.blob);
        await writable.close();
        toast.success(`Sauvegarde : ${saveHandle.name}`);
      }
    } catch (err) {
      toast.error(`Echec ecriture : ${err.message}`);
    }
  }, [manager, chantierName, branding, companyId, crrDoc]);

  // ── Archive export (.crcestima) ──
  const handleArchiveExport = useCallback(async () => {
    if (!crrDoc) return;
    const { exportCrcArchive } = await import('../../utils/crcArchive');
    const { loadDirHandle, saveToDirectory } = await import('../../utils/exportHelpers');

    toast.info('Preparation de l\'archive (telechargement des photos)...');
    let result;
    try {
      result = await exportCrcArchive(crrDoc, user?.email);
    } catch (err) {
      console.error('[CRC] Export archive:', err);
      toast.error('Erreur pendant l\'export de l\'archive.');
      return;
    }
    const { blob, filename, stats } = result;

    const statsMsg = stats.total > 0
      ? ` — ${stats.embedded}/${stats.total} photos embarquees${stats.failed ? ` (${stats.failed} inaccessibles)` : ''}`
      : '';

    const dirKey = `${companyId}_${crrDoc.id || 'default'}`;
    const dirHandle = await loadDirHandle(dirKey);
    if (dirHandle) {
      const saved = await saveToDirectory(dirHandle, filename, blob);
      if (saved) { toast.success(`Archive : ${filename}${statsMsg}`); return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Archive : ${filename}${statsMsg}`);
  }, [crrDoc, user, companyId]);

  // ── Archive import (.crcestima) ──
  const handleImportFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const { importCrcArchive } = await import('../../utils/crcArchive');
    const result = await importCrcArchive(file);
    if (!result.valid) {
      toast.error(result.error);
      return;
    }
    setImportModal({ summary: result.summary, data: result.data });
  }, []);

  const handleImportConfirm = useCallback(async (mode) => {
    if (!importModal) return;
    const { data } = importModal;

    if (mode === 'overwrite' && crrDoc) {
      const updated = { ...crrDoc, crrConfig: data.crrConfig, crrMeetings: data.crrMeetings };
      await setDoc(doc(db, 'companies', companyId, 'crr', crrDoc.id), {
        ...updated, lastSaved: new Date().toISOString(), updatedBy: user?.email,
      });
      setChantiers(prev => prev.map(d => d.id === crrDoc.id ? updated : d));
      setCrrDoc(updated);
      toast.success('Affaire importee (ecrasement).');
    } else {
      const newId = `crr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const newDoc = {
        id: newId,
        crrConfig: data.crrConfig,
        crrMeetings: data.crrMeetings,
        createdAt: new Date().toISOString(),
        lastSaved: new Date().toISOString(),
        updatedBy: user?.email,
      };
      await setDoc(doc(db, 'companies', companyId, 'crr', newId), newDoc);
      setChantiers(prev => [...prev, newDoc]);
      setCrrDoc(newDoc);
      toast.success('Affaire importee (nouveau chantier).');
    }
    setImportModal(null);
  }, [importModal, crrDoc, companyId, user]);

  const handleSendMail = useCallback(async () => {
    if (manager.diffusionEmails.length === 0) {
      toast.warning('Aucun destinataire avec email et diffusion cochee.');
      return;
    }
    const { buildExportFilename, loadDirHandle, saveDirHandle, saveToDirectory } = await import('../../utils/exportHelpers');
    const { buildLightVbs, buildMailSubject, buildMailHtml } = await import('../../utils/crrMailer');
    const info = manager.crrConfig.chantierInfo || {};
    const meeting = manager.activeMeeting;

    // 1. Obtenir le dossier projet (sauvegarde ou picker)
    const dirKey = `${companyId}_${crrDoc?.id || 'default'}`;
    let dirHandle = await loadDirHandle(dirKey);

    if (dirHandle) {
      try {
        const perm = await dirHandle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
          const req = await dirHandle.requestPermission({ mode: 'readwrite' });
          if (req !== 'granted') dirHandle = null;
        }
      } catch { dirHandle = null; }
    }

    if (!dirHandle) {
      try {
        dirHandle = await window.showDirectoryPicker({ id: 'crr-export', mode: 'readwrite', startIn: 'documents' });
        await saveDirHandle(dirKey, dirHandle);
      } catch (err) {
        if (err.name === 'AbortError') { toast.info('Annule.'); return; }
        toast.error(`Erreur : ${err.message}`);
        return;
      }
    }

    // 2. Generer le PDF
    const pdfFilename = buildExportFilename(info.exportPattern, {
      number: meeting.number, projectName: chantierName, date: meeting.date, ext: 'pdf',
    });
    const { generatePdfCrr } = await import('../../utils/pdfCrrGenerator');
    const pdfData = await generatePdfCrr(
      meeting, manager.crrConfig, chantierName, branding, { returnBlob: true, filename: pdfFilename, sortDate, sortCat }
    );
    if (!pdfData?.blob) { toast.error('Echec generation PDF.'); return; }

    // 3. Sauvegarder le PDF dans le dossier projet
    const pdfSaved = await saveToDirectory(dirHandle, pdfFilename, pdfData.blob);
    if (!pdfSaved) { toast.error('Echec ecriture PDF dans le dossier.'); return; }

    // 4. Generer et sauvegarder le VBS (leger, reference le PDF par nom)
    const subject = buildMailSubject(meeting, chantierName);
    const to = manager.diffusionEmails.join(';');
    const htmlBody = buildMailHtml(meeting, chantierName);
    const vbsContent = buildLightVbs(pdfFilename, to, subject, htmlBody);
    const vbsBlob = new Blob([vbsContent], { type: 'application/octet-stream' });
    const vbsFilename = `Envoyer_CR_${String(meeting.number).padStart(2, '0')}.vbs`;
    await saveToDirectory(dirHandle, vbsFilename, vbsBlob);

    toast.success(`${pdfFilename} + ${vbsFilename} enregistres.\nDouble-cliquez le .vbs pour ouvrir Outlook.`, { duration: 8000 });
  }, [manager, chantierName, branding, companyId, crrDoc]);

  // ── Optimisation images : recompression + migration vers Firebase Storage ───
  const handleOptimizeImages = useCallback(async () => {
    if (!crrDoc) return;
    const ok = await confirm(
      'Optimiser toutes les photos : recompression (600px / 50%) et deplacement vers Firebase Storage.\n\nCela reduit la taille du document Firestore (< 1 Mo) et libere l\'affaire.\nOperation sans possibilite de retour.',
      { title: 'Optimiser les images', danger: false }
    );
    if (!ok) return;
    toast.info('Optimisation en cours...');
    try {
      const res = await manager.optimizeAllImages({ companyId });
      const kbBefore = Math.round(res.sizeBefore / 1024);
      const kbAfter = Math.round(res.sizeAfter / 1024);
      const gain = kbBefore - kbAfter;
      const parts = [];
      if (res.migrated > 0) parts.push(`${res.migrated} migree${res.migrated > 1 ? 's' : ''} vers Storage`);
      if (res.optimized > 0) parts.push(`${res.optimized} recompressee${res.optimized > 1 ? 's' : ''}`);
      if (parts.length === 0) parts.push('aucune photo a optimiser');
      const errPart = res.migrationErrors > 0 ? ` (${res.migrationErrors} erreur${res.migrationErrors > 1 ? 's' : ''} Storage)` : '';
      toast.success(
        `${parts.join(' + ')}${errPart} — ${kbBefore} Ko → ${kbAfter} Ko (-${gain} Ko)`
      );
    } catch (err) {
      console.error('[CRC] Optimisation images:', err);
      toast.error('Erreur pendant l\'optimisation des images.');
    }
  }, [crrDoc, manager, companyId]);

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f5f5f7] text-gray-500">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hasMeeting = !!manager.activeMeeting;

  return (
    <div className="flex flex-col h-screen bg-[#f5f5f7] text-gray-900 overflow-hidden"
      >

      {/* ═══════════════════════════════════════════════════════════════════════
          RUBAN ESTIMASTYLE
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="shrink-0 bg-white/70 backdrop-blur-xl border-b border-slate-200/60 shadow-sm min-w-0 w-full z-40 relative">

        {/* Ligne superieure : titre + retour */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-200/50 bg-white/40">
          <button
            onClick={onBackToHub}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all text-xs font-medium"
          >
            <ArrowLeft size={14} />
            Hub
          </button>
          <div className="h-4 w-px bg-gray-200/60" />
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-gray-500" />
            <span className="text-sm font-bold text-gray-900 tracking-tight">Compte Rendu de Réunion</span>
            {overdueCount > 0 && (
              <span
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold border border-red-200"
                title={`${overdueCount} action${overdueCount > 1 ? 's' : ''} en retard sur ce CR (échéance dépassée + statut non résolu)`}
              >
                <AlertCircle size={10} />
                {overdueCount} en retard
              </span>
            )}
          </div>
        </div>

        {/* Ruban principal — wrap multi-lignes sous xl (tablette/laptop), single-line + scroll en xl+ */}
        <div className="flex items-end flex-wrap xl:flex-nowrap gap-x-1 gap-y-2 xl:gap-x-0.5 xl:gap-y-0 px-2 py-1 xl:overflow-x-auto max-w-full" style={{ scrollbarWidth: 'none' }}>

          {/* ── GROUPE : CHANTIER ── */}
          <RibbonGroup label="Chantier" dataTour="chantier">
            <RibbonButton icon={Plus} label="Nouvelle affaire" onClick={handleCreateChantier} variant="primary" title="Créer un nouveau chantier" />
            <RibbonButton
              icon={FolderOpen}
              label={crrDoc?.crrConfig?.chantierInfo?.nom || 'Choisir affaire'}
              onClick={() => setShowChantierPicker(true)}
              variant="primary"
              title="Choisir une affaire parmi la liste"
            />
          </RibbonGroup>

          <RibbonDivider />

          {/* ── GROUPE : REUNION ── */}
          <RibbonGroup label="Reunion" dataTour="reunion">
            <RibbonButton icon={Plus} label="Nouveau CR" onClick={manager.createMeeting} disabled={!crrDoc} variant="primary" title="Creer une nouvelle reunion de chantier" />
            <RibbonButton icon={Copy} label="Dupliquer CR" onClick={() => setShowDuplicateModal(true)} disabled={!hasMeeting} variant="primary" title="Dupliquer la reunion avec report des observations non resolues" />
            <RibbonButton icon={ArrowLeftRight} label="Audit CR" onClick={() => setShowAuditModal(true)} disabled={!previousMeeting} variant="accent" title="Comparer avec la reunion precedente" />
            <RibbonButton icon={Trash2} label="Supprimer CR" onClick={handleDeleteActiveMeeting} disabled={!hasMeeting} variant="default" title="Supprimer definitivement cette reunion" />
          </RibbonGroup>

          <RibbonDivider />

          {/* ── GROUPE : CONFIGURATION ── */}
          <RibbonGroup label="Configuration" dataTour="configuration">
            <RibbonButton icon={Building2} label="Info Chantier" onClick={() => setShowInfoChantierModal(true)} disabled={!crrDoc} variant="primary" title="Nom, adresse et infos du chantier" />
            <RibbonButton icon={Users} label="Participants" onClick={() => setShowParticipantsModal(true)} disabled={!crrDoc} variant="primary" title="Gerer les groupes et contacts participants" />
            <RibbonButton icon={ListTree} label="Categories" onClick={() => setShowCategoriesModal(true)} disabled={!crrDoc} variant="primary" title="Gerer les categories d'observations" />
          </RibbonGroup>

          <RibbonDivider />

          {/* ── GROUPE : MODE ── */}
          <RibbonGroup label="Mode" dataTour="mode">
            <div className="flex items-center bg-gray-100 rounded-lg xl:rounded-xl p-0.5">
              {[
                { id: 'edit', icon: Edit3, label: 'Édition' },
                { id: 'preview', icon: Eye, label: 'Aperçu' },
                { id: 'terrain', icon: MapPin, label: 'Terrain' },
              ].map(m => (
                <button key={m.id} onClick={() => setViewMode(m.id)}
                  className={`flex items-center gap-1 px-2 xl:px-3 py-1.5 xl:py-2 rounded-md xl:rounded-lg text-[10px] xl:text-xs font-medium transition-all ${
                    viewMode === m.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  }`}>
                  <m.icon size={12} className="xl:hidden" />
                  <m.icon size={14} className="hidden xl:block" />
                  {m.label}
                </button>
              ))}
            </div>
          </RibbonGroup>

          <RibbonDivider />

          {/* ── GROUPE : EXPORTS ── */}
          <RibbonGroup label="Exports" dataTour="exports">
            <RibbonButton icon={FileDown} label="Export PDF" onClick={handleExportPdf} disabled={!hasMeeting} variant="primary" title="Telecharger le compte rendu en PDF" />
            <RibbonButton icon={FileWord} label="Export Word" onClick={handleExportWord} disabled={!hasMeeting} variant="accent" title="Telecharger le compte rendu en Word (.doc)" />
            <RibbonButton icon={Mail} label="Outlook" onClick={handleSendMail} disabled={!hasMeeting} variant="accent" title="Envoi via Outlook (telecharge un script .vbs)" />
            <RibbonButton
              icon={Send}
              label={smtpConfigured ? 'Envoyer (web)' : 'Envoyer (web)'}
              onClick={() => setShowSendMailModal(true)}
              disabled={!hasMeeting}
              variant="primary"
              title={smtpConfigured
                ? 'Envoyer le CR par email via le serveur (SMTP)'
                : 'Configuration SMTP requise — cliquez pour configurer'}
            />
          </RibbonGroup>

          <RibbonDivider />

          {/* ── GROUPE : AIDE ── */}
          <RibbonGroup label="Aide">
            <RibbonButton icon={HelpCircle} label="Aide" onClick={() => setShowHelpPanel(true)} title="Ouvrir le guide d'aide complet" />
            <RibbonButton icon={Compass} label="Tour" onClick={() => setShowGuidedTour(true)} title="Lancer le tour guide interactif" />
          </RibbonGroup>

          <RibbonDivider />

          {/* ── GROUPE : ARCHIVAGE ── */}
          <RibbonGroup label="Archivage" dataTour="archivage">
            <RibbonButton icon={Archive} label="Archiver" onClick={handleArchiveExport} disabled={!crrDoc} title="Exporter l'affaire complete (.crcestima)" />
            <RibbonButton icon={UploadCloud} label="Importer" onClick={() => importFileRef.current?.click()} title="Importer une affaire (.crcestima)" />
            <RibbonButton icon={Minimize2} label="Optimiser images" onClick={handleOptimizeImages} disabled={!crrDoc} title="Recompresser toutes les photos pour passer sous la limite Firestore 1 Mo" />
          </RibbonGroup>

        </div>
      </div>

      <CoEditBanner editors={coEditors} />

      {/* ═══════════════════════════════════════════════════════════════════════
          CONTENU PRINCIPAL
          ═══════════════════════════════════════════════════════════════════════ */}
      {!crrDoc ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FolderOpen size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-sm text-gray-500 mb-4">Créez ou sélectionnez un chantier pour commencer</p>
            <button
              onClick={handleCreateChantier}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all mx-auto active:scale-[0.97]"
            >
              <Plus size={14} /> Nouveau chantier
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Onglets des reunions */}
          <div data-tour="meetings-list">
          <CrcMeetingTabs
            meetings={manager.meetings}
            activeMeetingId={manager.activeMeetingId}
            setActiveMeetingId={manager.setActiveMeetingId}
            saveStatus={manager.saveStatus}
            onForceSave={manager.forceSave}
          />
          </div>

          {/* Contenu principal (pleine largeur) */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#f5f5f7]" data-tour="content-area">
            <div className="flex-1 overflow-y-auto">
              {!manager.activeMeeting ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Edit3 size={48} className="mb-4 opacity-30" />
                  <p className="text-sm">Cliquez sur « Nouveau CR » pour créer le premier compte rendu</p>
                </div>
              ) : viewMode === 'terrain' ? (
                <div className="p-6 h-full">
                  <CrcTerrainView meeting={manager.activeMeeting} observationsByCategory={manager.observationsByCategory} />
                </div>
              ) : viewMode === 'preview' ? (
                <div className="p-6 bg-gray-100 min-h-full">
                  <CrrPreview meeting={manager.activeMeeting} crrConfig={manager.crrConfig} projectName={chantierName} branding={branding} sortDate={sortDate} sortCat={sortCat} />
                </div>
              ) : (
                <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
                  <CrrHeader meeting={manager.activeMeeting} projectName={chantierName}
                    updateMeetingField={manager.updateMeetingField} updateNextMeeting={manager.updateNextMeeting} />
                  <CrrParticipants meeting={manager.activeMeeting} crrConfig={manager.crrConfig}
                    setAttendance={manager.setAttendance} setDiffusion={manager.setDiffusion}
                    addContact={manager.addContact} updateContact={manager.updateContact} deleteContact={manager.deleteContact}
                    addParticipantGroup={manager.addParticipantGroup} updateParticipantGroup={manager.updateParticipantGroup}
                    deleteParticipantGroup={manager.deleteParticipantGroup} showManagement={true}
                    reorderParticipantGroups={manager.reorderParticipantGroups} />
                  <CrrObservations meeting={manager.activeMeeting} categories={manager.crrConfig.categories}
                    categoryCodes={manager.crrConfig.categoryCodes}
                    observationsByCategory={manager.observationsByCategory} addObservation={manager.addObservation}
                    updateObservation={manager.updateObservation} deleteObservation={manager.deleteObservation}
                    reorderObservations={manager.reorderObservations}
                    legalText={manager.crrConfig.legalText}
                    participantGroups={manager.crrConfig.participantGroups}
                    companyId={companyId} crrId={crrDoc?.id}
                    sortDate={sortDate} sortCat={sortCat}
                    onCycleDateSort={cycleDateSort} onCycleCatSort={cycleCatSort} />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Modals ── */}
      <CrcChantierPickerModal
        isOpen={showChantierPicker}
        onClose={() => setShowChantierPicker(false)}
        chantiers={chantiers}
        activeId={crrDoc?.id}
        onSelect={handleSelectChantier}
        onDelete={handleDeleteChantier}
        companyId={companyId}
      />

      <CrcCategoriesModal isOpen={showCategoriesModal} onClose={() => setShowCategoriesModal(false)}
        categories={manager.crrConfig.categories} addCategory={manager.addCategory}
        renameCategory={manager.renameCategory} deleteCategory={manager.deleteCategory}
        reorderCategories={manager.reorderCategories}
        categoryCodes={manager.crrConfig.categoryCodes} setCategoryCode={manager.setCategoryCode} />

      <UnifiedParticipantsModal
        isOpen={showParticipantsModal}
        onClose={() => setShowParticipantsModal(false)}
        participantGroups={manager.activeParticipantGroups}
        addContact={manager.addContact}
        updateContact={manager.updateContact}
        deleteContact={manager.deleteContact}
        addParticipantGroup={manager.addParticipantGroup}
        updateParticipantGroup={manager.updateParticipantGroup}
        deleteParticipantGroup={manager.deleteParticipantGroup}
        reorderParticipantGroups={manager.reorderParticipantGroups}
        importContactsFromLibrary={manager.importContactsFromLibrary}
        moveContactBetweenGroups={manager.moveContactBetweenGroups}
        libraryContacts={participantLibrary}
        onSaveLibrary={handleSaveLibrary}
      />

      <CrcLinkProjectModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onSelect={handleLinkChoice}
        companyId={companyId}
      />

      <CrcInfoChantierModal
        isOpen={showInfoChantierModal}
        onClose={() => setShowInfoChantierModal(false)}
        chantierInfo={manager.crrConfig.chantierInfo}
        updateChantierInfo={manager.updateChantierInfo}
        exportDirKey={`${companyId}_${crrDoc?.id || 'default'}`}
        linkedProjectId={crrDoc?.linkedProjectId}
      />

      {/* Input file hidden pour import .crcestima */}
      <input
        ref={importFileRef}
        type="file"
        accept=".crcestima"
        className="hidden"
        onChange={handleImportFile}
      />

      {/* Modal import .crcestima */}
      {importModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onMouseDown={() => setImportModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[460px] overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <UploadCloud size={18} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Importer une affaire</h3>
                  <p className="text-[10px] text-slate-500">Fichier .crcestima</p>
                </div>
              </div>
              <button onClick={() => setImportModal(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-all">
                <X size={16} className="text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Chantier</span>
                  <span className="font-bold text-slate-800">{importModal.summary.chantierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Comptes rendus</span>
                  <span className="font-medium text-slate-700">{importModal.summary.meetingCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Observations</span>
                  <span className="font-medium text-slate-700">{importModal.summary.observationCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Images</span>
                  <span className="font-medium text-slate-700">{importModal.summary.imageCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Groupes participants</span>
                  <span className="font-medium text-slate-700">{importModal.summary.participantGroups}</span>
                </div>
                {importModal.summary.exportedAt && (
                  <div className="flex justify-between text-[11px] pt-1 border-t border-slate-200">
                    <span className="text-slate-400">Exporte le</span>
                    <span className="text-slate-500">{new Date(importModal.summary.exportedAt).toLocaleString('fr-FR')}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                {crrDoc && (
                  <button
                    onClick={() => handleImportConfirm('overwrite')}
                    className="flex-1 px-4 py-2.5 bg-orange-50 text-orange-600 text-sm font-medium rounded-xl hover:bg-orange-100 transition-all border border-orange-200"
                  >
                    Ecraser le chantier actif
                  </button>
                )}
                <button
                  onClick={() => handleImportConfirm('new')}
                  className="flex-1 px-4 py-2.5 bg-emerald-500 text-white text-sm font-medium rounded-xl hover:bg-emerald-600 transition-all shadow-sm"
                >
                  Creer nouveau chantier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <CrcDuplicateModal
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        onConfirm={handleDuplicateMeeting}
        defaultDate={defaultDuplicateDate}
      />

      <CrcAuditModal
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        currentMeeting={manager.activeMeeting}
        previousMeeting={previousMeeting}
        participantGroups={manager.activeParticipantGroups}
      />

      <HelpPanel
        isOpen={showHelpPanel}
        onClose={() => setShowHelpPanel(false)}
        moduleId="crc"
        headerActions={
          <button
            onClick={() => { setShowHelpPanel(false); setShowGuidedTour(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold hover:bg-blue-200 transition-colors"
          >
            Tour guide
          </button>
        }
      />

      {showGuidedTour && (
        <CrcGuidedTour onClose={() => setShowGuidedTour(false)} />
      )}

      <CrcSendMailModal
        open={showSendMailModal}
        onClose={() => setShowSendMailModal(false)}
        meeting={manager.activeMeeting}
        crrConfig={manager.crrConfig}
        projectName={chantierName}
        branding={branding}
        sortDate={sortDate}
        sortCat={sortCat}
        companyId={companyId}
        crrId={crrDoc?.id}
        smtpConfig={smtpConfig}
        defaultRecipients={manager.diffusionEmails}
        onOpenSmtpSettings={() => {
          setShowSendMailModal(false);
          onNavigateModule?.('rgpd');
        }}
      />
    </div>
  );
}
