// src/views/estimaTp/TpCadreTab.jsx
// ESTIMA TP — onglet « Cadre » : le bordereau reprend la forme du devis ESTIMA
// (chapitres / sous-chapitres imbriqués / articles, ƒ(x), glisser-déposer).
// Import du bordereau depuis un DPGF Excel (réutilise le parseur du RAO).
import React, { useRef, useState } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useDialog } from '../../contexts/DialogContext';
import TpBordereau from './bordereau/TpBordereau';

export default function TpCadreTab({ study, setStudy }) {
  const chapters = study?.cadre?.chapters || [];
  const toast = useToast();
  const { confirm } = useDialog();
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);

  const setChapters = (next) =>
    setStudy(prev => ({ ...prev, cadre: { ...(prev?.cadre || {}), chapters: next } }));

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = null;
    if (!file) return;
    if (chapters.length > 0) {
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
      setChapters(res.chapters);
      const s = res.stats || {};
      toast.success(`Bordereau importé : ${s.totalItems || 0} article(s)${s.sheets > 1 ? `, ${s.sheets} onglets` : ''}.`);
      (res.warnings || []).forEach(w => toast.warning(w));
    } catch (err) {
      console.error('[ESTIMA TP] Import DPGF échoué:', err);
      toast.error('Impossible de lire le fichier. Vérifiez le format Excel.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 bg-[#f5f5f7]">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* Infos générales + import */}
        <div className="bg-white border border-gray-200/60 rounded-2xl p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Nom de l'étude" value={study?.name || ''}
              onChange={v => setStudy(p => ({ ...p, name: v }))} placeholder="Ex : Aménagement RD820" />
            <Field label="Référence / N° AO" value={study?.reference || ''}
              onChange={v => setStudy(p => ({ ...p, reference: v }))} placeholder="Ex : 2026-AO-014" />
            <Field label="Maître d'ouvrage" value={study?.maitreOuvrage || ''}
              onChange={v => setStudy(p => ({ ...p, maitreOuvrage: v }))} placeholder="Ex : CD31" />
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-gray-400">Partez d'un DPGF Excel (cadre de l'appel d'offres) ou saisissez le bordereau à la main.</p>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-sm disabled:opacity-50"
            >
              {importing ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
              {importing ? 'Import…' : 'Importer un DPGF Excel'}
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
          </div>
        </div>

        {/* Bordereau (forme ESTIMA) */}
        <TpBordereau chapters={chapters} onChange={setChapters} />
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-100 border border-gray-200/60 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
      />
    </label>
  );
}
