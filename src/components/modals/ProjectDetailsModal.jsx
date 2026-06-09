import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, FileSignature, MapPin, Calendar, Building2,
  Ruler, Briefcase, Clock, Hash, CheckCircle2,
  Hourglass, Navigation, Move, AlertTriangle, Upload, Trash2, ImageIcon,
  FileText, Globe2, ShieldAlert, Layers, PenLine, ToggleLeft, ToggleRight,
  Eye, RefreshCw, Link, Plus, Download, Percent
} from 'lucide-react';
import { buildCoverPageCanvas } from '../../utils/coverPageCanvas';
import { getProjectPhases, getCurrentPhase } from '../../utils/phaseModel';
import PhaseEditorModal from '../../views/ged/PhaseEditorModal';

// ─── APERÇUS PAGE DE GARDE PAR TYPE DE DOCUMENT ───────────────────────────────
// label = libellé affiché en haut à droite de la page de garde (uppercase auto)
// overrides = couleurs de thème spécifiques (RAO = vert Papyrus, comme le PDF réel)
const RAO_VERT = [45, 138, 78]; // #2d8a4e — identique à pdfRaoGenerator.js
const DOC_PREVIEWS = {
  'CCTP':      { label: 'CCTP',      overrides: {} },
  'RC':        { label: 'RC',        overrides: {} },
  'BPU / DQE': { label: 'BPU / DQE', overrides: {} },
  'RAO':       { label: "RAPPORT D'ANALYSE DES OFFRES", overrides: { primary: RAO_VERT, accent: RAO_VERT } },
};

// ─── SOUS-COMPOSANTS UI ───────────────────────────────────────────────────────

const ModernInput = ({ label, name, value, onChange, icon: Icon, type = "text", placeholder, disabled = false, required = false, className = "", error }) => (
  <div className={`group relative flex flex-col gap-1 ${className}`}>
    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
      {label} {required && <span className="text-red-500 text-xs">*</span>}
    </label>
    <div className={`relative flex items-center bg-slate-50 border transition-all rounded-lg focus-within:ring-1 focus-within:ring-indigo-500/20 
      ${disabled ? 'bg-slate-100 opacity-70 border-slate-200' : 'hover:border-slate-300 border-slate-200 focus-within:border-indigo-500'}
      ${error ? 'border-red-400 bg-red-50/50' : ''}`}>
      <div className={`pl-3 ${error ? 'text-red-400' : 'text-slate-400'}`}>
        {Icon && <Icon size={14} />}
      </div>
      <input
        type={type} name={name} value={value || ''} onChange={disabled ? undefined : onChange} disabled={disabled}
        placeholder={placeholder}
        className="w-full bg-transparent border-none text-xs font-semibold text-slate-700 placeholder:text-slate-300 px-3 py-2.5 focus:ring-0 focus:outline-none"
      />
    </div>
    {error && <span className="text-[9px] text-red-500 font-bold ml-1">{error}</span>}
  </div>
);

const ModernSelect = ({ label, name, value, onChange, options, icon: Icon }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 ml-1">{label}</label>
    <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-lg focus-within:border-indigo-500 hover:border-slate-300 transition-all">
      <div className="pl-3 text-slate-400">{Icon && <Icon size={14} />}</div>
      <select name={name} value={value} onChange={onChange}
        className="w-full bg-transparent border-none text-xs font-bold text-slate-700 px-3 py-2.5 focus:ring-0 focus:outline-none cursor-pointer appearance-none">
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1L5 5L9 1" /></svg>
      </div>
    </div>
  </div>
);

