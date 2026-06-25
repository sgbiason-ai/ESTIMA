// src/views/estimaTp/EstimaTpView.jsx
// ESTIMA TP — module « Étude de Prix » (chiffrage entreprise de travaux publics).
// Ruban Office partagé en tête + navigation en volet latéral gauche (façon ESTIMA).
import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft, Check, Loader2, ListTree, Coins, Percent, BarChart3, Package,
  PlusCircle, Info, FileSpreadsheet, FileText, Table2, HelpCircle,
  FolderPlus, Layers, FilePlus,
} from 'lucide-react';
import { useTpStudies } from '../../hooks/useTpStudies';
import { useTpStudy } from '../../hooks/useTpStudy';
import { useToast } from '../../contexts/ToastContext';
import { useDialog } from '../../contexts/DialogContext';
import { RibbonHeader, RibbonContainer, RibbonGroup, RibbonBtnLarge, RibbonBtnSmall, RibbonSpacer } from '../../components/common/RibbonParts';
import TpLandingView from './TpLandingView';
import TpCadreTab from './TpCadreTab';
import TpSousDetailTab from './sousDetail/TpSousDetailTab';
import MargesTab from './MargesTab';
import RecapTab from './RecapTab';
import TpResourcesTab from './ressources/TpResourcesTab';
import TpFicheAffaireModal from './TpFicheAffaireModal';
import HelpPanel from '../../components/help/HelpPanel';
import { newChapter, newSubChapter, newItem, addNode, findNode, findParentId } from './bordereau/tpBordereauModel';

const TABS = [
  { id: 'cadre',      label: 'Cadre',       icon: ListTree },
  { id: 'detail',     label: 'Sous-détail', icon: Coins },
  { id: 'marges',     label: 'Marges',      icon: Percent },
  { id: 'recap',      label: 'Récap',       icon: BarChart3 },
  { id: 'ressources', label: 'Ressources',  icon: Package },
];

