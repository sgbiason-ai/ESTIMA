// src/components/rao/DepouillementModal.jsx
//
// Modale de dépouillement de la consultation.
// Recense les entreprises soumissionnaires avec :
// - Nom
// - Montant relevé sur l'acte d'engagement (AE) — L2113-1, R2151-1 CCP
// - Variantes annoncées (label + montant)
//
// Étape macro avant l'import Excel détaillé des DQE.

import React, { useState, useEffect } from 'react';
import {
  X, ScrollText, Plus, Trash2, GitBranch, Building2, ChevronDown, ChevronRight, Check, AlertTriangle, Calendar
} from 'lucide-react';
import { generateId } from '../../utils/helpers';

const VARIANT_REGIMES = [
  { value: 'forbidden', label: 'Interdites',   desc: 'Aucune variante ne sera examinée.',                       color: 'red' },
  { value: 'allowed',   label: 'Autorisées',   desc: 'Examinées en complément de l\'offre de base.',           color: 'blue' },
  { value: 'mandatory', label: 'Obligatoires', desc: 'Le soumissionnaire doit proposer au moins une variante.', color: 'amber' },
];

const newCompanyDraft = () => ({
  draftId: generateId(),
  name: '',
  aeAmount: '',
  variants: [],
});

const newVariantDraft = (n = 1) => ({
  draftId: generateId(),
  label: `Variante ${n}`,
  aeAmount: '',
});

