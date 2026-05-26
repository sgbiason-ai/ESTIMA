// src/components/rao/AddVariantModal.jsx
//
// Modale d'ajout d'une variante entreprise.
// CCP R2151-8 à R2151-11 : la variante se substitue à la solution de base
// dans ses éléments différents. Le soumissionnaire doit respecter les exigences
// minimales fixées par l'acheteur dans les documents de consultation.

import React, { useState, useRef } from 'react';
import { X, GitBranch, FileSpreadsheet, FileText, Loader2, AlertTriangle, ScrollText, Check } from 'lucide-react';

export default function AddVariantModal({
  open,
  companyName,
  variantsRequirements = '',
  onImport,   // async (file, { label, description }) → { ok, variant }
  onClose,
}) {
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [importing, setImporting] = useState(false);
  const excelInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  React.useEffect(() => {
    if (open) {
      setLabel('');
      setDescription('');
      setAcknowledged(!variantsRequirements);
      setImporting(false);
    }
  }, [open, variantsRequirements]);

  if (!open) return null;

  const canImport = label.trim().length > 0 && (!variantsRequirements || acknowledged) && !importing;

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !onImport) { e.target.value = null; return; }
    setImporting(true);
    try {
      const result = await onImport(file, {
        label: label.trim() || 'Variante sans nom',
        description: description.trim(),
      });
      if (result?.ok) {
        onClose?.();
      }
    } finally {
      setImporting(false);
      e.target.value = null;
    }
  };

  const triggerExcel = () => excelInputRef.current?.click();
  const triggerPdf = () => pdfInputRef.current?.click();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200/60 bg-purple-50/40">
          <div className="p-2 rounded-xl bg-purple-100">
            <GitBranch size={20} className="text-purple-700" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-lg text-gray-900">Ajouter une variante</h2>
            <p className="text-xs text-gray-500 truncate">
              {companyName ? `Entreprise : ${companyName}` : 'CCP R2151-8 à R2151-11'}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={importing}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Nom de la variante */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1.5">
              Nom de la variante <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Ex. Variante béton armé / Variante structure acier"
              className="w-full px-3 py-2 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
              disabled={importing}
            />
          </div>

          {/* Descriptif */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1.5">
              Descriptif (optionnel)
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Décrivez brièvement les modifications proposées par cette variante..."
              className="w-full px-3 py-2 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 resize-none"
              disabled={importing}
            />
          </div>

          {/* Rappel des exigences minimales */}
          {variantsRequirements && (
            <div className="bg-purple-50/60 border border-purple-200 rounded-xl px-4 py-3">
              <div className="flex items-start gap-2 mb-2">
                <ScrollText size={14} className="text-purple-600 mt-0.5 shrink-0" />
                <div className="text-[11px] font-bold uppercase tracking-wider text-purple-900">
                  Exigences minimales à respecter (CCP)
                </div>
              </div>
              <div className="text-xs text-purple-900 whitespace-pre-wrap leading-relaxed pl-6 mb-3">
                {variantsRequirements}
              </div>
              <label className="flex items-start gap-2 cursor-pointer pl-6">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={e => setAcknowledged(e.target.checked)}
                  className="mt-0.5 accent-purple-600"
                  disabled={importing}
                />
                <span className="text-[11px] text-purple-900 leading-snug">
                  Je certifie avoir vérifié manuellement que cette variante respecte les exigences minimales ci-dessus.
                </span>
              </label>
            </div>
          )}

          {/* Bandeau info */}
          <div className="flex items-start gap-2 px-3 py-2 bg-blue-50/60 border border-blue-200 rounded-xl text-xs text-blue-900">
            <AlertTriangle size={13} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              Le fichier (Excel ou PDF avec texte extractible) doit avoir le format DQE
              (col 1 : Réf, col 2 : Désignation, col 4 : Quantité, col 5 : Prix unitaire).
              Les écarts de quantités vs DQE seront signalés automatiquement.
            </div>
          </div>

          <input
            ref={excelInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
          <input
            ref={pdfInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200/60 bg-gray-50/50">
          <div className="text-[11px] text-gray-500">
            <span className="text-red-500">*</span> Champs obligatoires
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={importing}
              className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-all disabled:opacity-50"
            >
              Annuler
            </button>
            {importing ? (
              <button
                disabled
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-purple-600 opacity-70"
              >
                <Loader2 size={15} className="animate-spin" />
                Import en cours…
              </button>
            ) : (
              <>
                <button
                  onClick={triggerPdf}
                  disabled={!canImport}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  title="Importer une variante depuis un PDF (extraction automatique du tableau)"
                >
                  <FileText size={15} />
                  PDF
                </button>
                <button
                  onClick={triggerExcel}
                  disabled={!canImport}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  title="Importer une variante depuis un fichier Excel"
                >
                  <FileSpreadsheet size={15} />
                  Excel
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
