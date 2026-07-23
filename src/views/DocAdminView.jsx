/* eslint-disable react-refresh/only-export-components -- fichier mêlant volontairement composants et helpers/constantes (règle DX Fast-Refresh, sans impact fonctionnel) */
// src/views/DocAdminView.jsx
// Module Document Administratif — Gestion des Fiches Marché + Documents EXE
import React, { useState, useMemo, useCallback } from 'react';
import {
  FileStack, ArrowLeft, Plus, Trash2, Copy, Search,
  FileText, ClipboardList, FileCheck, FileMinus, FileOutput, FileWarning,
  ChevronRight, Loader, FolderOpen, HardHat
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { createEmptyFiche, useFichesMarche } from '../hooks/useFichesMarche';
import { useDialog } from '../contexts/DialogContext';
import { useToast } from '../contexts/ToastContext';
import HelpPanel from '../components/help/HelpPanel';
import HelpButton from '../components/help/HelpButton';
import FicheForm from '../components/docAdmin/FicheForm';
import Exe1Form from '../components/docAdmin/Exe1Form';
import ExeReceptionForm from '../components/docAdmin/ExeReceptionForm';
import ExeLeveeForm from '../components/docAdmin/ExeLeveeForm';
import Exe10Form from '../components/docAdmin/Exe10Form';
import FicheRecap from '../components/docAdmin/FicheRecap';
import ProjectInheritancePreviewModal from '../components/docAdmin/ProjectInheritancePreviewModal';
import { usePresence, useCoEditors } from '../hooks/usePresence';
import CoEditBanner from '../components/common/CoEditBanner';
import { inheritFicheFromEstimaProject } from '../utils/docAdmin/projectFicheInheritance';
// Generators chargés dynamiquement pour le code-splitting
const loadExeGenerator = (n) => import(`../utils/docAdmin/generateExe${n}.js`);
const CloudProjectPicker = React.lazy(() => import('../components/modals/CloudProjectPicker'));

// ─── Utilitaires de calcul de la date de fin révisée ────────────────────────
export const getOSDate = (os) => {
  const d = os?.dateDemarragePrestations || os?.dateReception;
  if (!d) return null;
  const date = new Date(d);
  return isNaN(date.getTime()) ? null : date;
};

export const calculateArretDays = (osList) => {
  const events = osList
    .filter(os => os.typeOS === 'arret' || os.typeOS === 'reprise')
    .map(os => ({ type: os.typeOS, date: getOSDate(os) }))
    .filter(e => e.date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  let totalArretDays = 0;
  let currentArret = null;

  for (const event of events) {
    if (event.type === 'arret' && !currentArret) {
      currentArret = event.date;
    } else if (event.type === 'reprise' && currentArret) {
      const jours = Math.round((event.date.getTime() - currentArret.getTime()) / (1000 * 60 * 60 * 24));
      if (jours > 0) totalArretDays += jours;
      currentArret = null;
    }
  }
  if (currentArret) {
    const now = new Date();
    const jours = Math.round((now.getTime() - currentArret.getTime()) / (1000 * 60 * 60 * 24));
    if (jours > 0) totalArretDays += jours;
  }
  return totalArretDays;
};

export const calculateEndDate = (startDateStr, duration, unit) => {
  if (!startDateStr || !duration) return null;
  const date = new Date(startDateStr);
  if (isNaN(date.getTime())) return null;

  const amount = parseInt(duration, 10);
  if (isNaN(amount)) return null;

  if ((unit || '').toLowerCase().includes('mois')) {
    date.setMonth(date.getMonth() + amount);
  } else if ((unit || '').toLowerCase().includes('jour')) {
    date.setDate(date.getDate() + amount);
  } else if ((unit || '').toLowerCase().includes('semaine')) {
    date.setDate(date.getDate() + amount * 7);
  }
  return date;
};

export const getDateFinRevisee = (fiche) => {
  if (!fiche) return null;
  const D = fiche.sectionD || {};
  const osList = Array.isArray(fiche.exe1) ? fiche.exe1 : (fiche.exe1 ? [fiche.exe1] : []);
  const osDemarrage = osList.find(os => String(os.numeroOrdreService) === '1') || osList[0];
  const dateDemarrage = osDemarrage?.dateDemarragePrestations || osDemarrage?.dateReception || null;

  const dateFinTheorique = calculateEndDate(dateDemarrage, D.dureeExecution, D.uniteDuree);
  if (!dateFinTheorique) return null;

  const intemperiesValue = parseInt(D.joursIntemperies, 10) || 0;
  const totalArretDays = calculateArretDays(osList);
  const totalJoursDecalage = intemperiesValue + totalArretDays;

  const dateFinRevisee = new Date(dateFinTheorique);
  dateFinRevisee.setDate(dateFinRevisee.getDate() + totalJoursDecalage);
  return dateFinRevisee;
};

// ─── Couleurs des onglets entreprises ────────────────────────────────────────
const ENTREPRISE_COLORS = [
  { bg: 'bg-blue-500/20', text: 'text-blue-600', border: 'border-blue-500/40', muted: 'text-blue-400', barBg: 'from-blue-50', barBorder: 'border-blue-200', dotBg: 'bg-blue-400' },
  { bg: 'bg-emerald-500/20', text: 'text-emerald-600', border: 'border-emerald-500/40', muted: 'text-emerald-400', barBg: 'from-emerald-50', barBorder: 'border-emerald-200', dotBg: 'bg-emerald-400' },
  { bg: 'bg-amber-500/20', text: 'text-amber-600', border: 'border-amber-500/40', muted: 'text-amber-400', barBg: 'from-amber-50', barBorder: 'border-amber-200', dotBg: 'bg-amber-400' },
  { bg: 'bg-purple-500/20', text: 'text-purple-600', border: 'border-purple-500/40', muted: 'text-purple-400', barBg: 'from-purple-50', barBorder: 'border-purple-200', dotBg: 'bg-purple-400' },
  { bg: 'bg-cyan-500/20', text: 'text-cyan-600', border: 'border-cyan-500/40', muted: 'text-cyan-400', barBg: 'from-cyan-50', barBorder: 'border-cyan-200', dotBg: 'bg-cyan-400' },
  { bg: 'bg-rose-500/20', text: 'text-rose-600', border: 'border-rose-500/40', muted: 'text-rose-400', barBg: 'from-rose-50', barBorder: 'border-rose-200', dotBg: 'bg-rose-400' },
];

// ─── Configuration des documents EXE ────────────────────────────────────────
const EXE_DOCUMENTS = [
  { id: 'exe1',      label: 'EXE1-T',      title: 'Ordre de Service',              icon: FileText,      color: 'emerald', ready: true },
  { id: 'reception', label: 'EXE4 / 5 / 6', title: 'Réception (OPR, Propositions, Décision)', icon: ClipboardList, color: 'blue', ready: true },
  { id: 'exe7',  label: 'EXE7',   title: 'Décision de Non-Réception',                  icon: FileMinus,     color: 'red',     ready: false },
  { id: 'levee', label: 'EXE8 / 9', title: 'Levée des Réserves (PV, Propositions, Décision)', icon: FileWarning, color: 'amber', ready: true },
  { id: 'exe10', label: 'EXE10', title: 'Avenant', icon: FileOutput, color: 'cyan', ready: true },
];

// ─── Composant principal ────────────────────────────────────────────────────
export default function DocAdminView({ onBackToHub, user, companyId }) {
  const { confirm, choose } = useDialog();
  const toast = useToast();
  const {
    fiches, isLoading,
    selectedFiche, selectedFicheId, setSelectedFicheId,
    createFiche, saveFiche, duplicateFiche, deleteFiche,
  } = useFichesMarche(user, companyId);

  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [projectPickerIntent, setProjectPickerIntent] = useState(null);
  const [inheritancePreview, setInheritancePreview] = useState(null);
  const [isProjectSyncing, setIsProjectSyncing] = useState(false);

  // ── Présence + co-édition (alerte d'écrasement) ───────────────────────────
  usePresence({
    user, companyId, activeTab: 'doc_admin',
    entityType: selectedFicheId ? 'doc_admin' : null,
    entityId: selectedFicheId || null,
    entityName: selectedFiche?.sectionA?.designation || selectedFiche?.nom || null,
  });
  const coEditors = useCoEditors({
    companyId, currentUserId: user?.uid,
    entityType: 'doc_admin', entityId: selectedFicheId || null,
  });

  const dateFinRevisee = useMemo(() => getDateFinRevisee(selectedFiche), [selectedFiche]);

  // Vue active dans le panneau droit : 'fiche' (formulaire marché) ou 'exe1', 'exe4', etc.
  const [activeView, setActiveView] = useState('recap'); // 'recap', 'fiche', 'exe1'...
  const [activeGroupeId, setActiveGroupeId] = useState(null);

  // Filtrage des fiches
  const filteredFiches = fiches.filter((f) =>
    !searchTerm || (f.nom || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ── Actions CRUD ──────────────────────────────────────────────────────────
  const handleCreate = async () => {
    const choice = await choose(
      'Comment souhaitez-vous initialiser la fiche marché ?',
      [
        {
          key: 'from_estima',
          label: "Depuis une affaire EstimaVRD",
          description: 'Reprendre la Fiche affaire : MOA, MOE, objet, code, lieu et durées.',
        },
        {
          key: 'blank',
          label: 'Fiche vierge',
          description: 'Créer une fiche marché indépendante à compléter manuellement.',
        },
      ],
      { title: 'Nouvelle fiche marché' },
    );

    if (choice === 'from_estima') {
      setProjectPickerIntent({ type: 'create' });
      return;
    }
    if (choice === 'blank') {
      await createFiche('Nouveau marché');
      setActiveView('fiche');
    }
  };

  const handleSave = useCallback(async (ficheData) => {
    setIsSaving(true);
    const result = await saveFiche(ficheData);
    setIsSaving(false);
    return result;
  }, [saveFiche]);

  const prepareInheritancePreview = useCallback((baseFiche, project, isLinking) => {
    const inheritance = inheritFicheFromEstimaProject(baseFiche, project);
    setInheritancePreview({
      project,
      fiche: inheritance.fiche,
      changes: inheritance.changes,
      isLinking,
    });
  }, []);

  const handleSelectEstimaProject = useCallback(async (project) => {
    const intent = projectPickerIntent;
    setProjectPickerIntent(null);
    if (!intent) return;

    if (intent.type === 'create') {
      const { fiche } = inheritFicheFromEstimaProject(createEmptyFiche(), project);
      const created = await createFiche(fiche.nom || 'Nouveau marché', fiche);
      if (created) setActiveView('fiche');
      return;
    }

    prepareInheritancePreview(intent.fiche, project, true);
  }, [projectPickerIntent, createFiche, prepareInheritancePreview]);

  const handleInheritFromProject = useCallback(async (ficheDraft) => {
    const sourceProjectId = ficheDraft?.sourceEstima?.projectId;
    if (!sourceProjectId) {
      setProjectPickerIntent({ type: 'link', fiche: ficheDraft });
      return;
    }

    setIsProjectSyncing(true);
    try {
      const projectSnap = await getDoc(doc(db, 'companies', companyId, 'projects', sourceProjectId));
      if (!projectSnap.exists()) {
        toast.error("L'affaire EstimaVRD liée n'existe plus");
        return;
      }

      const project = { id: projectSnap.id, ...projectSnap.data() };
      const inheritance = inheritFicheFromEstimaProject(ficheDraft, project);
      if (inheritance.changes.length === 0) {
        toast.info('La fiche marché est déjà à jour');
        return;
      }
      setInheritancePreview({
        project,
        fiche: inheritance.fiche,
        changes: inheritance.changes,
        isLinking: false,
      });
    } catch (error) {
      console.error("Erreur d'actualisation depuis l'affaire EstimaVRD :", error);
      toast.error("Impossible de charger l'affaire EstimaVRD");
    } finally {
      setIsProjectSyncing(false);
    }
  }, [companyId, toast]);

  const handleConfirmInheritance = useCallback(async () => {
    if (!inheritancePreview?.fiche) return;
    const saved = await handleSave(inheritancePreview.fiche);
    if (saved) setInheritancePreview(null);
  }, [inheritancePreview, handleSave]);

  const handleDelete = async (ficheId, ficheName) => {
    const ok = await confirm(
      `Supprimer la fiche "${ficheName || 'Sans nom'}" ?\n\nCette action est irréversible.`
    );
    if (ok) {
      await deleteFiche(ficheId);
      setActiveView('fiche');
    }
  };

  const handleDuplicate = async (ficheId) => {
    await duplicateFiche(ficheId);
    setActiveView('fiche');
  };

  // ── Sélection d'une fiche ─────────────────────────────────────────────────
  const handleSelectFiche = (ficheId) => {
    setSelectedFicheId(ficheId);
    setActiveView('recap');
    setActiveGroupeId(null); // Reset entreprise sélectionnée
  };

  // ── Marché alloti : onglets par entreprise ────────────────────────────────
  const lots = selectedFiche?.sectionD?.lots || [];
  // Assurer que chaque groupe a un groupeId (migration à la volée si nécessaire)
  const groupesAttributaires = useMemo(() => {
    const raw = selectedFiche?.sectionB?.groupesAttributaires || [];
    let needsMigration = false;
    const migrated = raw.map((g, i) => {
      if (!g.groupeId) {
        needsMigration = true;
        return { ...g, groupeId: `g${i}_${Date.now().toString(36)}` };
      }
      return g;
    });
    // Sauvegarder la migration si nécessaire
    if (needsMigration && selectedFiche && migrated.length > 0) {
      const updatedFiche = {
        ...selectedFiche,
        sectionB: { ...selectedFiche.sectionB, groupesAttributaires: migrated },
      };
      saveFiche(updatedFiche);
    }
    return migrated;
  }, [selectedFiche?.id, selectedFiche?.sectionB?.groupesAttributaires]);
  const isAlloti = lots.length > 0 && groupesAttributaires.length > 0;

  // Auto-sélectionner la première entreprise si alloti et aucune sélection
  const effectiveGroupeId = useMemo(() => {
    if (!isAlloti) return null;
    if (activeGroupeId && groupesAttributaires.some((g) => g.groupeId === activeGroupeId)) return activeGroupeId;
    return groupesAttributaires[0]?.groupeId || null;
  }, [isAlloti, activeGroupeId, groupesAttributaires]);

  // Virtual fiche : redirige exe1/reception/exe10 vers les données de l'entreprise sélectionnée
  // + filtre sectionD.lots pour ne garder que les lots de cette entreprise
  const virtualFiche = useMemo(() => {
    if (!selectedFiche) return null;
    if (!isAlloti || !effectiveGroupeId) return selectedFiche;
    const exeData = selectedFiche.exeParEntreprise?.[effectiveGroupeId] || {};
    const groupe = groupesAttributaires.find((g) => g.groupeId === effectiveGroupeId);
    // Filtrer les lots pour ne garder que ceux attribués à cette entreprise
    const lotsEntreprise = (groupe?.lotIndices || [])
      .map((i) => lots[i])
      .filter(Boolean);
    return {
      ...selectedFiche,
      exe1: exeData.exe1 || [],
      reception: exeData.reception || {},
      exe10: exeData.exe10 || {},
      // Section B : uniquement l'entreprise sélectionnée
      sectionB: {
        type: 'seul',
        typeGroupement: 'solidaire',
        mandataire: groupe?.entreprise || {},
        cotraitants: [],
      },
      // Section D : uniquement les lots de cette entreprise
      sectionD: {
        ...selectedFiche.sectionD,
        lots: lotsEntreprise,
      },
    };
  }, [selectedFiche, isAlloti, effectiveGroupeId, groupesAttributaires, lots]);

  // Couleur de l'entreprise active
  const activeGroupeIndex = groupesAttributaires.findIndex((g) => g.groupeId === effectiveGroupeId);
  const activeColor = ENTREPRISE_COLORS[activeGroupeIndex >= 0 ? activeGroupeIndex % ENTREPRISE_COLORS.length : 0];

  // Save wrapper : route les saves vers exeParEntreprise[groupeId] en mode alloti
  const handleSaveForEntreprise = useCallback(async (ficheData) => {
    if (!isAlloti || !effectiveGroupeId) {
      return handleSave(ficheData);
    }
    const { exe1, reception, exe10 } = ficheData;
    const updatedFiche = {
      ...selectedFiche,
      exeParEntreprise: {
        ...(selectedFiche.exeParEntreprise || {}),
        [effectiveGroupeId]: { exe1, reception, exe10 },
      },
    };
    return handleSave(updatedFiche);
  }, [isAlloti, effectiveGroupeId, selectedFiche, handleSave]);

  const handleChangeGroupe = (groupeId) => {
    setActiveGroupeId(groupeId);
    // Rester sur la même vue EXE si on est dans un formulaire, sinon revenir au recap
  };

  // ── Ouverture d'un document EXE ───────────────────────────────────────────
  const handleOpenExe = (exeId) => {
    const doc = EXE_DOCUMENTS.find((d) => d.id === exeId);
    if (!doc || !doc.ready) return;
    setActiveView(exeId);
  };

  // ── Génération EXE1-T ─────────────────────────────────────────────────────
  const handleGenerateExe1 = async (exe1Data, format) => {
    const ficheExport = virtualFiche || selectedFiche;
    if (!ficheExport) return;
    try {
      const mod = await loadExeGenerator(1);
      if (format === 'docx') {
        await mod.exportExe1Docx(ficheExport, exe1Data);
        toast.success('Document EXE1-T généré (.docx)');
      } else {
        await mod.exportExe1Pdf(ficheExport, exe1Data);
        toast.success('Document EXE1-T généré (.pdf)');
      }
    } catch (err) {
      console.error('Erreur génération EXE1:', err);
      toast.error('Erreur lors de la génération du document');
    }
  };

  // ── Génération EXE4/5/6/8/9/10 ───────────────────────────────────────────
  const handleGenerateExeReception = async (exeType, exeData, format) => {
    const ficheExport = virtualFiche || selectedFiche;
    if (!ficheExport) return;
    const exeNum = exeType.replace('exe', '');
    const label = `EXE${exeNum}`;
    try {
      const mod = await loadExeGenerator(exeNum);
      const fnDocx = mod[`exportExe${exeNum}Docx`];
      const fnPdf  = mod[`exportExe${exeNum}Pdf`];
      if (format === 'docx') {
        await fnDocx(ficheExport, exeData);
      } else {
        await fnPdf(ficheExport, exeData);
      }
      toast.success(`Document ${label} généré (.${format})`);
    } catch (err) {
      console.error(`Erreur génération ${label}:`, err);
      toast.error('Erreur lors de la génération du document');
    }
  };

  // ── Rendu du panneau droit ────────────────────────────────────────────────
  const renderMainContent = () => {
    if (!selectedFiche) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          <div className="mb-6 p-5 rounded-2xl bg-purple-500/5 border border-purple-500/10">
            <FileStack size={48} className="text-purple-400/30" />
          </div>
          <h2 className="text-xl font-black text-gray-500 mb-2">Fiches Marché</h2>
          <p className="text-sm text-gray-600 max-w-sm leading-relaxed mb-6">
            Créez une fiche marché pour centraliser les informations communes
            (pouvoir adjudicateur, titulaire, maître d'œuvre, objet du marché)
            qui seront réutilisées dans tous vos documents EXE.
          </p>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 font-bold text-sm hover:bg-purple-500/20 hover:border-purple-400/50 transition-all"
          >
            <Plus size={18} />
            Créer ma première fiche marché
          </button>
          <div className="mt-12 max-w-lg w-full">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-600 mb-4">
              Workflow des documents EXE
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {EXE_DOCUMENTS.map((doc, idx) => (
                <React.Fragment key={doc.id}>
                  <div className={`px-2.5 py-1.5 rounded-lg border text-[9px] font-bold uppercase tracking-wider ${
                    doc.ready ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400/60' : 'bg-gray-50 border-gray-200 text-gray-600'
                  }`}>
                    {doc.label}
                  </div>
                  {idx < EXE_DOCUMENTS.length - 1 && (
                    <ChevronRight size={10} className="text-gray-400" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Fiche effective pour les formulaires EXE (virtuelle si alloti)
    const ficheForExe = virtualFiche || selectedFiche;
    const saveForExe = isAlloti ? handleSaveForEntreprise : handleSave;

    // Barre entreprises + formulaire EXE
    const exeViews = { exe1: 'exe1', reception: 'reception', levee: 'levee', exe10: 'exe10' };
    if (exeViews[activeView]) {

      let ExeFormComponent = null;
      let exeFormProps = {};
      if (activeView === 'exe1') {
        ExeFormComponent = Exe1Form;
        exeFormProps = { fiche: ficheForExe, dateFinRevisee, onBack: () => setActiveView('recap'), onGenerate: handleGenerateExe1, onSave: saveForExe, isSaving };
      } else if (activeView === 'reception') {
        ExeFormComponent = ExeReceptionForm;
        exeFormProps = { fiche: ficheForExe, user, companyId, dateFinRevisee, onBack: () => setActiveView('recap'), onGenerate: (t, d, f) => handleGenerateExeReception(t, d, f), onSave: saveForExe, isSaving };
      } else if (activeView === 'levee') {
        ExeFormComponent = ExeLeveeForm;
        exeFormProps = { fiche: ficheForExe, user, companyId, onBack: () => setActiveView('recap'), onGenerate: (t, d, f) => handleGenerateExeReception(t, d, f), onSave: saveForExe, isSaving };
      } else if (activeView === 'exe10') {
        ExeFormComponent = Exe10Form;
        exeFormProps = { fiche: ficheForExe, onBack: () => setActiveView('recap'), onGenerate: (t, d, f) => handleGenerateExeReception(t, d, f), onSave: saveForExe, isSaving };
      }

      if (!isAlloti) {
        return <ExeFormComponent key={selectedFiche?.id} {...exeFormProps} />;
      }

      // Mode alloti : barre entreprises au-dessus du formulaire EXE
      return (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Barre entreprises persistante — couleur selon entreprise active */}
          <div className={`shrink-0 bg-gradient-to-b ${activeColor.barBg} to-white border-b ${activeColor.barBorder} px-4 py-2 transition-colors duration-300`}>
            <div className="flex items-center gap-2 mb-1.5">
              <HardHat size={13} className={activeColor.muted} />
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-600">Entreprise attributaire</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {groupesAttributaires.map((groupe, gIdx) => {
                const isActive = groupe.groupeId === effectiveGroupeId;
                const cc = ENTREPRISE_COLORS[gIdx % ENTREPRISE_COLORS.length];
                const gLotsLabels = (groupe.lotIndices || [])
                  .map((i) => lots[i] ? `Lot ${lots[i].numero || i + 1}` : null)
                  .filter(Boolean).join(', ');
                return (
                  <button
                    key={groupe.groupeId}
                    onClick={() => handleChangeGroupe(groupe.groupeId)}
                    className={`
                      flex min-w-max items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all duration-200
                      ${isActive
                        ? `bg-white ${cc.text} border ${cc.border} font-bold`
                        : 'text-gray-500 hover:text-gray-700 hover:bg-white border border-transparent'
                      }
                    `}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${isActive ? cc.dotBg : 'bg-gray-300'} shrink-0`} />
                    <div className="flex flex-col items-start">
                      <span className="text-[10px] font-black uppercase tracking-wider leading-none">
                        {groupe.entreprise?.nomCommercial || '(Entreprise)'}
                      </span>
                      {gLotsLabels && (
                        <span className={`text-[8px] leading-none mt-1 ${isActive ? cc.muted : 'text-gray-400'}`}>
                          {gLotsLabels}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          {/* Formulaire EXE — key force remontage quand on change d'entreprise */}
          <ExeFormComponent key={effectiveGroupeId} {...exeFormProps} />
        </div>
      );
    }

    // Vue par défaut : Synthèse ou Formulaire Fiche Marché + barre EXE en haut
    return (
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Navigation compacte : synthèse, fiche et documents EXE */}
        <div className="shrink-0 space-y-2 border-b border-gray-200 bg-white px-4 py-2">
          {isAlloti && (
            <div className="flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-gray-100 p-1">
              {groupesAttributaires.map((groupe, gIdx) => {
                const isActive = groupe.groupeId === effectiveGroupeId;
                const cc = ENTREPRISE_COLORS[gIdx % ENTREPRISE_COLORS.length];
                const lotsLabels = groupe.lotIndices
                  .map((i) => lots[i] ? `Lot ${lots[i].numero || i + 1}` : null)
                  .filter(Boolean)
                  .join(', ');
                return (
                  <button
                    key={groupe.groupeId}
                    onClick={() => handleChangeGroupe(groupe.groupeId)}
                    className={`
                      flex min-w-max items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-all duration-200
                      ${isActive
                        ? `bg-white ${cc.text} ${cc.border} font-bold`
                        : 'border-transparent text-gray-600 hover:bg-white hover:text-gray-900'
                      }
                    `}
                  >
                    <div className={`h-2 w-2 shrink-0 rounded-full ${isActive ? cc.dotBg : 'bg-gray-300'}`} />
                    <span className="text-[10px] font-black uppercase tracking-wider">
                      {groupe.entreprise?.nomCommercial || '(Entreprise)'}
                    </span>
                    {lotsLabels && <span className="text-[9px] text-gray-500">{lotsLabels}</span>}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-1 overflow-x-auto rounded-2xl bg-gray-100 p-1">
            <button
              onClick={() => setActiveView('recap')}
              className={`flex h-9 min-w-max items-center gap-2 rounded-xl border px-3 text-[11px] font-bold transition-all ${
                activeView === 'recap'
                  ? 'border-purple-600 bg-purple-600 text-white'
                  : 'border-transparent text-gray-600 hover:bg-white hover:text-gray-900'
              }`}
            >
              <ClipboardList size={14} />
              Synthèse
            </button>
            <button
              onClick={() => setActiveView('fiche')}
              className={`flex h-9 min-w-max items-center gap-2 rounded-xl border px-3 text-[11px] font-bold transition-all ${
                activeView === 'fiche' || activeView === 'form'
                  ? 'border-purple-600 bg-purple-600 text-white'
                  : 'border-transparent text-gray-600 hover:bg-white hover:text-gray-900'
              }`}
            >
              <FileText size={14} />
              Fiche marché
            </button>

            <div className="mx-1 h-5 w-px shrink-0 bg-gray-300" />

            {EXE_DOCUMENTS.map((doc) => {
              const Icon = doc.icon;
              const colorMap = {
                emerald: 'text-emerald-700 hover:bg-emerald-50',
                blue: 'text-blue-700 hover:bg-blue-50',
                cyan: 'text-cyan-700 hover:bg-cyan-50',
                green: 'text-green-700 hover:bg-green-50',
                red: 'text-red-600',
                amber: 'text-amber-700 hover:bg-amber-50',
                purple: 'text-purple-700 hover:bg-purple-50',
              };

              return (
                <button
                  key={doc.id}
                  onClick={() => handleOpenExe(doc.id)}
                  disabled={!doc.ready}
                  className={`
                    flex h-9 min-w-max items-center gap-2 rounded-xl border px-3 text-[11px] font-bold transition-all duration-200
                    ${doc.ready
                      ? `border-transparent bg-white ${colorMap[doc.color]} active:scale-[0.97]`
                      : 'cursor-not-allowed border-transparent text-gray-400 opacity-60'
                    }
                  `}
                  title={doc.ready ? `Remplir et générer ${doc.label} — ${doc.title}` : `${doc.label} — Bientôt disponible`}
                >
                  <Icon size={14} />
                  <span className="font-black uppercase tracking-wider">{doc.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenu principal */}
        {activeView === 'recap' ? (
          <FicheRecap
            fiche={isAlloti ? virtualFiche : selectedFiche}
            ficheMere={isAlloti ? selectedFiche : null}
            isAlloti={isAlloti}
            activeGroupeId={effectiveGroupeId}
            groupesAttributaires={groupesAttributaires}
            lots={lots}
            onSave={isAlloti ? handleSaveForEntreprise : handleSave}
            isSaving={isSaving}
          />
        ) : (
          <FicheForm
            fiche={selectedFiche}
            onSave={handleSave}
            isSaving={isSaving}
            onInheritFromProject={handleInheritFromProject}
            isProjectSyncing={isProjectSyncing}
          />
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 text-gray-700 overflow-hidden relative">

      <HelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} moduleId="docAdmin" />

      {projectPickerIntent && (
        <React.Suspense
          fallback={(
            <div className="fixed inset-0 z-modal-backdrop flex items-center justify-center bg-black/25 backdrop-blur-sm">
              <Loader size={24} className="animate-spin text-blue-600" />
            </div>
          )}
        >
          <CloudProjectPicker
            companyId={companyId}
            onSelect={handleSelectEstimaProject}
            onClose={() => setProjectPickerIntent(null)}
            selectionOnly
            title="Choisir une affaire EstimaVRD"
          />
        </React.Suspense>
      )}

      {inheritancePreview && (
        <ProjectInheritancePreviewModal
          project={inheritancePreview.project}
          changes={inheritancePreview.changes}
          isLinking={inheritancePreview.isLinking}
          isSaving={isSaving}
          onClose={() => setInheritancePreview(null)}
          onConfirm={handleConfirmInheritance}
        />
      )}

      {/* Header */}
      <header className="relative z-10 flex items-center gap-3 px-4 py-2 border-b border-gray-200 bg-white/80 backdrop-blur-xl shrink-0">
        <button
          onClick={onBackToHub}
          className="flex h-9 items-center gap-2 rounded-xl border border-transparent px-2.5 text-gray-600 transition-all hover:border-gray-300 hover:bg-gray-100 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          <span className="text-[10px] font-black uppercase tracking-widest">Hub</span>
        </button>

        <div className="h-5 w-px bg-gray-300" />

        <div className="flex min-w-0 items-center gap-2.5">
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-2">
            <FileStack size={18} className="text-purple-700" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-black tracking-tight text-gray-900">Documents administratifs</h1>
            <p className="text-[10px] text-gray-600">Fiches marché et documents EXE</p>
          </div>
        </div>

        <div className="flex-1" />
        <HelpButton onClick={() => setShowHelp(true)} />
      </header>

      <div className="relative z-10">
        <CoEditBanner editors={coEditors} />
      </div>

      {/* Corps principal : sidebar liste + contenu */}
      <div className="relative z-10 flex-1 flex overflow-hidden">

        {/* ── Panneau gauche : Liste des fiches marché ───────────────────── */}
        <div className="w-64 shrink-0 border-r border-gray-200 flex flex-col bg-gray-50">

          {/* Barre de recherche + bouton créer */}
          <div className="p-2 space-y-1.5 border-b border-gray-200">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher un marché..."
                className="h-9 w-full rounded-xl border border-gray-300 bg-white pl-9 pr-3 text-xs text-gray-800 placeholder-gray-400 transition-all focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
              />
            </div>
            <button
              onClick={handleCreate}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3 text-[10px] font-bold uppercase tracking-widest text-purple-700 transition-all hover:border-purple-300 hover:bg-purple-100"
            >
              <Plus size={14} />
              Nouvelle fiche marché
            </button>
          </div>

          {/* Liste des fiches */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-32 text-gray-400">
                <Loader size={20} className="animate-spin" />
              </div>
            ) : filteredFiches.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-600 px-4 text-center">
                <FolderOpen size={24} className="mb-2" />
                <p className="text-[10px] font-bold uppercase tracking-wider">
                  {searchTerm ? 'Aucun résultat' : 'Aucune fiche marché'}
                </p>
                <p className="text-[9px] text-gray-400 mt-1">
                  {searchTerm ? 'Essayez un autre terme' : 'Créez votre première fiche'}
                </p>
              </div>
            ) : (
              <div className="p-1.5 space-y-1">
                {filteredFiches.map((fiche) => {
                  const isSelected = selectedFicheId === fiche.id;

                  return (
                    <div
                      key={fiche.id}
                      onClick={() => handleSelectFiche(fiche.id)}
                      className={`
                        group relative flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition-all
                        ${isSelected
                          ? 'bg-purple-50 border border-purple-200'
                          : 'border border-transparent hover:bg-gray-100 hover:border-gray-200'
                        }
                      `}
                    >
                      {/* Indicateur actif */}
                      <div className={`absolute left-0 w-1 rounded-full transition-all ${
                        isSelected ? 'h-6 bg-purple-600' : 'h-0'
                      }`} />

                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold truncate ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                          {fiche.nom || 'Sans nom'}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-gray-600">
                          {fiche.sectionA?.designation || 'Pouvoir adj. non renseigné'}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5 text-[9px] text-gray-500">
                          <span>{new Date(fiche.updatedAt || fiche.createdAt).toLocaleDateString('fr-FR')}</span>
                          {fiche.sourceEstima?.projectId && (
                            <span className="rounded-md bg-blue-100 px-1.5 py-0.5 font-bold text-blue-700">ESTIMA</span>
                          )}
                        </div>
                      </div>

                      {/* Actions au hover */}
                      <div className={`flex items-center gap-1 shrink-0 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDuplicate(fiche.id); }}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-purple-400 hover:bg-purple-500/10 transition-all"
                          title="Dupliquer"
                        >
                          <Copy size={12} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(fiche.id, fiche.nom); }}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Supprimer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Compteur */}
          <div className="px-2 py-1.5 border-t border-gray-200 text-[9px] text-gray-500 font-bold uppercase tracking-widest text-center">
            {fiches.length} fiche{fiches.length > 1 ? 's' : ''} marché
          </div>
        </div>

        {/* ── Panneau droit : Contenu dynamique ─────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {renderMainContent()}
        </div>
      </div>
    </div>
  );
}
