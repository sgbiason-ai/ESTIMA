// src/components/docAdmin/exeSharedUI.jsx
// Composants UI partages entre ExeReceptionForm, ExeLeveeForm, Exe10Form.
// Style « PDF officiel DAJ » — mode clair, largeur A4.

import React from 'react';

// ── En-tete de document (bloc MARCHES PUBLICS / RECEPTION / EXE*) ───────
export const PdfDocumentHeader = ({ subtitle, exeCode }) => (
  <div className="relative bg-[#B0E0F2] text-black text-center py-5 px-6 mb-6 rounded overflow-hidden border border-[#8ECFE6]">
    <p className="text-[11px] font-bold tracking-wide">MINISTÈRE DE L'ÉCONOMIE ET DES FINANCES</p>
    <p className="text-[10px] mt-0.5 text-gray-700">Direction des Affaires Juridiques</p>
    <div className="mt-3 space-y-0.5">
      <p className="text-[15px] font-bold tracking-wide">MARCHÉS PUBLICS</p>
      <p className="text-[12px] font-bold">RÉCEPTION DES TRAVAUX</p>
      <p className="text-[11px] mt-1 text-gray-700">{subtitle}</p>
    </div>
    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[28px] font-black tracking-tight text-black/70">{exeCode}</span>
  </div>
);

// ── Titre de section (A, B, C...) — fond bleu cyan comme le PDF officiel ──
export const PdfSectionHeader = ({ letter, title }) => (
  <div className="bg-[#B0E0F2] text-black font-bold text-[12px] py-2 px-3.5 mt-6 mb-3 rounded-sm leading-snug border-l-4 border-[#5BA8C8]">
    {letter} - {title}
  </div>
);

// ── Champ en lecture seule ──────────────────────────────────────────────
export const ReadOnlyField = ({ label, value }) => (
  <div className="flex flex-col gap-1">
    {label && <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</span>}
    <div className="px-3.5 py-2 rounded-md bg-gray-50 border border-gray-200 text-sm text-gray-600 min-h-[36px] flex items-center">
      {value || <span className="italic text-gray-400">Non renseigné</span>}
    </div>
  </div>
);

// ── Affichage read-only d'une entreprise ────────────────────────────────
export const ReadOnlyEntreprise = ({ ent, label }) => {
  if (!ent) return <p className="text-sm text-gray-400 italic">Non renseigné</p>;
  const lines = [
    ent.nomCommercial,
    ent.denominationSociale ? `(${ent.denominationSociale})` : '',
    ent.adresse,
    [ent.codePostal, ent.ville].filter(Boolean).join('  '),
    ent.telephone ? `Tél. : ${ent.telephone}` : '',
    ent.email ? `Email : ${ent.email}` : '',
    ent.siret ? `SIRET : ${ent.siret}` : '',
  ].filter(Boolean);

  return (
    <div>
      {label && <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 block mb-1">{label}</span>}
      <div className="px-3.5 py-2.5 rounded-md bg-gray-50 border border-gray-200 text-sm text-gray-600 space-y-0.5">
        {lines.map((l, i) => <p key={i}>{l}</p>)}
      </div>
    </div>
  );
};

// ── Sections A-D en lecture seule (communes aux 3 fiches) ───────────────
export const ReadOnlySectionsAD = ({ fiche, sectionATitle }) => {
  const A = fiche?.sectionA || {};
  const B = fiche?.sectionB || {};
  const C = fiche?.sectionC || {};
  const D = fiche?.sectionD || {};
  const isGroupement = B.type === 'groupement';
  const cotraitants = (B.cotraitants || []).filter(c => c?.nomCommercial || c?.denominationSociale);

  return (
    <>
      <PdfSectionHeader letter="A" title={sectionATitle || "Identification du pouvoir adjudicateur ou de l'entité adjudicatrice"} />
      <div className="pl-1 space-y-1">
        <div className="px-3.5 py-2.5 rounded-md bg-gray-50 border border-gray-200 text-sm text-gray-600 space-y-0.5">
          {A.designation && <p className="font-medium text-gray-800">{A.designation}</p>}
          {A.adresse && <p>{A.adresse}</p>}
          {(A.codePostal || A.ville) && <p>{[A.codePostal, A.ville].filter(Boolean).join('  ')}</p>}
          {A.representant && <p>Représentant : {A.representant}{A.qualite ? ` (${A.qualite})` : ''}</p>}
          {!A.designation && <p className="italic text-gray-400">Non renseigné</p>}
        </div>
      </div>

      <PdfSectionHeader letter="B" title="Identification du titulaire du marché public" />
      <div className="pl-1">
        {isGroupement && cotraitants.length > 0 ? (
          <div className="space-y-2">
            <ReadOnlyEntreprise ent={B.mandataire} label="Mandataire" />
            {cotraitants.map((cot, i) => <ReadOnlyEntreprise key={i} ent={cot} label={`Co-traitant ${i + 1}`} />)}
          </div>
        ) : (
          <ReadOnlyEntreprise ent={B.mandataire} />
        )}
      </div>

      <PdfSectionHeader letter="C" title="Identification du maître d'œuvre" />
      <div className="pl-1"><ReadOnlyEntreprise ent={C} /></div>

      <PdfSectionHeader letter="D" title="Objet du marché public" />
      <div className="pl-1">
        <div className="px-3.5 py-2.5 rounded-md bg-gray-50 border border-gray-200 text-sm text-gray-600">
          {D.objet || <span className="italic text-gray-400">Non renseigné</span>}
          {D.referenceMarche && <p className="mt-1 text-[11px] text-gray-500">Réf. : {D.referenceMarche}</p>}
        </div>
      </div>
    </>
  );
};

// ── Formateur montant avec separateur de milliers ──────────────────────
const _fmtMontant = (v) => {
  if (!v && v !== 0) return '';
  const num = typeof v === 'string' ? parseFloat(v.replace(/\s/g, '').replace(',', '.')) : v;
  if (isNaN(num)) return v;
  return num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ── Champ de saisie (mode clair) ────────────────────────────────────────
export const Field = ({ label, value, onChange, placeholder, type = 'text', className = '', rows, icon: Icon, suffix, error, readOnly }) => {
  const isTextarea = rows && rows > 1;
  const InputTag = isTextarea ? 'textarea' : 'input';
  const isMontant = suffix === '€';
  let displayValue = value || '';
  if (type === 'date' && value) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) displayValue = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const handleBlur = isMontant ? (e) => {
    const raw = e.target.value.replace(/\s/g, '').replace(',', '.');
    if (raw && !isNaN(parseFloat(raw))) onChange(_fmtMontant(raw));
  } : undefined;
  if (readOnly) {
    return (
      <div className={`flex flex-col gap-1.5 ${className}`}>
        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
          {Icon && <Icon size={10} className="text-gray-400" />}
          {label}
        </label>
        <div className="px-3.5 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-600 min-h-[40px] flex items-center">
          {type === 'date' && value ? new Date(value).toLocaleDateString('fr-FR') : (isMontant && value ? _fmtMontant(value) : value) || <span className="italic text-gray-400">—</span>}
          {suffix && <span className="ml-1 font-bold text-gray-500">{suffix}</span>}
        </div>
      </div>
    );
  }
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
        {Icon && <Icon size={10} className="text-gray-400" />}
        {label}
      </label>
      <div className="relative flex items-center">
        <InputTag
          type={type} value={displayValue} onChange={(e) => onChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder} rows={rows}
          className={`w-full px-3.5 py-2.5 rounded-lg bg-white border border-gray-300 text-sm text-gray-800 placeholder-gray-400
            hover:border-gray-400 focus:bg-white focus:outline-none
            transition-all duration-200 resize-none ${isTextarea ? 'min-h-[80px]' : 'h-10'} ${suffix ? 'pr-10' : ''} ${isMontant ? 'text-right' : ''}
            ${error ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200' : 'focus:border-blue-500 focus:ring-2 focus:ring-blue-200'}`}
        />
        {suffix && <span className="absolute right-3.5 text-sm font-bold text-gray-500 pointer-events-none">{suffix}</span>}
      </div>
      {error && <span className="text-[10px] text-red-600 font-bold mt-0.5 leading-tight">{error}</span>}
    </div>
  );
};

