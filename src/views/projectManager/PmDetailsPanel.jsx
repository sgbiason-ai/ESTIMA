import React, { useState, useEffect } from 'react';
import {
  X, ExternalLink, Copy, Folder, Trash2, RotateCcw, FileSignature,
  BarChart3, ClipboardList, Clock, User, BookOpen, Check, RefreshCw,
  MapPin, Hash, Building2, Download,
} from 'lucide-react';
import { NEUTRAL_COLOR } from './folderColors';
import { formatRelativeDate } from './relativeDate';
import { PROJECT_STATUSES, formatEuroHT } from './pmMeta';
import { getActiveLocalLibrary, backupActiveLocalLibrary, setActiveLocalLibrary, librariesMatch } from '../../utils/localLibrary';
import { toast } from '../../utils/globalUI';

const Section = ({ title, children }) => (
  <div>
    <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">{title}</div>
    {children}
  </div>
);

const Field = ({ label, icon: Icon, value, onChange, placeholder }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 ml-1">{label}</label>
    <div className="flex items-center bg-gray-100 border border-gray-200/60 rounded-xl focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
      {Icon && <Icon size={13} className="ml-3 text-gray-400 shrink-0" />}
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent border-none text-xs font-medium text-gray-800 placeholder-gray-400 px-2.5 py-2 focus:ring-0 focus:outline-none"
      />
    </div>
  </div>
);

/**
 * PmDetailsPanel — slide-over de détails d'une affaire (Direction 2, tranche 2).
 * Ouvert au clic sur une ligne/tuile. Édition rapide des métadonnées clés,
 * historique des versions, état de la bibliothèque liée (non bloquant), actions.
 * La fiche complète (ProjectDetailsModal) reste accessible via un bouton dédié.
 */
