import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Trash2, ChevronRight, AlertTriangle, Info } from 'lucide-react';
import { formatPrice, normalizeUnitSymbol } from '../../utils/helpers';
import { COMPANY_STYLES } from '../../utils/analysisConstants';

// --- SOUS-COMPOSANT : Cellule de Prix ---
const PriceCell = ({ value, onChange, style, isAnomaly, threshold }) => {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) inputRef.current.focus();
  }, [isEditing]);

  let cellClass = style.bg;
  if (isAnomaly) {
    cellClass = "bg-amber-100 text-amber-900 border-amber-300 font-bold ring-1 ring-inset ring-amber-300";
  } else if (style.isHeatmap) {
    cellClass = style.bg; 
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setIsEditing(false)}
        onKeyDown={(e) => { if (e.key === 'Enter') setIsEditing(false); }}
        className="w-full bg-white border border-blue-400 rounded px-1 text-right text-[11px] font-bold text-slate-800 outline-none p-0 tabular-nums tracking-tight shadow-md z-50 relative"
        placeholder="0.00"
      />
    );
  }

  return (
    <div 
      onClick={() => setIsEditing(true)}
      className={`w-full h-full min-h-[18px] flex items-center justify-end cursor-text group/cell rounded-sm px-1 transition-all relative ${cellClass}`}
      title={isAnomaly ? `Suspecté Anormalement Bas (< ${formatPrice(threshold)})` : "Cliquer pour modifier"}
    >
      {isAnomaly && <AlertTriangle size={10} className="text-amber-600 absolute left-0.5" />}
      <span className={`text-[11px] tabular-nums tracking-tight ${isAnomaly ? 'font-black' : 'font-medium'} ${!value ? 'text-slate-300 font-normal' : ''}`}>
        {value ? formatPrice(value) : '-'}
      </span>
    </div>
  );
};

// --- ALGORITHME OAB (Double Moyenne) ---
const calculateOABThreshold = (values) => {
  const validValues = values.filter(v => v > 0);
  if (validValues.length === 0) return 0;
  
  const M1 = validValues.reduce((a, b) => a + b, 0) / validValues.length;
  const upperLimit = M1 * 1.20;
  const filteredValues = validValues.filter(v => v <= upperLimit);
  
  if (filteredValues.length === 0) return M1 * 0.90;
  
  const M2 = filteredValues.reduce((a, b) => a + b, 0) / filteredValues.length;
  return M2 * 0.90;
};

// --- ALGORITHME HEATMAP ---
const getHeatmapColor = (value, reference) => {
  if (!value || !reference) return '';
  const delta = (value - reference) / reference;
  if (delta > 0.50) return 'bg-red-400 text-white';
  if (delta > 0.25) return 'bg-red-300 text-slate-900';
  if (delta > 0.10) return 'bg-red-200 text-slate-900';
  if (delta > 0.00) return 'bg-red-100 text-slate-900';
  if (delta < -0.50) return 'bg-emerald-400 text-white';
  if (delta < -0.25) return 'bg-emerald-300 text-slate-900';
  if (delta < -0.10) return 'bg-emerald-200 text-slate-900';
  if (delta < -0.00) return 'bg-emerald-100 text-slate-900';
  return 'bg-slate-50 text-slate-600';
};

