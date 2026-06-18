// src/components/modals/DocumentVariablesModal.jsx
// Modale UNIFIÉE de saisie des variables documents, partagée par CCTP / RC / CCAP.
// Onglets : Commun · RC · CCAP · CCTP (celui du module courant est actif par défaut).
// Source unique : édite directement les champs du projet (à plat) + project.ccapVars.
// La fiche projet complète (logos, page de garde, tranches) reste accessible via le lien dédié.
import React, { useState, useEffect } from 'react';
import {
  X, FileText, Building2, MapPin, Hash, Calendar, Clock, Briefcase,
  Globe2, Layers, ShieldAlert, Hourglass, Link, CalendarClock, Wrench,
  TrendingUp, Percent, CloudRain, Thermometer, Route, Save, ExternalLink,
  PenLine, AlertTriangle,
} from 'lucide-react';

// Valeurs par défaut des champs propres au CCAP (bucket project.ccapVars).
const CCAP_DEFAULTS = {
  coordonnateur_sps: '',
  duree_globale_mois: '',
  duree_preparation_mois: '',
  duree_travaux_mois: '',
  index_revision: '',
  seuil_debut_remboursement_avance: '65',
  voie_concernee: '',
  station_meteo: '',
  jours_intemperies_previsibles: '',
};

const TABS = [
  { key: 'common', label: 'Commun', icon: FileText },
  { key: 'rc', label: 'RC', icon: ShieldAlert },
  { key: 'ccap', label: 'CCAP', icon: PenLine },
  { key: 'cctp', label: 'CCTP', icon: Layers },
];

// ─── Mini-inputs (style ProjectDetailsModal) ───────────────────────────────────
const Field = ({ label, name, value, onChange, icon: Icon, type = 'text', placeholder, suffix }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 ml-1">{label}</label>
    <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all">
      <div className="pl-3 text-slate-400">{Icon && <Icon size={14} />}</div>
      <input
        type={type} name={name} value={value ?? ''} onChange={onChange} placeholder={placeholder}
        className="w-full bg-transparent border-none text-xs font-semibold text-slate-700 placeholder:text-slate-300 px-3 py-2.5 focus:ring-0 focus:outline-none"
      />
      {suffix && <span className="pr-3 text-[10px] font-bold text-slate-400 shrink-0">{suffix}</span>}
    </div>
  </div>
);

const SelectField = ({ label, name, value, onChange, icon: Icon, options }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 ml-1">{label}</label>
    <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 focus-within:border-indigo-500 transition-all">
      <div className="pl-3 text-slate-400">{Icon && <Icon size={14} />}</div>
      <select name={name} value={value ?? ''} onChange={onChange}
        className="w-full bg-transparent border-none text-xs font-bold text-slate-700 px-3 py-2.5 focus:ring-0 focus:outline-none cursor-pointer appearance-none">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1L5 5L9 1" /></svg>
      </div>
    </div>
  </div>
);

const Textarea = ({ label, name, value, onChange, icon: Icon, placeholder, rows = 3 }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 ml-1">{label}</label>
    <div className="relative flex items-start bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all">
      <div className="pl-3 pt-2.5 text-slate-400 shrink-0">{Icon && <Icon size={14} />}</div>
      <textarea name={name} value={value ?? ''} onChange={onChange} rows={rows} placeholder={placeholder}
        className="w-full bg-transparent border-none text-xs font-semibold text-slate-700 placeholder:text-slate-300 px-3 py-2.5 focus:ring-0 focus:outline-none resize-none" />
    </div>
  </div>
);

const Card = ({ title, icon: Icon, accent = 'text-indigo-600', children }) => (
  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
    <h3 className={`text-xs font-black uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2 ${accent}`}>
      <Icon size={12} /> {title}
    </h3>
    {children}
  </div>
);

// Classes complètes (Tailwind JIT ne détecte pas les classes construites dynamiquement).
const NOTE_STYLES = {
  cyan: { box: 'bg-cyan-50/50 border-cyan-100', icon: 'text-cyan-400', text: 'text-cyan-600' },
  teal: { box: 'bg-teal-50/50 border-teal-100', icon: 'text-teal-400', text: 'text-teal-600' },
};
const InfoNote = ({ children, accent = 'cyan' }) => {
  const s = NOTE_STYLES[accent] || NOTE_STYLES.cyan;
  return (
    <div className={`flex items-start gap-2 border rounded-lg px-3 py-2.5 ${s.box}`}>
      <FileText size={13} className={`${s.icon} shrink-0 mt-0.5`} />
      <p className={`text-[10px] font-medium leading-relaxed ${s.text}`}>{children}</p>
    </div>
  );
};

