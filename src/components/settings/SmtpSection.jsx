// src/components/settings/SmtpSection.jsx
//
// Configuration SMTP par utilisateur pour l'envoi du CRC par email (sans Outlook).
// Le mot de passe est chiffre cote serveur via Cloud Function (AES-256-GCM, cle en Secret Manager).

import React, { useEffect, useState } from 'react';
import {
  Mail, Loader2, Eye, EyeOff, Check, Trash2, Send,
  Info, AlertTriangle, Server, Lock, HelpCircle,
} from 'lucide-react';
import { confirm, toast } from '../../utils/globalUI';
import { useSmtpConfig } from '../../hooks/useSmtpConfig';
import {
  saveSmtpConfig, testSmtpConnection, deleteSmtpConfig, PWD_SENTINEL,
} from '../../services/mailService';
import HelpPanel from '../help/HelpPanel';

// ─── Presets fournisseurs ──────────────────────────────────────────────────

const PRESETS = [
  {
    id: 'gmail',
    label: 'Gmail / Google Workspace',
    host: 'smtp.gmail.com', port: 465, secure: true,
    hint: 'Necessite un mot de passe d\'application (MFA active) — myaccount.google.com/apppasswords',
  },
  {
    id: 'outlook',
    label: 'Outlook 365 / Office',
    host: 'smtp.office365.com', port: 587, secure: false,
    hint: 'L\'admin Microsoft doit autoriser le SMTP authentifie. Mot de passe d\'application recommande.',
  },
  {
    id: 'ovh',
    label: 'OVH (pro/perso)',
    host: 'ssl0.ovh.net', port: 465, secure: true,
    hint: 'Identifiants standards OVH Mail Pro.',
  },
  {
    id: 'free',
    label: 'Free.fr',
    host: 'smtp.free.fr', port: 465, secure: true,
    hint: 'Identifiants de la messagerie Free.',
  },
  {
    id: 'orange',
    label: 'Orange',
    host: 'smtp.orange.fr', port: 465, secure: true,
    hint: 'Identifiants Orange/Wanadoo.',
  },
  {
    id: 'custom',
    label: 'Autre / Personnalise',
    host: '', port: 587, secure: false,
    hint: 'Renseignez les parametres fournis par votre administrateur mail.',
  },
];

const DEFAULT_FORM = {
  host: '', port: 587, secure: false,
  user: '', password: PWD_SENTINEL,
  fromEmail: '', fromName: '',
};

