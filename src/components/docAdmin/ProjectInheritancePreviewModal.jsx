import React from 'react';
import { ArrowRight, Check, Link2, RefreshCw, X } from 'lucide-react';

const Value = ({ children, emptyLabel }) => (
  <div className="min-w-0 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 whitespace-pre-line break-words">
    {children || <span className="italic text-gray-400">{emptyLabel}</span>}
  </div>
);

export default function ProjectInheritancePreviewModal({
  project,
  changes,
  isLinking,
  isSaving,
  onClose,
  onConfirm,
}) {
  const hasChanges = changes.length > 0;

  return (
    <div
      className="fixed inset-0 z-modal-stack flex items-center justify-center bg-black/25 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-gray-200/60 px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            {isLinking ? <Link2 size={19} /> : <RefreshCw size={19} />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-gray-900">
              {isLinking ? "Lier l'affaire EstimaVRD" : "Actualiser depuis l'affaire"}
            </h2>
            <p className="truncate text-xs text-gray-500">
              {project?.name || 'Affaire sans nom'}
              {project?.code ? ` · ${project.code}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {hasChanges ? (
            <>
              <p className="mb-4 text-sm text-gray-600">
                {changes.length} champ{changes.length > 1 ? 's' : ''} seront mis à jour.
                Les autres informations administratives resteront inchangées.
              </p>
              <div className="space-y-3">
                {changes.map((change) => (
                  <div key={change.path} className="rounded-2xl border border-gray-200/60 p-4">
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                      {change.label}
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <Value emptyLabel="Non renseigné">{change.before}</Value>
                      <ArrowRight size={15} className="text-blue-400" />
                      <Value emptyLabel="Champ vide dans l'affaire">{change.after}</Value>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
              Les champs de la fiche marché sont déjà identiques à ceux de cette affaire.
              {isLinking && ' La liaison sera néanmoins enregistrée.'}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200/60 bg-gray-50/70 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl px-4 py-2.5 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-200/70 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition-all hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50"
          >
            {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
            {isSaving
              ? 'Enregistrement…'
              : isLinking
                ? 'Lier et actualiser'
                : 'Actualiser'}
          </button>
        </div>
      </div>
    </div>
  );
}
