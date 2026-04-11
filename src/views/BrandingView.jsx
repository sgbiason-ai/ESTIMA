// src/views/BrandingView.jsx
import React, { useState, useCallback, useRef } from 'react';
import { confirm } from '../utils/globalUI';
import { hexToRgbString, lightenHex } from '../utils/colorHelpers';
import HelpPanel from '../components/help/HelpPanel';
import HelpButton from '../components/help/HelpButton';

// ─── SCHÉMA PAR DÉFAUT ────────────────────────────────────────────────────────
export const DEFAULT_BRANDING = {
  // Identité MOE
  logo: null,
  companyName: '',
  tagline: '',
  address: '',
  zip: '',      // <-- AJOUT
  city: '',     // <-- AJOUT
  phone: '',
  email: '',
  website: '',

  // Couleurs
  colors: {
    primary:   '#286E55',
    secondary: '#32B482',
    text:      '#282828',
    subtle:    '#64748B',
  },

  // Typographie (noms de polices valides pour jsPDF + docx)
  fonts: {
    headings: 'Helvetica',
    main:     'Helvetica',
  },

  // Tailles en demi-points (×2 vs pt) — utilisées dans docx
  sizes: {
    title1: 28,
    title2: 24,
    title3: 22,
    title4: 20,
    title5: 18,
    body:   22,
  },
};

// ─── LISTES ────────────────────────────────────────────────────────────────────
const FONT_OPTIONS = [
  'Helvetica', 'Times New Roman', 'Georgia', 'Garamond',
  'Calibri', 'Arial', 'Trebuchet MS', 'Verdana',
  'Palatino', 'Book Antiqua', 'Cambria', 'Century Gothic',
];

const DOC_TYPES = [
  { id: 'estimation', label: 'Estimation', icon: '📐' },
  { id: 'dqe',        label: 'DQE',        icon: '📋' },
  { id: 'bpu',        label: 'BPU',        icon: '📊' },
  { id: 'cctp',       label: 'CCTP',       icon: '📄' },
  { id: 'rc',         label: 'RC',         icon: '📑' },
  { id: 'analysis',   label: 'Analyse des offres', icon: '🔍' },
];

const TABS = [
  { id: 'identity',    label: 'Identité',      icon: '🏢' },
  { id: 'colors',      label: 'Couleurs',       icon: '🎨' },
  { id: 'typography',  label: 'Typographie',    icon: '✍️' },
];

// ─── SOUS-COMPOSANTS ──────────────────────────────────────────────────────────

const SectionTitle = ({ children }) => (
  <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3 mt-6 first:mt-0">
    {children}
  </h3>
);

const Field = ({ label, children }) => (
  <div className="mb-3">
    <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
    {children}
  </div>
);

const Input = ({ value, onChange, placeholder, type = 'text' }) => (
  <input
    type={type}
    value={value || ''}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200/60 rounded-xl
               text-gray-800 placeholder-gray-300
               focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 focus:bg-white
               transition-all duration-150"
  />
);

const Select = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200/60 rounded-xl
               text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100
               focus:border-blue-400 focus:bg-white transition-all duration-150"
  >
    {options.map(o => (
      <option key={o} value={o}>{o}</option>
    ))}
  </select>
);

const ColorPicker = ({ label, value, onChange, description }) => (
  <div className="flex items-center gap-3 mb-3 p-3 rounded-2xl bg-gray-50/80 border border-gray-100">
    <div className="relative group">
      <div
        className="w-10 h-10 rounded-xl shadow-sm cursor-pointer
                   transition-transform group-hover:scale-105"
        style={{ backgroundColor: value }}
      />
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full rounded-xl"
        title={`Changer ${label.toLowerCase()}`}
      />
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium text-gray-800">{label}</div>
      {description && <div className="text-xs text-gray-400 truncate">{description}</div>}
      <input
        type="text"
        value={value}
        onChange={e => {
          if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) onChange(e.target.value);
        }}
        className="text-xs font-mono text-gray-500 bg-transparent border-none
                   outline-none w-24 mt-0.5"
        maxLength={7}
      />
    </div>
  </div>
);