const SmtpSection = ({ user }) => {
  const { config, isConfigured, loading } = useSmtpConfig();

  const [form, setForm] = useState(DEFAULT_FORM);
  const [showPwd, setShowPwd] = useState(false);
  const [preset, setPreset] = useState('custom');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Initialise le form depuis la config Firestore
  useEffect(() => {
    if (config) {
      setForm({
        host: config.host || '',
        port: config.port || 587,
        secure: Boolean(config.secure),
        user: config.user || '',
        password: PWD_SENTINEL, // sentinel "inchange"
        fromEmail: config.fromEmail || '',
        fromName: config.fromName || '',
      });
      // Auto-detect preset
      const match = PRESETS.find((p) => p.id !== 'custom' && p.host === config.host);
      setPreset(match ? match.id : 'custom');
    } else if (user?.email) {
      // Pre-remplit fromEmail avec l'email du user si pas de config
      setForm((f) => ({ ...f, user: user.email, fromEmail: user.email, fromName: user.displayName || '' }));
    }
  }, [config, user]);

  const handlePresetChange = (id) => {
    setPreset(id);
    const p = PRESETS.find((x) => x.id === id);
    if (p && id !== 'custom') {
      setForm((f) => ({ ...f, host: p.host, port: p.port, secure: p.secure }));
    }
  };

  const handleField = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: val }));
  };

  const handleSecureToggle = (checked) => {
    // SSL implicite (465) ou STARTTLS (587)
    setForm((f) => ({ ...f, secure: checked, port: checked ? 465 : 587 }));
  };

  const validate = () => {
    if (!form.host) return 'Serveur SMTP requis.';
    if (!form.port) return 'Port requis.';
    if (!form.user) return 'Identifiant requis.';
    if (!isConfigured && (!form.password || form.password === PWD_SENTINEL)) {
      return 'Mot de passe requis pour la premiere configuration.';
    }
    if (!form.fromEmail) return 'Adresse expediteur (From) requise.';
    if (!/.+@.+\..+/.test(form.fromEmail)) return 'Adresse expediteur invalide.';
    return null;
  };

  // Normalise le mot de passe (strip espaces : Gmail affiche les app passwords en 4x4 lettres)
  const cleanPassword = (pwd) => (pwd === PWD_SENTINEL ? pwd : String(pwd || '').replace(/\s+/g, ''));

  const handleSave = async () => {
    const error = validate();
    if (error) { toast.warning(error); return; }
    setSaving(true);
    try {
      await saveSmtpConfig({ ...form, password: cleanPassword(form.password) });
      toast.success('Configuration SMTP enregistree.');
      setForm((f) => ({ ...f, password: PWD_SENTINEL }));
      setShowPwd(false);
    } catch (err) {
      toast.error(`Erreur : ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!form.host || !form.port || !form.user) {
      toast.warning('Renseignez serveur, port et identifiant avant de tester.');
      return;
    }
    setTesting(true);
    try {
      const payload = form.password === PWD_SENTINEL
        ? { host: form.host, port: form.port, secure: form.secure, user: form.user } // serveur lira pwd Firestore
        : { ...form, password: cleanPassword(form.password) };
      const res = await testSmtpConnection(payload);
      toast.success(res?.message || 'Connexion SMTP OK.');
    } catch (err) {
      toast.error(`Echec test : ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm(
      'Supprimer votre configuration SMTP ? L\'envoi d\'email via le serveur sera desactive.',
      { title: 'Supprimer la configuration', danger: true }
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteSmtpConfig();
      toast.success('Configuration SMTP supprimee.');
      setForm(DEFAULT_FORM);
      setPreset('custom');
    } catch (err) {
      toast.error(`Erreur : ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const currentPresetHint = PRESETS.find((p) => p.id === preset)?.hint;

  return (
    <section className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 p-2 rounded-lg">
            <Mail size={20} className="text-emerald-600" />
          </div>
          <div>
            <h3 className="font-black uppercase text-sm tracking-widest text-slate-700">
              Configuration Email (SMTP)
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
              Envoi du CR sans Outlook
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConfigured && (
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Check size={12} /> Configure
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
            title="Guide complet de configuration SMTP"
          >
            <HelpCircle size={12} /> Aide
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex items-center justify-center text-slate-400">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Info securite */}
          <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 border border-blue-100">
            <Lock size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-blue-900 leading-relaxed">
              <strong>Securite :</strong> votre mot de passe est chiffre cote serveur (AES-256-GCM) et n'est jamais
              accessible en clair, meme depuis cette interface. Les emails partent depuis votre propre adresse, comme avec Outlook.
            </div>
          </div>

          {/* Preset */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Fournisseur
            </label>
            <select
              value={preset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full bg-gray-100 border border-gray-200/60 rounded-xl px-4 py-2.5 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
            >
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            {currentPresetHint && (
              <div className="flex items-start gap-2 mt-2 text-[11px] text-slate-500">
                <Info size={12} className="flex-shrink-0 mt-0.5" />
                <span>{currentPresetHint}</span>
              </div>
            )}
          </div>

          {/* Serveur + Port + Secure */}
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                <Server size={11} className="inline mr-1" /> Serveur SMTP
              </label>
              <input
                type="text"
                value={form.host}
                onChange={handleField('host')}
                placeholder="smtp.exemple.fr"
                className="w-full bg-gray-100 border border-gray-200/60 rounded-xl px-4 py-2.5 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Port
              </label>
              <input
                type="number"
                value={form.port}
                onChange={handleField('port')}
                className="w-full bg-gray-100 border border-gray-200/60 rounded-xl px-4 py-2.5 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Chiffrement
              </label>
              <label className="flex items-center gap-2 h-[42px] px-4 bg-gray-100 border border-gray-200/60 rounded-xl text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.secure}
                  onChange={(e) => handleSecureToggle(e.target.checked)}
                  className="rounded"
                />
                <span>{form.secure ? 'SSL/TLS' : 'STARTTLS'}</span>
              </label>
            </div>
          </div>

          {/* Identifiants */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Identifiant (souvent votre email)
              </label>
              <input
                type="text"
                value={form.user}
                onChange={handleField('user')}
                placeholder="vous@exemple.fr"
                className="w-full bg-gray-100 border border-gray-200/60 rounded-xl px-4 py-2.5 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Mot de passe {isConfigured && <span className="text-slate-400 normal-case font-medium">(laisser tel quel pour conserver)</span>}
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleField('password')}
                  onFocus={() => { if (form.password === PWD_SENTINEL) setForm((f) => ({ ...f, password: '' })); }}
                  className="w-full bg-gray-100 border border-gray-200/60 rounded-xl px-4 py-2.5 pr-10 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 rounded"
                  title={showPwd ? 'Masquer' : 'Afficher'}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          {/* From */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Adresse expediteur (From)
              </label>
              <input
                type="email"
                value={form.fromEmail}
                onChange={handleField('fromEmail')}
                placeholder="vous@exemple.fr"
                className="w-full bg-gray-100 border border-gray-200/60 rounded-xl px-4 py-2.5 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Nom affiche (optionnel)
              </label>
              <input
                type="text"
                value={form.fromName}
                onChange={handleField('fromName')}
                placeholder="Jean Dupont"
                className="w-full bg-gray-100 border border-gray-200/60 rounded-xl px-4 py-2.5 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
              />
            </div>
          </div>

          {/* Avertissement Gmail/Outlook */}
          {(preset === 'gmail' || preset === 'outlook') && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
              <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-900 leading-relaxed">
                {preset === 'gmail' && (
                  <>Gmail : la double authentification doit etre activee, puis generez un <strong>mot de passe d'application</strong> sur <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="underline">myaccount.google.com/apppasswords</a>.</>
                )}
                {preset === 'outlook' && (
                  <>Outlook 365 : l'administrateur Microsoft doit avoir <strong>autorise l'authentification SMTP</strong> pour votre compte. Un mot de passe d'application est generalement requis.</>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || saving}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 transition-colors"
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Tester la connexion
            </button>

            <div className="flex items-center gap-2">
              {isConfigured && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting || saving}
                  className="px-4 py-2 rounded-xl text-red-500 hover:bg-red-50 text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 transition-colors"
                >
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Supprimer
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || testing}
                className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 shadow-sm transition-colors"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      <HelpPanel
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        moduleId="smtp"
      />
    </section>
  );
};

export default SmtpSection;
