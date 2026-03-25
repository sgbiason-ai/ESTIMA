// src/components/modals/BrandingModal.jsx
//
// ═══════════════════════════════════════════════════════════════════
// CE QUI A CHANGÉ PAR RAPPORT À L'ORIGINAL :
//
//  1. NOUVEL ONGLET "Société" (1er onglet, avant Couleurs)
//     Contient : companyName, tagline, address, phone, email, website
//     → Ces infos apparaissent en bas de toutes les pages de garde
//
//  2. `localConfig` gère maintenant aussi ces nouveaux champs
//     (ils sont dans DEFAULT_BRANDING depuis BrandingView)
//
//  3. `handleRootChange` : nouvelle fonction pour modifier les
//     champs à la racine de l'objet branding (pas dans un sous-objet
//     comme colors ou fonts). C'est pour companyName, address, etc.
//
//  4. Ordre des onglets : Société → Couleurs → Polices → Logo
//     (Logo reste en dernier car moins utilisé)
//
// Tout le reste est IDENTIQUE à l'original.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { confirm } from '../../utils/globalUI';
import { X, Save, RotateCcw, Palette, Image as ImageIcon, Upload, Building2, Phone, Mail, Globe, MapPin, Tag } from 'lucide-react';
import { AVAILABLE_FONTS, DEFAULT_BRANDING } from '../../data/branding';