const SizeSlider = ({ label, value, onChange, min = 14, max = 40 }) => {
  const pt = (value / 2).toFixed(0);
  return (
    <div className="flex items-center gap-3 mb-2.5">
      <span className="text-xs text-gray-500 w-14 flex-shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 accent-blue-500 rounded-full"
      />
      <span className="text-xs font-mono text-gray-600 w-10 text-right bg-gray-100 px-1.5 py-0.5 rounded-lg">{pt} pt</span>
    </div>
  );
};

// ─── APERÇU PAGE DE GARDE ─────────────────────────────────────────────────────

const CoverPreview = ({ branding, activeDocType, project }) => {
  const docTypeLabel = {
    estimation: 'ESTIMATION CONFIDENTIELLE DES TRAVAUX',
    dqe:        'DÉTAIL QUANTITATIF ET ESTIMATIF',
    bpu:        'BORDEREAU DES PRIX UNITAIRES',
    cctp:       'CAHIER DES CLAUSES TECHNIQUES PARTICULIÈRES',
    rc:         'RÈGLEMENT DE LA CONSULTATION',
    analysis:   "ANALYSE COMPARATIVE DES OFFRES",
  }[activeDocType] || 'DOCUMENT DE MARCHÉ';

  const primary   = branding.colors.primary;
  const secondary = branding.colors.secondary;
  const textColor = branding.colors.text;
  const subtle    = branding.colors.subtle;
  const bgLight   = lightenHex(primary, 0.93);

  const headingFont = branding.fonts.headings;
  const mainFont    = branding.fonts.main;

  const today = new Date().toLocaleDateString('fr-FR');

  // Remplacement des données fictives par les données du projet
  const projectName = project?.name || 'NOM DU PROJET';
  const clientName = project?.client || 'NOM DU CLIENT';
  const clientAddress = project?.clientAddress || 'Adresse du client';
  const clientZip = project?.clientZip || '';
  const clientCity = project?.clientCity || 'VILLE';
  const location = project?.location || 'VILLE, DÉPARTEMENT';
  const phase = project?.phase || 'DCE';
  const code = project?.code || '2025-XXX';
  const clientLogo = project?.clientLogo || null;

  return (
    <div
      className="relative w-full overflow-hidden shadow-2xl"
      style={{
        aspectRatio: '210 / 297', // A4
        backgroundColor: '#FFFFFF',
        fontFamily: mainFont,
        borderRadius: '4px',
      }}
    >
      {/* Bande verticale gauche */}
      <div
        className="absolute top-0 left-0 bottom-0 w-[2.5%]"
        style={{ backgroundColor: primary }}
      />

      {/* En-tête logos */}
      <div className="absolute top-[3%] left-[5%] right-[5%] flex justify-between items-center h-[10%]">
        {/* Logo MOE */}
        <div className="h-full flex items-center">
          {branding.logo ? (
            <img
              src={branding.logo}
              alt="logo MOE"
              className="max-h-full max-w-[40%] object-contain"
            />
          ) : (
            <div
              className="h-full flex items-center justify-center px-3 rounded text-xs font-bold tracking-wide"
              style={{
                backgroundColor: bgLight,
                color: primary,
                fontFamily: headingFont,
                minWidth: '80px',
                fontSize: 'clamp(5px, 1.2vw, 11px)',
              }}
            >
              {branding.companyName || 'VOTRE SOCIÉTÉ'}
            </div>
          )}
        </div>

        {/* Logo client */}
        <div
          className="h-[70%] flex items-center justify-center rounded"
          style={{
            border: clientLogo ? 'none' : `1px dashed ${subtle}`,
            minWidth: '80px',
            fontSize: 'clamp(5px, 1vw, 9px)',
            color: subtle,
          }}
        >
          {clientLogo ? (
            <img src={clientLogo} alt="logo client" className="max-h-full max-w-full object-contain" loading="lazy" />
          ) : (
            <span className="opacity-40 px-3">LOGO CLIENT</span>
          )}
        </div>
      </div>

      {/* Ligne séparatrice */}
      <div
        className="absolute left-[5%] right-[5%]"
        style={{
          top: '14.5%',
          height: '1px',
          backgroundColor: `rgba(${hexToRgbString(primary)}, 0.15)`,
        }}
      />

      {/* Type de document */}
      <div
        className="absolute right-[5%] font-bold tracking-wider uppercase text-right"
        style={{
          top: '16%',
          color: subtle,
          fontFamily: headingFont,
          fontSize: 'clamp(4px, 1vw, 8px)',
          letterSpacing: '0.1em',
        }}
      >
        {docTypeLabel}
      </div>

      {/* Titre du projet */}
      <div
        className="absolute left-[5%] right-[5%] font-black leading-tight uppercase"
        style={{
          top: '28%',
          color: primary,
          fontFamily: headingFont,
          fontSize: 'clamp(10px, 3.5vw, 26px)',
        }}
      >
        {projectName}
      </div>

      {/* Trait de soulignement */}
      <div
        className="absolute"
        style={{
          top: '38%',
          left: '5%',
          width: '15%',
          height: '2px',
          backgroundColor: secondary,
          borderRadius: '1px',
        }}
      />

      {/* Bloc infos */}
      <div
        className="absolute left-[5%] right-[5%] rounded-lg"
        style={{
          top: '42%',
          height: '24%',
          backgroundColor: bgLight,
        }}
      >
        {/* Col gauche : MOA + lieu */}
        <div
          className="absolute top-[15%] left-[5%]"
          style={{ width: '42%' }}
        >
          <div
            className="font-bold uppercase tracking-widest mb-1"
            style={{
              color: subtle,
              fontFamily: headingFont,
              fontSize: 'clamp(3px, 0.8vw, 6px)',
            }}
          >
            MAÎTRE D'OUVRAGE
          </div>
          <div
            className="font-semibold uppercase"
            style={{
              color: textColor,
              fontFamily: headingFont,
              fontSize: 'clamp(5px, 1.2vw, 9px)',
            }}
          >
            {clientName}
          </div>
          <div
            style={{
              color: subtle,
              fontSize: 'clamp(4px, 0.9vw, 7px)',
              marginTop: '2px',
            }}
          >
            {clientAddress}
            <br />
            {clientZip} {clientCity}
          </div>

          <div
            className="font-bold uppercase tracking-widest mt-[8%]"
            style={{
              color: subtle,
              fontFamily: headingFont,
              fontSize: 'clamp(3px, 0.8vw, 6px)',
            }}
          >
            LIEU DE RÉALISATION
          </div>
          <div
            className="font-semibold uppercase truncate"
            style={{
              color: textColor,
              fontFamily: headingFont,
              fontSize: 'clamp(5px, 1.2vw, 9px)',
            }}
          >
            {location}
          </div>
        </div>

        {/* Séparateur vertical */}
        <div
          className="absolute top-[10%] bottom-[10%]"
          style={{
            left: '50%',
            width: '1px',
            backgroundColor: `rgba(${hexToRgbString(primary)}, 0.15)`,
          }}
        />

        {/* Col droite : Phase + Code */}
        <div
          className="absolute top-[15%]"
          style={{ left: '55%', right: '5%' }}
        >
          <div
            className="font-bold uppercase tracking-widest mb-1"
            style={{
              color: subtle,
              fontFamily: headingFont,
              fontSize: 'clamp(3px, 0.8vw, 6px)',
            }}
          >
            PHASE DU PROJET
          </div>
          <div
            className="inline-block font-bold text-white rounded px-2 py-0.5"
            style={{
              backgroundColor: primary,
              fontFamily: headingFont,
              fontSize: 'clamp(4px, 1vw, 7px)',
            }}
          >
            {phase}
          </div>

          <div
            className="font-bold uppercase tracking-widest mt-[8%]"
            style={{
              color: subtle,
              fontFamily: headingFont,
              fontSize: 'clamp(3px, 0.8vw, 6px)',
            }}
          >
            RÉFÉRENCE (CODE AFFAIRE)
          </div>
          <div
            className="font-semibold uppercase"
            style={{
              color: textColor,
              fontFamily: headingFont,
              fontSize: 'clamp(5px, 1.2vw, 9px)',
            }}
          >
            {code}
          </div>
        </div>
      </div>

      {/* Coordonnées MOE en bas */}
      {(branding.companyName || branding.address || branding.zip || branding.city || branding.phone || branding.email) && (
        <div
          className="absolute left-[5%] right-[5%]"
          style={{ bottom: '6%' }}
        >
          <div
            className="h-px mb-2"
            style={{ backgroundColor: `rgba(${hexToRgbString(primary)}, 0.15)` }}
          />
          <div className="flex justify-between items-end">
            <div>
              {branding.companyName && (
                <div
                  className="font-bold uppercase"
                  style={{
                    color: primary,
                    fontFamily: headingFont,
                    fontSize: 'clamp(4px, 1vw, 8px)',
                  }}
                >
                  {branding.companyName}
                </div>
              )}
              {branding.tagline && (
                <div
                  style={{
                    color: subtle,
                    fontSize: 'clamp(3px, 0.8vw, 6px)',
                  }}
                >
                  {branding.tagline}
                </div>
              )}
              {(branding.address || branding.zip || branding.city) && (
                <div
                  style={{
                    color: subtle,
                    fontSize: 'clamp(3px, 0.8vw, 6px)',
                    marginTop: '2px',
                  }}
                >
                  {branding.address}
                  {(branding.address && (branding.zip || branding.city)) && <br />}
                  {branding.zip} {branding.city}
                </div>
              )}
            </div>
            <div className="text-right">
              {branding.phone && (
                <div style={{ color: subtle, fontSize: 'clamp(3px, 0.8vw, 6px)' }}>
                  {branding.phone}
                </div>
              )}
              {branding.email && (
                <div style={{ color: subtle, fontSize: 'clamp(3px, 0.8vw, 6px)' }}>
                  {branding.email}
                </div>
              )}
              {branding.website && (
                <div
                  style={{
                    color: primary,
                    fontSize: 'clamp(3px, 0.8vw, 6px)',
                    fontWeight: 600,
                  }}
                >
                  {branding.website}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Date */}
      <div
        className="absolute right-[5%]"
        style={{
          bottom: '2%',
          color: subtle,
          fontSize: 'clamp(3px, 0.7vw, 5px)',
        }}
      >
        Édité le {today}
      </div>
    </div>
  );
};

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────

const BrandingView = ({
  masterBranding,
  onSaveMasterBranding,
  project
}) => {
  const [branding, setBranding] = useState(() => ({
    ...DEFAULT_BRANDING,
    ...masterBranding,
    colors: { ...DEFAULT_BRANDING.colors, ...(masterBranding?.colors || {}) },
    fonts:  { ...DEFAULT_BRANDING.fonts,  ...(masterBranding?.fonts  || {}) },
    sizes:  { ...DEFAULT_BRANDING.sizes,  ...(masterBranding?.sizes  || {}) },
  }));

  const [activeTab, setActiveTab]         = useState('identity');
  const [activeDocType, setActiveDocType] = useState('estimation');
  const [saveStatus, setSaveStatus]       = useState('idle'); // idle | saving | saved
  const [showHelp, setShowHelp]           = useState(false);
  const fileInputRef = useRef(null);
  const isDirty = useRef(false);

  // ── Mise à jour générique ──
  const update = useCallback((path, value) => {
    isDirty.current = true;
    setBranding(prev => {
      const next = { ...prev };
      const keys = path.split('.');
      if (keys.length === 1) {
        next[keys[0]] = value;
      } else if (keys.length === 2) {
        next[keys[0]] = { ...next[keys[0]], [keys[1]]: value };
      }
      return next;
    });
  }, []);

  // ── Upload logo ──
  const handleLogoUpload = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => update('logo', e.target.result);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleLogoUpload(file);
  };

  // ── Sauvegarde ──
  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      await onSaveMasterBranding?.(branding);
      isDirty.current = false;
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('idle');
    }
  };

  // ── Reset ──
  const handleReset = async () => {
    const ok = await confirm('Réinitialiser le branding aux valeurs par défaut ?', { danger: true });
    if (!ok) return;
    setBranding({ ...DEFAULT_BRANDING });
    isDirty.current = true;
  };

  return (
    <div className="flex h-full w-full bg-[#f5f5f7] overflow-hidden"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}>

      <HelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} moduleId="branding" />

      {/* ── PANNEAU GAUCHE : ÉDITEUR ── */}
      <div className="w-80 flex-shrink-0 flex flex-col bg-white/80 backdrop-blur-xl border-r border-gray-200/60 overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200/60 flex-shrink-0 flex items-start justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900 tracking-tight">
              Charte graphique
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Appliquée à tous les documents exportés
            </p>
          </div>
          <HelpButton onClick={() => setShowHelp(true)} />
        </div>

        {/* Onglets — segmented control Apple */}
        <div className="px-4 py-3 border-b border-gray-200/60 flex-shrink-0">
          <div className="flex p-0.5 bg-gray-100 rounded-xl">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all duration-200
                  ${activeTab === tab.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'}`}
              >
                <span className="text-sm">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contenu de l'onglet */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* ── IDENTITÉ ── */}
          {activeTab === 'identity' && (
            <>
              <SectionTitle>Logo de votre société</SectionTitle>
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className={`relative w-full rounded-2xl border-2 border-dashed cursor-pointer
                            transition-all duration-200 mb-4
                            ${branding.logo
                              ? 'border-gray-200 bg-gray-50 p-3'
                              : 'border-gray-200 hover:border-blue-300 bg-gray-50 hover:bg-blue-50/50 p-6'}`}
              >
                {branding.logo ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={branding.logo}
                      alt="logo"
                      className="max-h-12 max-w-[120px] object-contain rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 truncate">Logo chargé</p>
                      <button
                        onClick={e => { e.stopPropagation(); update('logo', null); }}
                        className="text-xs text-red-400 hover:text-red-600 mt-1"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="text-2xl mb-2">🖼️</div>
                    <p className="text-xs font-medium text-gray-500">
                      Glisser-déposer ou cliquer
                    </p>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => handleLogoUpload(e.target.files?.[0])}
                />
              </div>

              <SectionTitle>Informations société</SectionTitle>
              <Field label="Nom de la société">
                <Input
                  value={branding.companyName}
                  onChange={v => update('companyName', v)}
                  placeholder="Dupont Architecture"
                />
              </Field>
              <Field label="Tagline / Slogan">
                <Input
                  value={branding.tagline}
                  onChange={v => update('tagline', v)}
                  placeholder="Bureau d'études & maîtrise d'œuvre"
                />
              </Field>

              <SectionTitle>Coordonnées</SectionTitle>
              <Field label="Adresse">
                <Input
                  value={branding.address}
                  onChange={v => update('address', v)}
                  placeholder="12 rue de la Paix"
                />
              </Field>
              
              <div className="flex gap-3">
                <div className="flex-1">
                  <Field label="Code postal">
                    <Input
                      value={branding.zip}
                      onChange={v => update('zip', v)}
                      placeholder="75001"
                    />
                  </Field>
                </div>
                <div className="flex-[2]">
                  <Field label="Ville">
                    <Input
                      value={branding.city}
                      onChange={v => update('city', v)}
                      placeholder="Paris"
                    />
                  </Field>
                </div>
              </div>

              <Field label="Téléphone">
                <Input
                  value={branding.phone}
                  onChange={v => update('phone', v)}
                  placeholder="+33 1 23 45 67 89"
                />
              </Field>
              <Field label="Email">
                <Input
                  value={branding.email}
                  onChange={v => update('email', v)}
                  placeholder="contact@cabinet.fr"
                />
              </Field>
              <Field label="Site web">
                <Input
                  value={branding.website}
                  onChange={v => update('website', v)}
                  placeholder="www.cabinet.fr"
                />
              </Field>
            </>
          )}

          {/* ── COULEURS ── */}
          {activeTab === 'colors' && (
            <>
              <SectionTitle>Palette principale</SectionTitle>
              <ColorPicker
                label="Couleur primaire"
                value={branding.colors.primary}
                onChange={v => update('colors.primary', v)}
                description="Titres, accents, bandeau"
              />
              <ColorPicker
                label="Couleur secondaire"
                value={branding.colors.secondary}
                onChange={v => update('colors.secondary', v)}
                description="Traits, boutons, highlights"
              />
              <ColorPicker
                label="Couleur texte"
                value={branding.colors.text}
                onChange={v => update('colors.text', v)}
                description="Corps de texte principal"
              />
              <ColorPicker
                label="Couleur subtile"
                value={branding.colors.subtle}
                onChange={v => update('colors.subtle', v)}
                description="Labels, métadonnées, secondaire"
              />

              <SectionTitle>Aperçu palette</SectionTitle>
              <div className="flex gap-2 mb-4">
                {Object.entries(branding.colors).map(([key, val]) => (
                  <div key={key} className="flex-1">
                    <div
                      className="w-full aspect-square rounded-lg shadow-sm mb-1"
                      style={{ backgroundColor: val }}
                    />
                    <div className="text-xs text-gray-400 text-center truncate capitalize">
                      {key}
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="rounded-xl p-4 text-sm font-medium"
                style={{
                  backgroundColor: lightenHex(branding.colors.primary, 0.93),
                  color: branding.colors.primary,
                  fontWeight: 600,
                }}
              >
                <span style={{ color: branding.colors.subtle, fontSize: '11px', display: 'block', marginBottom: 4 }}>
                  APERÇU COULEUR
                </span>
                Combinaison de couleurs
                <div
                  className="inline-block ml-2 px-2 py-0.5 rounded text-white text-xs"
                  style={{ backgroundColor: branding.colors.secondary }}
                >
                  tag
                </div>
              </div>
            </>
          )}

          {/* ── TYPOGRAPHIE ── */}
          {activeTab === 'typography' && (
            <>
              <SectionTitle>Polices de caractères</SectionTitle>
              <Field label="Police des titres">
                <Select
                  value={branding.fonts.headings}
                  onChange={v => update('fonts.headings', v)}
                  options={FONT_OPTIONS}
                />
                <div
                  className="mt-2 text-base font-bold truncate"
                  style={{ fontFamily: branding.fonts.headings, color: branding.colors.primary }}
                >
                  Titre de chapitre en {branding.fonts.headings}
                </div>
              </Field>
              <Field label="Police du corps">
                <Select
                  value={branding.fonts.main}
                  onChange={v => update('fonts.main', v)}
                  options={FONT_OPTIONS}
                />
                <div
                  className="mt-2 text-sm truncate text-gray-600"
                  style={{ fontFamily: branding.fonts.main }}
                >
                  Texte de paragraphe en {branding.fonts.main}
                </div>
              </Field>

              <SectionTitle>Tailles (documents Word)</SectionTitle>
              <p className="text-xs text-gray-400 mb-3 -mt-1">
                Utilisées dans les exports CCTP et RC. La valeur est en points (pt).
              </p>
              {[
                { key: 'title1', label: 'Titre 1' },
                { key: 'title2', label: 'Titre 2' },
                { key: 'title3', label: 'Titre 3' },
                { key: 'title4', label: 'Titre 4' },
                { key: 'title5', label: 'Titre 5' },
                { key: 'body',   label: 'Corps'   },
              ].map(({ key, label }) => (
                <SizeSlider
                  key={key}
                  label={label}
                  value={branding.sizes[key]}
                  onChange={v => update(`sizes.${key}`, v)}
                />
              ))}

              <SectionTitle>Aperçu hiérarchie</SectionTitle>
              <div
                className="rounded-xl p-4 space-y-2 bg-gray-50 border border-gray-100"
                style={{ fontFamily: branding.fonts.headings }}
              >
                {[
                  { key: 'title1', text: '1. TITRE NIVEAU 1', color: branding.colors.primary,   bold: true,  caps: true  },
                  { key: 'title2', text: '1.1 Titre niveau 2', color: branding.colors.secondary, bold: true,  caps: false },
                  { key: 'title3', text: '1.1.1 Titre niveau 3', color: '#444444',               bold: true,  caps: false, italic: true },
                  { key: 'title4', text: '1.1.1.1 Titre niveau 4', color: '#000000',             bold: true,  caps: false },
                  { key: 'body',   text: 'Corps de texte régulier.', color: branding.colors.text, bold: false, caps: false, font: branding.fonts.main },
                ].map(({ key, text, color, bold, caps, italic, font }) => (
                  <div
                    key={key}
                    style={{
                      fontSize: `${branding.sizes[key] / 2}pt`,
                      color,
                      fontWeight: bold ? 700 : 400,
                      textTransform: caps ? 'uppercase' : 'none',
                      fontStyle: italic ? 'italic' : 'normal',
                      fontFamily: font || branding.fonts.headings,
                      lineHeight: 1.3,
                    }}
                  >
                    {text}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer : Boutons d'action */}
        <div className="px-5 py-4 border-t border-gray-200/60 flex-shrink-0 space-y-2">
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className={`w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 active:scale-[0.97]
              ${saveStatus === 'saved'
                ? 'bg-emerald-500'
                : saveStatus === 'saving'
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-gray-900 hover:bg-gray-800'}`}
          >
            {saveStatus === 'saving' ? 'Sauvegarde…'
             : saveStatus === 'saved' ? 'Enregistré !'
             : 'Enregistrer la charte'}
          </button>
          <button
            onClick={handleReset}
            className="w-full py-2 rounded-xl text-xs text-gray-400 hover:text-gray-600
                       hover:bg-gray-100 transition-all duration-200"
          >
            Réinitialiser aux valeurs par défaut
          </button>
        </div>
      </div>

      {/* ── PANNEAU DROIT : APERÇU ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Barre supérieure : sélection du type de document */}
        <div className="flex-shrink-0 bg-white/60 backdrop-blur-sm border-b border-gray-200/50 px-6 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider mr-1">Aperçu pour :</span>
            {DOC_TYPES.map(dt => (
              <button
                key={dt.id}
                onClick={() => setActiveDocType(dt.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium
                            transition-all duration-200
                            ${activeDocType === dt.id
                              ? 'bg-gray-900 text-white shadow-sm'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                <span>{dt.icon}</span>
                {dt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Aperçu centré */}
        <div className="flex-1 overflow-auto p-8 flex items-start justify-center">
          <div className="w-full max-w-md">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">
                  Page de garde — Format A4
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Basé sur les informations de votre projet actuel
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-gray-400">Temps réel</span>
              </div>
            </div>

            <CoverPreview
              branding={branding}
              activeDocType={activeDocType}
              project={project}
            />

            {/* Légende des documents impactés */}
            <div className="mt-5 p-4 bg-white rounded-2xl border border-gray-200/60">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                Documents utilisant cette charte
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'PDF Estimation / DQE', uses: ['logo', 'couleur primaire'] },
                  { label: 'PDF BPU',               uses: ['logo', 'couleur primaire'] },
                  { label: 'PDF Analyse des offres',uses: ['logo', 'couleur primaire'] },
                  { label: 'DOCX CCTP',             uses: ['logo', 'couleurs', 'polices', 'tailles'] },
                  { label: 'DOCX RC',               uses: ['logo', 'couleurs', 'polices', 'tailles'] },
                  { label: 'Excel (tous)',           uses: ['logo', 'couleur primaire'] },
                ].map(item => (
                  <div
                    key={item.label}
                    className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-100"
                  >
                    <div className="text-xs font-medium text-gray-700 truncate">{item.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">
                      {item.uses.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandingView;