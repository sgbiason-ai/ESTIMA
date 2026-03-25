import React, { useState } from 'react';
import {
  FileSpreadsheet, FileText, Plus, Upload, Trash2, History, CheckCircle2, BarChart3,
  Calculator, Settings2, Thermometer, AlertTriangle, EyeOff, Layers, ChevronDown,
  FileDown, Database
} from 'lucide-react';

/* ════════════════════════════════════════════════════════════════════
   RIBBON — Composants (même style que ProjectToolbar)
   ════════════════════════════════════════════════════════════════════ */

const RibbonGroup = ({ label, children, noBorder }) => (
  <div className="flex flex-col h-full relative">
    <div className="flex items-center justify-center gap-1.5 px-4 flex-1 py-1">
      {children}
    </div>
    <div className="text-center pb-1 px-2">
      <span className="text-[10px] text-slate-400 font-normal tracking-wide select-none whitespace-nowrap leading-none">
        {label}
      </span>
    </div>
    {!noBorder && (
      <div className="absolute right-0 top-2 bottom-2 w-px bg-gradient-to-b from-transparent via-slate-200 to-transparent" />
    )}
  </div>
);

const RibbonBtnLarge = ({ icon: Icon, label, onClick, title, active, accent, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title || label}
    className={`
      group flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded min-w-[52px]
      transition-all duration-100
      ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-default'}
      ${active
        ? 'bg-blue-50 border border-blue-200 shadow-sm'
        : 'border border-transparent hover:bg-[#dce6f0] hover:border-[#c4d5e8] active:bg-[#b8cce0]'
      }
    `}
  >
    <div className={`transition-colors ${accent || 'text-slate-600'} ${!disabled && !active ? 'group-hover:text-slate-800' : ''}`}>
      <Icon size={22} strokeWidth={1.6} />
    </div>
    <span className={`text-[10.5px] leading-tight text-center font-normal transition-colors
      ${active ? 'text-blue-700 font-medium' : 'text-slate-600'}
      ${!disabled && !active ? 'group-hover:text-slate-800' : ''}
    `}>
      {label}
    </span>
  </button>
);

const RibbonBtnSmall = ({ icon: Icon, label, onClick, title, active, accent, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title || label}
    className={`
      group flex items-center gap-2 px-2.5 py-[5px] rounded w-full
      transition-all duration-100
      ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-default'}
      ${active
        ? 'bg-blue-50 border border-blue-200'
        : 'border border-transparent hover:bg-[#dce6f0] hover:border-[#c4d5e8] active:bg-[#b8cce0]'
      }
    `}
  >
    <div className={`transition-colors shrink-0 ${accent || 'text-slate-500'} ${!disabled && !active ? 'group-hover:text-slate-700' : ''}`}>
      <Icon size={16} strokeWidth={1.6} />
    </div>
    {label && (
      <span className={`text-[11px] leading-none whitespace-nowrap font-normal transition-colors
        ${active ? 'text-blue-700 font-medium' : 'text-slate-600'}
        ${!disabled && !active ? 'group-hover:text-slate-800' : ''}
      `}>
        {label}
      </span>
    )}
  </button>
);

/* ════════════════════════════════════════════════════════════════════
   ANALYSIS TOOLBAR — Ribbon style Office
   ════════════════════════════════════════════════════════════════════ */

// LISTE DES 9 FORMULES
const FORMULAS = [
  { id: 'f1', label: 'F1 : Linéaire (Classique)', math: 'Note = N × ( Pmin ÷ P )' },
  { id: 'f2', label: 'F2 : Quadratique', math: 'Note = N × ( Pmin ÷ P )²' },
  { id: 'f3', label: 'F3 : Cubique', math: 'Note = N × ( Pmin ÷ P )³' },
  { id: 'f4', label: 'F4 : Écart Relatif', math: 'Note = N × [ 1 - ( P - Pmin ) ÷ Pmin ]' },
  { id: 'f5', label: 'F5 : Amortie (Moyenne)', math: 'Note = N × [ 1 - ( P - Pmin ) ÷ Pmoy ]' },
  { id: 'f6', label: 'F6 : Mixte', math: 'Si P < Pmoy : N × √( Pmin ÷ P )  |  Sinon : N × ( Pmin ÷ P )²' },
  { id: 'f7', label: 'F7 : Linéaire (Min/Max)', math: 'Note = N × [ 1 - ( P - Pmin ) ÷ ( Pmax - Pmin ) ]' },
  { id: 'f8', label: 'F8 : Moyenne Pondérée', math: 'Note = ( N × Pmoy ) ÷ ( Pmoy + P )' },
  { id: 'f9', label: 'F9 : Ratio Double Min', math: 'Note = N × ( 2 × Pmin ) ÷ ( Pmin + P )' },
];

