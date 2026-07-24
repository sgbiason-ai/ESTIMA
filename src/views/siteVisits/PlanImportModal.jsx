// src/views/siteVisits/PlanImportModal.jsx
// Modale d'import d'un plan PDF — choix des pages (miniatures basse résolution),
// nom éditable, puis rendu haute résolution + upload Storage page par page.
// Le module siteVisitPlanStorage est chargé paresseusement (il tire pdfjs).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Check, FileText } from 'lucide-react';

const THUMB_MAX_DIM = 300;   // miniatures de la grille de sélection
const EXPORT_MAX_DIM = 3000; // rendu final uploadé sur Storage

export default function PlanImportModal({ file, companyId, visitId, onClose, onImported }) {
  const [session, setSession] = useState(null);
  const [thumbs, setThumbs] = useState({});          // pageNum → { dataUrl, width, height }
  const [selected, setSelected] = useState(() => new Set());
  const baseName = useMemo(() => (file?.name || 'Plan').replace(/\.[^.]+$/, '') || 'Plan', [file]);
  const [name, setName] = useState(baseName);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);    // { done, total } pendant l'import
  const sessionRef = useRef(null);
  const importingRef = useRef(false);

  // Ouverture du PDF + rendu séquentiel des miniatures
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { openPdfForImport } = await import('../../utils/siteVisitPlanStorage');
        const s = await openPdfForImport(file);
        if (cancelled) { s.destroy?.(); return; }
        sessionRef.current = s;
        setSession(s);
        if (s.pageCount === 1) setSelected(new Set([1]));
        setLoading(false);
        for (let p = 1; p <= s.pageCount; p++) {
          if (cancelled) return;
          try {
            const thumb = await s.renderPage(p, THUMB_MAX_DIM);
            if (cancelled) return;
            setThumbs(prev => ({ ...prev, [p]: thumb }));
          } catch {
            // Page illisible → la vignette reste en attente, la page demeure sélectionnable
          }
        }
      } catch (err) {
        console.error('[Plans] Ouverture du PDF échouée:', err);
        if (!cancelled) { setError('Impossible de lire ce PDF.'); setLoading(false); }
      }
    })();
    return () => {
      cancelled = true;
      sessionRef.current?.destroy?.();
      sessionRef.current = null;
    };
  }, [file]);

  const pageCount = session?.pageCount || 0;

  const togglePage = (p) => {
    if (progress) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  };

  const handleImport = async () => {
    const s = sessionRef.current;
    if (!s || selected.size === 0 || importingRef.current) return;
    importingRef.current = true;
    setError(null);
    const pages = [...selected].sort((a, b) => a - b);
    const finalName = name.trim() || baseName;
    setProgress({ done: 0, total: pages.length });
    const plans = [];
    // Import page par page, tolérant à l'échec : une page qui ne se rend pas en
    // haute résolution (canvas trop grand sur tablette, page corrompue) ne doit
    // pas faire perdre les pages déjà abouties ni les laisser orphelines sur Storage.
    try {
      const { uploadPlanImage } = await import('../../utils/siteVisitPlanStorage');
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        try {
          const { dataUrl, width, height } = await s.renderPage(p, EXPORT_MAX_DIM);
          const plan = await uploadPlanImage({
            dataUrl, width, height,
            name: pages.length > 1 ? `${finalName} – p.${p}` : finalName,
            page: p,
            companyId,
            visitId,
          });
          plans.push(plan);
        } catch (err) {
          console.error(`[Plans] Import de la page ${p} échoué:`, err);
        }
        setProgress({ done: i + 1, total: pages.length });
      }
    } catch (err) {
      // Échec inattendu (chargement du module) : les pages déjà abouties sont
      // tout de même committées ci-dessous, les autres restent à réessayer.
      console.error('[Plans] Import du PDF échoué:', err);
    }
    // Committer immédiatement les pages réussies → jamais orphelines sur Storage.
    if (plans.length) onImported(plans);
    if (plans.length === pages.length) {
      onClose(); // toutes les pages abouties → le démontage détruit la session PDF
      return;
    }
    // Échec partiel ou total : on garde la modale ouverte et on ne re-cible que
    // les pages en échec (les réussies sont déjà enregistrées dans la visite).
    const notDone = pages.filter(p => !plans.some(pl => pl.page === p));
    setProgress(null);
    importingRef.current = false;
    setSelected(new Set(notDone));
    setError(
      plans.length
        ? `${plans.length} page${plans.length > 1 ? 's' : ''} importée${plans.length > 1 ? 's' : ''}. Échec sur ${notDone.length} page${notDone.length > 1 ? 's' : ''} (${notDone.join(', ')}) — réessayez.`
        : "L'import a échoué. Vérifiez la connexion puis réessayez."
    );
  };

  const requestClose = () => { if (!progress) onClose(); };

  const inputCls = "w-full px-3 py-2.5 text-sm border border-gray-200/60 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400";

  return (
    <div className="fixed inset-0 bg-black/60 z-modal flex items-center justify-center p-3" onMouseDown={requestClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[560px] max-w-full max-h-[90vh] flex flex-col" onMouseDown={(e) => e.stopPropagation()}>

        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-blue-50 shrink-0"><FileText size={18} className="text-blue-600" /></div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-gray-900">Importer un plan PDF</h3>
              <p className="text-[11px] text-gray-400 truncate">
                {file?.name}{pageCount > 0 ? ` — ${pageCount} page${pageCount > 1 ? 's' : ''}` : ''}
              </p>
            </div>
          </div>
          <button onClick={requestClose} disabled={!!progress}
            className="p-1.5 hover:bg-gray-100 rounded-xl transition disabled:opacity-40">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <p className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <span className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-[12px] text-gray-500">Lecture du PDF…</p>
            </div>
          ) : pageCount > 0 && (
            <>
              <div>
                <label className="block text-[11px] text-gray-500 font-medium mb-1.5">Nom du plan</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du plan"
                  disabled={!!progress} className={inputCls} />
                {selected.size > 1 && (
                  <p className="text-[10px] text-gray-400 mt-1">« – p.N » sera ajouté au nom de chaque page importée.</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] text-gray-500 font-medium mb-1.5">
                  Pages à importer — touchez pour sélectionner
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Array.from({ length: pageCount }, (_, i) => i + 1).map(p => {
                    const thumb = thumbs[p];
                    const sel = selected.has(p);
                    return (
                      <button key={p} type="button" onClick={() => togglePage(p)}
                        className={`relative rounded-xl border overflow-hidden transition active:scale-[0.98] ${
                          sel ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200/60 hover:border-gray-300'
                        }`}>
                        <div className="aspect-[3/4] bg-gray-50 flex items-center justify-center">
                          {thumb ? (
                            <img src={thumb.dataUrl} alt={`Page ${p}`} className="max-w-full max-h-full object-contain" />
                          ) : (
                            <span className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                          )}
                        </div>
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-gray-900/70 text-white text-[10px] font-bold">
                          p.{p}
                        </span>
                        {sel && (
                          <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-blue-600 border-2 border-white shadow flex items-center justify-center">
                            <Check size={13} className="text-white" strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Pied — actions ou progression */}
        <div className="px-6 py-4 border-t border-gray-200/60 shrink-0">
          {progress ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-blue-600">
                <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                Import de la page {Math.min(progress.done + 1, progress.total)}/{progress.total}…
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-500 rounded-xl hover:bg-gray-100 transition">
                Annuler
              </button>
              <button onClick={handleImport} disabled={selected.size === 0 || loading}
                className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed">
                Importer {selected.size || ''} page{selected.size > 1 ? 's' : ''}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
