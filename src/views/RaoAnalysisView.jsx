// src/views/RaoAnalysisView.jsx
import React, { useState, useRef, useCallback } from 'react';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db as fireDb } from '../firebase';
import { useDatabase } from '../hooks/useDatabase';
import { useProjectManager } from '../hooks/useProjectManager';
import { useAppResources } from '../hooks/useAppResources';
import { useDialog } from '../contexts/DialogContext';
import { useToast } from '../contexts/ToastContext';
import { generateId } from '../utils/helpers';
import { CURRENT_SCHEMA_VERSION } from '../utils/normalizeProject';
import PriceAnalysisView from './PriceAnalysisView';
import RaoLandingView from './rao/RaoLandingView';
import RaoStructureModal from '../components/rao/RaoStructureModal';
import HelpPanel from '../components/help/HelpPanel';
import HelpButton from '../components/help/HelpButton';

export default function RaoAnalysisView({ user, companyId, onBackToHub }) {
  const [showHelp, setShowHelp] = useState(false);
  const [importing, setImporting] = useState(false);
  // Mode : 'landing' (écran d'accueil RAO) | 'analysis' (vue d'analyse)
  const [mode, setMode] = useState('landing');
  // Sous-onglet actif dans la vue d'analyse — lift up pour que le bouton AIDE
  // en haut à droite affiche la bonne aide contextuelle (rao vs priceAnalysis)
  const [activeMainTab, setActiveMainTab] = useState('rao');

  // moduleId d'aide en fonction du contexte courant
  const helpModuleId = mode === 'landing'
    ? 'raoAnalysis'
    : (activeMainTab === 'rao' ? 'rao' : 'priceAnalysis');
  // État de la modale de structuration post-import DQE
  const [pendingImport, setPendingImport] = useState(null); // { chapters, fileName, projectName, warnings, stats }
  // Nom de projet pré-saisi (flux "Nouveau RAO" qui demande le nom avant le fichier)
  const pendingProjectNameRef = useRef(null);
  const dqeInputRef = useRef(null);
  const { prompt } = useDialog();
  const toast = useToast();
  const db = useDatabase(user, companyId);
  const {
    project, setProject, handleSaveProject,
  } = useProjectManager(user, companyId);
  const resources = useAppResources(user, companyId);

  // Charger le BPU quand on entre en mode analyse
  React.useEffect(() => {
    if (mode === 'analysis') db.loadBpu();
  }, [mode]);

  // Sélection d'un projet existant depuis le landing
  const handleSelectProject = useCallback(async (proj) => {
    try {
      const ref = doc(fireDb, 'companies', companyId, 'projects', proj.id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setProject({ id: snap.id, ...snap.data() });
      } else {
        setProject(proj);
      }
    } catch {
      setProject(proj);
    }
    setMode('analysis');
  }, [companyId, setProject]);

  const handleBackToLanding = useCallback(() => {
    setMode('landing');
  }, []);

  const handleNewRao = useCallback(async () => {
    // 1. Demander le nom du projet (l'import du fichier MOE suit obligatoirement)
    const projectName = await prompt(
      'Nom du projet (vous importerez ensuite l\'estimation MOE) :',
      '',
      {
        title: 'Nouveau RAO',
        placeholder: 'Ex: AMENAGEMENT ZAC DES PINS',
        confirmLabel: 'Sélectionner l\'estimation MOE',
      }
    );
    if (projectName === null) return;

    // 2. Mémoriser le nom et ouvrir le picker — l'import est obligatoire
    pendingProjectNameRef.current = (projectName.trim() || 'NOUVEAU RAO').toUpperCase();
    dqeInputRef.current?.click();
  }, [prompt]);

  const handleOpenDqePicker = useCallback(() => {
    pendingProjectNameRef.current = null; // raccourci sans nom pré-saisi
    dqeInputRef.current?.click();
  }, []);

  const handleImportDqe = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) { pendingProjectNameRef.current = null; return; }

    const suggestedName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ').toUpperCase();

    // Si on vient du flux "Nouveau RAO", le nom a déjà été saisi.
    // Sinon (raccourci "Importer DQE"), on demande le nom à partir du fichier.
    let finalProjectName = pendingProjectNameRef.current;
    if (!finalProjectName) {
      const projectName = await prompt('Nom du projet pour ce RAO :', suggestedName, {
        title: 'Importer une estimation MOE',
        placeholder: 'Ex: AMENAGEMENT ZAC DES PINS',
        confirmLabel: 'Vérifier la structure',
      });
      if (projectName === null) { event.target.value = null; return; }
      finalProjectName = (projectName.trim() || suggestedName).toUpperCase();
    }

    setImporting(true);
    try {
      const { parseDqeExcel } = await import('../utils/parseDqeExcel');
      const result = await parseDqeExcel(file);

      if (result.chapters.length === 0) {
        toast.error('Aucun article trouvé. Vérifiez que le fichier contient une colonne "Désignation".');
        return;
      }

      // Ouvrir la modale de validation/édition de la structure avant création
      setPendingImport({
        chapters: result.chapters,
        fileName: file.name,
        projectName: finalProjectName,
        warnings: result.warnings,
        stats: result.stats,
      });
    } catch (error) {
      console.error('[RAO] Erreur import DQE:', error);
      toast.error('Impossible de lire le fichier. Vérifiez le format Excel.');
    } finally {
      setImporting(false);
      pendingProjectNameRef.current = null;
      event.target.value = null;
    }
  }, [prompt, toast]);

  // Validation/édition de la structure post-import puis création du projet
  const handleConfirmStructure = useCallback(async (editedChapters) => {
    if (!pendingImport) return;

    const newProject = {
      id: `rao_${generateId()}`,
      name: pendingImport.projectName,
      chapters: editedChapters,
      tranches: [],
      sourceIds: [],
      clientPercent: 0,
      scoringConfig: { maxScore: 40, mode: 'f1' },
      rao: { raoTrancheId: 'global', includedOptions: {}, companies: {}, consultation: {}, criteria: [] },
      schemaVersion: CURRENT_SCHEMA_VERSION,
      isDqeImport: true,
    };

    setProject(newProject);
    await handleSaveProject(newProject);

    // Calculer les nouvelles stats à partir de la structure éditée
    let nbChap = 0, nbSub = 0, nbItem = 0;
    const walk = (arr, depth) => {
      for (const n of arr) {
        if (n.type === 'item') nbItem++;
        else if (depth === 0) nbChap++;
        else nbSub++;
        if (n.children) walk(n.children, depth + 1);
      }
    };
    walk(editedChapters, 0);

    const details = [`${nbItem} article(s)`, `${nbChap} chapitre(s)`];
    if (nbSub > 0) details.push(`${nbSub} sous-chapitre(s)`);
    if (pendingImport.stats.sheets > 1) details.push(`${pendingImport.stats.sheets} onglet(s)`);
    toast.success(`Projet RAO créé : ${details.join(', ')}.`);

    if (pendingImport.warnings && pendingImport.warnings.length > 0) {
      pendingImport.warnings.forEach(w => toast.warning(w));
    }

    setPendingImport(null);
    setMode('analysis');
  }, [pendingImport, setProject, handleSaveProject, toast]);

  const handleCancelStructure = useCallback(() => {
    setPendingImport(null);
  }, []);

  const isLanding = mode === 'landing';

  return (
    <div className="flex flex-col h-screen bg-[#f5f5f7] text-gray-900 overflow-hidden">

      <HelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} moduleId={helpModuleId} />

      {/* Modale de validation de la structure post-import DQE */}
      <RaoStructureModal
        open={!!pendingImport}
        initialChapters={pendingImport?.chapters || []}
        fileName={pendingImport?.fileName || ''}
        onConfirm={handleConfirmStructure}
        onCancel={handleCancelStructure}
      />

      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-3 border-b border-gray-200/60 shrink-0 bg-white/80 backdrop-blur-xl">
        <button
          onClick={isLanding ? onBackToHub : handleBackToLanding}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all"
        >
          <ArrowLeft size={18} />
          <span className="text-[10px] font-black uppercase tracking-widest">
            {isLanding ? 'Hub' : 'Projets'}
          </span>
        </button>

        <div className="h-6 w-px bg-gray-200/60" />

        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-blue-50 border border-blue-100">
            <BarChart3 size={20} className="text-blue-600" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-base text-gray-900 tracking-tight truncate">
              RAO & Analyse des Prix
            </h1>
            {!isLanding && project && (
              <p className="text-xs text-gray-400 -mt-0.5 truncate max-w-md">
                {project.name || 'Projet sans nom'}
                {project.code ? ` — ${project.code}` : ''}
              </p>
            )}
          </div>
        </div>

        {/* Bouton "Changer de projet" supprimé — le bouton "← Projets" en haut à gauche assure le retour à la landing */}

        <div className="ml-auto">
          <HelpButton onClick={() => setShowHelp(true)} />
        </div>

        {/* Input fichier DQE (caché) */}
        <input
          type="file"
          ref={dqeInputRef}
          accept=".xlsx,.xls"
          onChange={handleImportDqe}
          className="hidden"
        />
      </header>

      {/* Contenu */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {isLanding ? (
          <RaoLandingView
            companyId={companyId}
            onSelectProject={handleSelectProject}
            onNewRao={handleNewRao}
            onImportDqe={handleOpenDqePicker}
            importing={importing}
          />
        ) : (
          <PriceAnalysisView
            project={project}
            companyId={companyId}
            setProject={setProject}
            handleSaveProject={handleSaveProject}
            bpuConfig={{ numberingMode: project?.isDqeImport ? 'manual' : 'auto' }}
            clientPercent={project?.isDqeImport ? 0 : 10}
            masterBranding={resources.masterBranding}
            bpu={db.bpu}
            updateBpuItem={db.updateBpuItem}
            activeMainTab={activeMainTab}
            setActiveMainTab={setActiveMainTab}
          />
        )}
      </div>
    </div>
  );
}
