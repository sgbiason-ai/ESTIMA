// src/views/estimRapide/EstimRapideView.jsx
// Module Estimation Rapide — orchestrateur (liste ↔ éditeur, auto-save).
// Look ESTIMA : ribbon Office, fond clair, accent émeraude.
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ArrowLeft, Plus, Save, Loader2, CheckCircle2, Copy, Trash2, FileOutput, BookmarkPlus } from 'lucide-react';
import { useEstimRapide } from '../../hooks/useEstimRapide';
import { confirm, prompt } from '../../utils/globalUI';
import { RibbonHeader, RibbonContainer, RibbonGroup, RibbonBtnLarge } from '../../components/common/RibbonParts';
import EstimRapideList from './EstimRapideList';
import EstimRapideEditor from './EstimRapideEditor';
import TemplatePickerModal from './TemplatePickerModal';

export default function EstimRapideView({ user, companyId, onBackToHub, onNavigateModule }) {
  const {
    estimates, templates, isLoading, selected, selectedId, setSelectedId,
    createEstimate, createFromCustomTemplate, saveEstimate, duplicateEstimate, deleteEstimate,
    saveAsTemplate, deleteTemplate, convertToProject,
  } = useEstimRapide(user, companyId);

  const [view, setView] = useState('list'); // 'list' | 'editor'
  const [draft, setDraft] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);

  const savingRef = useRef(false);
  const autoSaveTimerRef = useRef(null);
  const draftRef = useRef(null);
  const isDirtyRef = useRef(false);

  // Sync draft depuis la sélection (ne réinitialise pas si même id)
  useEffect(() => {
    if (selected) setDraft(prev => (!prev || prev.id !== selected.id) ? { ...selected } : prev);
    else setDraft(null);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = useMemo(() => {
    if (!draft || !selected) return false;
    return JSON.stringify(draft) !== JSON.stringify(selected);
  }, [draft, selected]);

  useEffect(() => { draftRef.current = draft; }, [draft]);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  const performSave = useCallback(async () => {
    const d = draftRef.current;
    if (!d || !d.id || savingRef.current) return false;
    savingRef.current = true;
    setIsSaving(true);
    if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }
    const ok = await saveEstimate(d);
    setIsSaving(false);
    savingRef.current = false;
    return ok;
  }, [saveEstimate]);

  // Auto-save debounced (3 s)
  useEffect(() => {
    if (!isDirty || !draft) {
      if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }
      return;
    }
    autoSaveTimerRef.current = setTimeout(() => { performSave(); }, 3000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [draft, isDirty, performSave]);

  // Garde fermeture navigateur si modifs non enregistrées
  useEffect(() => {
    const handler = (e) => { if (isDirtyRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const flushAndRun = useCallback(async (fn) => {
    if (isDirtyRef.current) await performSave();
    fn();
  }, [performSave]);

  const handleOpen = (id) => {
    const est = estimates.find(e => e.id === id);
    if (est) setDraft({ ...est });   // seed synchrone → pas de flash de la liste
    setSelectedId(id);
    setView('editor');
  };
  const handleBackToList = () => flushAndRun(() => setView('list'));
  const handleBackToHub = () => flushAndRun(() => onBackToHub());

  const handleCreate = async (templateId, name) => {
    setShowTemplate(false);
    const est = await createEstimate(templateId, name);
    if (est) { setDraft({ ...est }); setView('editor'); }
  };

  const handleCreateCustom = async (template, name) => {
    setShowTemplate(false);
    const est = await createFromCustomTemplate(template, name);
    if (est) { setDraft({ ...est }); setView('editor'); }
  };

  const handleSaveAsTemplate = async () => {
    if (!draftRef.current) return;
    const name = await prompt('Nom du modèle', draftRef.current.name || '', { title: 'Enregistrer comme modèle', confirmLabel: 'Enregistrer' });
    if (name === null) return;
    await saveAsTemplate(draftRef.current, name.trim() || draftRef.current.name || 'Modèle');
  };

  const handleDelete = async (id) => {
    const ok = await confirm('Cette action est irréversible.', { title: 'Supprimer cette estimation ?', danger: true, confirmLabel: 'Supprimer' });
    if (!ok) return;
    await deleteEstimate(id);
    if (selectedId === id || draft?.id === id) { setDraft(null); setView('list'); }
  };

  const handleConvert = async () => {
    if (!draftRef.current) return;
    const ok = await confirm(
      "Un projet ESTIMA détaillé sera créé à partir de cette estimation (lots → chapitres, postes → articles, formules conservées). Vous pourrez l'affiner avec le BPU et les tranches.",
      { title: 'Convertir en ESTIMA VRD ?', confirmLabel: 'Convertir' }
    );
    if (!ok) return;
    if (isDirtyRef.current) await performSave();
    const projectId = await convertToProject(draftRef.current);
    if (projectId && onNavigateModule) onNavigateModule('estima');
  };

  const inEditor = view === 'editor' && !!draft;

  // ── Indicateur de sauvegarde (style ProjectToolbar) ──
  const SaveIndicator = () => {
    if (!inEditor) return null;
    if (isSaving) return <span className="flex items-center gap-1 text-[10px] text-blue-500"><Loader2 size={11} className="animate-spin" /> Enregistrement…</span>;
    if (isDirty) return <span className="flex items-center gap-1 text-[10px] text-amber-500"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Non enregistré</span>;
    return <span className="flex items-center gap-1 text-[10px] text-emerald-500"><CheckCircle2 size={11} /> Enregistré</span>;
  };

  return (
    <div className="h-screen w-full bg-[#f8fafc] overflow-hidden flex flex-col font-[system-ui,'Segoe_UI',sans-serif] text-slate-700 select-none">

      {/* ── Ribbon ── */}
      <header className="sticky top-0 z-20 shrink-0">
        <RibbonHeader
          title={inEditor ? (draft.name || 'Sans titre') : 'Estimation Rapide'}
          tabs={[{ id: 'accueil', label: 'Accueil' }]}
          activeTab="accueil"
          onTabChange={() => {}}
          rightContent={<SaveIndicator />}
        />
        <RibbonContainer>
          <RibbonGroup label="Navigation">
            <RibbonBtnLarge icon={ArrowLeft} label={inEditor ? 'Liste' : 'Hub'} onClick={inEditor ? handleBackToList : handleBackToHub} />
          </RibbonGroup>

          <RibbonGroup label="Fichier">
            <RibbonBtnLarge icon={Plus} label="Nouvelle" onClick={() => setShowTemplate(true)} accent="text-emerald-500" />
            {inEditor && (
              <RibbonBtnLarge
                icon={isSaving ? Loader2 : Save}
                label={isSaving ? 'Enreg…' : 'Enregistrer'}
                onClick={performSave}
                disabled={!isDirty || isSaving}
                accent="text-blue-500"
                active={isDirty && !isSaving}
              />
            )}
            {inEditor && (
              <RibbonBtnLarge icon={BookmarkPlus} label="Enreg. modèle" onClick={handleSaveAsTemplate} accent="text-violet-500" />
            )}
          </RibbonGroup>

          {inEditor && (
            <RibbonGroup label="Édition">
              <RibbonBtnLarge icon={Copy} label="Dupliquer" onClick={() => duplicateEstimate(draft.id)} />
              <RibbonBtnLarge icon={Trash2} label="Supprimer" onClick={() => handleDelete(draft.id)} accent="text-red-500" />
            </RibbonGroup>
          )}

          {inEditor && (
            <RibbonGroup label="Passerelle">
              <RibbonBtnLarge icon={FileOutput} label="Convertir en ESTIMA" onClick={handleConvert} accent="text-emerald-500" />
            </RibbonGroup>
          )}
        </RibbonContainer>
      </header>

      {/* ── Body ── */}
      <main className="flex-1 min-h-0 flex flex-col">
        {inEditor ? (
          <EstimRapideEditor draft={draft} onChange={setDraft} />
        ) : (
          <EstimRapideList
            estimates={estimates} isLoading={isLoading}
            onOpen={handleOpen} onNew={() => setShowTemplate(true)}
            onDuplicate={duplicateEstimate} onDelete={handleDelete}
          />
        )}
      </main>

      {showTemplate && (
        <TemplatePickerModal
          templates={templates}
          onCreate={handleCreate}
          onCreateCustom={handleCreateCustom}
          onDeleteTemplate={deleteTemplate}
          onClose={() => setShowTemplate(false)}
        />
      )}
    </div>
  );
}
