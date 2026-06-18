/* eslint-disable react-refresh/only-export-components -- fichier mêlant volontairement composants et helpers/constantes (règle DX Fast-Refresh, sans impact fonctionnel) */
// src/views/DocAdminView.jsx
// Module Document Administratif — Gestion des Fiches Marché + Documents EXE
import React, { useState, useMemo, useCallback } from 'react';
import {
  FileStack, ArrowLeft, Plus, Trash2, Copy, Search,
  FileText, ClipboardList, FileCheck, FileMinus, FileOutput, FileWarning,
  ChevronRight, Loader, FolderOpen, HardHat
} from 'lucide-react';
import { useFichesMarche } from '../hooks/useFichesMarche';
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
import { usePresence, useCoEditors } from '../hooks/usePresence';
import CoEditBanner from '../components/common/CoEditBanner';
// Generators chargés dynamiquement pour le code-splitting
const loadExeGenerator = (n) => import(`../utils/docAdmin/generateExe${n}.js`);

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
  { bg: 'bg-blue-500/20', text: 'text-blue-600', border: 'border-blue-500/40', glow: 'shadow-[0_0_10px_rgba(59,130,246,0.1)]', muted: 'text-blue-400', barBg: 'from-blue-50', barBorder: 'border-blue-200', dotBg: 'bg-blue-400' },
  { bg: 'bg-emerald-500/20', text: 'text-emerald-600', border: 'border-emerald-500/40', glow: 'shadow-[0_0_10px_rgba(16,185,129,0.1)]', muted: 'text-emerald-400', barBg: 'from-emerald-50', barBorder: 'border-emerald-200', dotBg: 'bg-emerald-400' },
  { bg: 'bg-amber-500/20', text: 'text-amber-600', border: 'border-amber-500/40', glow: 'shadow-[0_0_10px_rgba(245,158,11,0.1)]', muted: 'text-amber-400', barBg: 'from-amber-50', barBorder: 'border-amber-200', dotBg: 'bg-amber-400' },
  { bg: 'bg-purple-500/20', text: 'text-purple-600', border: 'border-purple-500/40', glow: 'shadow-[0_0_10px_rgba(168,85,247,0.1)]', muted: 'text-purple-400', barBg: 'from-purple-50', barBorder: 'border-purple-200', dotBg: 'bg-purple-400' },
  { bg: 'bg-cyan-500/20', text: 'text-cyan-600', border: 'border-cyan-500/40', glow: 'shadow-[0_0_10px_rgba(6,182,212,0.1)]', muted: 'text-cyan-400', barBg: 'from-cyan-50', barBorder: 'border-cyan-200', dotBg: 'bg-cyan-400' },
  { bg: 'bg-rose-500/20', text: 'text-rose-600', border: 'border-rose-500/40', glow: 'shadow-[0_0_10px_rgba(244,63,94,0.1)]', muted: 'text-rose-400', barBg: 'from-rose-50', barBorder: 'border-rose-200', dotBg: 'bg-rose-400' },
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
  const { confirm } = useDialog();
  const toast = useToast();
  const {
    fiches, isLoading,
    selectedFiche, selectedFicheId, setSelectedFicheId,
    createFiche, saveFiche, duplicateFiche, deleteFiche,
  } = useFichesMarche(user, companyId);

  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

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
    await createFiche('Nouveau marché');
    setActiveView('fiche');
  };

  const handleSave = async (ficheData) => {
    setIsSaving(true);
    const result = await saveFiche(ficheData);
    setIsSaving(false);
    return result;
  };

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
        exeFormProps = { fiche: ficheForExe, dateFinRevisee, onBack: () => setActiveView('recap'), onGenerate: (t, d, f) => handleGenerateExeReception(t, d, f), onSave: saveForExe, isSaving };
      } else if (activeView === 'levee') {
        ExeFormComponent = ExeLeveeForm;
        exeFormProps = { fiche: ficheForExe, onBack: () => setActiveView('recap'), onGenerate: (t, d, f) => handleGenerateExeReception(t, d, f), onSave: saveForExe, isSaving };
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
          <div className={`shrink-0 bg-gradient-to-b ${activeColor.barBg} to-white border-b ${activeColor.barBorder} px-6 py-3 transition-colors duration-300`}>
            <div className="flex items-center gap-2 mb-2">
              <HardHat size={13} className={activeColor.muted} />
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-600">Entreprise attributaire</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="flex flex-wrap gap-2">
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
                      flex items-center gap-2.5 px-4 py-2 rounded-lg text-xs transition-all duration-200
                      ${isActive
                        ? `${cc.bg} ${cc.text} border ${cc.border} ${cc.glow} font-bold`
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

        {/* ── Bandeau documents EXE (en haut, bien visible) ── */}
        <div className="shrink-0 bg-gradient-to-b from-gray-50 to-white border-b border-gray-300 px-6 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-2">
              <FileStack size={14} className="text-purple-400" />
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-700">
                Documents administratifs
              </h3>
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent" />
          </div>

          {/* ── Onglets entreprises (marchés allotis uniquement) ── */}
          {isAlloti && (
            <div className="flex flex-wrap gap-2 mb-3 p-1.5 rounded-xl bg-gray-100 border border-gray-200">
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
                      flex items-center gap-2.5 px-4 py-2 rounded-lg text-xs transition-all duration-200
                      ${isActive
                        ? `${cc.bg} ${cc.text} border ${cc.border} ${cc.glow} font-bold`
                        : 'text-gray-600 hover:text-gray-800 hover:bg-white border border-transparent'
                      }
                    `}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${isActive ? cc.dotBg : 'bg-gray-300'} shrink-0`} />
                    <div className="flex flex-col items-start">
                      <span className="text-[10px] font-black uppercase tracking-wider leading-none">
                        {groupe.entreprise?.nomCommercial || '(Entreprise)'}
                      </span>
                      {lotsLabels && (
                        <span className={`text-[8px] leading-none mt-1 ${isActive ? cc.muted : 'text-gray-400'}`}>
                          {lotsLabels}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {EXE_DOCUMENTS.map((doc) => {
              const Icon = doc.icon;
              const colorMap = {
                emerald: { border: 'border-emerald-500/40', bg: 'bg-emerald-500/15', text: 'text-emerald-400', glow: 'shadow-[0_0_12px_rgba(16,185,129,0.15)]', hover: 'hover:bg-emerald-500/25 hover:border-emerald-500/60' },
                blue:    { border: 'border-blue-500/40',    bg: 'bg-blue-500/15',    text: 'text-blue-400',    glow: 'shadow-[0_0_12px_rgba(59,130,246,0.15)]', hover: 'hover:bg-blue-500/25 hover:border-blue-500/60' },
                cyan:    { border: 'border-cyan-500/40',    bg: 'bg-cyan-500/15',    text: 'text-cyan-400',    glow: 'shadow-[0_0_12px_rgba(6,182,212,0.15)]', hover: 'hover:bg-cyan-500/25 hover:border-cyan-500/60' },
                green:   { border: 'border-green-500/40',   bg: 'bg-green-500/15',   text: 'text-green-400',   glow: 'shadow-[0_0_12px_rgba(34,197,94,0.15)]', hover: 'hover:bg-green-500/25 hover:border-green-500/60' },
                red:     { border: 'border-red-500/20',     bg: 'bg-red-500/5',      text: 'text-red-400',     glow: '', hover: '' },
                amber:   { border: 'border-amber-500/40',   bg: 'bg-amber-500/15',   text: 'text-amber-400',   glow: 'shadow-[0_0_12px_rgba(245,158,11,0.15)]', hover: 'hover:bg-amber-500/25 hover:border-amber-500/60' },
                purple:  { border: 'border-purple-500/40',  bg: 'bg-purple-500/15',  text: 'text-purple-400',  glow: 'shadow-[0_0_12px_rgba(168,85,247,0.15)]', hover: 'hover:bg-purple-500/25 hover:border-purple-500/60' },
              };
              const cc = doc.ready ? colorMap[doc.color] : null;

              return (
                <button
                  key={doc.id}
                  onClick={() => handleOpenExe(doc.id)}
                  disabled={!doc.ready}
                  className={`
                    flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all duration-200
                    ${doc.ready
                      ? `${cc.bg} ${cc.border} ${cc.text} ${cc.glow} ${cc.hover} cursor-pointer hover:scale-[1.03] active:scale-[0.97]`
                      : 'bg-gray-50 border-gray-200 text-gray-600 cursor-not-allowed'
                    }
                  `}
                  title={doc.ready ? `Remplir et générer ${doc.label} — ${doc.title}` : `${doc.label} — Bientôt disponible`}
                >
                  <Icon size={15} className={doc.ready ? '' : 'opacity-40'} />
                  <div className="flex flex-col items-start">
                    <span className="text-[10px] font-black uppercase tracking-wider leading-none">{doc.label}</span>
                    <span className={`text-[8px] leading-none mt-0.5 ${doc.ready ? 'text-emerald-500/80' : 'text-gray-600'}`}>
                      {doc.ready ? doc.title : 'Bientôt'}
                    </span>
                  </div>
                  {doc.ready && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Prêt
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sous-onglets pour la fiche */}
        <div className="flex items-center gap-4 px-6 pt-4 border-b border-gray-200 shrink-0 bg-gray-50">
          <button
            onClick={() => setActiveView('recap')}
            className={`pb-3 px-1 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${activeView === 'recap' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Synthèse & Planning
          </button>
          <button
            onClick={() => setActiveView('fiche')}
            className={`pb-3 px-1 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${activeView === 'fiche' || activeView === 'form' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Édition Fiche Marché
          </button>
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
          />
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 text-gray-700 overflow-hidden relative">

      <HelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} moduleId="docAdmin" />

      {/* Fond décoratif */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center gap-4 px-6 py-3 border-b border-gray-200 shrink-0">
        <button
          onClick={onBackToHub}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-100 border border-transparent hover:border-gray-400 transition-all"
        >
          <ArrowLeft size={18} />
          <span className="text-[10px] font-black uppercase tracking-widest">Hub</span>
        </button>

        <div className="h-6 w-px bg-gray-300" />

        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/30">
            <FileStack size={20} className="text-purple-400" />
          </div>
          <div>
            <h1 className="font-black text-lg text-gray-800 tracking-tight">Document Administratif</h1>
            <p className="text-[10px] text-gray-500">Fiches Marché & Documents EXE</p>
          </div>
        </div>

        <HelpButton onClick={() => setShowHelp(true)} />
      </header>

      <div className="relative z-10">
        <CoEditBanner editors={coEditors} />
      </div>

      {/* Corps principal : sidebar liste + contenu */}
      <div className="relative z-10 flex-1 flex overflow-hidden">

        {/* ── Panneau gauche : Liste des fiches marché ───────────────────── */}
        <div className="w-72 shrink-0 border-r border-gray-200 flex flex-col bg-gray-50">

          {/* Barre de recherche + bouton créer */}
          <div className="p-3 space-y-2 border-b border-gray-200">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher un marché..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-gray-300 text-xs text-gray-800 placeholder-gray-400 focus:border-purple-500 focus:outline-none transition-all"
              />
            </div>
            <button
              onClick={handleCreate}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 font-bold text-[10px] uppercase tracking-widest hover:bg-purple-500/20 hover:border-purple-400/50 transition-all"
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
              <div className="p-2 space-y-1">
                {filteredFiches.map((fiche) => {
                  const isSelected = selectedFicheId === fiche.id;

                  return (
                    <div
                      key={fiche.id}
                      onClick={() => handleSelectFiche(fiche.id)}
                      className={`
                        group relative flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all
                        ${isSelected
                          ? 'bg-purple-500/15 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                          : 'border border-transparent hover:bg-gray-100 hover:border-gray-200'
                        }
                      `}
                    >
                      {/* Indicateur actif */}
                      <div className={`absolute left-0 w-1 rounded-full transition-all ${
                        isSelected ? 'h-6 bg-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'h-0'
                      }`} />

                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold truncate ${isSelected ? 'text-gray-800' : 'text-gray-700'}`}>
                          {fiche.nom || 'Sans nom'}
                        </p>
                        <p className="text-[9px] text-gray-600 mt-0.5 truncate">
                          {fiche.sectionA?.designation || 'Pouvoir adj. non renseigné'}
                        </p>
                        <p className="text-[9px] text-gray-500 mt-0.5">
                          {new Date(fiche.updatedAt || fiche.createdAt).toLocaleDateString('fr-FR')}
                        </p>
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
          <div className="px-3 py-2 border-t border-gray-200 text-[9px] text-gray-500 font-bold uppercase tracking-widest text-center">
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
