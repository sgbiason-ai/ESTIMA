// src/views/estimaTp/TpFicheAffaireModal.jsx
// ESTIMA TP — « Fiche affaire » (côté entreprise TP).
// Jeu de champs ciblé : identité, intervenants, localisation, marché & délais,
// objet, notes. Pas de page de garde / CCTP / RC (notions MOE).
import React, { useState, useEffect, useRef } from 'react';
import {
  X, HardHat, Hash, FileSignature, Building2, Ruler, MapPin, Globe2,
  Briefcase, Calendar, Clock, Hourglass, FileText, StickyNote,
} from 'lucide-react';

// ─── Sous-composants UI (accent orange chantier) ─────────────────────────────
const Input = ({ label, name, value, onChange, icon: Icon, type = 'text', placeholder, required = false }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-400 ml-1 flex items-center gap-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="relative flex items-center bg-gray-50 border border-gray-200/80 rounded-xl hover:border-gray-300 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100 transition-all">
      {Icon && <div className="pl-3 text-gray-400"><Icon size={14} /></div>}
      <input
        type={type} name={name} value={value || ''} onChange={onChange} placeholder={placeholder}
        className="w-full bg-transparent border-none text-xs font-semibold text-gray-800 placeholder:text-gray-300 px-3 py-2.5 focus:ring-0 focus:outline-none"
      />
    </div>
  </div>
);

const Select = ({ label, name, value, onChange, icon: Icon, options }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-400 ml-1">{label}</label>
    <div className="relative flex items-center bg-gray-50 border border-gray-200/80 rounded-xl hover:border-gray-300 focus-within:border-orange-400 transition-all">
      {Icon && <div className="pl-3 text-gray-400"><Icon size={14} /></div>}
      <select name={name} value={value} onChange={onChange}
        className="w-full bg-transparent border-none text-xs font-bold text-gray-700 px-3 py-2.5 focus:ring-0 focus:outline-none cursor-pointer appearance-none">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1L5 5L9 1" /></svg>
      </div>
    </div>
  </div>
);

const Textarea = ({ label, name, value, onChange, icon: Icon, placeholder, rows = 3 }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-400 ml-1">{label}</label>
    <div className="relative flex items-start bg-gray-50 border border-gray-200/80 rounded-xl hover:border-gray-300 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100 transition-all">
      {Icon && <div className="pl-3 pt-2.5 text-gray-400 shrink-0"><Icon size={14} /></div>}
      <textarea
        name={name} value={value || ''} onChange={onChange} rows={rows} placeholder={placeholder}
        className="w-full bg-transparent border-none text-xs font-semibold text-gray-800 placeholder:text-gray-300 px-3 py-2.5 focus:ring-0 focus:outline-none resize-none"
      />
    </div>
  </div>
);

const SectionTitle = ({ icon: Icon, color, children }) => (
  <h3 className={`text-xs font-black uppercase tracking-widest border-b border-gray-100 pb-2 flex items-center gap-2 ${color}`}>
    <Icon size={12} /> {children}
  </h3>
);

const EMPTY = {
  name: '', reference: '', codeAffaire: '',
  maitreOuvrage: '', maitreOeuvre: '',
  lieu: '', departement: '',
  typeMarche: 'Privé', dateRemise: '', heureRemise: '', delaiExecution: '', demarrage: '',
  objet: '', notes: '',
};

