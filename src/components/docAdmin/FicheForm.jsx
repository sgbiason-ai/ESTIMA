// src/components/docAdmin/FicheForm.jsx
// Formulaire de saisie des 4 sections A/B/C/D d'une Fiche Marché
import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, Users, HardHat, FileText, Save, ChevronDown, ChevronRight,
  Plus, Trash2, MapPin, Phone, Mail, Hash, Briefcase, UserPlus, Crown,
  Link2, RefreshCw
} from 'lucide-react';
import { createEmptyEntreprise } from '../../hooks/useFichesMarche';

// ─── Formateur montant avec séparateur de milliers ─────────────────────────
const formatMontant = (value) => {
  if (!value && value !== 0) return '';
  const num = typeof value === 'string' ? parseFloat(value.replace(/\s/g, '').replace(',', '.')) : value;
  if (isNaN(num)) return value;
  return num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseMontant = (formatted) => {
  if (!formatted) return '';
  return formatted.replace(/\s/g, '').replace(',', '.');
};

// ─── Input montant avec séparateur de milliers ─────────────────────────────
const MontantInput = ({ value, onChange }) => {
  const [editing, setEditing] = React.useState(false);
  const [raw, setRaw] = React.useState('');

  const display = value ? formatMontant(value) : '';

  return (
    <input
      type="text"
      value={editing ? raw : display}
      onChange={(e) => { setRaw(e.target.value); onChange(e.target.value); }}
      onFocus={() => {
        setEditing(true);
        setRaw(value ? parseMontant(String(value)) : '');
      }}
      onBlur={() => {
        setEditing(false);
        const parsed = parseMontant(raw);
        if (parsed && !isNaN(parseFloat(parsed))) {
          onChange(formatMontant(parsed));
        }
      }}
      placeholder="0,00"
      className="h-9 w-32 rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-800 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 text-right"
    />
  );
};

// ─── Composant champ de formulaire ──────────────────────────────────────────
const Field = ({ label, value, onChange, placeholder, type = 'text', required, className = '', rows, icon: Icon }) => {
  const isTextarea = rows && rows > 1;
  const InputTag = isTextarea ? 'textarea' : 'input';

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
        {Icon && <Icon size={10} className="text-gray-600" />}
        {label}
        {required && <span className="text-red-400">*</span>}
      </label>
      <InputTag
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`
          px-3 py-2 rounded-xl bg-white border border-gray-300
          text-[13px] text-gray-800 placeholder-gray-400
          hover:border-gray-400
          focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-none
          transition-all duration-200 resize-none
          ${isTextarea ? 'min-h-[72px]' : 'h-9'}
        `}
      />
    </div>
  );
};

// ─── Section pliable ────────────────────────────────────────────────────────
const Section = ({ id, title, subtitle, icon: Icon, color, children, isOpen = true, onToggle }) => {

  const colorMap = {
    emerald: { border: 'border-emerald-200', text: 'text-emerald-700', iconBg: 'bg-emerald-100', hover: 'hover:bg-emerald-50' },
    blue:    { border: 'border-blue-200',    text: 'text-blue-700',    iconBg: 'bg-blue-100',    hover: 'hover:bg-blue-50' },
    amber:   { border: 'border-amber-200',   text: 'text-amber-700',   iconBg: 'bg-amber-100',   hover: 'hover:bg-amber-50' },
    purple:  { border: 'border-purple-200',  text: 'text-purple-700',  iconBg: 'bg-purple-100',  hover: 'hover:bg-purple-50' },
  };

  const c = colorMap[color] || colorMap.emerald;

  return (
    <div className={`rounded-2xl border ${c.border} bg-white overflow-hidden`}>
      <div
        onClick={onToggle ? () => onToggle(id) : undefined}
        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${onToggle ? `${c.hover} cursor-pointer` : ''}`}
      >
        <div className={`p-1.5 rounded-lg ${c.iconBg}`}>
          <Icon size={16} className={c.text} />
        </div>
        <div className="text-left flex-1">
          <h3 className={`text-[11px] font-black uppercase tracking-wider ${c.text}`}>{title}</h3>
          {subtitle && <p className="text-[10px] text-gray-600 mt-0.5">{subtitle}</p>}
        </div>
        {onToggle && (isOpen ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />)}
      </div>

      {isOpen && (
        <div className="px-4 pb-4 pt-3 border-t border-gray-200">
          {children}
        </div>
      )}
    </div>
  );
};

// ─── Bloc réutilisable : champs d'une entreprise ────────────────────────────
// Utilisé pour le mandataire, chaque co-traitant, et le maître d'œuvre
const EntrepriseFields = ({ data, onChange, nameLabel = 'Nom commercial', required = false }) => {
  const update = (field, value) => onChange({ ...data, [field]: value });

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <Field
          label={nameLabel}
          value={data.nomCommercial}
          onChange={(v) => update('nomCommercial', v)}
          placeholder="Nom commercial"
          required={required}
          icon={Briefcase}
        />
        <Field
          label="Dénomination sociale"
          value={data.denominationSociale}
          onChange={(v) => update('denominationSociale', v)}
          placeholder="Forme juridique et raison sociale"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        <Field
          label="Adresse"
          value={data.adresse}
          onChange={(v) => update('adresse', v)}
          placeholder="Adresse du siège social"
          className="md:col-span-3"
          icon={MapPin}
        />
        <Field
          label="Code postal"
          value={data.codePostal}
          onChange={(v) => update('codePostal', v)}
          placeholder="00000"
        />
        <Field
          label="Ville"
          value={data.ville}
          onChange={(v) => update('ville', v)}
          placeholder="Ville"
          className="md:col-span-2"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        <Field
          label="Téléphone"
          value={data.telephone}
          onChange={(v) => update('telephone', v)}
          placeholder="01 23 45 67 89"
          icon={Phone}
        />
        <Field
          label="Télécopie"
          value={data.telecopie}
          onChange={(v) => update('telecopie', v)}
          placeholder="01 23 45 67 89"
        />
        <Field
          label="Email"
          value={data.email}
          onChange={(v) => update('email', v)}
          placeholder="contact@entreprise.fr"
          type="email"
          icon={Mail}
        />
      </div>
      <Field
        label="N° SIRET"
        value={data.siret}
        onChange={(v) => update('siret', v)}
        placeholder="000 000 000 00000"
        icon={Hash}
      />
    </div>
  );
};

// ─── Composant principal ────────────────────────────────────────────────────
export default function FicheForm({
  fiche,
  onSave,
  isSaving,
  onInheritFromProject,
  isProjectSyncing = false,
}) {
  // État local éditable (copie de la fiche)
  const [form, setForm] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  const [activeSection, setActiveSection] = useState('sectionA');

  useEffect(() => {
    setActiveSection('sectionA');
  }, [fiche?.id]);

  // Synchroniser quand la fiche change (sélection d'une autre fiche)
  useEffect(() => {
    if (fiche) {
      // Migration : ancien format sectionB (plat) → nouveau format (mandataire/cotraitants)
      const clone = JSON.parse(JSON.stringify(fiche));
      if (clone.sectionB && !clone.sectionB.mandataire) {
        // Ancien format détecté → migrer
        const { type, typeGroupement, mandataire, cotraitants, isGroupement, ...oldFields } = clone.sectionB;
        clone.sectionB = {
          type: isGroupement ? 'groupement' : 'seul',
          typeGroupement: 'solidaire',
          mandataire: { ...createEmptyEntreprise(), ...oldFields },
          cotraitants: [],
        };
      }
      // Garantir que sectionC est au bon format
      if (clone.sectionC && !clone.sectionC.nomCommercial && clone.sectionC.nomCommercial !== '') {
        clone.sectionC = { ...createEmptyEntreprise(), ...clone.sectionC };
      }
      // Migration : ajouter groupeId aux groupesAttributaires existants
      if (clone.sectionB?.groupesAttributaires) {
        clone.sectionB.groupesAttributaires = clone.sectionB.groupesAttributaires.map((g, i) => {
          if (!g.groupeId) return { ...g, groupeId: `g${i}_${Date.now().toString(36)}` };
          return g;
        });
      }
      setForm(clone);
      setHasChanges(false);
    }
    // La révision Firestore suffit : une émission concernant une autre fiche
    // ne doit pas effacer les saisies locales encore non sauvegardées.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fiche?.id, fiche?.updatedAt]);

  // Helpers de mise à jour
  const updateField = useCallback((section, field, value) => {
    setForm((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
    setHasChanges(true);
  }, []);

  const updateRoot = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  }, []);

  // ── Section B : mandataire ────────────────────────────────────────────────
  const updateMandataire = useCallback((data) => {
    setForm((prev) => ({
      ...prev,
      sectionB: { ...prev.sectionB, mandataire: data },
    }));
    setHasChanges(true);
  }, []);

  // ── Section B : co-traitants ──────────────────────────────────────────────
  const addCotraitant = useCallback(() => {
    setForm((prev) => {
      const cots = prev.sectionB.cotraitants || [];
      if (cots.length >= 2) return prev; // max 2 co-traitants (= groupement de 3)
      return {
        ...prev,
        sectionB: {
          ...prev.sectionB,
          cotraitants: [...cots, createEmptyEntreprise()],
        },
      };
    });
    setHasChanges(true);
  }, []);

  const updateCotraitant = useCallback((index, data) => {
    setForm((prev) => {
      const cots = [...(prev.sectionB.cotraitants || [])];
      cots[index] = data;
      return { ...prev, sectionB: { ...prev.sectionB, cotraitants: cots } };
    });
    setHasChanges(true);
  }, []);

  const removeCotraitant = useCallback((index) => {
    setForm((prev) => {
      const cots = [...(prev.sectionB.cotraitants || [])];
      cots.splice(index, 1);
      return { ...prev, sectionB: { ...prev.sectionB, cotraitants: cots } };
    });
    setHasChanges(true);
  }, []);

  // ── Section C : maître d'œuvre ────────────────────────────────────────────
  const updateSectionC = useCallback((data) => {
    setForm((prev) => ({ ...prev, sectionC: data }));
    setHasChanges(true);
  }, []);

  // ── Gestion des lots ──────────────────────────────────────────────────────
  const addLot = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      sectionD: {
        ...prev.sectionD,
        lots: [...(prev.sectionD.lots || []), { numero: '', designation: '', montantHT: '' }],
      },
    }));
    setHasChanges(true);
  }, []);

  const updateLot = useCallback((index, field, value) => {
    setForm((prev) => {
      const lots = [...(prev.sectionD.lots || [])];
      lots[index] = { ...lots[index], [field]: value };
      return { ...prev, sectionD: { ...prev.sectionD, lots } };
    });
    setHasChanges(true);
  }, []);

  const removeLot = useCallback((index) => {
    setForm((prev) => {
      const lots = [...(prev.sectionD.lots || [])];
      lots.splice(index, 1);
      // Nettoyer les groupes attributaires qui référencent ce lot
      const groupes = (prev.sectionB.groupesAttributaires || []).map((g) => ({
        ...g,
        lotIndices: g.lotIndices.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i)),
      })).filter((g) => g.lotIndices.length > 0);
      return {
        ...prev,
        sectionD: { ...prev.sectionD, lots },
        sectionB: { ...prev.sectionB, groupesAttributaires: groupes },
      };
    });
    setHasChanges(true);
  }, []);

  // Extracted handlers for .map() rows (lots)
  const handleLotFieldChange = useCallback((index, field) => (e) => {
    updateLot(index, field, e.target.value);
  }, [updateLot]);

  const handleLotMontantChange = useCallback((index) => (v) => {
    updateLot(index, 'montantHT', v);
  }, [updateLot]);

  // ── Gestion des groupes attributaires (1 entreprise → N lots) ────────────
  const addGroupeAttributaire = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      sectionB: {
        ...prev.sectionB,
        groupesAttributaires: [
          ...(prev.sectionB.groupesAttributaires || []),
          { groupeId: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), entreprise: createEmptyEntreprise(), lotIndices: [] },
        ],
      },
    }));
    setHasChanges(true);
  }, []);

  const updateGroupeEntreprise = useCallback((gIndex, data) => {
    setForm((prev) => {
      const groupes = [...(prev.sectionB.groupesAttributaires || [])];
      groupes[gIndex] = { ...groupes[gIndex], entreprise: data };
      return { ...prev, sectionB: { ...prev.sectionB, groupesAttributaires: groupes } };
    });
    setHasChanges(true);
  }, []);

  const toggleGroupeLot = useCallback((gIndex, lotIndex) => {
    setForm((prev) => {
      const groupes = [...(prev.sectionB.groupesAttributaires || [])];
      const g = { ...groupes[gIndex] };
      const indices = [...g.lotIndices];
      const pos = indices.indexOf(lotIndex);
      if (pos >= 0) {
        indices.splice(pos, 1);
      } else {
        // Retirer ce lot de tout autre groupe
        groupes.forEach((og, oi) => {
          if (oi !== gIndex && og.lotIndices.includes(lotIndex)) {
            groupes[oi] = { ...og, lotIndices: og.lotIndices.filter((i) => i !== lotIndex) };
          }
        });
        indices.push(lotIndex);
      }
      g.lotIndices = indices;
      groupes[gIndex] = g;
      return { ...prev, sectionB: { ...prev.sectionB, groupesAttributaires: groupes } };
    });
    setHasChanges(true);
  }, []);

  const removeGroupeAttributaire = useCallback((gIndex) => {
    setForm((prev) => {
      const groupes = [...(prev.sectionB.groupesAttributaires || [])];
      const removed = groupes[gIndex];
      groupes.splice(gIndex, 1);
      // Nettoyer exeParEntreprise si le groupe avait un groupeId
      const exePE = { ...(prev.exeParEntreprise || {}) };
      if (removed?.groupeId && exePE[removed.groupeId]) {
        delete exePE[removed.groupeId];
      }
      return { ...prev, sectionB: { ...prev.sectionB, groupesAttributaires: groupes }, exeParEntreprise: exePE };
    });
    setHasChanges(true);
  }, []);

  // Sauvegarde
  const handleSave = async () => {
    if (!form || !onSave) return;
    const success = await onSave(form);
    if (success) setHasChanges(false);
  };

  if (!form) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
        Sélectionnez une fiche marché
      </div>
    );
  }

  const A = form.sectionA || {};
  const B = form.sectionB || {};
  const C = form.sectionC || {};
  const D = form.sectionD || {};

  const lots = D.lots || [];
  const hasLots = lots.length > 0;
  const isGroupement = B.type === 'groupement';
  const cotraitants = B.cotraitants || [];
  const nbEntreprises = 1 + cotraitants.length; // mandataire + co-traitants
  const sectionTabs = [
    { id: 'sectionA', short: 'A', label: 'Maître d’ouvrage', icon: Building2, color: 'emerald' },
    { id: 'sectionD', short: 'D', label: 'Marché', icon: FileText, color: 'purple' },
    { id: 'sectionB', short: 'B', label: hasLots ? 'Attributaires' : 'Titulaire', icon: HardHat, color: 'blue' },
    { id: 'sectionC', short: 'C', label: 'Maître d’œuvre', icon: Users, color: 'amber' },
  ];
  const tabColors = {
    emerald: 'bg-emerald-600 text-white border-emerald-600',
    purple: 'bg-purple-600 text-white border-purple-600',
    blue: 'bg-blue-600 text-white border-blue-600',
    amber: 'bg-amber-600 text-white border-amber-600',
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header avec nom + bouton save */}
      <div className="flex items-center gap-3 px-5 py-3 bg-white/90 backdrop-blur-xl border-b border-gray-200 shrink-0 z-10">
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={form.nom || ''}
            onChange={(e) => updateRoot('nom', e.target.value)}
            placeholder="Nom du marché..."
            className="w-full truncate bg-transparent text-base font-black text-gray-900 outline-none placeholder-gray-400"
          />
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-600">
            <span>
            Créée le {new Date(form.createdAt).toLocaleDateString('fr-FR')}
            {form.updatedAt && ` · Modifiée le ${new Date(form.updatedAt).toLocaleDateString('fr-FR')}`}
            </span>
            {form.sourceEstima?.projectId && (
              <span className="flex min-w-0 items-center gap-1.5 font-semibold text-blue-700">
                <Link2 size={11} className="shrink-0" />
                <span className="truncate">
                Affaire liée : {form.sourceEstima.projectName || 'Sans nom'}
                {form.sourceEstima.projectCode ? ` · ${form.sourceEstima.projectCode}` : ''}
                </span>
              </span>
            )}
          </div>
        </div>

        {onInheritFromProject && (
          <button
            type="button"
            onClick={() => onInheritFromProject(form)}
            disabled={isProjectSyncing}
            className="flex h-9 shrink-0 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-[10px] font-black uppercase tracking-wider text-blue-700 transition-all hover:border-blue-300 hover:bg-blue-100 active:scale-[0.98] disabled:opacity-50"
          >
            {isProjectSyncing
              ? <RefreshCw size={14} className="animate-spin" />
              : form.sourceEstima?.projectId
                ? <RefreshCw size={14} />
                : <Link2 size={14} />}
            {form.sourceEstima?.projectId ? 'Actualiser' : 'Lier une affaire'}
          </button>
        )}

        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className={`
              flex h-9 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-bold transition-all duration-200
            ${hasChanges
                ? 'bg-emerald-600 border border-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98]'
              : 'bg-gray-100 border border-gray-200 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          <Save size={16} />
          <span className="text-[10px] font-black uppercase tracking-widest">
            {isSaving ? 'Sauvegarde...' : hasChanges ? 'Sauvegarder' : 'Sauvegardé'}
          </span>
        </button>
      </div>

      <div className="shrink-0 border-b border-gray-200 bg-white px-5 py-2">
        <div className="flex w-full max-w-3xl items-center gap-1 overflow-x-auto rounded-2xl bg-gray-100 p-1">
          {sectionTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id)}
                className={`flex min-w-max flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-bold transition-all ${
                  isActive
                    ? tabColors[tab.color]
                    : 'border-transparent text-gray-600 hover:bg-white hover:text-gray-900'
                }`}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-black ${
                  isActive ? 'bg-white/20' : 'bg-white text-gray-500'
                }`}>
                  {tab.short}
                </span>
                <Icon size={14} strokeWidth={1.75} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Formulaire scrollable */}
      <div className="flex-1 overflow-y-auto px-5 py-4">

        {/* ── Section A : Pouvoir adjudicateur ────────────────────────────── */}
        {activeSection === 'sectionA' && (
        <Section
          id="sectionA"
          title="A — Pouvoir adjudicateur / Maître d'ouvrage"
          subtitle="Collectivité ou organisme acheteur"
          icon={Building2}
          color="emerald"
        >
          <div className="space-y-3">
            <Field
              label="Désignation"
              value={A.designation}
              onChange={(v) => updateField('sectionA', 'designation', v)}
              placeholder="Nom de la collectivité ou de l'organisme"
              required
              icon={Building2}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field
                label="Adresse"
                value={A.adresse}
                onChange={(v) => updateField('sectionA', 'adresse', v)}
                placeholder="Rue, numéro..."
                className="md:col-span-3"
                icon={MapPin}
              />
              <Field
                label="Code postal"
                value={A.codePostal}
                onChange={(v) => updateField('sectionA', 'codePostal', v)}
                placeholder="00000"
              />
              <Field
                label="Ville"
                value={A.ville}
                onChange={(v) => updateField('sectionA', 'ville', v)}
                placeholder="Ville"
                className="md:col-span-2"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field
                label="Téléphone"
                value={A.telephone}
                onChange={(v) => updateField('sectionA', 'telephone', v)}
                placeholder="01 23 45 67 89"
                icon={Phone}
              />
              <Field
                label="Télécopie"
                value={A.telecopie}
                onChange={(v) => updateField('sectionA', 'telecopie', v)}
                placeholder="01 23 45 67 89"
              />
              <Field
                label="Email"
                value={A.email}
                onChange={(v) => updateField('sectionA', 'email', v)}
                placeholder="contact@collectivite.fr"
                type="email"
                icon={Mail}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field
                label="Représentant"
                value={A.representant}
                onChange={(v) => updateField('sectionA', 'representant', v)}
                placeholder="Nom du représentant"
              />
              <Field
                label="Qualité"
                value={A.qualite}
                onChange={(v) => updateField('sectionA', 'qualite', v)}
                placeholder="Maire, Président, Directeur..."
              />
            </div>
          </div>
        </Section>
        )}

        {/* ── Section D : Objet du marché (affiché avant B pour définir les lots d'abord) ── */}
        {activeSection === 'sectionD' && (
        <Section
          id="sectionD"
          title="D — Objet du marché"
          subtitle="Description, référence et lots"
          icon={FileText}
          color="purple"
        >
          <div className="space-y-3">
            <Field
              label="Objet du marché"
              value={D.objet}
              onChange={(v) => updateField('sectionD', 'objet', v)}
              placeholder="Description de l'objet du marché public..."
              rows={3}
              required
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field
                label="Référence du marché"
                value={D.referenceMarche}
                onChange={(v) => updateField('sectionD', 'referenceMarche', v)}
                placeholder="N° de référence"
                icon={Hash}
              />
              <Field
                label="Date de notification"
                value={D.dateNotification}
                onChange={(v) => updateField('sectionD', 'dateNotification', v)}
                type="date"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <Field
                label="Période de préparation (mois)"
                value={D.dureePeriodePreparation}
                onChange={(v) => updateField('sectionD', 'dureePeriodePreparation', v)}
                placeholder="0"
              />
              <Field
                label="Durée des travaux (mois)"
                value={D.dureeExecution}
                onChange={(v) => updateField('sectionD', 'dureeExecution', v)}
                placeholder="12"
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Durée prévisionnelle (mois)</label>
                <div className="px-3.5 py-2.5 h-10 rounded-xl bg-emerald-50 border border-emerald-300 text-sm font-bold text-emerald-700 flex items-center justify-center shadow-inner">
                  {((parseFloat(D.dureePeriodePreparation) || 0) + (parseFloat(D.dureeExecution) || 0)) || '—'} mois
                </div>
              </div>
            </div>
            <Field
              label="Adresse d'exécution des prestations"
              value={D.adresseExecution}
              onChange={(v) => updateField('sectionD', 'adresseExecution', v)}
              placeholder="Lieu d'exécution des travaux"
              icon={MapPin}
            />

            {/* Lots */}
            <div className="mt-2">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  Lots (optionnel)
                </label>
                <button
                  onClick={addLot}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-all"
                >
                  <Plus size={12} />
                  Ajouter un lot
                </button>
              </div>

              {(D.lots || []).length > 0 && (
                <div className="space-y-2">
                  {D.lots.map((lot, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-gray-300 hover:border-gray-400 transition-all shadow-sm">
                      <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 w-12 shrink-0 text-center">
                        Lot {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={lot.numero || ''}
                        onChange={handleLotFieldChange(idx, 'numero')}
                        placeholder="N°"
                        className="w-16 px-2 py-1.5 rounded bg-white border border-gray-300 text-xs text-gray-800 placeholder-gray-400 focus:border-emerald-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={lot.designation || ''}
                        onChange={handleLotFieldChange(idx, 'designation')}
                        placeholder="Désignation du lot"
                        className="flex-1 px-2 py-1.5 rounded bg-white border border-gray-300 text-xs text-gray-800 placeholder-gray-400 focus:border-emerald-500 focus:outline-none"
                      />
                      <MontantInput
                        value={lot.montantHT}
                        onChange={handleLotMontantChange(idx)}
                      />
                      <span className="text-[10px] text-gray-400 shrink-0">€ HT</span>
                      <button
                        onClick={() => removeLot(idx)}
                        className="p-1.5 rounded text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {(D.lots || []).length === 0 && (
                <p className="text-[10px] text-gray-500 italic">Aucun lot défini — marché non alloti</p>
              )}
            </div>
          </div>
        </Section>
        )}

        {/* ── Section B : Titulaire(s) du marché ─────────────────────────────── */}
        {activeSection === 'sectionB' && (() => {
          const groupes = B.groupesAttributaires || [];
          const assignedLotIndices = new Set(groupes.flatMap((g) => g.lotIndices));
          const unassignedLots = lots.map((_, i) => i).filter((i) => !assignedLotIndices.has(i));

          return (
            <Section
              id="sectionB"
              title={hasLots ? 'B — Attributaires' : 'B — Titulaire du marché'}
              subtitle={hasLots
                ? `${groupes.length} entreprise${groupes.length > 1 ? 's' : ''} — ${lots.length} lot${lots.length > 1 ? 's' : ''}`
                : isGroupement
                  ? `Groupement ${B.typeGroupement || 'solidaire'} de ${nbEntreprises} entreprise${nbEntreprises > 1 ? 's' : ''}`
                  : 'Entreprise seule'
              }
              icon={HardHat}
              color="blue"
            >
              {hasLots ? (
                /* ── Mode alloti : groupes attributaires ──────────────────────── */
                <div className="space-y-6">
                  {groupes.map((groupe, gIdx) => (
                    <div key={gIdx} className="rounded-xl border border-blue-500/20 bg-blue-500/5 overflow-hidden">
                      {/* Header du groupe */}
                      <div className="flex items-center gap-2 px-4 py-3 bg-blue-500/10 border-b border-blue-500/15">
                        <HardHat size={14} className="text-blue-400" />
                        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-400 flex-1">
                          Attributaire {gIdx + 1}
                          {groupe.entreprise?.nomCommercial && (
                            <span className="text-blue-300 ml-2 normal-case tracking-normal font-bold">
                              — {groupe.entreprise.nomCommercial}
                            </span>
                          )}
                        </span>
                        <button
                          onClick={() => removeGroupeAttributaire(gIdx)}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold text-red-400/60 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
                        >
                          <Trash2 size={11} />
                          Retirer
                        </button>
                      </div>

                      <div className="p-4 space-y-4">
                        {/* Sélection des lots */}
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">
                            Lots attribués
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {lots.map((lot, lotIdx) => {
                              const isSelected = groupe.lotIndices.includes(lotIdx);
                              const isInOtherGroup = !isSelected && assignedLotIndices.has(lotIdx);
                              return (
                                <button
                                  key={lotIdx}
                                  onClick={() => toggleGroupeLot(gIdx, lotIdx)}
                                  className={`
                                    px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border
                                    ${isSelected
                                      ? 'bg-blue-100 text-blue-700 border-blue-300'
                                      : isInOtherGroup
                                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-pointer'
                                        : 'bg-white text-gray-500 border-gray-300 hover:border-blue-400 hover:text-blue-400'
                                    }
                                  `}
                                >
                                  Lot {lot.numero || lotIdx + 1}
                                  {lot.designation && (
                                    <span className="ml-1 normal-case tracking-normal font-normal text-[9px] opacity-70">
                                      {lot.designation.length > 20 ? lot.designation.slice(0, 20) + '...' : lot.designation}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Champs entreprise */}
                        <EntrepriseFields
                          data={groupe.entreprise || createEmptyEntreprise()}
                          onChange={(data) => updateGroupeEntreprise(gIdx, data)}
                          nameLabel={`Nom commercial`}
                        />
                      </div>
                    </div>
                  ))}

                  {/* Indicateur lots non attribués */}
                  {unassignedLots.length > 0 && groupes.length > 0 && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15">
                      <span className="text-[9px] font-bold text-amber-500/80 uppercase tracking-wider">
                        Lots non attribués :
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {unassignedLots.map((i) => `Lot ${lots[i].numero || i + 1}`).join(', ')}
                      </span>
                    </div>
                  )}

                  {/* Bouton ajouter attributaire */}
                  <button
                    onClick={addGroupeAttributaire}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-blue-500/20 text-blue-400/60 hover:text-blue-400 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all"
                  >
                    <UserPlus size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      Ajouter un attributaire
                    </span>
                  </button>
                </div>
              ) : (
                /* ── Mode non alloti : entreprise seule ou groupement ──────────── */
                <div className="space-y-4">

                  {/* Sélecteur : Entreprise seule / Groupement */}
                  <div className="flex items-center gap-2 p-1 rounded-xl bg-gray-50 border border-gray-300 w-fit shadow-inner">
                    <button
                      onClick={() => updateField('sectionB', 'type', 'seul')}
                      className={`
                        px-4 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all
                        ${!isGroupement
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'text-gray-500 hover:text-gray-700 border border-transparent'
                        }
                      `}
                    >
                      Entreprise seule
                    </button>
                    <button
                      onClick={() => updateField('sectionB', 'type', 'groupement')}
                      className={`
                        px-4 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all
                        ${isGroupement
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'text-gray-500 hover:text-gray-700 border border-transparent'
                        }
                      `}
                    >
                      Groupement
                    </button>
                  </div>

                  {/* Type de groupement (si groupement) */}
                  {isGroupement && (
                    <div className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 border border-gray-200">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Type :</span>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="typeGroupement"
                          value="solidaire"
                          checked={(B.typeGroupement || 'solidaire') === 'solidaire'}
                          onChange={() => updateField('sectionB', 'typeGroupement', 'solidaire')}
                          className="w-3.5 h-3.5 text-blue-500 border-gray-300 bg-white focus:ring-blue-200"
                        />
                        <span className="text-xs text-gray-700">Solidaire</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="typeGroupement"
                          value="conjoint"
                          checked={B.typeGroupement === 'conjoint'}
                          onChange={() => updateField('sectionB', 'typeGroupement', 'conjoint')}
                          className="w-3.5 h-3.5 text-blue-500 border-gray-300 bg-white focus:ring-blue-200"
                        />
                        <span className="text-xs text-gray-700">Conjoint</span>
                      </label>
                    </div>
                  )}

                  {/* ── Mandataire (ou entreprise seule) ──────────────────────────── */}
                  <div className="relative">
                    {isGroupement && (
                      <div className="flex items-center gap-2 mb-3 ml-1">
                        <Crown size={12} className="text-amber-400" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                          Mandataire du groupement
                        </span>
                        <div className="flex-1 h-px bg-amber-500/20 ml-2" />
                      </div>
                    )}
                    <EntrepriseFields
                      data={B.mandataire || createEmptyEntreprise()}
                      onChange={updateMandataire}
                      nameLabel={isGroupement ? 'Nom commercial (mandataire)' : 'Nom commercial'}
                      required
                    />
                  </div>

                  {/* ── Co-traitants (si groupement) ──────────────────────────────── */}
                  {isGroupement && (
                    <div className="space-y-4">
                      {cotraitants.map((cot, idx) => (
                        <div key={idx} className="relative">
                          <div className="flex items-center gap-2 mb-3 ml-1">
                            <Users size={12} className="text-blue-400" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">
                              Co-traitant {idx + 1}
                            </span>
                            <div className="flex-1 h-px bg-blue-500/20 ml-2" />
                            <button
                              onClick={() => removeCotraitant(idx)}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold text-red-400/60 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
                            >
                              <Trash2 size={11} />
                              Retirer
                            </button>
                          </div>
                          <EntrepriseFields
                            data={cot}
                            onChange={(data) => updateCotraitant(idx, data)}
                            nameLabel={`Nom commercial (co-traitant ${idx + 1})`}
                          />
                        </div>
                      ))}

                      {/* Bouton ajouter co-traitant */}
                      {cotraitants.length < 2 && (
                        <button
                          onClick={addCotraitant}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-blue-500/20 text-blue-400/60 hover:text-blue-400 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all"
                        >
                          <UserPlus size={16} />
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            Ajouter un co-traitant ({cotraitants.length + 1}/2)
                          </span>
                        </button>
                      )}

                      {/* Récap du groupement */}
                      <div className="flex items-center gap-3 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
                        <span className="text-[9px] font-bold text-blue-400/60 uppercase tracking-wider">
                          Groupement {B.typeGroupement || 'solidaire'} :
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {B.mandataire?.nomCommercial || '(mandataire)'}{' '}
                          {cotraitants.map((c, i) => `+ ${c.nomCommercial || `(co-traitant ${i + 1})`}`).join(' ')}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Section>
          );
        })()}

        {/* ── Section C : Maître d'œuvre ───────────────────────────────────── */}
        {activeSection === 'sectionC' && (
        <Section
          id="sectionC"
          title="C — Maître d'œuvre"
          subtitle="Bureau d'études ou service technique"
          icon={Users}
          color="amber"
        >
          <EntrepriseFields
            data={C}
            onChange={updateSectionC}
            required
          />
        </Section>
        )}

      </div>
    </div>
  );
}
