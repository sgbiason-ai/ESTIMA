// src/views/devisMoe/DevisMoeView.jsx
// Module Devis MOE — Composant principal (orchestrateur + sidebar + ribbon)
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Receipt, ArrowLeft, Plus, Trash2, Copy, Search,
  Save, Calculator, AlertTriangle, CheckCircle2,
  FileText, Loader2, FolderOpen,
  PanelLeftClose, PanelLeftOpen,
  BookOpen, SlidersHorizontal
} from 'lucide-react';
import { useDevisMoe, PHASES_LOI_MOP } from '../../hooks/useDevisMoe';
import {
  RibbonGroup, RibbonBtnLarge, RibbonHeader, RibbonContainer
} from '../../components/common/RibbonParts';
import HelpPanel from '../../components/help/HelpPanel';
import HelpButton from '../../components/help/HelpButton';
import { pct, honPhaseTemps, fmtE } from './devisMoeHelpers';
import DevisMoeInfoTab from './DevisMoeInfoTab';
import DevisMoeHonorairesTab from './DevisMoeHonorairesTab';
import DevisMoeRecapTab from './DevisMoeRecapTab';
import TacheTypeModal from './TacheTypeModal';
import { usePresence, useCoEditors } from '../../hooks/usePresence';
import CoEditBanner from '../../components/common/CoEditBanner';