export default function TpFicheAffaireModal({ isOpen, onClose, study, onSave }) {
  const [form, setForm] = useState(EMPTY);
  const wasOpen = useRef(false);

  // Hydrate le formulaire à l'ouverture seulement (pas à chaque maj study).
  useEffect(() => {
    if (isOpen && !wasOpen.current && study) {
      setForm({
        name: study.name || '', reference: study.reference || '', codeAffaire: study.codeAffaire || '',
        maitreOuvrage: study.maitreOuvrage || '', maitreOeuvre: study.maitreOeuvre || '',
        lieu: study.lieu || '', departement: study.departement || '',
        typeMarche: study.typeMarche || 'Privé', dateRemise: study.dateRemise || '',
        heureRemise: study.heureRemise || '', delaiExecution: study.delaiExecution || '',
        demarrage: study.demarrage || '',
        objet: study.objet || '', notes: study.notes || '',
      });
    }
    wasOpen.current = isOpen;
  }, [isOpen, study]);

  if (!isOpen) return null;

  const change = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const valid = (form.name || '').trim().length >= 1;

  const submit = (e) => {
    e.preventDefault();
    if (!valid) return;
    onSave({ ...form, name: form.name.trim() });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-[94vw] max-w-3xl max-h-[92vh] overflow-hidden flex flex-col border border-white/20 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="bg-white/80 backdrop-blur-xl px-6 py-4 flex justify-between items-center border-b border-gray-200/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-orange-50 p-2 rounded-lg border border-orange-100">
              <HardHat size={20} className="text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 uppercase tracking-wide leading-none">Fiche affaire</h2>
              <p className="text-[10px] text-gray-400 mt-1 font-medium">Informations générales de l'étude de prix</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-900 hover:bg-gray-100 p-2 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form id="tp-fiche-affaire" onSubmit={submit} className="flex-1 p-6 bg-gray-50/50 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Identité */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200/70 shadow-sm flex flex-col gap-4 md:col-span-2">
              <SectionTitle icon={FileSignature} color="text-orange-600">Identité de l'étude</SectionTitle>
              <Input label="Nom de l'étude" name="name" value={form.name} onChange={change} icon={FileSignature} placeholder="Ex : Aménagement RD820 — Tranche 1" required />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Référence / N° AO" name="reference" value={form.reference} onChange={change} icon={Hash} placeholder="Ex : 2026-AO-014" />
                <Input label="Code affaire interne" name="codeAffaire" value={form.codeAffaire} onChange={change} icon={Hash} placeholder="Ex : TP26-018" />
              </div>
            </div>

            {/* Intervenants */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200/70 shadow-sm flex flex-col gap-4">
              <SectionTitle icon={Building2} color="text-indigo-600">Intervenants</SectionTitle>
              <Input label="Maître d'ouvrage (MOA)" name="maitreOuvrage" value={form.maitreOuvrage} onChange={change} icon={Building2} placeholder="Ex : CD31" />
              <Input label="Maître d'œuvre (MOE)" name="maitreOeuvre" value={form.maitreOeuvre} onChange={change} icon={Ruler} placeholder="Ex : Bureau d'études X" />
            </div>

            {/* Localisation */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200/70 shadow-sm flex flex-col gap-4">
              <SectionTitle icon={MapPin} color="text-emerald-600">Localisation</SectionTitle>
              <Input label="Lieu / commune" name="lieu" value={form.lieu} onChange={change} icon={MapPin} placeholder="Ville / localisation des travaux" />
              <Input label="Département" name="departement" value={form.departement} onChange={change} icon={Globe2} placeholder="Ex : Haute-Garonne, 31…" />
            </div>

            {/* Marché & délais */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200/70 shadow-sm flex flex-col gap-4 md:col-span-2">
              <SectionTitle icon={Briefcase} color="text-amber-600">Marché &amp; délais</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Select label="Type de marché" name="typeMarche" value={form.typeMarche} onChange={change} icon={Briefcase}
                  options={[{ value: 'Privé', label: 'Marché privé' }, { value: 'Public', label: 'Marché public' }, { value: 'Sous-traitance', label: 'Sous-traitance' }]} />
                <Input label="Délai d'exécution" name="delaiExecution" value={form.delaiExecution} onChange={change} icon={Hourglass} placeholder="Ex : 4 mois" />
                <Input label="Démarrage prévisionnel" name="demarrage" value={form.demarrage} onChange={change} icon={Calendar} placeholder="Ex : septembre 2026" />
              </div>
              <div className="grid grid-cols-2 gap-3 max-w-md">
                <Input label="Date remise offre" name="dateRemise" type="date" value={form.dateRemise} onChange={change} icon={Calendar} />
                <Input label="Heure remise" name="heureRemise" type="time" value={form.heureRemise} onChange={change} icon={Clock} />
              </div>
            </div>

            {/* Objet */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200/70 shadow-sm flex flex-col gap-4">
              <SectionTitle icon={FileText} color="text-sky-600">Objet des travaux</SectionTitle>
              <Textarea label="Description générale" name="objet" value={form.objet} onChange={change} icon={FileText} placeholder="Décrivez brièvement la nature des travaux…" rows={5} />
            </div>

            {/* Notes */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200/70 shadow-sm flex flex-col gap-4">
              <SectionTitle icon={StickyNote} color="text-violet-600">Notes internes</SectionTitle>
              <Textarea label="Notes / commentaires" name="notes" value={form.notes} onChange={change} icon={StickyNote} placeholder="Hypothèses de chiffrage, points d'attention…" rows={5} />
            </div>

          </div>
        </form>

        {/* Footer */}
        <div className="bg-white px-6 py-4 border-t border-gray-200/60 flex justify-end items-center gap-3 shrink-0">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 transition-colors uppercase tracking-wider">
            Annuler
          </button>
          <button
            type="submit" form="tp-fiche-affaire" disabled={!valid}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
              valid ? 'bg-orange-600 text-white hover:bg-orange-700 hover:shadow-lg active:scale-[0.98]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <HardHat size={14} /> Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