const AnalysisTable = ({
  chaptersData, companies, stats, updateCompanyOffer, renameCompany, removeCompany, activeTrancheId, project, bpuConfig, scoringConfig,
  analysisMode, averagesHorsOAB = {}
}) => {

  const COMPANY_STYLES = [
    { name: 'Blue',    header: 'bg-blue-900',    subHeader: 'bg-blue-800',    bg: 'bg-blue-50/30',    border: 'border-blue-100', input: 'focus:ring-blue-500' },
    { name: 'Emerald', header: 'bg-emerald-900', subHeader: 'bg-emerald-800', bg: 'bg-emerald-50/30', border: 'border-emerald-100', input: 'focus:ring-emerald-500' },
    { name: 'Amber',   header: 'bg-amber-700',   subHeader: 'bg-amber-600',   bg: 'bg-amber-50/30',   border: 'border-amber-100', input: 'focus:ring-amber-500' },
    { name: 'Purple',  header: 'bg-purple-900',  subHeader: 'bg-purple-800',  bg: 'bg-purple-50/30',  border: 'border-purple-100', input: 'focus:ring-purple-500' },
    { name: 'Rose',    header: 'bg-rose-900',    subHeader: 'bg-rose-800',    bg: 'bg-rose-50/30',    border: 'border-rose-100', input: 'focus:ring-rose-500' },
    { name: 'Cyan',    header: 'bg-cyan-900',    subHeader: 'bg-cyan-800',    bg: 'bg-cyan-50/30',    border: 'border-cyan-100', input: 'focus:ring-cyan-500' },
  ];

  const COL_WIDTHS = {
    DESIGNATION: '260px', UNIT: '35px', QTY: '55px', EST_PU: '85px', EST_TOTAL: '95px', PU: '85px', TOTAL: '95px', PERCENT: '45px'
  };

  const refMap = useMemo(() => {
    const map = new Map();
    let counter = 1;
    const traverse = (nodes) => {
      nodes.forEach((node) => {
        if (node.type === "item") {
          let refLabel = (bpuConfig?.numberingMode === "manual" && node.bpuNum) ? String(node.bpuNum).trim() : `P.${counter++}`;
          map.set(node.id, refLabel);
        }
        if (node.children) traverse(node.children);
      });
    };
    traverse(project?.chapters || []);
    return map;
  }, [project, bpuConfig]);

  const renderDelta = (current, reference) => {
    if (!reference || reference === 0 || !current || current === 0) return <span className="text-slate-300">-</span>;
    const delta = ((current - reference) / reference) * 100;
    const isOver = delta > 0;
    if (Math.abs(delta) < 0.1) return <span className="text-slate-300">=</span>;
    return (
      <div className={`font-black text-[9px] ${isOver ? 'text-red-600' : 'text-emerald-600'}`}>
        {isOver ? '+' : ''}{delta.toFixed(0)}%
      </div>
    );
  };

  // --- CALCULS GLOBAUX POUR LE PIED DE PAGE ---
  const totalsList = companies.map(c => stats.companiesTotals[c.id] || 0).filter(t => t > 0);
  const Pmin = totalsList.length > 0 ? Math.min(...totalsList) : 0;
  const Pmoy = totalsList.length > 0 ? totalsList.reduce((a,b)=>a+b,0)/totalsList.length : 0;

  // 2. Calcul du Seuil OAB GLOBAL (sur le total)
  const globalOABThreshold = useMemo(() => calculateOABThreshold(totalsList), [totalsList]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      <div className="overflow-auto flex-1">
        <table className="border-collapse text-left table-fixed w-full">
          <colgroup>
            <col style={{ width: COL_WIDTHS.DESIGNATION, minWidth: COL_WIDTHS.DESIGNATION }} />
            <col style={{ width: COL_WIDTHS.UNIT, minWidth: COL_WIDTHS.UNIT }} />
            <col style={{ width: COL_WIDTHS.QTY, minWidth: COL_WIDTHS.QTY }} />
            <col style={{ width: COL_WIDTHS.EST_PU, minWidth: COL_WIDTHS.EST_PU }} />
            <col style={{ width: COL_WIDTHS.EST_TOTAL, minWidth: COL_WIDTHS.EST_TOTAL }} />
            {companies.map(company => (
              <React.Fragment key={`col-group-${company.id}`}>
                <col style={{ width: COL_WIDTHS.PU, minWidth: COL_WIDTHS.PU }} />
                <col style={{ width: COL_WIDTHS.TOTAL, minWidth: COL_WIDTHS.TOTAL }} />
                <col style={{ width: COL_WIDTHS.PERCENT, minWidth: COL_WIDTHS.PERCENT }} />
              </React.Fragment>
            ))}
          </colgroup>

          <thead className="sticky top-0 z-20 shadow-md">
            <tr className="bg-slate-900 text-white">
              <th className="px-2 py-1 text-[11px] font-bold uppercase border-r border-slate-700 align-middle tracking-tight" rowSpan={2}>Désignation</th>
              <th className="px-1 py-1 text-[10px] font-bold uppercase border-r border-slate-700 text-center align-middle" rowSpan={2}>U</th>
              <th className="px-1 py-1 text-[10px] font-bold uppercase border-r border-slate-700 text-center align-middle" rowSpan={2}>Qté</th>
              <th className="px-1 py-1 text-[10px] font-bold uppercase border-r border-slate-700 bg-slate-800 text-center align-middle" colSpan={2}>Estimation</th>
              {companies.map((company, index) => {
                const style = COMPANY_STYLES[index % COMPANY_STYLES.length];
                return (
                  <th key={company.id} colSpan={3} className={`px-1 py-1 border-r border-slate-700 ${style.header} relative group align-middle`}>
                    <div className="flex items-center justify-between gap-1">
                      <input value={company.name} onChange={(e) => renameCompany(company.id, e.target.value)} className="bg-transparent border-none focus:ring-1 ring-white/30 rounded px-1 text-white text-[10px] font-bold uppercase outline-none text-center w-full truncate" />
                      <button onClick={() => removeCompany(company.id)} className="text-red-300 hover:text-red-100 opacity-0 group-hover:opacity-100 transition-opacity absolute right-1 top-1"><Trash2 size={10} /></button>
                    </div>
                  </th>
                );
              })}
            </tr>
            <tr className="bg-slate-800 text-slate-300 border-b border-slate-600">
              <th className="py-1 px-1 text-[9px] font-semibold border-r border-slate-700 text-center uppercase text-slate-400">P.U.</th>
              <th className="py-1 px-1 text-[9px] font-semibold border-r border-slate-700 text-center uppercase text-white bg-slate-700/50">Total</th>
              {companies.map((company, index) => {
                const style = COMPANY_STYLES[index % COMPANY_STYLES.length];
                return (
                  <React.Fragment key={`sub-header-${company.id}`}>
                    <th className={`py-1 px-1 text-[9px] font-semibold border-r border-slate-700 text-center uppercase text-white/70 ${style.subHeader}`}>P.U.</th>
                    <th className={`py-1 px-1 text-[9px] font-semibold border-r border-slate-700 text-center uppercase text-white ${style.subHeader} brightness-110`}>Total</th>
                    <th className={`py-1 px-1 text-[9px] font-semibold border-r border-slate-700 text-center uppercase text-white/70 ${style.subHeader}`}>%</th>
                  </React.Fragment>
                );
              })}
            </tr>
          </thead>
          
          <tbody className="bg-white divide-y divide-slate-100">
            {chaptersData.map((chapter) => {
              const chapEstTotal = chapter.items.reduce((acc, item) => acc + (item.activeQty * item.price), 0);
              
              const chapterTotals = companies.map(c => 
                chapter.items.reduce((acc, i) => acc + (i.activeQty * (c.offers[i.id] || 0)), 0)
              );
              const chapterOABThreshold = (analysisMode === 'oab') ? calculateOABThreshold(chapterTotals) : 0;

              return (
                <React.Fragment key={chapter.id}>
                  <tr className="bg-slate-50 border-y border-slate-200">
                    <td colSpan={5 + (companies.length * 3)} className="px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <ChevronRight size={14} className="text-slate-500" />
                        <span className="text-[11px] font-bold uppercase text-slate-800 truncate">{chapter.title}</span>
                      </div>
                    </td>
                  </tr>

                  {chapter.items.map((item) => {
                    const itemPrices = companies.map(c => c.offers[item.id] || 0);
                    const itemThreshold = (analysisMode === 'oab') ? calculateOABThreshold(itemPrices) : 0;

                    return (
                      <tr key={item.id} className="hover:bg-slate-100 transition-colors group">
                        <td className="px-2 py-1 border-r border-slate-100 align-middle">
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1 rounded border border-slate-200 shrink-0 tabular-nums">{refMap.get(item.id)}</span>
                            <span className="text-[11px] font-semibold text-slate-700 uppercase truncate" title={item.designation}>{item.designation}</span>
                          </div>
                        </td>
                        <td className="px-1 py-1 text-center border-r border-slate-100 text-[10px] font-semibold text-slate-500">{normalizeUnitSymbol(item.unit)}</td>
                        <td className="px-1 py-1 text-center border-r border-slate-100 text-[11px] font-medium text-slate-800 bg-slate-50/50 tabular-nums">{item.activeQty}</td>
                        <td className="px-1 py-1 text-right border-r border-slate-100 align-middle">
                          <div className="text-[11px] text-slate-500 tabular-nums tracking-tight font-medium">{formatPrice(item.price)}</div>
                          {averagesHorsOAB[item.id] && (
                            <div className="text-[9px] font-bold text-violet-600 tabular-nums mt-0.5" title={`Moyenne hors OAB (${averagesHorsOAB[item.id].count}/${averagesHorsOAB[item.id].total} offres)`}>
                              ⌀ {formatPrice(averagesHorsOAB[item.id].avg)}
                            </div>
                          )}
                        </td>
                        <td className="px-1 py-1 text-right border-r border-slate-200 text-[11px] font-bold text-slate-700 bg-slate-50/50 tabular-nums tracking-tight">{formatPrice(item.price * item.activeQty)}</td>
                        
                        {companies.map((company, index) => {
                          const style = COMPANY_STYLES[index % COMPANY_STYLES.length];
                          const pu = company.offers[item.id] || 0;
                          const lineTotal = item.activeQty * pu;
                          const lineEst = item.activeQty * item.price;
                          
                          let cellBg = style.bg;
                          let isOAB = false;

                          if (analysisMode === 'heatmap' && pu > 0) {
                            cellBg = getHeatmapColor(pu, item.price);
                            style.isHeatmap = true;
                          } else if (analysisMode === 'oab' && pu > 0) {
                            isOAB = pu < itemThreshold;
                          }

                          return (
                            <React.Fragment key={`${company.id}-${item.id}`}>
                              <td className={`px-0.5 py-1 border-r ${style.border} ${isOAB ? '' : cellBg} transition-colors duration-300`}>
                                <PriceCell 
                                  value={company.offers[item.id]} 
                                  onChange={(val) => updateCompanyOffer(company.id, item.id, val)}
                                  style={{...style, bg: cellBg}}
                                  isAnomaly={isOAB}
                                  threshold={itemThreshold}
                                />
                              </td>
                              <td className={`px-1 py-1 text-right border-r ${style.border} ${isOAB ? 'bg-amber-100 text-amber-900 font-black' : cellBg + ' font-bold text-slate-700'} text-[11px] tabular-nums tracking-tight transition-colors duration-300`}>
                                {lineTotal !== 0 ? formatPrice(lineTotal) : <span className="text-slate-400">-</span>}
                              </td>
                              <td className={`px-0.5 py-1 text-center border-r border-slate-200 ${cellBg} transition-colors duration-300`}>
                                {renderDelta(lineTotal, lineEst)}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    );
                  })}
                  
                  <tr className="bg-slate-100 border-t border-slate-200 border-b">
                    <td colSpan={4} className="px-2 py-1 text-right text-[10px] font-bold uppercase text-slate-500 tracking-tight border-r border-slate-200">Total {chapter.title}</td>
                    <td className="px-1 py-1 text-right border-r border-slate-200 text-[11px] font-black text-slate-700 bg-slate-200/50 tabular-nums">{formatPrice(chapEstTotal)}</td>
                    {companies.map((company, index) => {
                      const style = COMPANY_STYLES[index % COMPANY_STYLES.length];
                      const chapCompTotal = chapter.items.reduce((acc, item) => acc + (item.activeQty * (company.offers[item.id] || 0)), 0);
                      
                      let cellBg = style.bg;
                      let isChapOAB = false;

                      if (analysisMode === 'heatmap' && chapCompTotal > 0) {
                        cellBg = getHeatmapColor(chapCompTotal, chapEstTotal);
                      } else if (analysisMode === 'oab' && chapCompTotal > 0) {
                         isChapOAB = chapCompTotal < chapterOABThreshold;
                      }

                      return (
                        <React.Fragment key={`total-chap-${company.id}`}>
                          <td className={`border-r ${style.border} ${isChapOAB ? 'bg-amber-100' : cellBg}`}></td>
                          <td className={`px-1 py-1 text-right border-r ${style.border} text-[11px] tabular-nums ${isChapOAB ? 'bg-amber-100 text-amber-900 font-black ring-1 ring-inset ring-amber-300' : `${cellBg} font-black text-slate-800`}`}>
                            <div className="flex items-center justify-end gap-1">
                              {isChapOAB && <AlertTriangle size={10} className="text-amber-600" />}
                              {formatPrice(chapCompTotal)}
                            </div>
                          </td>
                          <td className={`px-0.5 py-1 text-center border-r border-slate-300 ${cellBg}`}>
                            {renderDelta(chapCompTotal, chapEstTotal)}
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>

          {/* --- PIED DE TABLEAU --- */}
          <tfoot className="sticky bottom-0 z-20 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.15)]">
            <tr className="bg-slate-900 text-white">
              <td colSpan={4} className="px-2 py-2 text-right text-[11px] font-black uppercase border-r border-slate-700">
                <div className="flex items-center justify-end gap-2">
                  <span>Total Général HT</span>
                  {/* AFFICHAGE DU SEUIL OAB GLOBAL */}
                  {analysisMode === 'oab' && globalOABThreshold > 0 && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/50 rounded text-[9px] text-amber-300 lowercase font-mono">
                      <Info size={10} />
                      seuil oab: {formatPrice(globalOABThreshold)}
                    </div>
                  )}
                </div>
              </td>
              <td className="px-1 py-2 text-right border-r border-slate-700 text-xs font-black bg-slate-800 text-white tabular-nums">{formatPrice(stats.totalEstimation)}</td>
              {companies.map((company, index) => {
                const total = stats.companiesTotals[company.id] || 0;
                const style = COMPANY_STYLES[index % COMPANY_STYLES.length];
                
                const isGlobalOAB = (analysisMode === 'oab') && total > 0 && total < globalOABThreshold;

                return (
                  <React.Fragment key={`footer-${company.id}`}>
                    <td className={`border-r border-slate-800 ${style.header} opacity-80`}></td>
                    <td className={`px-1 py-2 text-right border-r border-slate-800 text-xs tabular-nums ${style.header} ${isGlobalOAB ? 'bg-amber-500 text-white font-black ring-2 ring-inset ring-amber-300 shadow-[inset_0_0_10px_rgba(0,0,0,0.3)]' : 'font-black text-white'}`}>
                       <div className="flex items-center justify-end gap-1">
                          {isGlobalOAB && <AlertTriangle size={12} className="text-white animate-pulse" />}
                          {formatPrice(total)}
                        </div>
                    </td>
                    <td className={`px-0.5 py-2 text-center border-r border-slate-800 bg-slate-900`}>{renderDelta(total, stats.totalEstimation)}</td>
                  </React.Fragment>
                );
              })}
            </tr>

            <tr className="bg-amber-100 text-amber-900 border-t-2 border-slate-900">
              <td colSpan={4} className="px-2 py-2 text-right border-r border-amber-200">
                <div className="flex flex-col items-end">
                  <span className="text-[11px] font-black uppercase tracking-tight">Note Prix / {scoringConfig?.maxScore || 40}</span>
                  <div className="flex items-center gap-2 text-[9px] font-mono text-amber-700 mt-0.5 opacity-80">
                     <span title="Offre la moins disante">p-min: <b>{formatPrice(Pmin)}</b></span>
                     <span className="opacity-30">|</span>
                     <span title="Moyenne des offres">moy: <b>{formatPrice(Pmoy)}</b></span>
                  </div>
                </div>
              </td>
              <td className="px-1 py-2 bg-amber-200 border-r border-amber-300"></td>
              
              {companies.map((company) => {
                const score = stats.companyScores ? stats.companyScores[company.id] : 0;
                const total = stats.companiesTotals[company.id] || 0;
                const tooltipText = `Formule: ${scoringConfig.mode.toUpperCase()}\nP (Offre): ${formatPrice(total)}\nPmin (Bas): ${formatPrice(Pmin)}\nMoyenne: ${formatPrice(Pmoy)}\nNote Max: ${scoringConfig.maxScore}`;

                return (
                  <React.Fragment key={`score-${company.id}`}>
                    <td colSpan={3} className="px-1 py-2 text-center border-r border-amber-200 text-sm font-black text-amber-900 tabular-nums relative group cursor-help transition-colors hover:bg-amber-200">
                      {score ? score.toFixed(2) : '0.00'}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 text-white text-[10px] rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl whitespace-pre-line font-normal text-left border border-slate-600">
                        <div className="font-bold border-b border-slate-600 pb-1 mb-1 text-center text-amber-400">Détail du calcul</div>
                        {tooltipText}
                      </div>
                    </td>
                  </React.Fragment>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default AnalysisTable;