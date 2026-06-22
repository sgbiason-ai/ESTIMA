// src/views/estimaTp/RecapTab.jsx
// ESTIMA TP — onglet « Récap » : DQE chiffré (lecture seule) + totaux par poste.
import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { refMapOf } from './bordereau/tpBordereauModel';
import { computeDetail, defaultCoefficients, POSTES, POSTE_LABELS } from '../../utils/tp/tpPriceCompute';
import { fmt, fmt2 } from './sousDetail/sdFormat';
import { useToast } from '../../contexts/ToastContext';

export default function RecapTab({ study }) {
  const toast = useToast();
  const [exporting, setExporting] = useState(null); // 'excel' | 'pdf' | null
  const chapters = useMemo(() => study?.cadre?.chapters || [], [study?.cadre?.chapters]);

  const handleExport = async (kind) => {
    if (exporting) return;
    setExporting(kind);
    try {
      if (kind === 'excel') {
        const { generateTpExcel } = await import('../../utils/tp/tpExcelExport');
        await generateTpExcel(study);
      } else {
        const { generateTpPdf } = await import('../../utils/tp/tpPdfExport');
        await generateTpPdf(study);
      }
    } catch (e) {
      console.error('[ESTIMA TP] Export échoué:', e);
      toast.error('Export impossible. Réessayez.');
    } finally {
      setExporting(null);
    }
  };
  const coef = study?.coefficients || defaultCoefficients();

  const { rows, totals } = useMemo(() => {
    const refMap = refMapOf(chapters);
    const rows = [];
    const totals = { deboursec: 0, vente: 0, sec: { materiel: 0, mo: 0, fourniture: 0, soustraitance: 0, transport: 0 } };
    const walk = (arr) => (arr || []).forEach(n => {
      if (!n) return;
      if (n.type === 'item') {
        const qte = Number(n.qty || 0);
        const r = computeDetail(n.detail, qte, coef, n.unit);
        rows.push({ id: n.id, num: refMap.get(n.id) || '—', designation: n.designation, unit: n.unit, qte, ...r });
        totals.deboursec += r.deboursecSec;
        totals.vente += r.totalVente;
        POSTES.forEach(p => { totals.sec[p] += r.sec[p]; });
      }
      if (n.children) walk(n.children);
    });
    walk(chapters);
    return { rows, totals };
  }, [chapters, coef]);

  const marge = totals.deboursec > 0 ? ((totals.vente - totals.deboursec) / totals.deboursec) * 100 : 0;

  if (rows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-slate-400 bg-[#f5f5f7]">
        Aucun article — créez le bordereau puis chiffrez les sous-détails.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 bg-[#f5f5f7]">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* Exports */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-bold text-slate-900">Récapitulatif chiffré</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => handleExport('excel')} disabled={!!exporting}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-50">
              {exporting === 'excel' ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />} Excel
            </button>
            <button onClick={() => handleExport('pdf')} disabled={!!exporting}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-all shadow-sm disabled:opacity-50">
              {exporting === 'pdf' ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} PDF
            </button>
          </div>
        </div>

        {/* Synthèse */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card label="Déboursé sec total" value={fmt(totals.deboursec)} tone="slate" />
          <Card label="Total vente HT" value={fmt(totals.vente)} tone="orange" />
          <Card label="Marge" value={`${marge >= 0 ? '+' : ''}${marge.toFixed(1)} %`} tone="emerald" />
          <Card label="Articles chiffrés" value={String(rows.length)} tone="slate" />
        </div>

        {/* Répartition déboursé par poste */}
        <div className="flex flex-wrap gap-2">
          {POSTES.map(p => (
            <span key={p} className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-medium text-slate-600">
              {POSTE_LABELS[p]} : <span className="font-bold text-slate-900">{fmt(totals.sec[p])}</span>
            </span>
          ))}
        </div>

        {/* Tableau DQE chiffré */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">
          <div className="min-w-[820px]">
            <div className="grid grid-cols-[56px_1fr_70px_60px_90px_100px_90px_110px] gap-2 px-4 py-2 border-b border-slate-200 text-[9px] font-black uppercase tracking-wider text-slate-400">
              <span>N°</span><span>Désignation</span><span className="text-right">Qté</span><span className="text-center">U</span>
              <span className="text-right">PU sec</span><span className="text-right">Déboursé</span><span className="text-right">PU vente</span><span className="text-right">Total vente</span>
            </div>
            {rows.map(r => (
              <div key={r.id} className="grid grid-cols-[56px_1fr_70px_60px_90px_100px_90px_110px] gap-2 px-4 py-1.5 border-b border-slate-50 items-center hover:bg-slate-50/60">
                <span className="text-[10px] font-mono font-bold text-orange-600">{r.num}</span>
                <span className="text-xs font-semibold text-slate-800 truncate">{r.designation || '—'}</span>
                <span className="text-right text-xs font-mono text-slate-600">{r.qte.toLocaleString('fr-FR')}</span>
                <span className="text-center text-[10px] font-bold text-slate-500 uppercase">{r.unit}</span>
                <span className="text-right text-xs font-mono text-slate-600">{fmt2(r.puSec)}</span>
                <span className="text-right text-xs font-mono text-slate-600">{fmt(r.deboursecSec)}</span>
                <span className="text-right text-xs font-mono font-bold text-orange-700">{fmt2(r.puRetenu)}</span>
                <span className="text-right text-xs font-mono font-black text-slate-900">{fmt(r.totalVente)}</span>
              </div>
            ))}
            <div className="grid grid-cols-[56px_1fr_70px_60px_90px_100px_90px_110px] gap-2 px-4 py-2.5 bg-slate-900 text-white">
              <span /><span className="text-[11px] font-black uppercase tracking-widest">Total HT</span>
              <span /><span /><span />
              <span className="text-right text-xs font-mono">{fmt(totals.deboursec)}</span>
              <span />
              <span className="text-right text-sm font-mono font-black">{fmt(totals.vente)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'bg-white border-slate-200 text-slate-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">{label}</p>
      <p className="text-xl font-mono font-black leading-tight mt-0.5">{value}</p>
    </div>
  );
}