export default function DevisMoeView({ onBackToHub, user, companyId }) {
  const { devisList, isLoading, selected, selectedId, setSelectedId,
    createDevis, saveDevis, duplicateDevis, deleteDevis } = useDevisMoe(user, companyId);

  // ── Présence + co-édition (alerte d'écrasement) ───────────────────────────
  usePresence({
    user, companyId, activeTab: 'devis_moe',
    entityType: selectedId ? 'devis_moe' : null,
    entityId: selectedId || null,
    entityName: selected?.nom || null,
  });
  const coEditors = useCoEditors({
    companyId, currentUserId: user?.uid,
    entityType: 'devis_moe', entityId: selectedId || null,
  });

  const [searchTerm, setSearchTerm]       = useState('');
  const [activeTab, setActiveTab]         = useState('infos');
  const [draft, setDraft]                 = useState(null);
  const [isSaving, setIsSaving]           = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [sidebarOpen, setSidebarOpen]     = useState(true);
  const [templatesOpen, setTemplatesOpen] = useState(true);
  const [configOpen, setConfigOpen]       = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // { type: 'hub' | 'select', id? }

  // Refs anti double-save + auto-save debounced
  const savingRef = useRef(false);
  const autoSaveTimerRef = useRef(null);
  const draftRef = useRef(null);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    if (selected) setDraft(prev => (!prev || prev.id !== selected.id) ? { ...selected } : prev);
    else setDraft(null);
  }, [selected?.id]); // eslint-disable-line

  const isDirty = useMemo(() => {
    if (!draft || !selected) return false;
    return JSON.stringify(draft) !== JSON.stringify(selected);
  }, [draft, selected]);

  // Synchroniser les refs (utilisées dans les handlers async / event listeners)
  useEffect(() => { draftRef.current = draft; }, [draft]);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  const quickTotalHon = useMemo(() => {
    if (!draft) return 0;
    const cats = draft.categories || [];
    const isPct = draft.methode === 'pourcentage';
    const activePh = (draft.phases || PHASES_LOI_MOP).filter(p => p.actif);
    return (draft.lots || []).reduce((s, l) =>
      s + (isPct ? pct(l, draft.tauxHonorairesGlobal) : activePh.reduce((s2, ph) => s2 + honPhaseTemps(l, ph.id, cats), 0)), 0);
  }, [draft]);

  // Save sécurisé : anti double-clic via ref, validation minimale, annule l'auto-save en cours
  const performSave = useCallback(async () => {
    const d = draftRef.current;
    if (!d || !d.id || savingRef.current) return false;
    savingRef.current = true;
    setIsSaving(true);
    if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }
    const updated = { ...d, updatedAt: new Date().toISOString() };
    const ok = await saveDevis(updated);
    if (ok) setDraft(updated);
    setIsSaving(false);
    savingRef.current = false;
    return ok;
  }, [saveDevis]);

  const handleSave = performSave;

  const handleCreate = async () => {
    setActiveTab('infos');
    await createDevis('Nouveau devis MOE');
  };

  // Auto-save debounced (3s d'inactivité)
  useEffect(() => {
    if (!isDirty || !draft) {
      if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }
      return;
    }
    autoSaveTimerRef.current = setTimeout(() => { performSave(); }, 3000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [draft, isDirty, performSave]);

  // Garde fermeture navigateur (onglet / refresh) si modifs non sauvegardées
  useEffect(() => {
    const handler = (e) => { if (isDirtyRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Garde navigation : Hub
  const handleBackToHub = useCallback(() => {
    if (isDirtyRef.current) { setPendingAction({ type: 'hub' }); return; }
    onBackToHub();
  }, [onBackToHub]);

  // Garde navigation : sélection d'un autre devis
  const handleSelectDevis = useCallback((id) => {
    if (id === selectedId) return;
    if (isDirtyRef.current) { setPendingAction({ type: 'select', id }); return; }
    setSelectedId(id);
    setActiveTab('infos');
  }, [selectedId, setSelectedId]);

  // Résolution du modal "modifications non enregistrées"
  const executePendingAction = useCallback(async (choice) => {
    const action = pendingAction;
    setPendingAction(null);
    if (choice === 'save') await performSave();
    if (!action) return;
    if (action.type === 'hub') onBackToHub();
    else if (action.type === 'select') { setSelectedId(action.id); setActiveTab('infos'); }
  }, [pendingAction, performSave, onBackToHub, setSelectedId]);

  const filteredList = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return !q ? devisList : devisList.filter(d =>
      (d.nom || '').toLowerCase().includes(q) ||
      (d.reference || '').toLowerCase().includes(q) ||
      (d.client?.designation || '').toLowerCase().includes(q)
    );
  }, [devisList, searchTerm]);

  // ── Indicateur de sauvegarde ──────────────────────────────────────────────
  const SaveIndicator = () => {
    if (!draft) return null;
    if (isSaving) return (
      <div className="flex items-center gap-1 text-[10px] text-blue-500">
        <Loader2 size={11} className="animate-spin" /><span>Enregistrement...</span>
      </div>
    );
    if (isDirty) return (
      <div className="flex items-center gap-1 text-[10px] text-amber-500">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /><span>Non enregistré</span>
      </div>
    );
    return (
      <div className="flex items-center gap-1 text-[10px] text-emerald-500">
        <CheckCircle2 size={11} /><span>Enregistré</span>
      </div>
    );
  };

  return (
    <div className="h-screen w-full bg-[#f8fafc] overflow-hidden flex flex-col font-[system-ui,'Segoe_UI',sans-serif] text-slate-700 select-none">

      <HelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} moduleId="devisMoe" />

      {/* ══════════════════════ RIBBON ══════════════════════ */}
      <header className="sticky top-0 z-20">

        {/* Barre d'onglets */}
        <RibbonHeader
          title={draft ? (draft.nom || 'Sans titre') : 'Devis MOE'}
          tabs={[{ id: 'accueil', label: 'Accueil' }]}
          activeTab="accueil"
          onTabChange={() => {}}
          rightContent={<SaveIndicator />}
        />

        {/* Ribbon body */}
        <RibbonContainer>
          <RibbonGroup label="Navigation">
            <RibbonBtnLarge icon={ArrowLeft} label="Hub" onClick={handleBackToHub} />
          </RibbonGroup>

          {/* Info devis courant */}
          {draft && (
            <div className="flex flex-col justify-center px-5 border-r border-slate-200 min-w-[200px] max-w-[260px]">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Devis en cours</p>
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                  draft.methode === 'pourcentage'
                    ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                    : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                }`}>
                  {draft.methode === 'pourcentage' ? '% Montant' : 'Temps passé'}
                </span>
                {draft.moeType === 'mandataire' && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-amber-50 text-amber-600 border-amber-200">Groupement</span>
                )}
                {draft.moeType === 'cotraitant' && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-blue-50 text-blue-600 border-blue-200">Co-traitant</span>
                )}
              </div>
              {(draft.lots?.length || 0) > 0 && (
                <p className="text-[10px] font-semibold text-slate-500">
                  Honoraires : <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{fmtE(quickTotalHon)}</span>
                </p>
              )}
            </div>
          )}

          <RibbonGroup label="Fichier">
            <RibbonBtnLarge icon={Plus} label="Nouveau" onClick={handleCreate} accent="text-emerald-500" />
            <RibbonBtnLarge
              icon={isSaving ? Loader2 : Save}
              label={isSaving ? 'Enreg…' : 'Enregistrer'}
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              accent="text-blue-500"
              active={isDirty && !isSaving}
            />
          </RibbonGroup>

          <RibbonGroup label="Édition">
            <RibbonBtnLarge icon={Copy}   label="Dupliquer" onClick={() => selectedId && duplicateDevis(selectedId)} disabled={!selectedId} />
            <RibbonBtnLarge icon={Trash2} label="Supprimer" onClick={() => selectedId && setConfirmDelete(selectedId)} disabled={!selectedId} accent="text-red-500" />
            <RibbonBtnLarge icon={BookOpen} label="Bibliothèque" onClick={() => setShowTemplateModal(true)} disabled={!selectedId} accent="text-emerald-500" />
          </RibbonGroup>

          {/* Onglets contenu dans le ribbon */}
          {draft && (
            <RibbonGroup label="Vue">
              {[
                { id: 'infos',      label: 'Informations', Icon: FileText },
                { id: 'honoraires', label: 'Honoraires',   Icon: Calculator },
                { id: 'recap',      label: 'Récapitulatif',Icon: Receipt },
              ].map(({ id, label, Icon }) => (
                <RibbonBtnLarge key={id} icon={Icon} label={label} onClick={() => setActiveTab(id)}
                  active={activeTab === id}
                  accent={activeTab === id ? 'text-emerald-500' : undefined} />
              ))}
            </RibbonGroup>
          )}

          {draft && activeTab === 'honoraires' && (
            <RibbonGroup label="">
              <RibbonBtnLarge icon={SlidersHorizontal} label="Paramètres"
                onClick={() => setConfigOpen(!configOpen)}
                active={configOpen}
                accent={configOpen ? 'text-emerald-500' : undefined} />
            </RibbonGroup>
          )}

          {/* Aide */}
          <div className="flex items-center px-3 ml-auto">
            <HelpButton onClick={() => setShowHelp(true)} variant="ribbon" />
          </div>

        </RibbonContainer>
      </header>

      <CoEditBanner editors={coEditors} />

      {/* ══════════════════════ BODY ══════════════════════ */}
      <div className="flex-1 flex min-h-0">

        {/* Sidebar liste — repliable */}
        <div className={`shrink-0 border-r border-slate-200 flex flex-col bg-gradient-to-b from-slate-50/80 to-white transition-all duration-300 overflow-hidden ${sidebarOpen ? 'w-64' : 'w-0'}`}>
          {sidebarOpen && (
            <>
              <div className="px-3 py-2.5 border-b border-slate-200/60 bg-gradient-to-r from-slate-50 to-white shrink-0 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-700">Mes Devis</span>
                    <span className="bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-medium px-1.5 py-0.5 rounded-full">
                      {devisList.length}
                    </span>
                  </div>
                  <button onClick={() => setSidebarOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-default">
                    <PanelLeftClose size={16} />
                  </button>
                </div>
                <div className="relative">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Rechercher…"
                    className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-400 rounded-lg text-[11px] text-slate-700 placeholder-slate-400 outline-none transition-all select-text" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {isLoading ? (
                  <div className="flex items-center justify-center py-10 text-slate-400">
                    <Loader2 size={18} className="animate-spin" />
                  </div>
                ) : filteredList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-center px-4">
                    <FolderOpen size={22} className="mb-2 text-slate-300" />
                    <p className="text-[11px] font-semibold text-slate-500">Aucun devis</p>
                    <p className="text-[10px] mt-1 text-slate-400">Utilisez "Nouveau" dans la barre d'outils</p>
                  </div>
                ) : (
                  filteredList.map(d => (
                    <div key={d.id}
                      onClick={() => handleSelectDevis(d.id)}
                      className={`group relative p-3 rounded-lg cursor-default border transition-all duration-200 ${
                        d.id === selectedId
                          ? 'bg-emerald-50/80 border-emerald-200 shadow-sm border-l-[3px] border-l-emerald-500'
                          : 'border-transparent hover:bg-slate-50/80 hover:border-slate-200 hover:shadow-sm'
                      }`}>
                      <p className={`text-xs font-semibold truncate ${d.id === selectedId ? 'text-emerald-900' : 'text-slate-700'}`}>
                        {d.numero && <span className="text-emerald-600 font-mono mr-1.5">{d.numero}</span>}
                        {d.nom || 'Devis sans titre'}
                      </p>
                      {d.client?.designation && (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{d.client.designation}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                          d.methode === 'pourcentage'
                            ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                            : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        }`}>
                          {d.methode === 'pourcentage' ? '%' : 'Temps'}
                        </span>
                        {d.moeType === 'mandataire' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-amber-50 text-amber-600 border-amber-200">Groupement</span>
                        )}
                        {d.moeType === 'cotraitant' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-blue-50 text-blue-600 border-blue-200">Co-traitant</span>
                        )}
                        <span className="text-[9px] text-slate-400 ml-auto">{d.dateDevis || ''}</span>
                      </div>
                      {/* Actions hover */}
                      <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-0.5 bg-white border border-slate-200 rounded shadow-sm px-1">
                        <button onClick={e => { e.stopPropagation(); duplicateDevis(d.id); }}
                          className="p-1 text-slate-400 hover:text-indigo-600 transition-colors cursor-default" title="Dupliquer">
                          <Copy size={11} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); setConfirmDelete(d.id); }}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-default" title="Supprimer">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Bouton réouvrir sidebar — visible quand repliée */}
        {!sidebarOpen && (
          <div className="shrink-0 border-r border-slate-200 flex items-start pt-2 px-1">
            <button onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-default"
              title="Afficher la liste des devis">
              <PanelLeftOpen size={16} />
            </button>
          </div>
        )}

        {/* Zone contenu */}
        {!selectedId || !draft ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 bg-gradient-to-br from-slate-50/50 via-white to-emerald-50/30">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-emerald-200/30 rounded-full blur-2xl scale-150" />
              <div className="relative p-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-100">
                <Receipt size={48} className="text-emerald-400" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-slate-500 mb-2">Aucun devis sélectionné</h2>
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed mb-6">
              Créez un nouveau devis ou sélectionnez-en un dans la liste.
            </p>
            <button onClick={handleCreate}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-semibold text-sm hover:from-emerald-500 hover:to-emerald-400 hover:shadow-lg hover:shadow-emerald-200 transition-all duration-200 shadow-md cursor-default">
              <Plus size={16} />Nouveau devis MOE
            </button>
          </div>
        ) : (
          <div className={`flex-1 ${activeTab === 'honoraires' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
            {activeTab === 'infos'      && <DevisMoeInfoTab       draft={draft} onChange={setDraft} />}
            {activeTab === 'honoraires' && <DevisMoeHonorairesTab  draft={draft} onChange={setDraft} templatesOpen={templatesOpen} setTemplatesOpen={setTemplatesOpen} configOpen={configOpen} setConfigOpen={setConfigOpen} />}
            {activeTab === 'recap'      && <DevisMoeRecapTab        draft={draft} />}
          </div>
        )}
      </div>

      {/* ══════════════════════ MODAL BIBLIOTHÈQUE ══════════════════════ */}
      {showTemplateModal && draft && <TacheTypeModal
        draft={draft}
        setDraft={setDraft}
        onClose={() => setShowTemplateModal(false)}
      />}

      {/* ══════════════════════ MODAL MODIFS NON ENREGISTRÉES ══════════════════════ */}
      {pendingAction && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-amber-50 border border-amber-100">
                <AlertTriangle size={20} className="text-amber-500" />
              </div>
              <h3 className="font-bold text-slate-800">Modifications non enregistrées</h3>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              Vous avez des modifications en cours sur ce devis. Voulez-vous les enregistrer avant de continuer&nbsp;?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPendingAction(null)}
                className="flex-1 px-3 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-200 transition-all cursor-default">
                Annuler
              </button>
              <button onClick={() => executePendingAction('discard')}
                className="flex-1 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 text-sm font-medium text-red-600 hover:bg-red-100 transition-all cursor-default">
                Ne pas enregistrer
              </button>
              <button onClick={() => executePendingAction('save')}
                className="flex-1 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-bold text-emerald-600 hover:bg-emerald-100 transition-all cursor-default">
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ MODAL SUPPRESSION ══════════════════════ */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-red-50 border border-red-100">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <h3 className="font-bold text-slate-800">Supprimer le devis ?</h3>
            </div>
            <p className="text-sm text-slate-500 mb-6">Cette action est irréversible. Le devis sera définitivement supprimé.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-all cursor-default">
                Annuler
              </button>
              <button onClick={async () => { await deleteDevis(confirmDelete); setConfirmDelete(null); }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-sm font-bold text-red-600 hover:bg-red-100 transition-all cursor-default">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