const ModernDurationInput = ({ label, name, value, onChange, icon: Icon, error }) => {
  const parts = value ? String(value).trim().split(' ') : [];
  const num = parts.length > 0 ? parts[0] : '';
  const unit = parts.length > 1 ? parts[1] : 'mois';
  const handleNum = (e) => onChange({ target: { name, value: e.target.value ? `${e.target.value} ${unit}` : '' } });
  const handleUnit = (e) => onChange({ target: { name, value: num ? `${num} ${e.target.value}` : ` ${e.target.value}` } });
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 ml-1">{label}</label>
      <div className={`flex items-center bg-slate-50 border transition-all rounded-lg focus-within:ring-1 focus-within:ring-indigo-500/20 hover:border-slate-300 border-slate-200 focus-within:border-indigo-500 ${error ? 'border-red-400 bg-red-50/50' : ''}`}>
        <div className={`pl-2.5 pr-0.5 ${error ? 'text-red-400' : 'text-slate-400'}`}>{Icon && <Icon size={14} />}</div>
        <input type="number" min="1" value={num} onChange={handleNum} placeholder="4"
          className="w-10 bg-transparent border-none text-xs font-semibold text-slate-700 placeholder:text-slate-300 px-0 py-2.5 focus:ring-0 focus:outline-none text-center" />
        <div className="relative flex-1 border-l border-slate-200">
          <select value={unit} onChange={handleUnit}
            className="w-full bg-transparent border-none text-xs font-bold text-slate-600 py-2.5 pl-1.5 pr-5 focus:ring-0 focus:outline-none cursor-pointer appearance-none">
            <option value="mois">mois</option>
            <option value="semaines">semaines</option>
          </select>
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1L5 5L9 1" /></svg>
          </div>
        </div>
      </div>
      {error && <span className="text-[9px] text-red-500 font-bold ml-1">{error}</span>}
    </div>
  );
};

const ModernTextarea = ({ label, name, value, onChange, icon: Icon, placeholder, rows = 4 }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 ml-1">{label}</label>
    <div className="relative flex items-start bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all">
      <div className="pl-3 pt-2.5 text-slate-400 shrink-0">{Icon && <Icon size={14} />}</div>
      <textarea
        name={name} value={value || ''} onChange={onChange} rows={rows} placeholder={placeholder}
        className="w-full bg-transparent border-none text-xs font-semibold text-slate-700 placeholder:text-slate-300 px-3 py-2.5 focus:ring-0 focus:outline-none resize-none"
      />
    </div>
  </div>
);

// ─── COMPOSANT UPLOAD LOGO ────────────────────────────────────────────────────

const LogoUpload = ({ label, value, onChange, hint }) => {
  const inputRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onloadend = () => onChange(reader.result);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 ml-1">{label}</label>

      {value ? (
        // Aperçu du logo
        <div className="relative group flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg h-20 overflow-hidden">
          <img src={value} alt="logo" className="max-h-16 max-w-full object-contain" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-1.5 right-1.5 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow"
            title="Supprimer le logo"
          >
            <Trash2 size={11} />
          </button>
        </div>
      ) : (
        // Zone de drop
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-1.5 bg-slate-50 border border-dashed border-slate-300 rounded-lg h-20 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all"
        >
          <Upload size={18} className="text-slate-400" />
          <span className="text-[10px] text-slate-400 font-semibold">Cliquer ou déposer un logo</span>
          {hint && <span className="text-[9px] text-slate-300">{hint}</span>}
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => handleFile(e.target.files[0])} />
    </div>
  );
};

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────

