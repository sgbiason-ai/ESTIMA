// src/components/modals/LinkedLibraryModal.jsx
//
// Modale proposée à l'ouverture d'un projet qui référence une bibliothèque locale différente
// de celle actuellement active. Permet de :
// 1. Charger la biblio liée (et sauvegarder l'actuelle en backup)
// 2. Garder la biblio actuelle (poursuivre l'ouverture sans bascule)
// 3. Importer un autre JSON

import React, { useRef } from 'react';
import { Library, FileText, ArrowRight, X, Upload, ShieldCheck, AlertTriangle, Cloud, PlayCircle } from 'lucide-react';

const formatDate = (iso) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return null; }
};

const LibraryCard = ({ icon: Icon, color, title, name, count, importedAt, badge }) => (
  <div className={`flex items-start gap-3 p-3 rounded-xl border bg-white ${color.border}`}>
    <div className={`shrink-0 p-2 rounded-lg ${color.iconBg}`}>
      <Icon size={16} className={color.iconText} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-0.5">
        <p className={`text-[10px] font-bold uppercase tracking-widest ${color.label}`}>{title}</p>
        {badge && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${color.badgeBg} ${color.badgeText}`}>{badge}</span>}
      </div>
      <p className="text-sm font-semibold text-gray-900 truncate">{name || 'Sans nom'}</p>
      <p className="text-[11px] text-gray-400 mt-0.5">
        {count != null ? `${count} prix` : 'aucun prix'}
        {importedAt && ` · importée le ${formatDate(importedAt)}`}
      </p>
    </div>
  </div>
);

const COLORS = {
  linked: {
    border: 'border-blue-200',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
    label: 'text-blue-700',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
  },
  current: {
    border: 'border-amber-200',
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-600',
    label: 'text-amber-700',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
  },
};

export default function LinkedLibraryModal({
  isOpen,
  projectName,
  linkedLibrary,
  currentLibrary,
  comparison,
  onLoadLinked,
  onUseCloudBase,
  onKeepCurrent,
  onImportOther,
  onClose,
}) {
  const fileInputRef = useRef(null);

  // La modale s'affiche dans 2 cas :
  // (a) linkedLibrary présent et différent de l'active → bouton "Charger biblio liée"
  // (b) comparaison projet ↔ biblio active a détecté des écarts → avertissement
  const hasLinked = !!(linkedLibrary && Array.isArray(linkedLibrary.bpu) && linkedLibrary.bpu.length > 0);
  const missCount = comparison?.missingIds?.length || 0;
  const divCount = comparison?.divergentPrices?.length || 0;
  const hasDiff = !!comparison?.hasDifferences;

  if (!isOpen || (!hasLinked && !hasDiff)) return null;

  const handleImportClick = () => fileInputRef.current?.click();
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fileName = file.name.replace(/\.json$/i, '');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target.result);
        const lib = Array.isArray(json) ? { bpu: json } : json;
        onImportOther?.(lib, { name: fileName });
      } catch {
        // Géré par l'appelant via toast — pas de feedback ici pour rester sobre
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" />
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`shrink-0 p-2 rounded-xl ${hasLinked ? 'bg-indigo-50' : 'bg-amber-50'}`}>
              {hasLinked ? <Library size={20} className="text-indigo-600" /> : <AlertTriangle size={20} className="text-amber-600" />}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 text-base leading-snug">
                {hasLinked ? 'Bibliothèque associée au projet' : 'Bibliothèque active différente du projet'}
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">
                « {projectName || 'Sans nom'} »
                {hasLinked
                  ? ' référence une bibliothèque différente de celle active.'
                  : ' référence des prix qui ne correspondent pas à la bibliothèque active.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors" title="Annuler">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {hasLinked && (
            <>
              <LibraryCard
                icon={FileText}
                color={COLORS.linked}
                title="Liée au projet"
                name={linkedLibrary.name}
                count={Array.isArray(linkedLibrary.bpu) ? linkedLibrary.bpu.length : null}
                importedAt={linkedLibrary.importedAt}
                badge="Recommandée"
              />
              <div className="flex items-center justify-center text-gray-300">
                <ArrowRight size={14} className="rotate-90" />
              </div>
            </>
          )}

          <LibraryCard
            icon={Library}
            color={COLORS.current}
            title="Active actuellement"
            name={currentLibrary?.name || 'Mode Cloud (aucune biblio locale)'}
            count={currentLibrary && Array.isArray(currentLibrary.bpu) ? currentLibrary.bpu.length : null}
            importedAt={currentLibrary?.importedAt}
            badge={currentLibrary?.isCloud ? 'Cloud' : (currentLibrary ? null : 'Cloud')}
          />

          {hasDiff && (
            <div className="px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200/60 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Écarts détectés</p>
                <span className="ml-auto text-[10px] text-amber-600/70">
                  {missCount > 0 && `${missCount} absent${missCount > 1 ? 's' : ''}`}
                  {missCount > 0 && divCount > 0 && ' · '}
                  {divCount > 0 && `${divCount} prix divergent${divCount > 1 ? 's' : ''}`}
                </span>
              </div>

              {/* Items absents — tableau */}
              {missCount > 0 && (
                <div className="bg-white/70 rounded-lg p-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-red-700 mb-1.5">
                    Absents de la base
                  </p>
                  <div className={`${currentLibrary?.isCloud ? 'max-h-56 overflow-y-auto' : ''} space-y-0.5`}>
                    {(currentLibrary?.isCloud ? comparison.missingIds : comparison.missingIds.slice(0, 3)).map((m, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1 text-[10px] hover:bg-red-50/30 rounded" title={m.designation}>
                        <span className="text-red-500 shrink-0">·</span>
                        {m.bpuNum && (
                          <span className="font-mono text-red-600 bg-red-50 px-1.5 py-0.5 rounded text-[9px] shrink-0" title={`uid: ${m.uid}`}>
                            {m.bpuNum}
                          </span>
                        )}
                        <span className="text-gray-700 truncate flex-1">{m.designation || '(sans désignation)'}</span>
                      </div>
                    ))}
                  </div>
                  {!currentLibrary?.isCloud && missCount > 3 && (
                    <p className="text-[10px] text-amber-600/60 italic ml-3 mt-0.5">… et {missCount - 3} autres</p>
                  )}
                </div>
              )}

              {/* Prix divergents — tableau projet vs base */}
              {divCount > 0 && (
                <div className="bg-white/70 rounded-lg p-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-orange-700 mb-1.5">
                    Prix divergents (projet → base)
                  </p>
                  {/* Header tableau (seulement en mode Cloud où on liste tout) */}
                  {currentLibrary?.isCloud && (
                    <div className="grid grid-cols-[1fr_90px_18px_90px_140px] gap-2 px-2 pb-1 border-b border-orange-200/40 text-[9px] font-bold uppercase tracking-wider text-orange-700/60">
                      <span>Désignation</span>
                      <span className="text-right">Projet</span>
                      <span></span>
                      <span className="text-right">Base</span>
                      <span className="text-right">Écart</span>
                    </div>
                  )}
                  <div className={`${currentLibrary?.isCloud ? 'max-h-56 overflow-y-auto divide-y divide-orange-100/40' : 'space-y-0.5'}`}>
                    {(currentLibrary?.isCloud ? comparison.divergentPrices : comparison.divergentPrices.slice(0, 3)).map((d, i) => {
                      const delta = (d.libraryPrice ?? 0) - (d.projectPrice ?? 0);
                      const pct = d.projectPrice ? (delta / d.projectPrice) * 100 : null;
                      const fmt = (n) => `${Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
                      const sign = delta > 0 ? '+' : '';
                      const color = Math.abs(delta) < 0.01 ? 'text-gray-500' : (delta > 0 ? 'text-emerald-600' : 'text-red-600');
                      const pctStr = pct != null && Math.abs(pct) >= 1 ? ` · ${sign}${pct.toFixed(0)}%` : '';
                      return currentLibrary?.isCloud ? (
                        <div key={i} className="grid grid-cols-[1fr_90px_18px_90px_140px] gap-2 px-2 py-1 items-center text-[10px] hover:bg-orange-50/40" title={d.designation}>
                          <span className="text-gray-700 truncate" title={d.designation}>{d.designation || d.uid}</span>
                          <span className="font-mono text-gray-500 text-right">{fmt(d.projectPrice)}</span>
                          <span className="text-gray-300 text-center">→</span>
                          <span className="font-mono text-gray-900 font-semibold text-right">{fmt(d.libraryPrice)}</span>
                          <span className={`font-mono text-right ${color}`}>{sign}{fmt(delta)}{pctStr}</span>
                        </div>
                      ) : (
                        <div key={i} className="flex items-center gap-1.5 text-[10px]" title={d.designation}>
                          <span className="text-orange-500 shrink-0">·</span>
                          <span className="text-gray-700 truncate flex-1">{d.designation || d.uid}</span>
                          <span className="font-mono text-gray-500 shrink-0">{fmt(d.projectPrice)}</span>
                          <span className="text-gray-300 shrink-0">→</span>
                          <span className="font-mono text-gray-900 font-semibold shrink-0">{fmt(d.libraryPrice)}</span>
                          <span className={`font-mono shrink-0 ${color}`}>({sign}{fmt(delta)}{pctStr})</span>
                        </div>
                      );
                    })}
                  </div>
                  {!currentLibrary?.isCloud && divCount > 3 && (
                    <p className="text-[10px] text-amber-600/60 italic ml-3 mt-0.5">… et {divCount - 3} autres</p>
                  )}
                </div>
              )}
            </div>
          )}

          {hasLinked && currentLibrary && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200/60">
              <ShieldCheck size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-emerald-700 leading-snug">
                La bibliothèque actuelle sera sauvegardée automatiquement avant la bascule.
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/60 flex flex-col gap-2">
          {hasLinked && (
            <button
              onClick={onLoadLinked}
              className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
              title="Active la bibliothèque associée à ce projet"
            >
              <FileText size={14} /> Charger « {linkedLibrary.name || 'la biblio liée'} »
            </button>
          )}
          <div className="flex gap-2">
            {!currentLibrary?.isCloud && (
              <button
                onClick={onUseCloudBase}
                className={`flex-1 px-3 py-2 ${hasLinked ? 'bg-white hover:bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-emerald-600 hover:bg-emerald-700 text-white'} text-[11px] font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-1.5`}
                title="Désactive le mode local et utilise la base BPU Firebase comme bibliothèque active"
              >
                <Cloud size={12} /> Base Firebase
              </button>
            )}
            {/* En mode Cloud + écarts : pas de "Base Firebase" (déjà active) → proposer "Continuer quand même" pour
                ouvrir le projet sans rien changer (accepter les écarts détectés). */}
            {currentLibrary?.isCloud && (
              <button
                onClick={onKeepCurrent}
                className={`flex-1 px-3 py-2 ${hasLinked ? 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200' : 'bg-gray-900 hover:bg-gray-800 text-white'} text-[11px] font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-1.5`}
                title="Ouvre le projet en gardant la base Firebase actuelle, malgré les écarts détectés"
              >
                <PlayCircle size={12} /> Continuer quand même
              </button>
            )}
            <button
              onClick={handleImportClick}
              className="flex-1 px-3 py-2 bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200 text-[11px] font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-1.5"
              title="Importer un fichier JSON contenant une bibliothèque BPU"
            >
              <Upload size={12} /> Importer JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