const AnalysisToolbar = ({
  activeTrancheId, setActiveTrancheId, tranches, lastSaved,
  scoringConfig, setScoringConfig,
  analysisMode, setAnalysisMode,
  onAddManualCompany, onImportOffer, onClearAll, onUndoObservatory, canUndoObservatory, onExportPDF, onExportExcel,
  onPushAveragesToBpu, averagesHorsOABCount = 0
}) => {
  const [showScoringSettings, setShowScoringSettings] = useState(false);

  return (
    <div className="font-[system-ui,'Segoe_UI',sans-serif] select-none relative">

      {/* ═══════ BARRE TITRE ═══════ */}
      <div className="flex items-center h-[30px] px-3 bg-white border-b border-slate-200">
        <div className="flex-1 flex items-center justify-center gap-2.5">
          <span className="text-[11.5px] font-semibold text-slate-700 tracking-wide">
            Analyse Financière
          </span>
        </div>
        <div className="flex items-center pr-2">
          {lastSaved && (
            <div className="flex items-center gap-1 text-[10px] font-normal text-emerald-500">
              <CheckCircle2 size={11} />
              <span>Sauvegardé</span>
            </div>
          )}
        </div>
      </div>

      {/* ═══════ CONTENU DU RIBBON ═══════ */}
      <div className="flex items-stretch bg-[#f3f3f3] border-b border-slate-200 min-h-[78px]">

        {/* ── Tranches ── */}
        <RibbonGroup label="Tranche">
          <RibbonBtnLarge
            icon={Layers}
            label="Global"
            onClick={() => setActiveTrancheId('global')}
            active={activeTrancheId === 'global'}
            accent="text-emerald-600"
          />
          {tranches.map(t => (
            <RibbonBtnLarge
              key={t.id}
              icon={Layers}
              label={t.name}
              onClick={() => setActiveTrancheId(t.id)}
              active={activeTrancheId === t.id}
              accent="text-indigo-500"
            />
          ))}
        </RibbonGroup>

        {/* ── Visualisation ── */}
        <RibbonGroup label="Visualisation">
          <RibbonBtnLarge
            icon={EyeOff}
            label="Standard"
            onClick={() => setAnalysisMode('none')}
            active={analysisMode === 'none'}
            accent="text-slate-500"
          />
          <RibbonBtnLarge
            icon={Thermometer}
            label="Heatmap"
            onClick={() => setAnalysisMode('heatmap')}
            active={analysisMode === 'heatmap'}
            accent="text-orange-500"
          />
          <RibbonBtnLarge
            icon={AlertTriangle}
            label="OAB"
            onClick={() => setAnalysisMode('oab')}
            active={analysisMode === 'oab'}
            accent="text-amber-500"
          />
        </RibbonGroup>

        {/* ── Notation ── */}
        <RibbonGroup label="Notation">
          <button
            onClick={(e) => { e.stopPropagation(); setShowScoringSettings(!showScoringSettings); }}
            title="Configurer la notation"
            className={`
              group flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded min-w-[52px]
              transition-all duration-100 cursor-default
              ${showScoringSettings
                ? 'bg-blue-50 border border-blue-200 shadow-sm'
                : 'border border-transparent hover:bg-[#dce6f0] hover:border-[#c4d5e8] active:bg-[#b8cce0]'
              }
            `}
          >
            <div className={`transition-colors ${showScoringSettings ? 'text-indigo-600' : 'text-indigo-500 group-hover:text-indigo-700'}`}>
              <Calculator size={22} strokeWidth={1.6} />
            </div>
            <span className={`text-[10.5px] leading-tight text-center font-normal transition-colors ${showScoringSettings ? 'text-blue-700 font-medium' : 'text-slate-600 group-hover:text-slate-800'}`}>
              {(scoringConfig?.mode || 'F1').toUpperCase()} · {scoringConfig?.maxScore || 40}pts
            </span>
          </button>
        </RibbonGroup>

        {/* ── Observatoire Prix ── */}
        <RibbonGroup label="Observatoire">
          <RibbonBtnLarge
            icon={Database}
            label={<>Moy. → BPU{averagesHorsOABCount > 0 && <span className="ml-0.5 text-[9px] opacity-70">({averagesHorsOABCount})</span>}</>}
            onClick={onPushAveragesToBpu}
            accent="text-violet-500"
            title="Calculer la moyenne des prix hors OAB et mettre à jour la base de prix"
            disabled={averagesHorsOABCount === 0}
          />
        </RibbonGroup>

        {/* ── Spacer ── */}
        <div className="flex-1 min-w-[16px]" />

        {/* ── Données ── */}
        <RibbonGroup label="Données">
          <div className="flex flex-col gap-[3px] justify-center">
            <label className="cursor-pointer">
              <RibbonBtnSmall icon={Upload} label="Importer" accent="text-indigo-500" title="Importer un fichier Excel" />
              <input type="file" accept=".xlsx, .xls" onChange={onImportOffer} className="hidden" />
            </label>
            <RibbonBtnSmall icon={Plus} label="Ajouter" onClick={onAddManualCompany} accent="text-emerald-500" title="Ajouter une entreprise" />
          </div>
          <div className="flex flex-col gap-[3px] justify-center">
            {canUndoObservatory && (
              <RibbonBtnSmall icon={History} label="Annuler" onClick={onUndoObservatory} accent="text-slate-500" title="Annuler la dernière action" />
            )}
            <RibbonBtnSmall icon={Trash2} label="Effacer" onClick={onClearAll} accent="text-red-400" title="Tout effacer" />
          </div>
        </RibbonGroup>

        {/* ── Export ── */}
        <RibbonGroup label="Export" noBorder>
          <RibbonBtnLarge
            icon={FileSpreadsheet}
            label="Excel"
            onClick={onExportExcel}
            accent="text-emerald-600"
            title="Exporter en Excel"
          />
          <RibbonBtnLarge
            icon={FileText}
            label="PDF"
            onClick={onExportPDF}
            accent="text-red-500"
            title="Exporter en PDF"
          />
        </RibbonGroup>
      </div>

      {/* ── Menu déroulant Notation ── */}
      {showScoringSettings && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setShowScoringSettings(false)} />
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 z-[9999] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-xs font-black uppercase text-slate-700 flex items-center gap-2">
                <Settings2 size={16} className="text-indigo-500" /> Configuration notation
              </h3>
              <button onClick={() => setShowScoringSettings(false)} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase">Fermer</button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-500 mb-2">
                  <span>Note Maximale (N)</span>
                  <span className="text-indigo-600 bg-indigo-50 px-1.5 rounded">{scoringConfig.maxScore} points</span>
                </label>
                <input
                  type="range" min="10" max="100" step="5"
                  value={scoringConfig.maxScore}
                  onChange={(e) => setScoringConfig({...scoringConfig, maxScore: Number(e.target.value)})}
                  className="w-full accent-indigo-600 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-2">Algorithme de calcul</label>
                <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto">
                  {FORMULAS.map(f => (
                    <div
                      key={f.id}
                      onClick={() => setScoringConfig({...scoringConfig, mode: f.id})}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${scoringConfig.mode === f.id ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'hover:bg-slate-50 border-transparent hover:border-slate-100'}`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${scoringConfig.mode === f.id ? 'border-indigo-600' : 'border-slate-300'}`}>
                        {scoringConfig.mode === f.id && <div className="w-2 h-2 bg-indigo-600 rounded-full" />}
                      </div>
                      <div className="flex flex-col w-full">
                        <span className={`text-[11px] font-bold ${scoringConfig.mode === f.id ? 'text-indigo-900' : 'text-slate-700'}`}>{f.label}</span>
                        <div className="mt-1 bg-slate-100 px-2 py-1.5 rounded text-[10px] text-slate-600 font-mono font-medium border border-slate-200 w-full text-center">
                          {f.math}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AnalysisToolbar;