const ProjectDetailsModal = ({ isOpen, onClose, project, onSave, branding = null, archives = [] }) => {
  const [formData, setFormData] = useState({
    name: '', subtitle1: '', subtitle2: '',
    client: '', clientAddress: '', clientZip: '', clientCity: '',
    moe: 'PAPYRUS', moeAddress: '', code: '', location: '', marketType: 'Privé', tauxTVA: 20,
    phase: 'DCE', dateRemise: '', timeRemise: '', duration: '', prepPeriod: '1 mois',
    clientLogo: null, projectDescription: '', hasPSE: 'ne comporte pas', department: '',
    lotName: '', spsLevel: 'II', startDate: '', validityDays: 120, platformUrl: '',
    showSignatures: true,
    signatories: ['', '', '', ''],
    sharepointUrl: '',
    sharepointPlans: [],
    phases: [],
  });
  const [showPhaseEditor, setShowPhaseEditor] = useState(false);

  const modalRef = useRef(null);
  const position = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // ── Aperçu page de garde en temps réel ───────────────────────────────────
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewDocType, setPreviewDocType] = useState('CCTP');
  const [previewOpen, setPreviewOpen] = useState(true);
  const [exportingCover, setExportingCover] = useState(false);
  const debounceRef = useRef(null);

  const handleExportCoverPdf = async () => {
    if (exportingCover) return;
    setExportingCover(true);
    try {
      const { generateCoverPagePDF } = await import('../../utils/pdfCoverPageGenerator');
      await generateCoverPagePDF(formData, branding);
    } catch (e) {
      console.error('Export page de garde PDF échoué:', e);
    } finally {
      setExportingCover(false);
    }
  };

  const refreshPreview = useCallback(async (data, docType, brand) => {
    setPreviewLoading(true);
    try {
      const cfg = DOC_PREVIEWS[docType] || { label: docType, overrides: {} };
      const url = await buildCoverPageCanvas(data, cfg.label, brand, cfg.overrides);
      setPreviewUrl(url);
    } catch (e) {
      console.warn('Preview error:', e);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      refreshPreview(formData, previewDocType, branding);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [formData, previewDocType, branding, isOpen, refreshPreview]);

  // Drag modale
  const handleMouseDown = (e) => {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX - position.current.x, y: e.clientY - position.current.y };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    if (modalRef.current) modalRef.current.style.transition = 'none';
  };
  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    const newX = e.clientX - dragStart.current.x;
    const newY = e.clientY - dragStart.current.y;
    position.current = { x: newX, y: newY };
    if (modalRef.current) modalRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
  };
  const handleMouseUp = () => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    if (modalRef.current) modalRef.current.style.transition = '';
  };

  const wasOpenRef = useRef(false);

  useEffect(() => {
    // Réinitialiser le formulaire UNIQUEMENT à l'ouverture du modal,
    // pas à chaque changement de project (sinon onSave → update project
    // → useEffect ré-écrase formData et empêche la fermeture).
    if (isOpen && !wasOpenRef.current) {
      position.current = { x: 0, y: 0 };
      if (modalRef.current) modalRef.current.style.transform = 'translate(0px, 0px)';
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        name: project.name || '', subtitle1: project.subtitle1 || '', subtitle2: project.subtitle2 || '',
        client: project.client || '',
        clientAddress: project.clientAddress || '', clientZip: project.clientZip || '',
        clientCity: project.clientCity || '', moe: project.moe || 'PAPYRUS',
        moeAddress: project.moeAddress || (branding?.address || ''),
        code: project.code || '', location: project.location || '',
        marketType: project.marketType || 'Privé',
        tauxTVA: project.tauxTVA ?? 20,
        phases: getProjectPhases(project),
        phase: getCurrentPhase(project)?.id || project.phase || 'DCE',
        dateRemise: project.dateRemise || today, timeRemise: project.timeRemise || '',
        duration: project.duration || '',
        prepPeriod: project.prepPeriod || '1 mois',
        clientLogo: project.clientLogo || null,
        projectDescription: project.projectDescription || '',
        hasPSE: project.hasPSE || 'ne comporte pas',
        department: project.department || '',
        lotName: project.lotName || '',
        spsLevel: project.spsLevel || 'II',
        startDate: project.startDate || '',
        validityDays: project.validityDays ?? 120,
        platformUrl: project.platformUrl || '',
        showSignatures: project.showSignatures !== false,
        signatories: project.signatories || ['', '', '', ''],
        sharepointUrl: project.sharepointUrl || '',
        sharepointPlans: project.sharepointPlans || [],
      });
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, project]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const getErrors = (data) => {
    const errs = {};
    if (!data.name || data.name.trim().length < 3) errs.name = "Minimum 3 caractères.";
    if (!data.client || data.client.trim().length < 3) errs.client = "Minimum 3 caractères.";
    if (data.code && !/^\d{2}-\d{3,4}$/.test(data.code.trim())) errs.code = "Format requis : AA-XXXX (ex: 26-0001).";
    if (data.clientZip && !/^\d{5}$/.test(data.clientZip.trim())) errs.clientZip = "Doit contenir 5 chiffres.";
    const specialCharRegex = /[<>{}[\]$|\\^~]/;
    ['clientCity', 'location', 'clientAddress', 'moe'].forEach(field => {
      if (data[field] && specialCharRegex.test(data[field])) errs[field] = "Caractères < > { } [ ] $ interdits.";
    });
    return errs;
  };

  const errors = getErrors(formData);
  const isFormValid = Object.keys(errors).length === 0;
  const isProjectSavedAndValid = !!project.name && Object.keys(getErrors(project)).length === 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isFormValid) return;
    const tauxTVA = Number(formData.tauxTVA);
    onSave({ ...formData, tauxTVA: Number.isFinite(tauxTVA) ? tauxTVA : 20 });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={isProjectSavedAndValid ? onClose : undefined} />

      <div ref={modalRef} className="relative bg-white rounded-2xl shadow-2xl w-[96vw] max-w-[1600px] h-[94vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-white/20 ring-1 ring-black/5 will-change-transform flex flex-col">
        
        {/* HEADER — pleine largeur */}
        <div className="bg-slate-900 px-6 py-4 flex justify-between items-center border-b border-slate-800 cursor-move select-none group shrink-0" onMouseDown={handleMouseDown}>
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/20 p-2 rounded-lg border border-indigo-500/30">
              <FileSignature size={20} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-wide leading-none flex items-center gap-2">
                Fiche Projet <Move size={14} className="text-slate-600 opacity-50 group-hover:opacity-100 transition-opacity" />
              </h2>
              <p className="text-[10px] text-slate-400 mt-1 font-medium">Informations générales & administratives</p>
            </div>
          </div>
          {isProjectSavedAndValid && (
            <button type="button" onClick={onClose} className="text-slate-500 hover:text-white hover:bg-white/10 p-2 rounded-full transition-all" onMouseDown={(e) => e.stopPropagation()}>
              <X size={20} />
            </button>
          )}
        </div>

        {/* BODY — deux colonnes */}
        <div className="flex flex-1 min-h-0">

          {/* COL GAUCHE : formulaire */}
          <div className="flex-1 flex flex-col min-w-0">
            <form id="project-form" onSubmit={handleSubmit} className="flex-1 p-6 bg-slate-50/50 overflow-y-auto">
          <div className="mb-6 flex flex-col gap-3">
            <ModernInput label="Nom de l'opération (Titre principal)" name="name" value={formData.name}
              onChange={handleChange} icon={FileSignature} placeholder="Ex: AMÉNAGEMENT DU CENTRE BOURG..."
              className="w-full" required error={errors.name} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ModernInput label="Sous-titre 1 (optionnel)" name="subtitle1" value={formData.subtitle1}
                onChange={handleChange} icon={FileSignature} placeholder="Ex: VOIRIE ET RÉSEAUX DIVERS" />
              <ModernInput label="Sous-titre 2 (optionnel)" name="subtitle2" value={formData.subtitle2}
                onChange={handleChange} icon={FileSignature} placeholder="Ex: TRANCHE 1 — PHASE TRAVAUX" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* COL 1 — MOA */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
                <Building2 size={12}/> Maîtrise d'Ouvrage
              </h3>
              <ModernInput label="Client / MOA" name="client" value={formData.client} onChange={handleChange} icon={Building2} placeholder="Nom du client" required error={errors.client} />
              <ModernInput label="Adresse (Rue)" name="clientAddress" value={formData.clientAddress} onChange={handleChange} icon={MapPin} placeholder="N° et Rue" error={errors.clientAddress} />
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1"><ModernInput label="CP" name="clientZip" value={formData.clientZip} onChange={handleChange} placeholder="Code" error={errors.clientZip} /></div>
                <div className="col-span-2"><ModernInput label="Ville" name="clientCity" value={formData.clientCity} onChange={handleChange} icon={Navigation} placeholder="Commune" error={errors.clientCity} /></div>
              </div>
            </div>

            {/* COL 2 — LOGOS */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <h3 className="text-xs font-black text-violet-600 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
                <ImageIcon size={12}/> Logos & Identité
              </h3>
              <LogoUpload
                label="Logo Client / MOA"
                value={formData.clientLogo}
                onChange={(val) => setFormData(prev => ({ ...prev, clientLogo: val }))}
                hint="JPEG, PNG — page de garde"
              />
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <ImageIcon size={13} className="text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-slate-500">Logo MOE (ton entreprise)</p>
                  <p className="text-[9px] text-slate-400">Géré dans le module Branding</p>
                </div>
              </div>
            </div>

            {/* COL 3 — CONTEXTE */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <h3 className="text-xs font-black text-emerald-600 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
                <MapPin size={12}/> Contexte & Lieu
              </h3>
              <ModernInput label="Lieu de réalisation" name="location" value={formData.location} onChange={handleChange} icon={MapPin} placeholder="Ville / Localisation" error={errors.location} />
              <ModernInput label="Maître d'Oeuvre (MOE)" name="moe" value={formData.moe} onChange={handleChange} icon={Ruler} placeholder="PAPYRUS" error={errors.moe} />
              <ModernInput label="Adresse MOE" name="moeAddress" value={formData.moeAddress} onChange={handleChange} icon={MapPin} placeholder="21-23 Route de la Pradine, 81500 Bannières" />
              <ModernSelect label="Type de Marché" name="marketType" value={formData.marketType} onChange={handleChange} icon={Briefcase}
                options={[{ value: 'Privé', label: 'Marché Privé' }, { value: 'Public', label: 'Marché Public' }, { value: 'Sous-traitance', label: 'Sous-traitance' }]} />
              <ModernSelect label="Taux de TVA" name="tauxTVA" value={String(formData.tauxTVA)} onChange={handleChange} icon={Percent}
                options={[{ value: '20', label: '20 % (taux normal)' }, { value: '10', label: '10 % (intermédiaire)' }, { value: '5.5', label: '5,5 % (réduit)' }, { value: '0', label: '0 % (exonéré / autoliquidation)' }]} />
            </div>

            {/* COL 4 — PLANNING */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <h3 className="text-xs font-black text-amber-600 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
                <Calendar size={12}/> Planning & Admin
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <ModernSelect label="Phase courante" name="phase" value={formData.phase} onChange={handleChange} icon={CheckCircle2}
                  options={(formData.phases || []).map((p) => ({ value: p.id, label: p.label ? `${p.code} — ${p.label}` : p.code }))} />
                <ModernInput label="Code Affaire" name="code" value={formData.code} onChange={handleChange} icon={Hash} placeholder="Ex: 26-0001" required error={errors.code} />
              </div>
              <button type="button" onClick={() => setShowPhaseEditor(true)}
                className="-mt-1 self-start flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline">
                <Layers size={11} /> Gérer les phases de l'affaire
              </button>
              <div className="grid grid-cols-2 gap-3">
                <ModernDurationInput label="Préparation" name="prepPeriod" value={formData.prepPeriod} onChange={handleChange} icon={Hourglass} />
                <ModernDurationInput label="Durée Trx" name="duration" value={formData.duration} onChange={handleChange} icon={Clock} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ModernInput label="Date Remise Offre" name="dateRemise" type="date" value={formData.dateRemise} onChange={handleChange} icon={Calendar} />
                <ModernInput label="Heure Remise Offre" name="timeRemise" type="time" value={formData.timeRemise} onChange={handleChange} icon={Clock} />
              </div>
            </div>
          </div>

          {/* LIGNE 2 — DESCRIPTION, PSE, TRANCHES, DÉPARTEMENT */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">

            {/* Description du projet */}
            <div className="md:col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <h3 className="text-xs font-black text-sky-600 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
                <FileText size={12}/> Description du Projet
              </h3>
              <ModernTextarea
                label="Description générale"
                name="projectDescription"
                value={formData.projectDescription}
                onChange={handleChange}
                icon={FileText}
                placeholder="Décrire brièvement l'opération, le contexte, les enjeux..."
                rows={5}
              />
            </div>

            {/* PSE */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <h3 className="text-xs font-black text-rose-600 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
                <ShieldAlert size={12}/> PSE — Prestations Supplémentaires
              </h3>
              {(() => {
                const hasOptions = (project?.chapters || []).some(c => c.isOption === true);
                return (
                  <div className={`flex items-center gap-3 rounded-lg px-3 py-3 border ${hasOptions ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                    <ShieldAlert size={16} className={hasOptions ? 'text-rose-500 shrink-0' : 'text-slate-400 shrink-0'} />
                    <div>
                      <p className={`text-xs font-black ${hasOptions ? 'text-rose-600' : 'text-slate-500'}`}>
                        {hasOptions ? 'Ce marché comporte des PSE' : 'Ce marché ne comporte pas de PSE'}
                      </p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Détecté automatiquement depuis les chapitres "Option" du devis</p>
                    </div>
                  </div>
                );
              })()}
              <div className="flex items-start gap-2 bg-rose-50/50 border border-rose-100 rounded-lg px-3 py-2.5">
                <ShieldAlert size={13} className="text-rose-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-rose-500 font-medium leading-relaxed">
                  Utilisez <span className="font-black">{"{{hasPSE}}"}</span> dans vos textes — remplacé par <em>"comporte"</em> ou <em>"ne comporte pas"</em>.
                </p>
              </div>
            </div>

            {/* Tranches */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <h3 className="text-xs font-black text-violet-600 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
                <Layers size={12}/> Tranches
              </h3>
              {(() => {
                const tranches = project?.tranches || [];
                return tranches.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <div className="bg-violet-50 border border-violet-200 rounded-lg px-3 py-2.5">
                      <p className="text-[10px] font-black text-violet-600 mb-2">{tranches.length} tranche{tranches.length > 1 ? 's' : ''} détectée{tranches.length > 1 ? 's' : ''}</p>
                      <ul className="flex flex-col gap-1">
                        {tranches.map((t, i) => (
                          <li key={t.id} className="flex items-center gap-2 text-[11px] font-semibold text-violet-700">
                            <span className="w-4 h-4 rounded-full bg-violet-200 text-violet-700 flex items-center justify-center text-[9px] font-black shrink-0">{i + 1}</span>
                            {t.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <p className="text-[9px] text-slate-400">Géré depuis le devis — onglet Tranches</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg px-3 py-3 border bg-slate-50 border-slate-200">
                    <Layers size={16} className="text-slate-400 shrink-0" />
                    <div>
                      <p className="text-xs font-black text-slate-500">Aucune tranche</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Projet en mode global</p>
                    </div>
                  </div>
                );
              })()}
              <div className="flex items-start gap-2 bg-violet-50/50 border border-violet-100 rounded-lg px-3 py-2.5">
                <Layers size={13} className="text-violet-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-violet-500 font-medium leading-relaxed">
                  <span className="font-black">{"{{trancheCount}}"}</span> → nombre · <span className="font-black">{"{{trancheNames}}"}</span> → liste à puces
                </p>
              </div>
            </div>

            {/* Département */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <h3 className="text-xs font-black text-teal-600 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
                <Globe2 size={12}/> Localisation Administrative
              </h3>
              <ModernInput
                label="Département"
                name="department"
                value={formData.department}
                onChange={handleChange}
                icon={Globe2}
                placeholder="Ex: Drôme, Isère, 26..."
              />
              <div className="flex items-start gap-2 bg-teal-50/50 border border-teal-100 rounded-lg px-3 py-2.5 mt-1">
                <Globe2 size={13} className="text-teal-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-teal-500 font-medium leading-relaxed">
                  Utilisez <span className="font-black">{"{{department}}"}</span> pour insérer le département dans vos documents.
                </p>
              </div>
            </div>

          </div>

          {/* CONSULTATION / RC */}
          <div className="mt-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-xs font-black text-cyan-600 uppercase tracking-widest flex items-center gap-2">
                <FileText size={12}/> Consultation / Règlement (RC)
              </h3>
            </div>
            <div className="flex flex-col gap-3">
              <ModernInput label="Intitulé du lot" name="lotName" value={formData.lotName} onChange={handleChange} icon={Layers}
                placeholder="Ex: LOT unique : TERRASSEMENTS / VOIRIE / ESPACES VERTS / RÉSEAU EP / ÉCLAIRAGE" />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <ModernSelect label="Coordination SPS" name="spsLevel" value={formData.spsLevel} onChange={handleChange} icon={ShieldAlert}
                  options={[{ value: 'I', label: 'Niveau I' }, { value: 'II', label: 'Niveau II' }, { value: 'III', label: 'Niveau III' }, { value: 'Sans objet', label: 'Sans objet' }]} />
                <ModernInput label="Démarrage prévisionnel" name="startDate" value={formData.startDate} onChange={handleChange} icon={Calendar} placeholder="Ex: septembre 2026" />
                <ModernInput label="Validité des offres (jours)" name="validityDays" type="number" value={formData.validityDays} onChange={handleChange} icon={Hourglass} placeholder="120" />
                <ModernInput label="Plateforme (URL)" name="platformUrl" type="url" value={formData.platformUrl} onChange={handleChange} icon={Link} placeholder="https://marches-publics..." />
              </div>
              <div className="flex items-start gap-2 bg-cyan-50/50 border border-cyan-100 rounded-lg px-3 py-2.5">
                <FileText size={13} className="text-cyan-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-cyan-600 font-medium leading-relaxed">
                  Variables RC : <span className="font-black">{"{{lotName}}"}</span> · <span className="font-black">{"{{spsLevel}}"}</span> · <span className="font-black">{"{{startDate}}"}</span> · <span className="font-black">{"{{validityDays}}"}</span> · <span className="font-black">{"{{platformUrl}}"}</span> · <span className="font-black">{"{{moeAddress}}"}</span> · <span className="font-black">{"{{criteresTable}}"}</span> <em>(critères du module RAO)</em>
                </p>
              </div>
            </div>
          </div>

          {/* SHAREPOINT — DOSSIER PLANS */}
          <div className="mt-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                <Link size={12}/> Plans (SharePoint)
              </h3>
              <button
                type="button"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  sharepointPlans: [...(prev.sharepointPlans || []), { name: '', url: 'https://papyrusbe.sharepoint.com/sites/Papyrus1/' }],
                }))}
                className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 hover:text-blue-700 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition-all"
              >
                <Plus size={12} /> Ajouter un dossier
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mb-3">
              Ajoutez un lien par phase de rendu (AVP, PRO, DCE, EXE...). Clic droit sur le dossier SharePoint → « Copier le lien ».
            </p>

            {(formData.sharepointPlans || []).length === 0 && (
              <p className="text-[11px] text-gray-300 italic text-center py-4">Aucun dossier de plans configuré.</p>
            )}

            <div className="space-y-2">
              {(formData.sharepointPlans || []).map((plan, idx) => (
                <div key={idx} className="flex items-start gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200/60">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={plan.name}
                      onChange={e => {
                        const updated = [...formData.sharepointPlans];
                        updated[idx] = { ...updated[idx], name: e.target.value };
                        setFormData(prev => ({ ...prev, sharepointPlans: updated }));
                      }}
                      placeholder="Nom (ex: Plans DCE, Plans EXE...)"
                      className="w-full px-2.5 py-1.5 text-[12px] font-semibold border border-gray-200/60 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 text-gray-800"
                    />
                    <input
                      type="url"
                      value={plan.url}
                      onChange={e => {
                        const updated = [...formData.sharepointPlans];
                        updated[idx] = { ...updated[idx], url: e.target.value };
                        setFormData(prev => ({ ...prev, sharepointPlans: updated }));
                      }}
                      placeholder="https://papyrusbe.sharepoint.com/sites/Papyrus1/..."
                      className="w-full px-2.5 py-1.5 text-[11px] border border-gray-200/60 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 text-gray-600"
                    />
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {plan.url && (
                      <a href={plan.url} target="_blank" rel="noreferrer"
                        className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors" title="Ouvrir">
                        <Globe2 size={13} />
                      </a>
                    )}
                    <button type="button"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        sharepointPlans: prev.sharepointPlans.filter((_, i) => i !== idx),
                      }))}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="Supprimer">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* LIGNE 3 — CASES SIGNATURE */}
          <div className="mt-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-xs font-black text-orange-600 uppercase tracking-widest flex items-center gap-2">
                <PenLine size={12}/> Cases Tampon / Signature — Page de garde
              </h3>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, showSignatures: !prev.showSignatures }))}
                className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border transition-all ${
                  formData.showSignatures
                    ? 'bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100'
                    : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
                }`}
              >
                {formData.showSignatures
                  ? <><ToggleRight size={14}/> Affichées</>
                  : <><ToggleLeft size={14}/> Masquées</>
                }
              </button>
            </div>
            <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 transition-opacity ${formData.showSignatures ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 ml-1">Case {i + 1}</label>
                  <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 focus-within:border-orange-400 transition-all">
                    <div className="pl-3 text-slate-400"><PenLine size={13}/></div>
                    <input
                      type="text"
                      value={formData.signatories[i] || ''}
                      onChange={e => {
                        const next = [...formData.signatories];
                        next[i] = e.target.value;
                        setFormData(prev => ({ ...prev, signatories: next }));
                      }}
                      placeholder={['Le Maître d\'Ouvrage', 'Le Maître d\'Œuvre', 'L\'Entreprise', 'Le Bureau de Contrôle'][i]}
                      className="w-full bg-transparent border-none text-xs font-semibold text-slate-700 placeholder:text-slate-300 px-3 py-2.5 focus:ring-0 focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[9px] text-slate-400 mt-3 flex items-center gap-1">
              <PenLine size={10}/> Les cases apparaissent en bas de la page de garde de tous les exports PDF et Word.
            </p>
          </div>

        </form>

            {/* FOOTER — dans la colonne gauche */}
            <div className="bg-white px-6 py-4 border-t border-slate-200 flex justify-between items-center shrink-0">
              <div>
                {!isFormValid && (
                  <span className="text-[10px] text-red-500 font-bold flex items-center gap-1 animate-pulse bg-red-50 px-2 py-1 rounded-md border border-red-100">
                    <AlertTriangle size={12} /> Veuillez corriger les champs en rouge.
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {/* Bouton toggle aperçu */}
                <button
                  type="button"
                  onClick={() => setPreviewOpen(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${
                    previewOpen
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                  title={previewOpen ? 'Masquer l\'aperçu' : 'Afficher l\'aperçu page de garde'}
                >
                  <Eye size={13} />
                  {previewOpen ? 'Masquer aperçu' : 'Aperçu'}
                </button>
                {isProjectSavedAndValid && (
                  <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors uppercase tracking-wider">
                    Annuler
                  </button>
                )}
                <button
                  type="submit"
                  form="project-form"
                  disabled={!isFormValid}
                  title={!isFormValid ? `Champs requis : ${Object.values(errors).join(' — ')}` : 'Enregistrer le projet'}
                  className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
                    isFormValid
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:scale-[1.02]'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <FileSignature size={14} /> Enregistrer
                </button>
              </div>
            </div>
          </div>{/* fin colonne gauche */}

          {/* COL DROITE : volet aperçu rabattable */}
          <div className={`shrink-0 border-l border-slate-200 bg-slate-900 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${previewOpen ? 'w-[320px]' : 'w-0 border-l-0'}`}>
            {/* Titre + sélecteur type doc */}
            <div className="px-4 py-3 border-b border-slate-700 shrink-0 min-w-[320px]">
              <div className="flex items-center gap-2 mb-2.5">
                <Eye size={13} className="text-indigo-400" />
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Aperçu page de garde</span>
                {previewLoading && <RefreshCw size={10} className="text-indigo-400 animate-spin ml-auto" />}
              </div>
              <div className="flex gap-1">
                {['CCTP', 'RC', 'BPU / DQE', 'RAO'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setPreviewDocType(type)}
                    className={`flex-1 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all ${
                      previewDocType === type
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Canvas preview */}
            <div className="flex-1 overflow-hidden flex items-start justify-center p-4 min-w-[320px]">
              <div className="relative w-full" style={{ aspectRatio: '210/297' }}>
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Aperçu page de garde"
                    className={`w-full h-full object-cover rounded shadow-2xl ring-1 ring-white/10 transition-opacity duration-300 ${previewLoading ? 'opacity-50' : 'opacity-100'}`}
                  />
                ) : (
                  <div className="w-full h-full bg-slate-800 rounded flex items-center justify-center">
                    <RefreshCw size={20} className="text-slate-600 animate-spin" />
                  </div>
                )}
                {previewLoading && previewUrl && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-slate-900/70 rounded-full p-2">
                      <RefreshCw size={14} className="text-indigo-400 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer volet : export + infos */}
            <div className="px-4 py-2.5 border-t border-slate-700 shrink-0 min-w-[320px]">
              <button
                type="button"
                onClick={handleExportCoverPdf}
                disabled={exportingCover}
                className="w-full mb-2 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-lg transition-all"
                title="Télécharger un PDF A4 avec seulement la page de garde (sans CCTP/RC)"
              >
                {exportingCover ? (
                  <>
                    <RefreshCw size={11} className="animate-spin" />
                    Génération…
                  </>
                ) : (
                  <>
                    <Download size={11} />
                    Télécharger la page de garde
                  </>
                )}
              </button>
              <p className="text-[9px] text-slate-500 text-center leading-relaxed">
                Mis à jour en temps réel · 150 DPI · Format A4
              </p>
            </div>
          </div>{/* fin volet aperçu */}

        </div>{/* fin BODY */}
      </div>

      <PhaseEditorModal
        show={showPhaseEditor}
        onClose={() => setShowPhaseEditor(false)}
        phases={formData.phases}
        archives={archives}
        onSave={(newPhases) => {
          setFormData(prev => {
            const stillExists = newPhases.some(p => p.id === prev.phase);
            return { ...prev, phases: newPhases, phase: stillExists ? prev.phase : (newPhases[0]?.id || '') };
          });
        }}
      />
    </div>
  );
};

export default ProjectDetailsModal;