const DocumentVariablesModal = ({
  isOpen, onClose, project, onSave, onOpenFullSheet, activeModule = 'common',
}) => {
  const [tab, setTab] = useState(activeModule);
  const [form, setForm] = useState({});   // champs projet à plat (commun + RC)
  const [ccap, setCcap] = useState(CCAP_DEFAULTS);

  useEffect(() => {
    if (!isOpen) return;
    setTab(activeModule);
    setForm({
      // Commun
      client: project?.client || '', clientAddress: project?.clientAddress || '',
      clientZip: project?.clientZip || '', clientCity: project?.clientCity || '',
      moe: project?.moe || '', moeAddress: project?.moeAddress || '',
      projectDescription: project?.projectDescription || '',
      location: project?.location || '', code: project?.code || '',
      phase: project?.phase || 'DCE', marketType: project?.marketType || 'Privé',
      dateRemise: project?.dateRemise || '', timeRemise: project?.timeRemise || '',
      duration: project?.duration || '', prepPeriod: project?.prepPeriod || '',
      department: project?.department || '',
      // RC
      lotName: project?.lotName || '', spsLevel: project?.spsLevel || 'II',
      startDate: project?.startDate || '',
      validityDays: project?.validityDays != null ? project.validityDays : 120,
      platformUrl: project?.platformUrl || '',
    });
    setCcap({ ...CCAP_DEFAULTS, ...(project?.ccapVars || {}) });
  }, [isOpen, project, activeModule]);

  if (!isOpen) return null;

  const onForm = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const onCcap = (e) => setCcap(prev => ({ ...prev, [e.target.name]: e.target.value }));

  // Contrôle de cohérence des durées CCAP : globale = préparation + travaux.
  const dG = parseFloat(ccap.duree_globale_mois);
  const dP = parseFloat(ccap.duree_preparation_mois);
  const dT = parseFloat(ccap.duree_travaux_mois);
  const durationsFilled = [dG, dP, dT].every((n) => !Number.isNaN(n));
  const durationSum = (Number.isNaN(dP) ? 0 : dP) + (Number.isNaN(dT) ? 0 : dT);
  const durationIncoherent = durationsFilled && dG !== durationSum;
  const fixDuration = () => setCcap(prev => ({ ...prev, duree_globale_mois: String(durationSum) }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...project, ...form, ccapVars: ccap });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-white/80 backdrop-blur-xl px-6 py-4 flex justify-between items-center border-b border-gray-200/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600"><FileText size={18} /></div>
            <div>
              <h2 className="text-base font-black text-slate-800">Champs des documents</h2>
              <p className="text-[10px] text-slate-400 font-medium">Variables communes & spécifiques (CCTP · RC · CCAP)</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-900 hover:bg-gray-100 p-2 rounded-full transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Onglets */}
        <div className="px-6 pt-4 bg-slate-50/50 shrink-0">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = tab === t.key;
              const isCurrent = t.key === activeModule && t.key !== 'common';
              return (
                <button key={t.key} type="button" onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${active ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
                  <Icon size={13} /> {t.label}
                  {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" title="Module courant" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <form id="doc-vars-form" onSubmit={handleSubmit} className="flex-1 p-6 pt-4 bg-slate-50/50 overflow-y-auto flex flex-col gap-4">

          {/* ── COMMUN ── */}
          {tab === 'common' && (
            <>
              <Card title="Maître d'ouvrage" icon={Building2} accent="text-blue-600">
                <Field label="Maître d'ouvrage" name="client" value={form.client} onChange={onForm} icon={Building2} placeholder="Ex: Commune de…" />
                <Field label="Adresse" name="clientAddress" value={form.clientAddress} onChange={onForm} icon={MapPin} placeholder="N° et voie" />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Code postal" name="clientZip" value={form.clientZip} onChange={onForm} icon={Hash} placeholder="31000" />
                  <Field label="Ville" name="clientCity" value={form.clientCity} onChange={onForm} icon={MapPin} placeholder="Toulouse" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Maîtrise d'œuvre" name="moe" value={form.moe} onChange={onForm} icon={Briefcase} placeholder="Bureau d'études…" />
                  <Field label="Adresse MOE" name="moeAddress" value={form.moeAddress} onChange={onForm} icon={MapPin} placeholder="Adresse de la MOE" />
                </div>
              </Card>

              <Card title="Opération" icon={FileText} accent="text-indigo-600">
                <Textarea label="Objet de l'opération" name="projectDescription" value={form.projectDescription} onChange={onForm} icon={FileText} placeholder="Description de l'opération…" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Lieu d'exécution" name="location" value={form.location} onChange={onForm} icon={MapPin} placeholder="Commune / secteur" />
                  <Field label="Référence / code" name="code" value={form.code} onChange={onForm} icon={Hash} placeholder="REF-2026-XX" />
                  <Field label="Département" name="department" value={form.department} onChange={onForm} icon={Globe2} placeholder="Haute-Garonne, 31…" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SelectField label="Phase" name="phase" value={form.phase} onChange={onForm} icon={Layers}
                    options={[{value:'ESQ',label:'ESQ'},{value:'AVP',label:'AVP'},{value:'PRO',label:'PRO'},{value:'DCE',label:'DCE'},{value:'ACT',label:'ACT'},{value:'EXE',label:'EXE'}]} />
                  <SelectField label="Type de marché" name="marketType" value={form.marketType} onChange={onForm} icon={ShieldAlert}
                    options={[{value:'Privé',label:'Privé'},{value:'Public',label:'Public'}]} />
                </div>
              </Card>

              <Card title="Dates & délais" icon={Calendar} accent="text-teal-600">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Date limite de remise des offres" name="dateRemise" type="date" value={form.dateRemise} onChange={onForm} icon={Calendar} />
                  <Field label="Heure limite" name="timeRemise" type="time" value={form.timeRemise} onChange={onForm} icon={Clock} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Durée du contrat" name="duration" value={form.duration} onChange={onForm} icon={Hourglass} placeholder="Ex: 6 mois" />
                  <Field label="Période de préparation" name="prepPeriod" value={form.prepPeriod} onChange={onForm} icon={Hourglass} placeholder="Ex: 1 mois" />
                </div>
                <InfoNote accent="teal">
                  Les <span className="font-black">tranches</span>, <span className="font-black">logos</span> et la <span className="font-black">page de garde</span> se gèrent dans la fiche projet complète (lien en bas).
                </InfoNote>
              </Card>
            </>
          )}

          {/* ── RC ── */}
          {tab === 'rc' && (
            <Card title="Consultation / Règlement (RC)" icon={ShieldAlert} accent="text-cyan-600">
              <Textarea label="Intitulé du lot" name="lotName" value={form.lotName} onChange={onForm} icon={Layers} rows={2}
                placeholder="Ex: LOT unique : TERRASSEMENTS / VOIRIE / RÉSEAUX…" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <SelectField label="Coordination SPS" name="spsLevel" value={form.spsLevel} onChange={onForm} icon={ShieldAlert}
                  options={[{value:'I',label:'Niveau I'},{value:'II',label:'Niveau II'},{value:'III',label:'Niveau III'},{value:'Sans objet',label:'Sans objet'}]} />
                <Field label="Démarrage prévisionnel" name="startDate" value={form.startDate} onChange={onForm} icon={Calendar} placeholder="Ex: septembre 2026" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Validité des offres" name="validityDays" type="number" value={form.validityDays} onChange={onForm} icon={Hourglass} placeholder="120" suffix="jours" />
                <Field label="Plateforme (URL)" name="platformUrl" type="url" value={form.platformUrl} onChange={onForm} icon={Link} placeholder="https://marches-publics…" />
              </div>
              <InfoNote accent="cyan">
                Le tableau des critères <span className="font-black">{'{{criteresTable}}'}</span> est repris automatiquement du module <span className="font-black">RAO</span>.
              </InfoNote>
            </Card>
          )}

          {/* ── CCAP ── */}
          {tab === 'ccap' && (
            <>
              <Card title="Coordination SPS" icon={ShieldAlert} accent="text-teal-600">
                <Field label="Coordonnateur SPS (nom / société)" name="coordonnateur_sps" value={ccap.coordonnateur_sps} onChange={onCcap} icon={ShieldAlert} placeholder="Ex: Bureau Veritas — M. Dupont" />
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  La catégorie SPS <span className="font-black text-slate-500">{'{{categorie_sps}}'}</span> est reprise de l'onglet RC (Coordination SPS).
                </p>
              </Card>
              <Card title="Délais d'exécution (en mois)" icon={CalendarClock} accent="text-blue-600">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Durée globale" name="duree_globale_mois" type="number" value={ccap.duree_globale_mois} onChange={onCcap} icon={CalendarClock} placeholder="6" suffix="mois" />
                  <Field label="Période de préparation" name="duree_preparation_mois" type="number" value={ccap.duree_preparation_mois} onChange={onCcap} icon={Hourglass} placeholder="1" suffix="mois" />
                  <Field label="Durée des travaux" name="duree_travaux_mois" type="number" value={ccap.duree_travaux_mois} onChange={onCcap} icon={Wrench} placeholder="5" suffix="mois" />
                </div>
                {durationIncoherent && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                    <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-[11px] text-red-700 font-bold leading-snug">
                        Durées incohérentes : globale ({dG} mois) ≠ préparation + travaux ({durationSum} mois).
                      </p>
                      <button type="button" onClick={fixDuration}
                        className="mt-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold text-white bg-red-500 hover:bg-red-600 transition-colors">
                        Corriger → durée globale = {durationSum} mois
                      </button>
                    </div>
                  </div>
                )}
              </Card>
              <Card title="Prix & avance" icon={TrendingUp} accent="text-emerald-600">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Index de révision des prix" name="index_revision" value={ccap.index_revision} onChange={onCcap} icon={TrendingUp} placeholder="Ex: TP01, BT01…" />
                  <Field label="Seuil de début de remboursement de l'avance" name="seuil_debut_remboursement_avance" type="number" value={ccap.seuil_debut_remboursement_avance} onChange={onCcap} icon={Percent} placeholder="65" suffix="%" />
                </div>
              </Card>
              <Card title="Pénalités & chantier" icon={Route} accent="text-amber-600">
                <Field label="Voie concernée (pénalités circulation)" name="voie_concernee" value={ccap.voie_concernee} onChange={onCcap} icon={Route} placeholder="Ex: RD 820, Avenue de la Gare…" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Station météo de référence" name="station_meteo" value={ccap.station_meteo} onChange={onCcap} icon={Thermometer} placeholder="Ex: Toulouse-Blagnac" />
                  <Field label="Jours d'intempéries prévisibles" name="jours_intemperies_previsibles" type="number" value={ccap.jours_intemperies_previsibles} onChange={onCcap} icon={CloudRain} placeholder="10" suffix="j" />
                </div>
              </Card>
            </>
          )}

          {/* ── CCTP ── */}
          {tab === 'cctp' && (
            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center gap-3">
              <div className="p-3 rounded-2xl bg-slate-50 text-slate-400"><Layers size={28} /></div>
              <h3 className="text-sm font-black text-slate-700">Le CCTP n'a pas de champ spécifique</h3>
              <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                Le CCTP n'utilise que les champs <span className="font-bold text-slate-500">communs</span> (objet, maître d'ouvrage, lieu, dates…).
              </p>
              <button type="button" onClick={() => setTab('common')}
                className="mt-1 px-4 py-2 rounded-lg text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors">
                Aller à l'onglet Commun
              </button>
            </div>
          )}

        </form>

        {/* Footer */}
        <div className="bg-white border-t border-gray-200/60 px-6 py-4 flex justify-between items-center gap-2 shrink-0">
          <button type="button" onClick={() => { onClose(); onOpenFullSheet?.(); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
            <ExternalLink size={13} /> Fiche projet complète (logos, page de garde, tranches…)
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors uppercase tracking-wider">
              Annuler
            </button>
            <button type="submit" form="doc-vars-form"
              className="px-5 py-2.5 rounded-lg text-xs font-black text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all uppercase tracking-wider flex items-center gap-2 shadow-sm">
              <Save size={14} /> Enregistrer
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DocumentVariablesModal;
