/* eslint-disable react-refresh/only-export-components -- fichier mêlant volontairement composants et helpers/constantes (règle DX Fast-Refresh, sans impact fonctionnel) */
// src/components/docAdmin/Exe1Form.jsx
// Formulaire spécifique pour l'EXE1-T (Ordre de Service)
// Les sections A/B/C/D viennent de la Fiche Marché, ce formulaire gère E/F/G
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  ArrowLeft, FileText, Plus, Trash2, MapPin, Clock,
  Pen, FileDown, Loader, Save, ChevronDown, ChevronRight, ChevronUp,
  Play, Pause, RotateCcw
} from 'lucide-react';
import { RibbonGroup, RibbonBtnLarge, RibbonBtnSmall, RibbonContainer, RibbonHeader, RibbonSpacer } from '../../components/common/RibbonParts';

// ─── Modèle vide des données EXE1 ──────────────────────────────────────────
export const OS_TYPES = [
  { value: 'preparation', label: 'Démarrage période de préparation' },
  { value: 'demarrage', label: 'Démarrage des travaux' },
  { value: 'arret', label: 'Arrêt des travaux' },
  { value: 'reprise', label: 'Reprise des travaux' },
];

export const createEmptyExe1Data = (numero = '1') => ({
  // En-tête
  typeOS: 'demarrage',  // 'demarrage' | 'arret' | 'reprise'
  numeroOrdreService: numero,

  // Section E — Prestations ordonnées
  adresseExecution: '',     // pré-rempli depuis sectionD si dispo
  delaiExecution: '',
  dateDemarragePrestations: '',
  autresPrecisions: '',
  prestations: [
    { designation: '', quantite: '', tva: '', prixUnitaire: '' },
  ],

  // Section F — Signature maître d'œuvre
  lieuSignatureMoe: '',
  dateSignatureMoe: '',

  // Section G — Accusé de réception
  dateReception: '',
  observations: '',
  lieuSignatureTitulaire: '',
  dateSignatureTitulaire: '',
});

