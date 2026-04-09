// src/components/analysis/OabDetailModal.jsx
import React from 'react';
import { AlertTriangle, X, CheckCircle2, ArrowDown, TrendingDown } from 'lucide-react';
import { formatPrice } from '../../utils/helpers';

const OabDetailModal = ({ companies, companiesTotals, targetCompanyId, onClose }) => {
  if (!targetCompanyId) return null;

  const targetCompany = companies.find(c => c.id === targetCompanyId);
  if (!targetCompany) return null;

  const targetTotal = companiesTotals[targetCompanyId] || 0;

  // ── Algorithme Double Moyenne (identique à calculateOABThreshold) ──
  const allTotals = companies.map(c => ({ id: c.id, name: c.name, total: companiesTotals[c.id] || 0 }));
  const validTotals = allTotals.filter(c => c.total > 0).sort((a, b) => a.total - b.total);

  const values = validTotals.map(c => c.total);
  const M1 = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const plafond = M1 * 1.20;
  const filtered = values.filter(v => v <= plafond);
  const excluded = validTotals.filter(c => c.total > plafond);
  const M2 = filtered.length > 0 ? filtered.reduce((a, b) => a + b, 0) / filtered.length : M1;
  const seuil = (filtered.length > 0 ? M2 : M1) * 0.90;
  const isOAB = targetTotal > 0 && targetTotal < seuil;

  // Barre visuelle : min et max pour positionner
  const allValues = [...values, seuil];
  const minVal = Math.min(...allValues) * 0.95;
  const maxVal = Math.max(...allValues) * 1.02;
  const range = maxVal - minVal || 1;
  const pos = (v) => Math.max(0, Math.min(100, ((v - minVal) / range) * 100));

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-amber-500 p-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <AlertTriangle size={22} />
            <div>
              <h2 className="font-black uppercase tracking-widest text-sm">Analyse OAB</h2>
              <p className="text-amber-100 text-xs font-medium mt-0.5">{targetCompany.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-amber-600 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Étape 1 : M1 */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-slate-700 text-white text-[10px] font-black flex items-center justify-center">1</span>
              <span className="text-xs font-bold text-slate-700 uppercase">Moyenne des offres (M1)</span>
            </div>
            <div className="space-y-1 ml-7">
              {validTotals.map(c => (
                <div key={c.id} className={`flex justify-between text-[11px] ${c.id === targetCompanyId ? 'font-bold text-amber-700' : 'text-slate-600'}`}>
                  <span>{c.name} {c.id === targetCompanyId && '←'}</span>
                  <span className="tabular-nums">{formatPrice(c.total)}</span>
                </div>
              ))}
              <div className="border-t border-slate-300 mt-1.5 pt-1.5 flex justify-between text-xs font-black text-slate-800">
                <span>M1 = Σ / {values.length}</span>
                <span className="tabular-nums">{formatPrice(M1)}</span>
              </div>
            </div>
          </div>

          {/* Étape 2 : Filtrage */}
          <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">2</span>
              <span className="text-xs font-bold text-blue-700 uppercase">Filtrage (plafond = M1 x 1.20)</span>
            </div>
            <div className="ml-7 space-y-1">
              <div className="text-[11px] text-blue-600">
                Plafond = {formatPrice(M1)} x 1.20 = <b>{formatPrice(plafond)}</b>
              </div>
              {excluded.length > 0 ? (
                <div className="text-[11px] text-red-500 mt-1">
                  {excluded.map(c => c.name).join(', ')} exclu{excluded.length > 1 ? 's' : ''} (total &gt; plafond)
                </div>
              ) : (
                <div className="text-[11px] text-emerald-600 mt-1">Aucune offre exclue</div>
              )}
              <div className="text-[11px] text-blue-600">
                {filtered.length} offre{filtered.length > 1 ? 's' : ''} retenue{filtered.length > 1 ? 's' : ''} pour M2
              </div>
            </div>
          </div>

          {/* Étape 3 : M2 */}
          <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center">3</span>
              <span className="text-xs font-bold text-indigo-700 uppercase">Moyenne filtrée (M2)</span>
            </div>
            <div className="ml-7">
              <div className="flex justify-between text-xs font-black text-indigo-800">
                <span>M2 = Σ filtrées / {filtered.length}</span>
                <span className="tabular-nums">{formatPrice(M2)}</span>
              </div>
            </div>
          </div>

          {/* Étape 4 : Seuil */}
          <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center">4</span>
              <span className="text-xs font-bold text-amber-700 uppercase">Seuil OAB = M2 x 0.90</span>
            </div>
            <div className="ml-7">
              <div className="flex justify-between text-xs font-black text-amber-800">
                <span>Seuil = {formatPrice(M2)} x 0.90</span>
                <span className="tabular-nums">{formatPrice(seuil)}</span>
              </div>
            </div>
          </div>

          {/* Barre visuelle */}
          <div className="bg-slate-100 rounded-xl p-3 border border-slate-200">
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-3">Positionnement des offres</div>
            <div className="relative h-8 bg-slate-200 rounded-full overflow-hidden">
              {/* Zone OAB */}
              <div className="absolute left-0 top-0 bottom-0 bg-amber-200/60 rounded-l-full" style={{ width: `${pos(seuil)}%` }} />
              {/* Ligne seuil */}
              <div className="absolute top-0 bottom-0 w-0.5 bg-amber-500 z-10" style={{ left: `${pos(seuil)}%` }}>
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-amber-600 whitespace-nowrap">
                  Seuil OAB
                </div>
              </div>
              {/* Points entreprises */}
              {validTotals.map(c => {
                const isTarget = c.id === targetCompanyId;
                const isBelowSeuil = c.total < seuil;
                return (
                  <div
                    key={c.id}
                    className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 z-20 ${
                      isTarget
                        ? isBelowSeuil ? 'bg-amber-500 border-amber-700 ring-2 ring-amber-300' : 'bg-emerald-500 border-emerald-700 ring-2 ring-emerald-300'
                        : isBelowSeuil ? 'bg-amber-300 border-amber-500' : 'bg-slate-400 border-slate-500'
                    }`}
                    style={{ left: `calc(${pos(c.total)}% - 6px)` }}
                    title={`${c.name}: ${formatPrice(c.total)}`}
                  />
                );
              })}
            </div>
            {/* Légende */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
              {validTotals.map(c => (
                <div key={c.id} className={`text-[9px] flex items-center gap-1 ${c.id === targetCompanyId ? 'font-bold' : 'text-slate-500'}`}>
                  <div className={`w-2 h-2 rounded-full ${
                    c.id === targetCompanyId
                      ? c.total < seuil ? 'bg-amber-500' : 'bg-emerald-500'
                      : c.total < seuil ? 'bg-amber-300' : 'bg-slate-400'
                  }`} />
                  {c.name}
                </div>
              ))}
            </div>
          </div>

          {/* Verdict */}
          <div className={`rounded-xl p-4 border-2 ${isOAB ? 'bg-amber-50 border-amber-400' : 'bg-emerald-50 border-emerald-400'}`}>
            <div className="flex items-center gap-3">
              {isOAB ? (
                <TrendingDown size={28} className="text-amber-600 shrink-0" />
              ) : (
                <CheckCircle2 size={28} className="text-emerald-600 shrink-0" />
              )}
              <div>
                <div className={`text-sm font-black ${isOAB ? 'text-amber-800' : 'text-emerald-800'}`}>
                  {isOAB ? 'OFFRE ANORMALEMENT BASSE' : 'OFFRE DANS LA NORME'}
                </div>
                <div className={`text-xs mt-1 ${isOAB ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {targetCompany.name} : {formatPrice(targetTotal)} {isOAB ? '<' : '≥'} seuil {formatPrice(seuil)}
                  {isOAB && (
                    <span className="font-bold"> (−{formatPrice(seuil - targetTotal)} soit {((1 - targetTotal / seuil) * 100).toFixed(1)}% sous le seuil)</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-3 bg-slate-50 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default OabDetailModal;
