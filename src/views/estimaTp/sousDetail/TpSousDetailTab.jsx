// src/views/estimaTp/sousDetail/TpSousDetailTab.jsx
// ESTIMA TP — onglet « Sous-détail » : barre latérale « Bibliothèque » à gauche
// (façon ESTIMA), sélecteur d'articles compact en haut, éditeur en dessous.
// Le PU retenu calculé est réinjecté dans le PU de l'article au bordereau.
import React, { useMemo, useState } from 'react';
import { Coins, FileWarning, Package } from 'lucide-react';
import { findNode, updateNode } from '../bordereau/tpBordereauModel';
import {
  computeDetail, emptyDetail, defaultCoefficients,
  newRessourceLine, newTransportLine, newFournitureLine, newSousTraitanceLine,
} from '../../../utils/tp/tpPriceCompute';
import { useTpResources } from '../../../hooks/useTpResources';
import { flattenArticles } from './sdFormat';
import TpSousDetailEditor from './TpSousDetailEditor';
import TpAllResourcesModal from './TpAllResourcesModal';
import TpArticleNavigator from './TpArticleNavigator';
import TpLibraryPanel from '../ressources/TpLibraryPanel';

// Construit une ligne de sous-détail à partir d'une ressource de bibliothèque (sans code).
function lineFromResource(res) {
  const c = { designation: res.designation, unit: res.unit };
  switch (res.category) {
    case 'materiel':
    case 'mo':
      return [res.category, newRessourceLine({ ...c, unit: res.unit || 'J', puJour: res.puJour, amort: res.amort, entret: res.entret, cons: res.cons, loc: res.loc })];
    case 'transport':
      return ['transport', newTransportLine({ ...c, unit: res.unit || 'T', contenance: res.contenance, coutJour: res.coutJour })];
    case 'fourniture':
      return ['fourniture', newFournitureLine({ ...c, unit: res.unit || 'T', puBareme: res.puBareme })];
    case 'soustraitance':
      return ['soustraitance', newSousTraitanceLine({ ...c, unit: res.unit || 'U', puBareme: res.puBareme })];
    default:
      return [null, null];
  }
}