export default function EstimaTpView({ companyId, onBackToHub }) {
  const [activeStudyId, setActiveStudyId] = useState(null);
  const [activeTab, setActiveTab] = useState('cadre');
  const [detailArticleId, setDetailArticleId] = useState(null); // article ouvert dans le sous-détail (contrôlé)
  const [bordereauSelId, setBordereauSelId] = useState(null);    // nœud sélectionné dans le bordereau (contrôlé)
  const [showHelp, setShowHelp] = useState(false);
  const [showInfos, setShowInfos] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(null); // 'excel' | 'pdf' | null

  const toast = useToast();
  const { prompt, confirm } = useDialog();
  const fileRef = useRef(null);

  const { studies, loading, createStudy, deleteStudy } = useTpStudies(companyId);
  const { study, setStudy, loading: loadingStudy, saving } = useTpStudy(companyId, activeStudyId);

  const isEditing = !!activeStudyId;
  const hasChapters = (study?.cadre?.chapters || []).length > 0;

  const handleBack = () => {
    if (isEditing) { setActiveStudyId(null); setActiveTab('cadre'); setDetailArticleId(null); setBordereauSelId(null); }
    else onBackToHub();
  };

  // Double-clic sur le N° d'un article (bordereau) → ouvre son sous-détail.
  const openSousDetail = (itemId) => {
    setDetailArticleId(itemId);
    setActiveTab('detail');
  };

  // ── Insertion depuis le ruban (chapitre / sous-chapitre / article) ──
  const setChapters = (next) =>
    setStudy(prev => ({ ...prev, cadre: { ...(prev?.cadre || {}), chapters: next } }));

  // Parent où insérer un sous-chapitre/article selon la sélection courante :
  // chapitre/sous-chapitre sélectionné → dedans ; article sélectionné → son parent ;
  // sinon → dernier chapitre. Renvoie null si aucun chapitre n'existe encore.
  const resolveParent = (chapters) => {
    const node = bordereauSelId ? findNode(chapters, bordereauSelId) : null;
    if (node) {
      if (node.type === 'chapter') return node.id;
      if (node.type === 'item') {
        const pid = findParentId(chapters, node.id);
        if (pid && pid !== 'root') return pid;
      }
    }
    const last = chapters[chapters.length - 1];
    return last ? last.id : null;
  };

  const addChapter = () => {
    const chapters = study?.cadre?.chapters || [];
    const ch = newChapter();
    setChapters([...chapters, ch]);
    setBordereauSelId(ch.id);
    setActiveTab('cadre');
  };

  const addChild = (factory) => {
    const chapters = study?.cadre?.chapters || [];
    const node = factory();
    let parentId = resolveParent(chapters);
    if (!parentId) {
      // Aucun chapitre : on en crée un et on y insère le nœud.
      const ch = newChapter();
      setChapters(addNode([...chapters, ch], ch.id, node));
    } else {
      setChapters(addNode(chapters, parentId, node));
    }
    setBordereauSelId(node.id);
    setActiveTab('cadre');
  };

  const addSubChapter = () => addChild(newSubChapter);
  const addArticle = () => addChild(newItem);

  // ── Nouvelle étude (depuis le ruban) ──
  const handleNewStudy = async () => {
    const name = await prompt("Nom de l'étude de prix :", '', {
      title: 'Nouvelle étude de prix',
      placeholder: 'Ex : Aménagement RD820 — Tranche 1',
      confirmLabel: "Créer l'étude",
    });
    if (name === null) return;
    try {
      const created = await createStudy({ name: (name || '').trim() || 'Nouvelle étude' });
      if (created) { toast.success('Étude créée.'); setActiveStudyId(created.id); setActiveTab('cadre'); }
    } catch (e) {
      console.error('[ESTIMA TP] Création échouée:', e);
      toast.error("Impossible de créer l'étude.");
    }
  };

  // ── Import DPGF Excel (réutilise le parseur du RAO) ──
  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = null;
    if (!file || !study) return;
    if (hasChapters) {
      const ok = await confirm(
        'Remplacer le bordereau actuel par le contenu du fichier ?\n\nLes chapitres et articles existants (et leurs sous-détails) seront perdus.',
        { title: 'Importer un DPGF Excel', danger: true, confirmLabel: 'Remplacer' }
      );
      if (!ok) return;
    }
    setImporting(true);
    try {
      const { parseDqeExcel } = await import('../../utils/parseDqeExcel');
      const res = await parseDqeExcel(file);
      if (!res.chapters || res.chapters.length === 0) {
        toast.error('Aucun article trouvé. Vérifiez que le fichier contient une colonne « Désignation ».');
        return;
      }
      setStudy(prev => ({ ...prev, cadre: { ...(prev?.cadre || {}), chapters: res.chapters } }));
      const s = res.stats || {};
      toast.success(`Bordereau importé : ${s.totalItems || 0} article(s)${s.sheets > 1 ? `, ${s.sheets} onglets` : ''}.`);
      (res.warnings || []).forEach(w => toast.warning(w));
      setActiveTab('cadre');
    } catch (err) {
      console.error('[ESTIMA TP] Import DPGF échoué:', err);
      toast.error('Impossible de lire le fichier. Vérifiez le format Excel.');
    } finally {
      setImporting(false);
    }
  };

  // Purge la sélection bordereau si le nœud n'existe plus dans l'arbre (suppression, import,
  // ouverture d'une autre étude…). Sans ça, le ruban « Insertion » retomberait silencieusement
  // sur le dernier chapitre.
  useEffect(() => {
    if (!bordereauSelId) return;
    const chs = study?.cadre?.chapters || [];
    if (!findNode(chs, bordereauSelId)) setBordereauSelId(null);
  }, [study?.cadre?.chapters, bordereauSelId]);

  // ── Exports (Excel / PDF Bordereau / PDF Sous-détails) ──
  const handleExport = async (kind) => {
    if (exporting || !study) return;
    setExporting(kind);
    try {
      if (kind === 'excel') {
        const { generateTpExcel } = await import('../../utils/tp/tpExcelExport');
        await generateTpExcel(study);
      } else if (kind === 'pdf-bordereau') {
        const { generateTpBordereauPdf } = await import('../../utils/tp/tpPdfExport');
        await generateTpBordereauPdf(study, { companyId });
      } else if (kind === 'pdf-sd') {
        const { generateTpSousDetailPdf } = await import('../../utils/tp/tpPdfExport');
        await generateTpSousDetailPdf(study, { companyId });
      }
    } catch (e) {
      console.error('[ESTIMA TP] Export échoué:', e);
      toast.error(e?.message || 'Export impossible. Réessayez.');
    } finally {
      setExporting(null);
    }
  };

  // ── Indicateur de sauvegarde (style ProjectToolbar) ──
  const SaveIndicator = () => {
    if (!isEditing) return null;
    return (
      <span className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400">
        {saving ? <><Loader2 size={11} className="animate-spin text-orange-500" /> Enregistrement…</> : <><Check size={11} className="text-emerald-500" /> Enregistré</>}
      </span>
    );
  };

  const renderTab = () => {
    if (loadingStudy) return <div className="flex-1 flex items-center justify-center"><Loader2 size={28} className="animate-spin text-orange-500" /></div>;
    if (!study) return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <p className="text-sm font-semibold text-gray-700">Étude introuvable</p>
        <button onClick={() => setActiveStudyId(null)} className="mt-3 px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-all">Retour aux études</button>
      </div>
    );
    switch (activeTab) {
      case 'cadre':      return <TpCadreTab study={study} setStudy={setStudy} onOpenSousDetail={openSousDetail} selectedId={bordereauSelId} onSelectId={setBordereauSelId} />;
      case 'detail':     return <TpSousDetailTab study={study} setStudy={setStudy} companyId={companyId} selectedId={detailArticleId} onSelectArticle={setDetailArticleId} />;
      case 'marges':     return <MargesTab study={study} setStudy={setStudy} />;
      case 'recap':      return <RecapTab study={study} />;
      case 'ressources': return <TpResourcesTab companyId={companyId} />;
      default:           return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#f5f5f7] text-gray-900 overflow-hidden font-[system-ui,'Segoe_UI',sans-serif] select-none">
      <HelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} moduleId="estimaTp" />
      {study && (
        <TpFicheAffaireModal
          isOpen={showInfos}
          onClose={() => setShowInfos(false)}
          study={study}
          onSave={(patch) => setStudy(prev => ({ ...prev, ...patch }))}
        />
      )}
      {/* Input caché pour l'import DPGF (piloté par le ruban) */}
      <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />

      {/* ═══════ RUBAN ═══════ */}
      <header className="sticky top-0 z-20 shrink-0">
        <RibbonHeader
          title={isEditing ? (study?.name || 'Étude sans nom') : 'ESTIMA TP'}
          tabs={[{ id: 'accueil', label: 'Accueil' }]}
          activeTab="accueil"
          onTabChange={() => {}}
          rightContent={<SaveIndicator />}
        />
        <RibbonContainer>
          {/* Navigation */}
          <RibbonGroup label="Navigation">
            <RibbonBtnLarge icon={ArrowLeft} label={isEditing ? 'Études' : 'Hub'} onClick={handleBack} title={isEditing ? 'Revenir à la liste des études' : 'Revenir au hub'} />
          </RibbonGroup>

          {/* Fichier */}
          <RibbonGroup label="Fichier">
            <RibbonBtnLarge icon={PlusCircle} label="Nouvelle" onClick={handleNewStudy} accent="text-emerald-500" title="Créer une nouvelle étude de prix" />
          </RibbonGroup>

          {/* Affaire — visible uniquement en édition */}
          {isEditing && (
            <RibbonGroup label="Affaire">
              <RibbonBtnLarge icon={Info} label="Infos" onClick={() => setShowInfos(true)} accent="text-orange-500" title="Fiche affaire (informations générales de l'étude)" />
            </RibbonGroup>
          )}

          {/* Insertion — chapitre / sous-chapitre / article */}
          {isEditing && (
            <RibbonGroup label="Insertion">
              <RibbonBtnLarge icon={FolderPlus} label="Chapitre" onClick={addChapter} accent="text-orange-500" title="Ajouter un chapitre (à la racine du bordereau)" />
              <RibbonBtnLarge icon={Layers} label="Sous-chap." onClick={addSubChapter} accent="text-slate-500" title="Ajouter un sous-chapitre dans la sélection courante (ou le dernier chapitre)" />
              <RibbonBtnLarge icon={FilePlus} label="Article" onClick={addArticle} accent="text-emerald-500" title="Ajouter un article dans la sélection courante (ou le dernier chapitre)" />
            </RibbonGroup>
          )}

          {/* Données */}
          {isEditing && (
            <RibbonGroup label="Données">
              <RibbonBtnLarge
                icon={importing ? Loader2 : FileSpreadsheet}
                label={importing ? 'Import…' : 'Import DPGF'}
                onClick={() => fileRef.current?.click()}
                disabled={importing}
                accent="text-emerald-600"
                title="Importer le bordereau depuis un DPGF Excel (cadre de l'appel d'offres)"
              />
            </RibbonGroup>
          )}

          <RibbonSpacer />

          {/* Export */}
          {isEditing && (
            <RibbonGroup label="Export">
              <div className="flex flex-col gap-[3px] justify-center">
                <RibbonBtnSmall icon={exporting === 'excel' ? Loader2 : Table2} label="Excel DQE" onClick={() => handleExport('excel')} disabled={!!exporting || !hasChapters} accent="text-emerald-600" title="Exporter le bordereau chiffré (Excel)" />
                <RibbonBtnSmall icon={exporting === 'pdf-bordereau' ? Loader2 : FileText} label="PDF Bordereau" onClick={() => handleExport('pdf-bordereau')} disabled={!!exporting || !hasChapters} accent="text-red-500" title="Exporter le bordereau chiffré (PDF, portrait)" />
                <RibbonBtnSmall icon={exporting === 'pdf-sd' ? Loader2 : FileText} label="PDF Sous-détails" onClick={() => handleExport('pdf-sd')} disabled={!!exporting || !hasChapters} accent="text-orange-500" title="Exporter les sous-détails de prix (1 page par article, paysage)" />
              </div>
            </RibbonGroup>
          )}

          {/* Aide */}
          <RibbonGroup label="Aide" noBorder>
            <RibbonBtnLarge icon={HelpCircle} label="Aide" onClick={() => setShowHelp(true)} title="Aide du module ESTIMA TP" />
          </RibbonGroup>
        </RibbonContainer>
      </header>

      {/* ═══════ CORPS ═══════ */}
      {!isEditing ? (
        <TpLandingView studies={studies} loading={loading} onOpen={setActiveStudyId} onCreate={createStudy} onDelete={deleteStudy} />
      ) : (
        <div className="flex-1 flex min-h-0">
          {/* Volet de navigation (gauche, façon ESTIMA) */}
          <nav className="w-40 shrink-0 border-r border-gray-200/60 bg-white flex flex-col py-2 gap-0.5">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 mx-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${active ? 'bg-orange-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
                  <Icon size={17} strokeWidth={1.8} /> {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Contenu de l'onglet */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {renderTab()}
          </div>
        </div>
      )}
    </div>
  );
}