const PmDetailsPanel = ({
  proj,
  isSessionActive,
  folders, folderColorMap = {},
  presence = [], linkedCrcNames, hasRao,
  deletingId,
  onClose,
  onOpenInEstima, onLoadSession,
  onOpenFullDetails,
  onDuplicate, onMove, onDelete, onRestore,
  onSaveQuick,
  onNavigateModule,
}) => {
  const [form, setForm] = useState({ name: '', code: '', location: '', client: '' });
  const [saving, setSaving] = useState(false);

  // Resynchroniser le formulaire quand on change d'affaire (ou après refresh de la liste)
  useEffect(() => {
    setForm({
      name: proj?.name || '',
      code: proj?.code || '',
      location: proj?.location || '',
      client: proj?.client || '',
    });
  }, [proj?.id, proj?.name, proj?.code, proj?.location, proj?.client]);

  // Fermeture par Échap
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!proj) return null;

  const fc = proj.folderId ? (folderColorMap[proj.folderId] || NEUTRAL_COLOR) : NEUTRAL_COLOR;
  const projFolder = proj.folderId ? folders.find(f => f.id === proj.folderId) : null;

  const date = proj.lastSaved ? new Date(proj.lastSaved) : null;
  const savedFull = date ? date.toLocaleString('fr-FR') : null;
  const savedBy = proj.updatedBy || proj.savedBy || '';

  const saveHistory = (() => {
    if (Array.isArray(proj.saveHistory) && proj.saveHistory.length > 0) return proj.saveHistory;
    try { return JSON.parse(localStorage.getItem(`save_history_${proj.id}`) || '[]'); } catch { return []; }
  })();

  const dirty = form.name !== (proj.name || '') || form.code !== (proj.code || '')
    || form.location !== (proj.location || '') || form.client !== (proj.client || '');
  const canSave = dirty && form.name.trim().length > 0 && !saving;

  const handleQuickSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSaveQuick(proj.id, {
        name: form.name.trim(),
        code: form.code.trim(),
        location: form.location.trim(),
        client: form.client.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Bibliothèque liée (information non bloquante) ──
  const linked = proj.linkedLibrary;
  const hasLinked = linked && Array.isArray(linked.bpu) && linked.bpu.length > 0;
  const activeLib = getActiveLocalLibrary();
  const linkedMatchesActive = hasLinked && activeLib && librariesMatch(activeLib, linked);

  const handleActivateLinked = () => {
    try {
      backupActiveLocalLibrary();
      setActiveLocalLibrary(linked);
      toast.success(`Bibliothèque « ${linked.name || 'liée'} » activée.`);
      onClose?.(); // le re-render relira getActiveLocalLibrary à la réouverture
    } catch (e) {
      console.error('[PmDetailsPanel] activation bibliothèque liée:', e);
      toast.error('Impossible d\'activer la bibliothèque liée.');
    }
  };

  const isDeleting = deletingId === proj.id;

  return (
    <div className="absolute inset-y-0 right-0 z-30 w-[380px] max-w-[92vw] bg-white border-l border-gray-200/60 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">

      {/* ── Header ── */}
      <div className="shrink-0 px-5 py-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-gray-900 leading-snug flex-1 line-clamp-2" title={proj.name || 'Projet sans nom'}>
            {proj.name || 'Projet sans nom'}
          </h3>
          <button onClick={onClose} aria-label="Fermer le panneau"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {proj.code && (
            <span className="flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-lg bg-gray-100 text-gray-600 border border-gray-200/60">
              N° {proj.code}
            </span>
          )}
          {projFolder && (
            <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <span className={`w-2 h-2 rounded-full ${fc.dot}`} /> {projFolder.name}
            </span>
          )}
          {isSessionActive && (
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200/60">
              <Check size={10} /> En session
            </span>
          )}
          {presence.map(p => (
            <span key={p.uid} title={`${p.displayName || p.email} est sur ce projet`}
              className="flex items-center gap-1 bg-blue-50 text-blue-500 border border-blue-200/60 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              {p.displayName || p.email?.split('@')[0]}
            </span>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Actions principales */}
        <div className="space-y-2">
          <button onClick={() => onOpenInEstima(proj)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-sm active:scale-[0.98] transition-all">
            <ExternalLink size={15} /> Ouvrir dans Estima VRD
          </button>
          <button onClick={() => onLoadSession(proj)} disabled={isSessionActive}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all active:scale-[0.98] disabled:cursor-default
              disabled:bg-emerald-50 disabled:text-emerald-600 disabled:border-emerald-200/60
              bg-white text-gray-700 border-gray-200/60 hover:bg-gray-50">
            {isSessionActive ? (<><Check size={14} /> Chargée en session</>) : (<><Download size={14} /> Charger en session</>)}
          </button>
        </div>

        {/* Statut métier */}
        <Section title="Statut de l'affaire">
          <div className="flex items-center gap-1.5 flex-wrap">
            {PROJECT_STATUSES.map(s => {
              const active = proj.status === s.id;
              return (
                <button key={s.id}
                  onClick={() => onSaveQuick(proj.id, { status: active ? null : s.id })}
                  title={active ? `Retirer le statut « ${s.label} »` : `Marquer « ${s.label} »`}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-[0.97] ${
                    active ? s.badge : 'bg-white text-gray-500 border-gray-200/60 hover:bg-gray-50'
                  }`}>
                  <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                  {s.label}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Édition rapide */}
        <Section title="Édition rapide">
          <div className="space-y-2.5">
            <Field label="Nom de l'affaire" icon={FileSignature} value={form.name}
              onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Nom de l'opération" />
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="N° d'affaire" icon={Hash} value={form.code}
                onChange={v => setForm(f => ({ ...f, code: v }))} placeholder="26-0001" />
              <Field label="Lieu" icon={MapPin} value={form.location}
                onChange={v => setForm(f => ({ ...f, location: v }))} placeholder="Commune" />
            </div>
            <Field label="Client / MOA" icon={Building2} value={form.client}
              onChange={v => setForm(f => ({ ...f, client: v }))} placeholder="Nom du client" />
            <div className="flex items-center gap-2">
              <button onClick={handleQuickSave} disabled={!canSave}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all active:scale-[0.97] ${
                  canSave ? 'bg-gray-900 text-white hover:bg-gray-700 shadow-sm' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                Enregistrer
              </button>
              <button onClick={() => onOpenFullDetails(proj)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors">
                <FileSignature size={13} /> Fiche complète…
              </button>
            </div>
          </div>
        </Section>

        {/* Activité */}
        <Section title="Activité">
          <div className="bg-gray-50 border border-gray-200/60 rounded-xl px-3.5 py-3 space-y-1.5">
            {formatEuroHT(proj.totalHT) && (
              <div className="flex items-center gap-2 text-xs" title="Total HT étude, hors options — recalculé à chaque sauvegarde Cloud">
                <span className="text-gray-400 shrink-0 font-mono">€</span>
                <span className="font-bold text-gray-900">{formatEuroHT(proj.totalHT)}</span>
                {Array.isArray(proj.chapters) && <span className="text-gray-400">· {proj.chapters.length} chapitre{proj.chapters.length > 1 ? 's' : ''}</span>}
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-gray-600" title={savedFull || ''}>
              <Clock size={13} className="text-gray-400 shrink-0" />
              {date ? <>Sauvegardée {formatRelativeDate(date)} <span className="text-gray-400">({savedFull})</span></> : 'Jamais sauvegardée sur le Cloud'}
            </div>
            {savedBy && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <User size={13} className="text-gray-400 shrink-0" /> {savedBy}
              </div>
            )}
            {(hasRao || linkedCrcNames) && (
              <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                {hasRao && (
                  <button onClick={() => onNavigateModule?.('rao_analysis')}
                    className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-200/60 hover:bg-blue-100 transition-colors" title="Ouvrir l'analyse des offres">
                    <BarChart3 size={11} /> Analyse RAO
                  </button>
                )}
                {linkedCrcNames && (
                  <button onClick={() => onNavigateModule?.('crc')}
                    className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200/60 hover:bg-emerald-100 transition-colors" title={`Ouvrir CR : ${linkedCrcNames.join(', ')}`}>
                    <ClipboardList size={11} /> {linkedCrcNames.length} compte{linkedCrcNames.length > 1 ? 's' : ''}-rendu{linkedCrcNames.length > 1 ? 's' : ''}
                  </button>
                )}
              </div>
            )}
          </div>
        </Section>

        {/* Versions */}
        {saveHistory.length > 1 && (
          <Section title="Versions précédentes">
            <div className="space-y-1">
              {saveHistory.slice(1).map((iso, i) => {
                const d = new Date(iso);
                return (
                  <button key={i} onClick={() => onRestore(proj.id, iso)}
                    title="Restaurer cette version (confirmation demandée)"
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-600 bg-gray-50 border border-gray-200/60 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200/60 transition-colors text-left">
                    <RotateCcw size={13} className="shrink-0" />
                    <span className="flex-1">{formatRelativeDate(d)}</span>
                    <span className="text-gray-400">{d.toLocaleDateString('fr-FR')} {d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {/* Bibliothèque de prix */}
        <Section title="Bibliothèque de prix">
          <div className="bg-gray-50 border border-gray-200/60 rounded-xl px-3.5 py-3 space-y-2">
            {hasLinked ? (
              <>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <BookOpen size={13} className="text-gray-400 shrink-0" />
                  <span className="truncate font-medium" title={linked.name || 'Bibliothèque liée'}>{linked.name || 'Bibliothèque liée'}</span>
                  <span className="text-gray-400 shrink-0">({linked.bpu.length} articles)</span>
                </div>
                {linkedMatchesActive ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
                    <Check size={12} /> Identique à la bibliothèque active
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-amber-600 font-medium">
                      Différente de la bibliothèque active{activeLib?.name ? ` (« ${activeLib.name} »)` : ''}.
                    </p>
                    <button onClick={handleActivateLinked}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/60 hover:bg-amber-100 transition-colors">
                      <BookOpen size={12} /> Activer la bibliothèque liée
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-[11px] text-gray-500">Aucune bibliothèque liée — la base active sera utilisée à l'ouverture.</p>
            )}
          </div>
        </Section>

        {/* Autres actions */}
        <Section title="Actions">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={(e) => onDuplicate(proj, e)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-gray-700 bg-white border border-gray-200/60 hover:bg-gray-50 transition-colors">
              <Copy size={13} className="text-violet-500" /> Dupliquer
            </button>
            <button onClick={() => onMove(proj)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-gray-700 bg-white border border-gray-200/60 hover:bg-gray-50 transition-colors">
              <Folder size={13} className="text-blue-500" /> Déplacer
            </button>
            <button onClick={(e) => onDelete(proj, e)} disabled={isDeleting}
              className="col-span-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-500 bg-white border border-red-200/60 hover:bg-red-50 transition-colors disabled:opacity-50">
              {isDeleting ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />} Supprimer l'affaire
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
};

export default PmDetailsPanel;