// ── Groupe de choix ─────────────────────────────────────────────────────
export const ChoiceGroup = ({ label, options, value, onChange }) => (
  <div className="flex flex-col gap-1.5">
    {label && <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</label>}
    <div className="flex flex-wrap items-center gap-2 p-1 rounded-lg bg-gray-100 border border-gray-200 w-fit">
      {options.map((opt) => {
        const isActive = value === opt.value;
        let btnColor = 'text-gray-500 hover:text-gray-700 border-transparent hover:bg-white';
        if (isActive) {
          if (opt.value.includes('oui') || opt.value.includes('conforme') || opt.value === 'sans_reserve' || opt.value === 'prononcer' || opt.value === 'present' || opt.value === 'globale') {
            btnColor = 'bg-emerald-100 border-emerald-300 text-emerald-700 shadow-sm';
          } else if (opt.value.includes('non') || opt.value.includes('absent') || opt.value === 'refus' || opt.value === 'ne_pas_prononcer') {
            btnColor = 'bg-red-100 border-red-300 text-red-700 shadow-sm';
          } else {
            btnColor = 'bg-amber-100 border-amber-300 text-amber-700 shadow-sm';
          }
        }
        return (
          <button key={opt.value} onClick={() => onChange(opt.value)} className={`px-3 py-1.5 rounded-md border text-xs font-bold transition-all ${btnColor}`}>
            {opt.label}
          </button>
        );
      })}
    </div>
  </div>
);

// ── Case a cocher stylisee (imite les checkboxes du PDF) ────────────────
// Si onChange est fourni, la case est interactive (cochable). Sinon lecture seule.
export const PdfCheckItem = ({ checked, label, indent = 0, bold, onChange }) => {
  const interactive = typeof onChange === 'function';
  return (
    <div
      className={`flex items-start gap-2.5 py-1 ${interactive ? 'cursor-pointer group' : ''}`}
      style={{ paddingLeft: `${indent * 16}px` }}
      onClick={interactive ? () => onChange(!checked) : undefined}
    >
      <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
        checked ? 'bg-emerald-100 border-emerald-500' : 'border-gray-300 bg-white'
      } ${interactive && !checked ? 'group-hover:border-emerald-400 group-hover:bg-emerald-50' : ''}`}>
        {checked && <span className="text-emerald-600 text-[10px] font-black">✓</span>}
      </div>
      <span className={`text-[12px] leading-relaxed select-none ${bold ? 'font-bold text-gray-800' : 'text-gray-700'}`}>{label}</span>
    </div>
  );
};
