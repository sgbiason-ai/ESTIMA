// src/views/estimaTp/sousDetail/TpSousDetailTab.jsx
// ESTIMA TP — onglet « Sous-détail » : liste des articles à gauche, éditeur au centre,
// volet « Bibliothèque » à droite (insertion de ressources). Le PU retenu calculé
// est réinjecté dans le PU de l'article au bordereau.
import React, { useMemo, useState } from 'react';
import { Coins, ChevronRight, FileWarning } from 'lucide-react';
import { findNode, updateNode } from '../bordereau/tpBordereauModel';
import {
  computeDetail, emptyDetail, defaultCoefficients,
  newRessourceLine, newTransportLine, newFournitureLine, newSousTraitanceLine,
} from '../../../utils/tp/tpPriceCompute';
import { useTpResources } from '../../../hooks/useTpResources';
import { flattenArticles, fmt2 } from './sdFormat';
import TpSousDetailEditor from './TpSousDetailEditor';
import TpLibraryPanel from '../ressources/TpLibraryPanel';

// Construit une ligne de sous-détail à partir d'une ressource de bibliothèque.
function lineFromResource(res) {
  const common = { code: res.code, designation: res.designation, unit: res.unit };
  switch (res.category) {
    case 'materiel':
    case 'mo':
      return [res.category, newRessourceLine({ ...common, unit: res.unit || 'J', puJour: res.puJour, amort: res.amort, entret: res.entret, cons: res.cons, loc: res.loc })];
    case 'transport':
      return ['transport', newTransportLine({ ...common, unit: res.unit || 'J', puJour: res.puJour, amort: res.amort, entret: res.entret, cons: res.cons, loc: res.loc })];
    case 'fourniture':
      return ['fourniture', newFournitureLine({ ...common, unit: res.unit || 'T', epaisseur: res.epaisseur, densite: res.densite, puBareme: res.puBareme })];
    case 'soustraitance':
      return ['soustraitance', newSousTraitanceLine({ ...common, unit: res.unit || 'U', puBareme: res.puBareme })];
    default:
      return [null, null];
  }
}

export default function TpSousDetailTab({ study, setStudy, companyId }) {
  const chapters = useMemo(() => study?.cadre?.chapters || [], [study?.cadre?.chapters]);
  const coef = study?.coefficients || defaultCoefficients();
  const articles = useMemo(() => flattenArticles(chapters), [chapters]);
  const [selectedId, setSelectedId] = useState(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const { resources } = useTpResources(companyId);

  const currentId = selectedId && articles.some(a => a.id === selectedId) ? selectedId : (articles[0]?.id || null);
  const selectedItem = currentId ? findNode(chapters, currentId) : null;

  const applyDetail = (nextDetail) => {
    const item = findNode(chapters, currentId);
    if (!item) return;
    const { puRetenu } = computeDetail(nextDetail, Number(item.qty || 0), coef);
    const next = updateNode(chapters, currentId, { detail: nextDetail, price: puRetenu });
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
      {/* Liste des articles */}
      <div className="w-64 shrink-0 border-r border-slate-200 bg-white overflow-y-auto">
        {articles.map(a => {
          const active = a.id === currentId;
          return (
            <button key={a.id} onClick={() => setSelectedId(a.id)}
              className={`w-full text-left px-4 py-2.5 border-b border-slate-100 transition-colors ${active ? 'bg-orange-50' : 'hover:bg-slate-50'}`}>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono font-bold px-1.5 rounded ${active ? 'bg-orange-200 text-orange-800' : 'bg-slate-100 text-slate-500'}`}>{a.num}</span>
                <span className="flex-1 text-xs font-semibold text-slate-800 truncate">{a.designation}</span>
                {a.hasDetail
                  ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Sous-détail renseigné" />
                  : <ChevronRight size={13} className="text-slate-300 shrink-0" />}
              </div>
              <div className="flex items-center justify-between mt-0.5 pl-7">
                <span className="text-[10px] text-slate-400">{a.qty.toLocaleString('fr-FR')} {a.unit}</span>
                <span className="text-[10px] font-mono font-bold text-slate-600">{a.price > 0 ? `${fmt2(a.price)}/${a.unit}` : '—'}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Éditeur */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {selectedItem
          ? <TpSousDetailEditor
              item={{ ...selectedItem, detail: selectedItem.detail || emptyDetail() }}
              coef={coef} onChange={applyDetail}
              libraryOpen={libraryOpen} onToggleLibrary={() => setLibraryOpen(o => !o)} />
          : <div className="flex items-center justify-center h-full text-slate-400"><Coins size={20} className="mr-2" /> Sélectionnez un article</div>}
      </div>

      {/* Volet bibliothèque */}
      {libraryOpen && (
        <TpLibraryPanel resources={resources} onInsert={insertFromLibrary} onClose={() => setLibraryOpen(false)} />
      )}
    </div>
  );
}