const parseAmount = (v) => {
  if (v === '' || v == null) return null;
  const cleaned = String(v).replace(/[\s €]/g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

const fmtEUR = (n) => {
  if (n == null || !Number.isFinite(n)) return '—';
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
};

export default function DepouillementModal({
  open,
  existingCompanies = [],
  existingConsultation = {},
  onConfirm,
  onCancel,
}) {
  const [drafts, setDrafts] = useState([]);
  const [expanded, setExpanded] = useState({});
  // Champs de consultation gérés par la modale (CCP R2151-1 + R2151-8)
  const [dateOpening, setDateOpening] = useState('');
  const [variantsRegime, setVariantsRegime] = useState('forbidden');
  const [variantsRequirements, setVariantsRequirements] = useState('');

  // Initialisation : reprendre les entreprises et infos de consultation existantes
  useEffect(() => {
    if (!open) return;
    if (existingCompanies.length > 0) {
      setDrafts(existingCompanies.map(c => ({
        draftId: c.id || generateId(),
        existingId: c.id,
        name: c.name || '',
        aeAmount: c.aeAmount != null ? String(c.aeAmount) : '',
        variants: (c.variants || []).map((v, i) => ({
          draftId: v.id || generateId(),
          existingId: v.id,
          label: v.label || `Variante ${i + 1}`,
          aeAmount: v.aeAmount != null ? String(v.aeAmount) : (v.total != null ? String(v.total) : ''),
        })),
      })));
    } else {
      setDrafts([newCompanyDraft()]);
    }
    setExpanded({});
    // Charger les champs consultation existants
    setDateOpening(existingConsultation.dateOuverturePLis || existingConsultation.dateRemise || '');
    setVariantsRegime(existingConsultation.variantsAllowed || 'forbidden');
    setVariantsRequirements(existingConsultation.variantsRequirements || '');
  }, [open, existingCompanies, existingConsultation]);

  if (!open) return null;

  const addCompany = () => setDrafts(d => [...d, newCompanyDraft()]);
  const removeCompany = (id) => setDrafts(d => d.filter(c => c.draftId !== id));
  const updateCompany = (id, patch) =>
    setDrafts(d => d.map(c => c.draftId === id ? { ...c, ...patch } : c));

  const toggleExpand = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const addVariant = (companyId) => {
    setDrafts(d => d.map(c => {
      if (c.draftId !== companyId) return c;
      const nextNum = (c.variants?.length || 0) + 1;
      return { ...c, variants: [...(c.variants || []), newVariantDraft(nextNum)] };
    }));
    setExpanded(e => ({ ...e, [companyId]: true }));
  };

  const removeVariant = (companyId, variantId) => {
    setDrafts(d => d.map(c =>
      c.draftId !== companyId
        ? c
        : { ...c, variants: (c.variants || []).filter(v => v.draftId !== variantId) }
    ));
  };

  const updateVariant = (companyId, variantId, patch) => {
    setDrafts(d => d.map(c => {
      if (c.draftId !== companyId) return c;
      return {
        ...c,
        variants: (c.variants || []).map(v =>
          v.draftId === variantId ? { ...v, ...patch } : v
        ),
      };
    }));
  };

  const validDrafts = drafts.filter(c => (c.name || '').trim().length > 0);
  const totalAe = validDrafts.reduce((s, c) => s + (parseAmount(c.aeAmount) || 0), 0);
  const nbVariants = validDrafts.reduce((s, c) => s + (c.variants || []).filter(v => (v.label || '').trim()).length, 0);

  const canValidate = validDrafts.length > 0;

  const handleConfirm = () => {
    const entries = validDrafts.map(c => ({
      existingId: c.existingId || null,
      name: c.name.trim(),
      aeAmount: parseAmount(c.aeAmount),
      variants: (c.variants || [])
        .filter(v => (v.label || '').trim())
        .map(v => ({
          existingId: v.existingId || null,
          label: v.label.trim(),
          aeAmount: parseAmount(v.aeAmount),
        })),
    }));
    onConfirm({
      consultation: {
        dateOuverturePLis: dateOpening,
        variantsAllowed: variantsRegime,
        variantsRequirements: variantsRegime !== 'forbidden' ? variantsRequirements : '',
      },
      entries,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200/60 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
          <div className="p-2 rounded-xl bg-indigo-100">
            <ScrollText size={20} className="text-indigo-700" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-lg text-gray-900">Dépouillement de la consultation</h2>
            <p className="text-xs text-gray-500 truncate">
              Recensez les entreprises et montants relevés sur les actes d'engagement (CCP L2113-1 / R2151-1)
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corps : tableau */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* ─── Bloc CONSULTATION : date + régime variantes ─── */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Calendar size={11} />
                  Date d'ouverture des plis
                </label>
                <input
                  type="date"
                  value={dateOpening}
                  onChange={e => setDateOpening(e.target.value)}
                  className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <GitBranch size={11} />
                  Variantes entreprises (CCP R2151-8)
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {VARIANT_REGIMES.map(r => {
                    const active = variantsRegime === r.value;
                    const cls = active
                      ? r.color === 'red'  ? 'bg-red-500 text-white border-red-500'
                      : r.color === 'blue' ? 'bg-blue-500 text-white border-blue-500'
                      :                       'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300';
                    return (
                      <button
                        key={r.value}
                        onClick={() => setVariantsRegime(r.value)}
                        className={`px-3 py-2 rounded-lg border-2 text-xs font-bold transition-all ${cls}`}
                        title={r.desc}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {variantsRegime !== 'forbidden' && (
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
                  Exigences minimales que les variantes doivent respecter
                </label>
                <textarea
                  value={variantsRequirements}
                  onChange={e => setVariantsRequirements(e.target.value)}
                  rows={3}
                  placeholder="Ex. Respect des performances techniques minimales, maintien des caractéristiques fonctionnelles, aucune diminution du périmètre des prestations…"
                  className="w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 resize-none"
                />
              </div>
            )}
          </div>

          <div className="bg-amber-50/60 border border-amber-200 rounded-xl px-4 py-2.5 flex items-start gap-2 text-[11px] text-amber-900">
            <AlertTriangle size={13} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              Saisissez le <strong>montant de l'acte d'engagement</strong> (offre globale signée) et les éventuelles variantes proposées.
              Les détails par article (prix unitaires) seront complétés ensuite par import Excel ou saisie manuelle.
            </div>
          </div>

          {/* En-têtes colonnes */}
          <div className="grid grid-cols-[40px_1fr_180px_120px_40px] gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-500 border-b border-gray-200">
            <div></div>
            <div>Entreprise</div>
            <div className="text-right">Montant AE (€ HT)</div>
            <div className="text-center">Variantes</div>
            <div></div>
          </div>

          {/* Lignes entreprises */}
          <div className="space-y-1.5 mt-1.5">
            {drafts.map((c, idx) => {
              const isExpanded = expanded[c.draftId];
              const nbV = (c.variants || []).length;
              return (
                <div key={c.draftId} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  {/* Ligne principale */}
                  <div className="grid grid-cols-[40px_1fr_180px_120px_40px] gap-2 items-center px-3 py-2">
                    <button
                      onClick={() => toggleExpand(c.draftId)}
                      disabled={nbV === 0}
                      className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default transition-all"
                      title={nbV > 0 ? (isExpanded ? 'Replier' : 'Déplier') : 'Aucune variante'}
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                        <Building2 size={14} className="text-indigo-600" />
                      </div>
                      <input
                        value={c.name}
                        onChange={e => updateCompany(c.draftId, { name: e.target.value })}
                        placeholder={`Entreprise ${idx + 1}`}
                        className="flex-1 px-3 py-1.5 text-sm font-semibold text-gray-900 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    <input
                      value={c.aeAmount}
                      onChange={e => updateCompany(c.draftId, { aeAmount: e.target.value })}
                      placeholder="0,00"
                      inputMode="decimal"
                      className="px-3 py-1.5 text-sm text-right font-mono tabular-nums text-gray-900 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                    <div className="flex items-center justify-center gap-1">
                      {nbV > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 text-[10px] font-bold">
                          {nbV}
                        </span>
                      )}
                      <button
                        onClick={() => addVariant(c.draftId)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-purple-600 hover:bg-purple-50 text-[10px] font-bold transition-all"
                        title="Ajouter une variante"
                      >
                        <GitBranch size={11} />
                        + Variante
                      </button>
                    </div>
                    <button
                      onClick={() => removeCompany(c.draftId)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                      title="Retirer cette entreprise"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Variantes (dépliable) */}
                  {isExpanded && nbV > 0 && (
                    <div className="border-t border-gray-100 bg-purple-50/30 px-3 py-2 space-y-1.5">
                      {(c.variants || []).map((v, vi) => (
                        <div key={v.draftId} className="grid grid-cols-[40px_1fr_180px_120px_40px] gap-2 items-center">
                          <div className="flex items-center justify-center">
                            <span className="w-6 h-6 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-black">
                              V{vi + 1}
                            </span>
                          </div>
                          <input
                            value={v.label}
                            onChange={e => updateVariant(c.draftId, v.draftId, { label: e.target.value })}
                            placeholder="Nom de la variante (ex. structure acier)"
                            className="px-3 py-1.5 text-xs text-gray-800 bg-white border border-purple-200 rounded-lg focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                          />
                          <input
                            value={v.aeAmount}
                            onChange={e => updateVariant(c.draftId, v.draftId, { aeAmount: e.target.value })}
                            placeholder="0,00"
                            inputMode="decimal"
                            className="px-3 py-1.5 text-xs text-right font-mono tabular-nums text-gray-800 bg-white border border-purple-200 rounded-lg focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                          />
                          <div></div>
                          <button
                            onClick={() => removeVariant(c.draftId, v.draftId)}
                            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                            title="Retirer cette variante"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bouton ajout */}
          <button
            onClick={addCompany}
            className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-indigo-700 hover:bg-indigo-50 border-2 border-dashed border-indigo-200 hover:border-indigo-300 transition-all w-full justify-center"
          >
            <Plus size={14} />
            Ajouter une entreprise
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200/60 bg-gray-50/50">
          <div className="text-xs text-gray-600 flex items-center gap-4">
            <span>
              <strong className="text-gray-900">{validDrafts.length}</strong> entreprise{validDrafts.length > 1 ? 's' : ''}
            </span>
            {nbVariants > 0 && (
              <span className="text-purple-700">
                <strong>{nbVariants}</strong> variante{nbVariants > 1 ? 's' : ''}
              </span>
            )}
            <span>•</span>
            <span>
              Cumul AE : <strong className="text-gray-900 font-mono tabular-nums">{fmtEUR(totalAe)}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-all"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canValidate}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Check size={15} />
              Valider le dépouillement
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