export default function TpSousDetailTab({ study, setStudy, companyId, selectedId, onSelectArticle }) {
  const chapters = useMemo(() => study?.cadre?.chapters || [], [study?.cadre?.chapters]);
  const coef = study?.coefficients || defaultCoefficients();
  const articles = useMemo(() => flattenArticles(chapters), [chapters]);
  const [libraryOpen, setLibraryOpen] = useState(true); // ouvert par défaut ; rabattable via la poignée latérale
  const [activePoste, setActivePoste] = useState(null);
  const [showAll, setShowAll] = useState(false); // overlay « toutes les ressources » (5 postes empilés)
  const [filterTick, setFilterTick] = useState(0); // bump → re-filtre la biblio même au re-clic du même poste
  const { resources } = useTpResources(companyId);

  // Sélection d'un poste (onglet ou en-tête de table) : poste actif + re-filtrage forcé de la biblio.
  const selectPoste = (p) => { setActivePoste(p); setFilterTick(t => t + 1); };

  const currentId = selectedId && articles.some(a => a.id === selectedId) ? selectedId : (articles[0]?.id || null);
  const selectedItem = currentId ? findNode(chapters, currentId) : null;

  const applyDetail = (nextDetail) => {
    const item = findNode(chapters, currentId);
    if (!item) return;
    const { puRetenu } = computeDetail(nextDetail, Number(item.qty || 0), coef);
    const next = updateNode(chapters, currentId, { detail: nextDetail, price: puRetenu });
    setStudy(prev => ({ ...prev, cadre: { ...(prev?.cadre || {}), chapters: next } }));
  };

  // Quantité d'ouvrage éditable depuis le sous-détail : met à jour l'article du
  // bordereau (on retire la formule de quantité éventuelle) + recalcule le PU.
  const applyQty = (newQty) => {
    const item = findNode(chapters, currentId);
    if (!item) return;
    const detail = item.detail || emptyDetail();
    const { puRetenu } = computeDetail(detail, newQty, coef);
    const next = updateNode(chapters, currentId, { qty: Number(newQty) || 0, formula: '', price: puRetenu });
    setStudy(prev => ({ ...prev, cadre: { ...(prev?.cadre || {}), chapters: next } }));
  };

  // Unité d'ouvrage éditable depuis le sous-détail : met à jour l'article du bordereau
  // (même champ que le Cadre). Le PU est par unité → la valeur ne change pas, juste le libellé.
  const applyUnit = (newUnit) => {
    const item = findNode(chapters, currentId);
    if (!item) return;
    const next = updateNode(chapters, currentId, { unit: (newUnit || '').trim() });
    setStudy(prev => ({ ...prev, cadre: { ...(prev?.cadre || {}), chapters: next } }));
  };

  const insertFromLibrary = (res) => {
    if (!selectedItem) return;
    const [block, line] = lineFromResource(res);
    if (!block) return;
    const detail = selectedItem.detail || emptyDetail();
    applyDetail({ ...detail, [block]: [...(detail[block] || []), line] });
  };

  if (articles.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 bg-[#f5f5f7]">
        <div className="p-4 rounded-2xl bg-orange-50 mb-4"><FileWarning size={28} className="text-orange-500" strokeWidth={1.5} /></div>
        <p className="text-sm font-semibold text-slate-700">Aucun article à chiffrer</p>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">Ajoutez d'abord des articles dans l'onglet <strong>Cadre</strong>, puis revenez ici pour construire leur sous-détail de prix.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex min-h-0 bg-[#f5f5f7]">
      {/* Volet bibliothèque (gauche, façon ESTIMA) — filtre suit le bloc actif.
          Ouvert par défaut ; rabattable via la croix du volet, ré-ouvrable via la poignée latérale. */}
      {libraryOpen ? (
        <TpLibraryPanel resources={resources} onInsert={insertFromLibrary} onClose={() => setLibraryOpen(false)} activeCategory={activePoste} filterTick={filterTick} />
      ) : (
        <button
          onClick={() => setLibraryOpen(true)}
          title="Ouvrir la bibliothèque de ressources"
          className="group w-7 shrink-0 bg-white border-r border-slate-200 flex flex-col items-center justify-start py-3 gap-2 hover:bg-orange-50 transition-colors"
        >
          <Package size={14} className="text-orange-600 group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-orange-700"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
            Bibliothèque
          </span>
        </button>
      )}

      <div className="relative flex-1 flex flex-col min-h-0 min-w-0">
        {/* Navigateur compact d'articles (recherche + précédent/suivant + compteur) */}
        <TpArticleNavigator articles={articles} currentId={currentId} onSelect={onSelectArticle} />

        {/* Éditeur */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {selectedItem
            ? <TpSousDetailEditor
                item={{ ...selectedItem, detail: selectedItem.detail || emptyDetail() }}
                coef={coef} onChange={applyDetail} onQtyChange={applyQty} onUnitChange={applyUnit}
                activePoste={activePoste} onSelectPoste={selectPoste}
                onShowAll={() => setShowAll(true)} />
            : <div className="flex items-center justify-center h-full text-slate-400"><Coins size={20} className="mr-2" /> Sélectionnez un article</div>}
        </div>

        {/* Overlay « toutes les ressources » : couvre UNIQUEMENT la zone d'édition (à droite
            du volet) → la Bibliothèque reste cliquable pour insérer des ressources. */}
        {showAll && selectedItem && (
          <TpAllResourcesModal
            item={{ ...selectedItem, detail: selectedItem.detail || emptyDetail() }}
            coef={coef} activePoste={activePoste} onSelectPoste={selectPoste}
            onChange={applyDetail} onQtyChange={applyQty} onUnitChange={applyUnit} onClose={() => setShowAll(false)} />
        )}
      </div>
    </div>
  );
}