// ─── SOUS-COMPOSANT : CHAMP TEXTE SIMPLE ─────────────────────────────────────
// [NOUVEAU] Factorisation pour éviter la répétition dans l'onglet Société
const Field = ({ label, value, onChange, placeholder, icon: Icon, type = 'text' }) => (
  <div>
    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
      {label}
    </label>
    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-100 transition-all">
      {Icon && <Icon size={13} className="text-slate-400 flex-shrink-0" />}
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-xs font-semibold text-slate-700 placeholder:text-slate-300 focus:outline-none min-w-0"
      />
    </div>
  </div>
);

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────
const BrandingModal = ({ isOpen, onClose, branding, onUpdate, onSaveToCloud }) => {
  const [localConfig, setLocalConfig] = useState(branding || DEFAULT_BRANDING);

  // [MODIFIÉ] 4 onglets au lieu de 3 : on ajoute 'company' en premier
  const [activeTab, setActiveTab] = useState('company');

  // Quand le branding reçu en props change (ex: ouverture de la modale),
  // on réinitialise l'état local.
  useEffect(() => {
    if (branding) setLocalConfig(branding);
  }, [branding]);

  if (!isOpen) return null;

  // ── GESTIONNAIRES DE CHANGEMENTS ─────────────────────────────────────────

  // EXISTANT : pour les sous-objets colors, fonts, sizes
  // Exemple : handleChange('colors', 'primary', '#FF0000')
  const handleChange = (section, key, value) => {
    const newConfig = {
      ...localConfig,
      [section]: { ...localConfig[section], [key]: value }
    };
    setLocalConfig(newConfig);
    onUpdate(newConfig);
  };

  // [NOUVEAU] : pour les champs à la racine de l'objet branding
  // Exemple : handleRootChange('companyName', 'PAPYRUS')
  // Contrairement à handleChange, il n'y a pas de sous-objet ici.
  const handleRootChange = (key, value) => {
    const newConfig = { ...localConfig, [key]: value };
    setLocalConfig(newConfig);
    onUpdate(newConfig);
  };

  // EXISTANT : gestion upload logo
  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newConfig = { ...localConfig, logo: reader.result };
        setLocalConfig(newConfig);
        onUpdate(newConfig);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    const newConfig = { ...localConfig, logo: null };
    setLocalConfig(newConfig);
    onUpdate(newConfig);
  };

  const handleSave = async () => {
    const ok = await confirm("Définir ce style (et ce logo) comme le standard pour TOUTE l'entreprise ?");
    if (ok) {
      onSaveToCloud(localConfig);
      onClose();
    }
  };

  const handleReset = () => {
    setLocalConfig(DEFAULT_BRANDING);
    onUpdate(DEFAULT_BRANDING);
  };

  // ── RENDU ──────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
          <h3 className="font-black text-slate-800 uppercase text-sm tracking-wide flex items-center gap-2">
            <Palette size={18} className="text-indigo-600" /> Charte & Logo
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400">
            <X size={18} />
          </button>
        </div>

        {/* ── [MODIFIÉ] ONGLETS : 4 onglets au lieu de 3 ── */}
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {[
            { id: 'company', label: 'Société' },   // ← [NOUVEAU]
            { id: 'colors',  label: 'Couleurs' },
            { id: 'fonts',   label: 'Polices' },
            { id: 'logo',    label: 'Logo' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap
                ${activeTab === tab.id
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                  : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── CONTENU ── */}
        <div className="p-6 h-[400px] overflow-y-auto">

          {/* ── [NOUVEAU] ONGLET SOCIÉTÉ ────────────────────────────────────────
            Ces informations alimentent le pied de page des pages de garde PDF.
            Elles sont aussi utilisées dans les exports CCTP et RC.
            
            Lien avec ProjectDetailsModal :
            - `companyName` ← suggéré depuis `project.moe` (pré-rempli)
            - Les autres champs (adresse, tél, email...) sont propres au branding
              global (pas par projet) car ils ne changent pas selon le projet.
          ─────────────────────────────────────────────────────────────────────── */}
          {activeTab === 'company' && (
            <div className="space-y-4">
              <p className="text-[10px] text-slate-400 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                Ces infos apparaissent en bas de chaque page de garde (PDF + Word).
                Elles sont communes à tous vos projets.
              </p>

              <Field
                label="Nom de la société"
                value={localConfig.companyName}
                onChange={v => handleRootChange('companyName', v)}
                placeholder="PAPYRUS"
                icon={Building2}
              />
              <Field
                label="Tagline / Slogan"
                value={localConfig.tagline}
                onChange={v => handleRootChange('tagline', v)}
                placeholder="Bureau d'études & maîtrise d'œuvre"
                icon={Tag}
              />
              <Field
                label="Adresse"
                value={localConfig.address}
                onChange={v => handleRootChange('address', v)}
                placeholder="12 rue de la Paix, 75001 Paris"
                icon={MapPin}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Téléphone"
                  value={localConfig.phone}
                  onChange={v => handleRootChange('phone', v)}
                  placeholder="+33 1 23 45 67 89"
                  icon={Phone}
                  type="tel"
                />
                <Field
                  label="Email"
                  value={localConfig.email}
                  onChange={v => handleRootChange('email', v)}
                  placeholder="contact@cabinet.fr"
                  icon={Mail}
                  type="email"
                />
              </div>
              <Field
                label="Site web"
                value={localConfig.website}
                onChange={v => handleRootChange('website', v)}
                placeholder="www.cabinet.fr"
                icon={Globe}
              />

              {/* Aperçu du pied de page */}
              {(localConfig.companyName || localConfig.address) && (
                <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Aperçu pied de page
                  </p>
                  <div className="flex justify-between items-end text-[9px]">
                    <div className="space-y-0.5">
                      {localConfig.companyName && (
                        <p className="font-bold text-slate-700">{localConfig.companyName.toUpperCase()}</p>
                      )}
                      {localConfig.tagline && (
                        <p className="text-slate-400 italic">{localConfig.tagline}</p>
                      )}
                      {localConfig.address && (
                        <p className="text-slate-400">{localConfig.address}</p>
                      )}
                    </div>
                    <div className="text-right space-y-0.5">
                      {localConfig.phone && <p className="text-slate-400">{localConfig.phone}</p>}
                      {localConfig.email && <p className="text-slate-400">{localConfig.email}</p>}
                      {localConfig.website && (
                        <p className="font-bold" style={{ color: localConfig.colors?.primary || '#286E55' }}>
                          {localConfig.website}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ONGLET COULEURS (inchangé) ── */}
          {activeTab === 'colors' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-600">Couleur Principale (Titre 1)</label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-400">{localConfig.colors?.primary}</span>
                  <input type="color" value={localConfig.colors?.primary || '#286E55'} onChange={(e) => handleChange('colors', 'primary', e.target.value)} className="h-8 w-14 cursor-pointer border rounded" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-600">Couleur Secondaire (Titre 2)</label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-400">{localConfig.colors?.secondary}</span>
                  <input type="color" value={localConfig.colors?.secondary || '#32B482'} onChange={(e) => handleChange('colors', 'secondary', e.target.value)} className="h-8 w-14 cursor-pointer border rounded" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-600">Couleur Texte Standard</label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-400">{localConfig.colors?.text}</span>
                  <input type="color" value={localConfig.colors?.text || '#282828'} onChange={(e) => handleChange('colors', 'text', e.target.value)} className="h-8 w-14 cursor-pointer border rounded" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-600">Couleur Discrète (En-tête)</label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-400">{localConfig.colors?.subtle}</span>
                  <input type="color" value={localConfig.colors?.subtle || '#64748B'} onChange={(e) => handleChange('colors', 'subtle', e.target.value)} className="h-8 w-14 cursor-pointer border rounded" />
                </div>
              </div>

              {/* Aperçu de la palette */}
              <div className="flex gap-2 pt-2">
                {Object.entries(localConfig.colors || {}).map(([key, val]) => (
                  <div key={key} className="flex-1 text-center">
                    <div className="w-full aspect-square rounded-lg shadow-sm mb-1" style={{ backgroundColor: val }} />
                    <span className="text-[9px] text-slate-400 capitalize">{key}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ONGLET POLICES (inchangé) ── */}
          {activeTab === 'fonts' && (
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-2">Police des Titres</label>
                <select
                  value={localConfig.fonts?.headings || 'Helvetica'}
                  onChange={(e) => handleChange('fonts', 'headings', e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded text-sm bg-white"
                >
                  {AVAILABLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <p className="text-sm mt-2 font-bold truncate" style={{ fontFamily: localConfig.fonts?.headings }}>
                  Exemple de titre en {localConfig.fonts?.headings}
                </p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-2">Police du Corps de texte</label>
                <select
                  value={localConfig.fonts?.main || 'Helvetica'}
                  onChange={(e) => handleChange('fonts', 'main', e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded text-sm bg-white"
                >
                  {AVAILABLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <p className="text-xs mt-2 text-slate-600 truncate" style={{ fontFamily: localConfig.fonts?.main }}>
                  Exemple de corps en {localConfig.fonts?.main}
                </p>
              </div>
              
              <div className="pt-4 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-600 block mb-3">Tailles (Points Word)</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-slate-400">Titre 1 (pt)</span>
                    <input
                      type="number"
                      value={(localConfig.sizes?.title1 || 28) / 2}
                      onChange={(e) => handleChange('sizes', 'title1', e.target.value * 2)}
                      className="w-full p-1 border rounded text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Corps (pt)</span>
                    <input
                      type="number"
                      value={(localConfig.sizes?.body || 22) / 2}
                      onChange={(e) => handleChange('sizes', 'body', e.target.value * 2)}
                      className="w-full p-1 border rounded text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── ONGLET LOGO (inchangé) ── */}
          {activeTab === 'logo' && (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <div className="w-full h-32 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center bg-slate-50 relative overflow-hidden">
                {localConfig.logo ? (
                  <img src={localConfig.logo} alt="Logo" className="h-full object-contain p-2" />
                ) : (
                  <div className="text-center text-slate-400">
                    <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
                    <span className="text-xs">Aucun logo</span>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 w-full">
                <label className="flex-1 cursor-pointer bg-indigo-50 text-indigo-600 hover:bg-indigo-100 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border border-indigo-200 transition-colors">
                  <Upload size={14} /> Choisir une image
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
                {localConfig.logo && (
                  <button onClick={removeLogo} className="px-3 py-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg text-xs font-bold border border-red-200">
                    <X size={14} />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-400 text-center">
                Le logo apparaîtra en haut à gauche des pages de garde<br />
                et en en-tête de toutes les pages exportées.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
          <button onClick={handleReset} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1">
            <RotateCcw size={12} /> Rétablir défaut
          </button>
          <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            <Save size={14} /> Sauvegarder Standard
          </button>
        </div>
      </div>
    </div>
  );
};

export default BrandingModal;