// ─── Section pliable ────────────────────────────────────────────────────────
const Section = ({ id, title, subtitle, icon: Icon, color, children, isOpen, onToggle }) => {

  const colorMap = {
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', iconBg: 'bg-emerald-100', hover: 'hover:bg-emerald-100' },
    blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-600',    iconBg: 'bg-blue-100', hover: 'hover:bg-blue-100' },
    amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-600',   iconBg: 'bg-amber-100', hover: 'hover:bg-amber-100' },
    slate:   { bg: 'bg-gray-50',   border: 'border-gray-300',       text: 'text-gray-700',   iconBg: 'bg-gray-200', hover: 'hover:bg-gray-100' },
  };

  const c = colorMap[color] || colorMap.emerald;

  return (
    <div className={`rounded-2xl border ${c.border} ${c.bg} overflow-hidden`}>
      <button
        onClick={() => onToggle(id)}
        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${c.hover}`}
      >
        {Icon && (
          <div className={`p-1.5 rounded-lg ${c.iconBg}`}>
            <Icon size={16} className={c.text} />
          </div>
        )}
        <div className="text-left flex-1">
          <h3 className={`text-xs font-black uppercase tracking-wider ${c.text}`}>{title}</h3>
          {subtitle && <p className="text-[10px] text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {isOpen ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-3 border-t border-gray-200">
          {children}
        </div>
      )}
    </div>
  );
};

// ─── Composant champ ────────────────────────────────────────────────────────
const Field = ({ label, value, onChange, placeholder, type = 'text', className = '', rows, icon: Icon }) => {
  const isTextarea = rows && rows > 1;
  const InputTag = isTextarea ? 'textarea' : 'input';

  // Formatage forcé en YYYY-MM-DD pour que le sélecteur <input type="date"> natif s'affiche bien
  let displayValue = value || '';
  if (type === 'date' && value) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      displayValue = `${year}-${month}-${day}`;
    }
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
        {Icon && <Icon size={10} className="text-gray-600" />}
        {label}
      </label>
      <InputTag
        type={type}
        value={displayValue}
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

// ─── Composant principal ────────────────────────────────────────────────────
export default function Exe1Form({ fiche, onBack, onGenerate, onSave, isSaving }) {
  const [dataList, setDataList] = useState(() => {
    let list = [];
    if (fiche?.exe1) {
      // Rétrocompatibilité : si c'était un objet seul, on le met dans un tableau
      list = Array.isArray(fiche.exe1) ? fiche.exe1 : [fiche.exe1];
    }
    // Si la liste est vide, on initialise le premier OS
    if (list.length === 0) {
      const d = createEmptyExe1Data('1');
      if (fiche?.sectionD) {
        d.adresseExecution = fiche.sectionD.adresseExecution || '';
        // Pré-remplir le délai selon le type d'OS (préparation ou travaux)
        if (d.typeOS === 'preparation' && fiche.sectionD.dureePeriodePreparation) {
          d.delaiExecution = `${fiche.sectionD.dureePeriodePreparation} mois`;
        } else if (fiche.sectionD.dureeExecution) {
          d.delaiExecution = `${fiche.sectionD.dureeExecution} mois`;
        }
        // Pré-remplir les prestations avec les lots (désignation + montant HT)
        const lots = fiche.sectionD.lots || [];
        if (lots.length > 0) {
          d.prestations = lots.map((lot) => {
            const raw = (lot.montantHT || '').replace(/\s/g, '').replace(',', '.');
            return {
              designation: `Lot ${lot.numero || '?'} — ${lot.designation || ''}`.trim(),
              quantite: '1',
              tva: '20',
              prixUnitaire: raw && !isNaN(parseFloat(raw)) ? parseFloat(raw).toFixed(2) : '',
            };
          });
        }
      }
      list = [d];
    }
    return list;
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // État des sections
  const [openSections, setOpenSections] = useState({
    infos: true,
    sectionE: true,
    sectionF: true,
    sectionG: true,
  });

  const toggleSection = useCallback((id) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const expandAll = () => setOpenSections({ infos: true, sectionE: true, sectionF: true, sectionG: true });
  const collapseAll = () => setOpenSections({ infos: false, sectionE: false, sectionF: false, sectionG: false });

  // Les données de l'onglet actif
  const data = dataList[activeIndex] || createEmptyExe1Data('1');

  // Helpers
  const update = useCallback((field, value) => {
    setDataList((prev) => {
      const newList = [...prev];
      newList[activeIndex] = { ...newList[activeIndex], [field]: value };
      return newList;
    });
  }, [activeIndex]);

  // Prestations
  const updatePrestation = useCallback((index, field, value) => {
    setDataList((prev) => {
      const newList = [...prev];
      const prestations = [...(newList[activeIndex].prestations || [])];
      prestations[index] = { ...prestations[index], [field]: value };
      newList[activeIndex] = { ...newList[activeIndex], prestations };
      return newList;
    });
  }, [activeIndex]);

  const addPrestation = useCallback(() => {
    setDataList((prev) => {
      const newList = [...prev];
      const prestations = [...(newList[activeIndex].prestations || []), { designation: '', quantite: '', tva: '', prixUnitaire: '' }];
      newList[activeIndex] = { ...newList[activeIndex], prestations };
      return newList;
    });
  }, [activeIndex]);

  const removePrestation = useCallback((index) => {
    setDataList((prev) => {
      const newList = [...prev];
      if (!newList[activeIndex]) return prev;
      const prestations = [...(newList[activeIndex].prestations || [])];
      prestations.splice(index, 1);
      if (prestations.length === 0) {
        prestations.push({ designation: '', quantite: '', tva: '', prixUnitaire: '' });
      }
      newList[activeIndex] = { ...newList[activeIndex], prestations };
      return newList;
    });
  }, [activeIndex]);

  // Ajouter un nouvel Ordre de Service
  const addOS = () => {
    setDataList((prev) => {
      const newNumero = String(prev.length + 1);
      const d = createEmptyExe1Data(newNumero);
      if (fiche?.sectionD) {
        d.adresseExecution = fiche.sectionD.adresseExecution || '';
      }
      return [...prev, d];
    });
    setActiveIndex(dataList.length); // Sélectionne le nouveau à la fin
  };

  // Supprimer un Ordre de Service (avec confirmation)
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState(null);

  const confirmDeleteOS = (idx) => {
    setPendingDeleteIndex(idx);
  };

  const cancelDelete = () => {
    setPendingDeleteIndex(null);
  };

  const executeDelete = () => {
    if (pendingDeleteIndex === null) return;
    setDataList((prev) => {
      const newList = prev.filter((_, i) => i !== pendingDeleteIndex);
      if (newList.length === 0) {
        const d = createEmptyExe1Data('1');
        if (fiche?.sectionD) d.adresseExecution = fiche.sectionD.adresseExecution || '';
        return [d];
      }
      return newList;
    });
    setActiveIndex((prev) => {
      if (pendingDeleteIndex <= prev && prev > 0) return prev - 1;
      return prev;
    });
    setPendingDeleteIndex(null);
  };

  // ─── Sauvegarde automatique ───────────────────────────────────────────────
  const saveTimeoutRef = useRef(null);
  const lastSavedDataRef = useRef(JSON.stringify(dataList));

  useEffect(() => {
    const currentDataString = JSON.stringify(dataList);
    if (currentDataString === lastSavedDataRef.current) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      if (onSave) {
        await onSave({ ...fiche, exe1: dataList });
        lastSavedDataRef.current = currentDataString;
      }
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [dataList, fiche, onSave]);

  // Calcul total d'une ligne
  const lineTotal = (p) => {
    const q = parseFloat(p.quantite) || 0;
    const pu = parseFloat(p.prixUnitaire) || 0;
    return q * pu;
  };

  const grandTotal = (data.prestations || []).reduce((sum, p) => sum + lineTotal(p), 0);

  // Génération
  const handleGenerate = async (format) => {
    setIsGenerating(true);
    try {
      await onGenerate(data, format);
    } finally {
      setIsGenerating(false);
    }
  };

  // Sauvegarde
  const handleSave = async () => {
    if (onSave) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      await onSave({ ...fiche, exe1: dataList });
      lastSavedDataRef.current = JSON.stringify(dataList);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* ── Ribbon Office ── */}
      <div className="font-[system-ui,'Segoe_UI',sans-serif] select-none shrink-0 z-10">
        <RibbonHeader
          title={`EXE1-T — Ordre de Service  ·  ${fiche?.nom || 'Sans nom'}`}
          rightContent={isSaving ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-purple-600">
              <Loader size={10} className="animate-spin" /> Sauvegarde...
            </span>
          ) : null}
        />
        <RibbonContainer compact>

          <RibbonGroup label="Navigation">
            <RibbonBtnLarge icon={ArrowLeft} label="Retour" onClick={onBack} title="Retour à la fiche marché" />
          </RibbonGroup>

          <RibbonGroup label="Affichage">
            <div className="flex flex-col gap-0.5 w-[110px]">
              <RibbonBtnSmall icon={ChevronDown} label="Tout déplier" onClick={expandAll} />
              <RibbonBtnSmall icon={ChevronUp} label="Tout replier" onClick={collapseAll} />
            </div>
          </RibbonGroup>

          <RibbonGroup label="Ordres de service">
            <RibbonBtnLarge icon={Plus} label="Nouvel OS" onClick={addOS} accent="text-emerald-600" title="Ajouter un Ordre de Service" />
          </RibbonGroup>

          <RibbonSpacer />

          <RibbonGroup label="Enregistrer">
            <RibbonBtnLarge icon={Save} label={isSaving ? 'Enreg...' : 'Enregistrer'} onClick={handleSave} disabled={isSaving} accent="text-purple-500" title="Enregistrer les données EXE1" />
          </RibbonGroup>

          <RibbonGroup label="Exporter" noBorder>
            <RibbonBtnLarge icon={FileText} label={isGenerating ? 'Word...' : 'Word'} onClick={() => handleGenerate('docx')} disabled={!!isGenerating} accent="text-blue-500" title="Générer EXE1-T en .docx" />
            <RibbonBtnLarge icon={FileDown} label={isGenerating ? 'PDF...' : 'PDF'} onClick={() => handleGenerate('pdf')} disabled={!!isGenerating} accent="text-red-500" title="Générer EXE1-T en .pdf" />
          </RibbonGroup>

        </RibbonContainer>
      </div>

      {/* ── Liste des Ordres de Service ── */}
      <div className="shrink-0 px-5 pt-3 pb-3 border-b border-gray-300 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
            Ordres de Service ({dataList.length})
          </h3>
          <button
            onClick={addOS}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            title="Ajouter un nouvel Ordre de Service"
          >
            <Plus size={13} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Nouvel OS</span>
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {dataList.map((os, idx) => {
            const isActive = activeIndex === idx;
            const typeConfig = {
              preparation: { icon: Clock, color: 'purple', label: 'Préparation' },
              demarrage: { icon: Play,       color: 'blue',   label: 'Démarrage' },
              arret:     { icon: Pause,      color: 'red',    label: 'Arrêt' },
              reprise:   { icon: RotateCcw,  color: 'green',  label: 'Reprise' },
            };
            const cfg = typeConfig[os.typeOS] || typeConfig.demarrage;
            const TypeIcon = cfg.icon;

            const colorClasses = {
              purple: { active: 'bg-purple-50 border-purple-400', dot: 'bg-purple-500', text: 'text-purple-600', muted: 'text-purple-500' },
              blue:  { active: 'bg-blue-50 border-blue-400', dot: 'bg-blue-500', text: 'text-blue-600', muted: 'text-blue-500' },
              red:   { active: 'bg-red-50 border-red-400', dot: 'bg-red-500', text: 'text-red-600', muted: 'text-red-500' },
              green: { active: 'bg-green-50 border-green-400', dot: 'bg-green-500', text: 'text-green-600', muted: 'text-green-500' },
            };
            const cc = colorClasses[cfg.color];

            const osDate = os.dateDemarragePrestations;
            const formattedDate = osDate ? new Date(osDate).toLocaleDateString('fr-FR') : null;

            return (
              <div
                key={idx}
                className={`relative flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all duration-200 min-w-[170px] group ${
                  isActive
                    ? `${cc.active}`
                    : 'bg-white border-gray-200 hover:border-gray-400 hover:bg-gray-100'
                }`}
                onClick={() => setActiveIndex(idx)}
              >
                {/* Icône type */}
                <div className={`p-1.5 rounded-lg ${isActive ? `${cc.text} bg-gray-100` : 'text-gray-500 bg-gray-100'}`}>
                  <TypeIcon size={14} />
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-black ${isActive ? 'text-gray-800' : 'text-gray-700'}`}>
                      OS N°{os.numeroOrdreService || idx + 1}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                      isActive ? `${cc.muted} bg-gray-100` : 'text-gray-500 bg-gray-100'
                    }`}>
                      {cfg.label}
                    </span>
                  </div>
                  {formattedDate && (
                    <p className={`text-[10px] mt-0.5 ${isActive ? 'text-gray-500' : 'text-gray-600'}`}>
                      {formattedDate}
                    </p>
                  )}
                </div>

                {/* Bouton supprimer */}
                <button
                  onClick={(e) => { e.stopPropagation(); confirmDeleteOS(idx); }}
                  className="p-1 rounded-md text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
                  title="Supprimer cet OS"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Formulaire scrollable */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

        {/* N° Ordre de service + Type */}
        <Section
          id="infos"
          title="Informations Générales"
          subtitle="Numéro et type d'ordre de service"
          icon={FileText}
          color="slate"
          isOpen={openSections.infos}
          onToggle={toggleSection}
        >
          <div className="space-y-4">
          <Field
            label="N° Ordre de Service"
            value={data.numeroOrdreService}
            onChange={(v) => update('numeroOrdreService', v)}
            placeholder="001, OS-2024-001..."
            icon={FileText}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
              <FileText size={10} className="text-gray-600" />
              Type d'ordre de service
            </label>
            <div className="flex items-center gap-2 p-1 rounded-xl bg-white border border-gray-300 w-fit shadow-inner">
              {OS_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => {
                    update('typeOS', t.value);
                    // Mettre à jour le délai selon le type d'OS
                    const D = fiche?.sectionD || {};
                    if (t.value === 'preparation' && D.dureePeriodePreparation) {
                      update('delaiExecution', `${D.dureePeriodePreparation} mois`);
                    } else if (t.value === 'demarrage' && D.dureeExecution) {
                      update('delaiExecution', `${D.dureeExecution} mois`);
                    }
                  }}
                  className={`flex-1 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${
                    data.typeOS === t.value
                      ? 'bg-emerald-50 border border-emerald-400 text-emerald-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 border border-transparent'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          </div>
        </Section>

        {/* ── Section E : Prestations ordonnées ──────────────────────────── */}
        <Section
          id="sectionE"
          title="E — Prestations ordonnées"
          icon={FileText}
          color="emerald"
          isOpen={openSections.sectionE}
          onToggle={toggleSection}
        >
          <div className="space-y-4">
            <Field
              label="Adresse d'exécution des prestations"
              value={data.adresseExecution}
              onChange={(v) => update('adresseExecution', v)}
              placeholder="Lieu d'exécution des travaux"
              icon={MapPin}
            />
            <Field
              label="Délai d'exécution des prestations ordonnées"
              value={data.delaiExecution}
              onChange={(v) => update('delaiExecution', v)}
              placeholder="Ex: 3 mois à compter de la notification de l'OS"
              icon={Clock}
            />
            <Field
              label={data.typeOS === 'arret' ? "Date d'arrêt des travaux" : data.typeOS === 'reprise' ? 'Date de reprise des travaux' : data.typeOS === 'preparation' ? 'Date de démarrage de la période de préparation' : 'Date de démarrage des prestations'}
              value={data.dateDemarragePrestations}
              onChange={(v) => update('dateDemarragePrestations', v)}
              type="date"
            />
            <Field
              label="Autres précisions"
              value={data.autresPrecisions}
              onChange={(v) => update('autresPrecisions', v)}
              placeholder="À renseigner le cas échéant..."
              rows={2}
            />

            {/* Tableau des prestations */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    Tableau des prestations
                  </label>
                  {(fiche?.sectionD?.lots || []).length > 0 && (
                    <span className="text-[9px] text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                      Montants des lots repris par défaut
                    </span>
                  )}
                </div>
                <button
                  onClick={addPrestation}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                >
                  <Plus size={12} />
                  Ligne
                </button>
              </div>

              {/* En-têtes du tableau */}
              <div className="grid grid-cols-[1fr_80px_70px_100px_100px_36px] gap-2 mb-2 px-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-600">Désignation</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-600">Quantité</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-600">TVA %</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-600">Prix unit.</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-600 text-right">Total</span>
                <span></span>
              </div>

              {/* Lignes */}
              <div className="space-y-1.5">
                {data.prestations.map((p, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_80px_70px_100px_100px_36px] gap-3 items-center p-2.5 rounded-xl bg-white border border-gray-300 hover:border-gray-400 transition-all shadow-sm">
                    <input
                      type="text"
                      value={p.designation}
                      onChange={(e) => updatePrestation(idx, 'designation', e.target.value)}
                      placeholder="Désignation..."
                      className="px-3 py-2 rounded-lg bg-white border border-gray-300 text-xs text-gray-800 placeholder-gray-400 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none transition-all shadow-inner w-full"
                    />
                    <input
                      type="number"
                      value={p.quantite}
                      onChange={(e) => updatePrestation(idx, 'quantite', e.target.value)}
                      placeholder="0"
                      className="px-3 py-2 rounded-lg bg-white border border-gray-300 text-xs text-gray-800 placeholder-gray-400 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none transition-all shadow-inner w-full text-center"
                    />
                    <input
                      type="number"
                      value={p.tva}
                      onChange={(e) => updatePrestation(idx, 'tva', e.target.value)}
                      placeholder="20"
                      className="px-3 py-2 rounded-lg bg-white border border-gray-300 text-xs text-gray-800 placeholder-gray-400 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none transition-all shadow-inner w-full text-center"
                    />
                    <input
                      type="number"
                      value={p.prixUnitaire}
                      onChange={(e) => updatePrestation(idx, 'prixUnitaire', e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      className="px-3 py-2 rounded-lg bg-white border border-gray-300 text-xs text-gray-800 placeholder-gray-400 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 focus:outline-none transition-all shadow-inner w-full text-right"
                    />
                    <div className="text-xs font-bold text-emerald-400 text-right pr-1">
                      {lineTotal(p) > 0 ? lineTotal(p).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €' : '—'}
                    </div>
                    <button
                      onClick={() => removePrestation(idx)}
                      className="p-2 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Total général */}
              <div className="mt-3 flex items-center justify-end gap-4 pr-12">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Total HT</span>
                <span className="text-sm font-black text-emerald-400">
                  {grandTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                </span>
              </div>
            </div>
           </div>
        </Section>

        {/* ── Section F : Signature MOE ───────────────────────────────────── */}
        <Section
          id="sectionF"
          title="F — Signature du maître d'œuvre"
          icon={Pen}
          color="amber"
          isOpen={openSections.sectionF}
          onToggle={toggleSection}
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field
                label="Lieu (À ...)"
                value={data.lieuSignatureMoe}
                onChange={(v) => update('lieuSignatureMoe', v)}
                placeholder="Ville"
                icon={Pen}
              />
              <Field
                label="Date (le ...)"
                value={data.dateSignatureMoe}
                onChange={(v) => update('dateSignatureMoe', v)}
                type="date"
              />
            </div>
        </Section>

        {/* ── Section G : Accusé de réception ────────────────────────────── */}
        <Section
          id="sectionG"
          title="G — Accusé de réception par le titulaire"
          icon={Clock}
          color="blue"
          isOpen={openSections.sectionG}
          onToggle={toggleSection}
        >
          <div className="space-y-3">
            <Field
              label="Reçu le présent ordre de service le"
              value={data.dateReception}
              onChange={(v) => update('dateReception', v)}
              type="date"
            />
            <Field
              label="Observations éventuelles"
              value={data.observations}
              onChange={(v) => update('observations', v)}
              placeholder="À renseigner le cas échéant..."
              rows={2}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field
                label="Lieu (À ...)"
                value={data.lieuSignatureTitulaire}
                onChange={(v) => update('lieuSignatureTitulaire', v)}
                placeholder="Ville"
                icon={Pen}
              />
              <Field
                label="Date (le ...)"
                value={data.dateSignatureTitulaire}
                onChange={(v) => update('dateSignatureTitulaire', v)}
                type="date"
              />
            </div>
          </div>
        </Section>

      </div>

      {/* Modale de confirmation de suppression */}
      {pendingDeleteIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-gray-300 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-red-100 border border-red-300">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <h3 className="font-black text-sm text-gray-800">Supprimer l'OS {pendingDeleteIndex + 1} ?</h3>
            </div>
            <p className="text-xs text-gray-500 mb-6">
              Cette action supprimera définitivement cet Ordre de Service et toutes ses données. Cette action est irréversible.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 bg-gray-100 border border-gray-300 hover:bg-gray-200 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={executeDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-500/80 border border-red-500/50 hover:bg-red-500 transition-all"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
