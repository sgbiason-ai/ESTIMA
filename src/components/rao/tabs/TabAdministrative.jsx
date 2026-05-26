// src/components/rao/tabs/TabAdministrative.jsx
import React, { useState } from 'react';
import { FileText, Target, MessageSquare, Users, Plus, Trash2, Pencil, Check, X, AlertTriangle, ScrollText, GitBranch, Lock, FileSpreadsheet, Calendar, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Field, Textarea, OuiNonToggle } from '../RaoUI';
import { COMPANY_UI_COLORS, CONCLUSION_OPTIONS } from '../RaoConstants';
import CompanySidebar from '../CompanySidebar';
import AddVariantModal from '../AddVariantModal';
import TabAlertBanner from '../TabAlertBanner';

const ROLES = ['Mandataire', 'Cotraitant'];

// ── Composant pièce éditable ──
const EditablePiece = ({ piece, pieceKey, pieceValue, onToggle, onRename, onRemove, dragHandleProps = null, isDragging = false }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(piece.label);

  const commitRename = () => {
    if (draft.trim() && draft.trim() !== piece.label) onRename(draft.trim());
    setEditing(false);
  };

  return (
    <div className={`group/piece flex items-center gap-2 py-1.5 border-b border-slate-50 last:border-0 ${
      isDragging ? 'bg-blue-50/50 rounded-lg shadow-md' : ''
    }`}>
      {/* Drag handle */}
      {dragHandleProps && (
        <span
          {...dragHandleProps}
          className="text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing shrink-0 transition-colors"
          title="Glisser pour réorganiser"
        >
          <GripVertical size={14} />
        </span>
      )}

      {editing ? (
        <div className="flex-1 flex items-center gap-1.5">
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(false); }}
            className="flex-1 px-2 py-1 text-sm font-medium text-slate-700 bg-blue-50 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/30"
          />
          <button onClick={commitRename} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded transition-colors"><Check size={14} /></button>
          <button onClick={() => { setDraft(piece.label); setEditing(false); }} className="p-1 text-slate-400 hover:bg-slate-100 rounded transition-colors"><X size={14} /></button>
        </div>
      ) : (
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-slate-700 leading-snug">{piece.label}</span>
          <button
            onClick={() => { setDraft(piece.label); setEditing(true); }}
            className="opacity-0 group-hover/piece:opacity-100 p-0.5 text-slate-300 hover:text-blue-500 rounded transition-all"
            title="Renommer"
          >
            <Pencil size={12} />
          </button>
        </div>
      )}
      <div className="flex items-center gap-2 shrink-0">
        <OuiNonToggle value={pieceValue} onChange={onToggle} />
        <button
          onClick={onRemove}
          className="opacity-0 group-hover/piece:opacity-100 p-1 text-slate-300 hover:text-red-500 rounded transition-all"
          title="Supprimer cette pièce"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};

const TabAdministrative = ({
  companyNames, companiesData, updateAdminPiece, updateAdminField,
  selectedCompany, onSelectCompany,
  adminPieces, offerPieces, setAdminPieces, setOfferPieces,
  analysisCompanies = [],
  consultation = {},
  onImportVariant = null,
  onRemoveVariant = null,
  onToggleVariantRetained = null,
  missing = [], // items à compléter dans cet onglet
}) => {
  const [variantModalOpen, setVariantModalOpen] = useState(false);

  // ── Logique complétion pour sidebar ──
  const getAdminCompletion = (companyName) => {
    const admin = companiesData[companyName]?.admin || {};
    const pcs = admin.pieces || {};
    const conclusion = admin.conclusion;
    const allPieceIds = [...adminPieces.map(p => p.id), ...offerPieces.map(p => p.id)];
    const answeredCount = allPieceIds.filter(id => pcs[id] !== undefined && pcs[id] !== null).length;
    const hasConclusion = conclusion && conclusion !== '';
    if (hasConclusion && answeredCount === allPieceIds.length) return 'complete';
    if (hasConclusion || answeredCount > 0) return 'partial';
    return 'empty';
  };

  // ── Handlers pièces admin ──
  const addAdminPiece = () => {
    const id = `custom_admin_${Date.now()}`;
    setAdminPieces([...adminPieces, { id, label: 'Nouvelle pièce administrative' }]);
  };
  const removeAdminPiece = (pieceId) => setAdminPieces(adminPieces.filter(p => p.id !== pieceId));
  const renameAdminPiece = (pieceId, newLabel) => setAdminPieces(adminPieces.map(p => p.id === pieceId ? { ...p, label: newLabel } : p));

  // ── Drag & drop : réordre pièces admin ──
  const reorderAdminPieces = (sourceIndex, destIndex) => {
    if (sourceIndex === destIndex) return;
    const next = [...adminPieces];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(destIndex, 0, moved);
    setAdminPieces(next);
  };

  // ── Handlers pièces offre ──
  const addOfferPiece = () => {
    const id = `custom_offer_${Date.now()}`;
    setOfferPieces([...offerPieces, { id, label: 'Nouvelle pièce d\'offre' }]);
  };
  const removeOfferPiece = (pieceId) => setOfferPieces(offerPieces.filter(p => p.id !== pieceId));
  const renameOfferPiece = (pieceId, newLabel) => setOfferPieces(offerPieces.map(p => p.id === pieceId ? { ...p, label: newLabel } : p));

  // ── Drag & drop : réordre pièces offre ──
  const reorderOfferPieces = (sourceIndex, destIndex) => {
    if (sourceIndex === destIndex) return;
    const next = [...offerPieces];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(destIndex, 0, moved);
    setOfferPieces(next);
  };

  // ── Handler global pour DragDropContext (distingue admin vs offer via droppableId) ──
  const handleDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    if (source.droppableId !== destination.droppableId) return; // pas de cross-list
    if (source.droppableId.startsWith('admin-pieces-')) {
      reorderAdminPieces(source.index, destination.index);
    } else if (source.droppableId === 'offer-pieces') {
      reorderOfferPieces(source.index, destination.index);
    }
  };

  if (!selectedCompany || !companyNames.includes(selectedCompany)) return null;

  const ci = companyNames.indexOf(selectedCompany);
  const name = selectedCompany;
  const uiColor = COMPANY_UI_COLORS[ci % COMPANY_UI_COLORS.length];
  const admin = companiesData[name]?.admin || {};
  const pieces = admin.pieces || {};
  const concl = admin.conclusion || 'reguliere';
  const conclOpt = CONCLUSION_OPTIONS.find(o => o.value === concl) || CONCLUSION_OPTIONS[0];
  const isGroupement = !!admin.isGroupement;
  const members = admin.groupementMembers || [];

  const adminEntities = isGroupement && members.length > 0
    ? members.map(m => ({ key: m.id, label: m.name || 'Sans nom', role: m.role }))
    : [{ key: '_self', label: name, role: null }];

  return (
    <div className="flex h-full">
      {/* ── Sidebar entreprises ── */}
      <CompanySidebar
        companyNames={companyNames}
        selectedCompany={selectedCompany}
        onSelectCompany={onSelectCompany}
        getCompletionStatus={getAdminCompletion}
      />

      {/* ── Contenu entreprise sélectionnée ── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6 pb-24">
          {/* Banner d'alerte items à compléter */}
          <TabAlertBanner
            missing={missing}
            onItemClick={(item) => {
              if (item.companyName && item.companyName !== name) onSelectCompany(item.companyName);
            }}
          />


          {/* Header entreprise */}
          <div className={`flex items-center gap-4 px-5 py-3 bg-white rounded-2xl border ${uiColor.border} border-l-[5px] shadow-sm`}>
            <div className={`w-10 h-10 rounded-xl ${uiColor.bg} ${uiColor.text} flex items-center justify-center font-black text-lg shadow-inner`}>
              {name.substring(0, 1).toUpperCase()}
            </div>
            <h2 className="font-extrabold text-slate-800 text-xl tracking-tight">{name}</h2>
            {isGroupement && (
              <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border shadow-sm bg-indigo-50 text-indigo-700 border-indigo-200">
                Groupement ({members.length})
              </span>
            )}
            <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border shadow-sm ml-auto ${
              concl === 'reguliere' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : concl === 'inappropriee' ? 'bg-orange-50 text-orange-700 border-orange-200'
              : 'bg-red-50 text-red-600 border-red-200'
            }`}>
              {conclOpt.label}
            </span>
          </div>

          {/* ── Écart Acte d'Engagement vs total recalculé (CCP L2113-1) ── */}
          <AeAmountMismatchPanel
            analysisCompany={analysisCompanies.find(c => c.name === name)}
          />

          {/* ── Écarts de quantités vs DQE — Code Commande Publique L2152-2 ── */}
          <QuantityMismatchesPanel
            analysisCompany={analysisCompanies.find(c => c.name === name)}
            autoFlaggedReason={admin.autoFlaggedReason}
          />

          {/* ── Variantes entreprise — CCP R2151-8 à R2151-11 ── */}
          <VariantsPanel
            analysisCompany={analysisCompanies.find(c => c.name === name)}
            variantsRegime={consultation.variantsAllowed || 'forbidden'}
            variantsRequirements={consultation.variantsRequirements || ''}
            onAddClick={() => setVariantModalOpen(true)}
            onRemoveVariant={onRemoveVariant}
            onToggleRetained={onToggleVariantRetained}
          />

          {/* Modale d'ajout de variante */}
          <AddVariantModal
            open={variantModalOpen}
            companyName={name}
            variantsRequirements={consultation.variantsRequirements || ''}
            onImport={async (file, metadata) => {
              const co = analysisCompanies.find(c => c.name === name);
              if (!co || !onImportVariant) return { ok: false };
              return await onImportVariant(co.id, file, metadata);
            }}
            onClose={() => setVariantModalOpen(false)}
          />

          {/* ── Toggle Groupement ── */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users size={18} className="text-indigo-500" />
                <div>
                  <span className="text-sm font-bold text-slate-800">Groupement d'entreprises</span>
                  <p className="text-[11px] text-slate-500">Cocher si le candidat se présente en groupement</p>
                </div>
              </div>
              <button
                onClick={() => updateAdminField(name, 'isGroupement', !isGroupement)}
                className={`relative inline-flex h-6 w-12 shrink-0 items-center rounded-full transition-colors duration-200 ${isGroupement ? 'bg-indigo-500' : 'bg-slate-200'}`}
              >
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${isGroupement ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* ── Membres du groupement ── */}
            {isGroupement && (
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Membres du groupement (3 max)</span>
                  {members.length < 3 && (
                    <button
                      onClick={() => updateAdminField(name, 'groupementMembers', [...members, { id: `m${Date.now()}`, name: '', role: 'Cotraitant' }])}
                      className="flex items-center gap-1 text-[10px] font-bold text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
                    >
                      <Plus size={12} /> Ajouter
                    </button>
                  )}
                </div>
                {members.map((m, mi) => (
                  <div key={m.id} className="flex items-center gap-2 bg-indigo-50/50 border border-indigo-100 rounded-xl px-3 py-2">
                    <span className="text-xs font-black text-indigo-500 w-5 text-center">{mi + 1}</span>
                    <input
                      value={m.name}
                      onChange={e => {
                        const updated = [...members];
                        updated[mi] = { ...updated[mi], name: e.target.value };
                        updateAdminField(name, 'groupementMembers', updated);
                      }}
                      className="flex-1 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                      placeholder="Nom du membre"
                    />
                    <select
                      value={m.role}
                      onChange={e => {
                        const updated = [...members];
                        updated[mi] = { ...updated[mi], role: e.target.value };
                        updateAdminField(name, 'groupementMembers', updated);
                      }}
                      className="px-2 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button
                      onClick={() => updateAdminField(name, 'groupementMembers', members.filter((_, j) => j !== mi))}
                      className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Pièces administratives par membre (ou entreprise seule) ── */}
          <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* Colonne gauche : pièces admin par membre */}
            <div className="space-y-4 flex flex-col">
              {adminEntities.map(entity => (
                <div key={entity.key} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-5">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
                      <FileText size={16} className="text-blue-500" />
                      Pièces administratives
                      {entity.key !== '_self' && (
                        <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg ml-1">
                          {entity.label} — {entity.role}
                        </span>
                      )}
                    </h4>
                    <button
                      onClick={addAdminPiece}
                      className="flex items-center gap-1 text-[10px] font-bold text-blue-500 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors"
                      title="Ajouter une pièce administrative"
                    >
                      <Plus size={12} /> Ajouter
                    </button>
                  </div>
                  <Droppable droppableId={`admin-pieces-${entity.key}`}>
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                        {adminPieces.map((p, idx) => {
                          const pieceKey = entity.key === '_self' ? p.id : `${entity.key}_${p.id}`;
                          return (
                            <Draggable key={pieceKey} draggableId={pieceKey} index={idx}>
                              {(dragProvided, snapshot) => (
                                <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} style={dragProvided.draggableProps.style}>
                                  <EditablePiece
                                    piece={p}
                                    pieceKey={pieceKey}
                                    pieceValue={pieces[pieceKey]}
                                    onToggle={v => updateAdminPiece(name, pieceKey, v)}
                                    onRename={newLabel => renameAdminPiece(p.id, newLabel)}
                                    onRemove={() => removeAdminPiece(p.id)}
                                    dragHandleProps={dragProvided.dragHandleProps}
                                    isDragging={snapshot.isDragging}
                                  />
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                  <div className="mt-6 pt-5 border-t border-slate-100">
                    <Field label="Observations" icon={MessageSquare}>
                      <Textarea value={admin[entity.key === '_self' ? 'obsAdmin' : `obsAdmin_${entity.key}`] || ''} onChange={v => updateAdminField(name, entity.key === '_self' ? 'obsAdmin' : `obsAdmin_${entity.key}`, v)} placeholder="Notes sur le dossier administratif…" rows={2} />
                    </Field>
                  </div>
                </div>
              ))}
            </div>

            {/* Colonne droite : offre unique */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">
              <div className="flex items-center justify-between mb-5">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
                  <Target size={16} className="text-emerald-500" /> Offre de l'entreprise
                </h4>
                <button
                  onClick={addOfferPiece}
                  className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 px-2 py-1 rounded-lg transition-colors"
                  title="Ajouter une pièce d'offre"
                >
                  <Plus size={12} /> Ajouter
                </button>
              </div>
              <Droppable droppableId="offer-pieces">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                    {offerPieces.map((p, idx) => (
                      <Draggable key={p.id} draggableId={`offer_${p.id}`} index={idx}>
                        {(dragProvided, snapshot) => (
                          <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} style={dragProvided.draggableProps.style}>
                            <EditablePiece
                              piece={p}
                              pieceKey={p.id}
                              pieceValue={pieces[p.id]}
                              onToggle={v => updateAdminPiece(name, p.id, v)}
                              onRename={newLabel => renameOfferPiece(p.id, newLabel)}
                              onRemove={() => removeOfferPiece(p.id)}
                              dragHandleProps={dragProvided.dragHandleProps}
                              isDragging={snapshot.isDragging}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
              <div className="mt-6 pt-5 border-t border-slate-100">
                <Field label="Observations éventuelles" icon={MessageSquare}>
                  <Textarea value={admin.obsOffre || ''} onChange={v => updateAdminField(name, 'obsOffre', v)} placeholder="Notes sur le contenu de l'offre…" rows={2} />
                </Field>
              </div>
            </div>
          </div>
          </DragDropContext>

          {/* ── Conclusion ── */}
          <div id={`admin-concl-${name}`} className={`p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${!admin.conclusion ? 'rao-empty border-2' : 'bg-white border-slate-200'}`}>
            <div>
              <h4 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-1">
                Conclusion de l'analyse
                {!admin.conclusion && (
                  <span className="ml-2 text-[10px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md uppercase tracking-wide">⚠ Requise</span>
                )}
              </h4>
              <p className="text-xs text-slate-500">Statut officiel de la candidature pour la suite de l'analyse.</p>
            </div>
            <div className="flex flex-wrap gap-2 p-1.5 bg-slate-50 rounded-xl border border-slate-100 shadow-inner">
              {CONCLUSION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => updateAdminField(name, 'conclusion', opt.value)}
                  className={`px-5 py-2.5 rounded-lg text-xs font-black transition-all duration-300 ${
                    concl === opt.value && admin.conclusion
                      ? opt.color === 'emerald' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                      : opt.color === 'orange'  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                      :                           'bg-red-500 text-white shadow-md shadow-red-500/30'
                      : 'bg-transparent text-slate-500 hover:bg-white hover:shadow-sm'
                  }`}
                >{opt.label}</button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default TabAdministrative;

// ─── Panneau écart entre montant AE annoncé et total recalculé ─────────────
// CCP L2113-1 : l'AE est le document contractuel signé par le candidat.
// Le total recalculé (Σ qté MOE × prix unitaire) doit correspondre à l'AE.
// Un écart peut traduire : erreur de saisie BPU, oubli d'article, anomalie.
// Note : en cas de divergence BPU/DQE, le BPU prévaut contractuellement.
function AeAmountMismatchPanel({ analysisCompany }) {
  const mm = analysisCompany?.amountMismatch;
  if (!mm) return null;

  const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const isOver = mm.delta > 0;
  const signStr = mm.delta > 0 ? '+' : '';

  return (
    <div className="bg-orange-50/60 border border-orange-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-5 py-3 bg-orange-100/70 border-b border-orange-200">
        <AlertTriangle size={18} className="text-orange-600 shrink-0" />
        <div className="flex-1">
          <h3 className="text-sm font-extrabold text-orange-900 uppercase tracking-wide">
            Écart Acte d'Engagement / Total recalculé
          </h3>
          <p className="text-[11px] text-orange-700 mt-0.5 leading-snug">
            <ScrollText size={11} className="inline -mt-0.5 mr-1" />
            CCP L2113-1 : l'AE est le document contractuel signé. En cas de divergence BPU/DQE, le BPU prévaut.
          </p>
        </div>
      </div>

      <div className="p-5 grid grid-cols-3 gap-3">
        <div className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-center">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
            Annoncé sur AE
          </div>
          <div className="font-mono tabular-nums text-sm font-bold text-slate-900">
            {fmt(mm.expectedAe)}
          </div>
        </div>
        <div className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-center">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
            Recalculé après import
          </div>
          <div className="font-mono tabular-nums text-sm font-bold text-slate-900">
            {fmt(mm.computedTotal)}
          </div>
        </div>
        <div className={`px-3 py-2 border rounded-xl text-center ${isOver ? 'bg-orange-100 border-orange-300' : 'bg-blue-50 border-blue-200'}`}>
          <div className={`text-[10px] font-black uppercase tracking-wider mb-1 ${isOver ? 'text-orange-700' : 'text-blue-700'}`}>
            Écart {isOver ? '(majoré)' : '(minoré)'}
          </div>
          <div className={`font-mono tabular-nums text-sm font-bold ${isOver ? 'text-orange-800' : 'text-blue-800'}`}>
            {signStr}{fmt(mm.delta)}
          </div>
          <div className={`text-[10px] font-bold mt-0.5 ${isOver ? 'text-orange-600' : 'text-blue-600'}`}>
            {signStr}{mm.deltaPct}%
          </div>
        </div>
      </div>

      <div className="px-5 pb-4 text-[11px] text-orange-900 leading-relaxed">
        <strong>À vérifier :</strong> erreurs de saisie ou prix manquants dans le BPU importé,
        omissions d'articles, prix unitaires aberrants, ou erreur dans le montant porté sur l'AE.
        Cet écart ne classe pas automatiquement l'offre comme irrégulière mais doit faire l'objet d'une analyse.
      </div>
    </div>
  );
}

// ─── Panneau écarts de quantités (DQE vs offre) ────────────────────────────
// Conformément au CCP L2152-2, le soumissionnaire ne peut pas modifier les
// quantités du DQE. Toute divergence est signalée pour permettre la
// régularisation manuelle par le pouvoir adjudicateur.
function QuantityMismatchesPanel({ analysisCompany, autoFlaggedReason }) {
  const mismatches = analysisCompany?.quantityMismatches || [];
  const wasAutoFlagged = autoFlaggedReason === 'quantity_mismatch';

  if (mismatches.length === 0 && !wasAutoFlagged) return null;

  const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 3 });

  return (
    <div className="bg-red-50/60 border border-red-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-5 py-3 bg-red-100/70 border-b border-red-200">
        <AlertTriangle size={18} className="text-red-600 shrink-0" />
        <div className="flex-1">
          <h3 className="text-sm font-extrabold text-red-900 uppercase tracking-wide">
            Écarts de quantités détectés ({mismatches.length})
          </h3>
          <p className="text-[11px] text-red-700 mt-0.5 leading-snug">
            <ScrollText size={11} className="inline -mt-0.5 mr-1" />
            Conformément à l'article L2152-2 du Code de la Commande Publique, le soumissionnaire ne peut pas modifier les quantités du DQE.
            Cette offre est marquée <strong>irrégulière</strong> automatiquement et peut être régularisée par décision motivée du pouvoir adjudicateur.
          </p>
        </div>
      </div>

      {mismatches.length > 0 && (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-red-50 text-red-900 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left font-bold">Article</th>
                <th className="px-3 py-2 text-right font-bold w-24">Qté DQE</th>
                <th className="px-3 py-2 text-right font-bold w-24">Qté offre</th>
                <th className="px-3 py-2 text-right font-bold w-20">Unité</th>
                <th className="px-3 py-2 text-right font-bold w-24">Écart</th>
              </tr>
            </thead>
            <tbody>
              {mismatches.map((m, i) => (
                <tr key={`${m.itemId}_${i}`} className="border-t border-red-100 hover:bg-red-50/50">
                  <td className="px-4 py-2 text-slate-700">
                    <div className="truncate max-w-md" title={m.designation}>
                      {m.designation || '(sans désignation)'}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600">{fmt(m.moeQty)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums font-bold text-red-700">{fmt(m.offerQty)}</td>
                  <td className="px-3 py-2 text-right text-slate-400">{m.unit || '—'}</td>
                  <td className={`px-3 py-2 text-right font-mono tabular-nums font-bold ${
                    m.delta > 0 ? 'text-orange-600' : 'text-blue-600'
                  }`}>
                    {m.delta > 0 ? '+' : ''}{fmt(m.delta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Panneau Variantes — CCP R2151-8 à R2151-11 ────────────────────────────
function VariantsPanel({ analysisCompany, variantsRegime, variantsRequirements, onAddClick, onRemoveVariant, onToggleRetained }) {
  const variants = analysisCompany?.variants || [];
  const canAdd = variantsRegime !== 'forbidden' && analysisCompany;

  // Si interdites et aucune variante déposée → ne rien afficher (cas le plus courant)
  if (variantsRegime === 'forbidden' && variants.length === 0) return null;

  const regimeStyles = {
    forbidden: { bg: 'bg-red-50/60',    border: 'border-red-200',    head: 'bg-red-100/70 border-red-200',    text: 'text-red-900',    icon: 'text-red-600' },
    allowed:   { bg: 'bg-blue-50/60',   border: 'border-blue-200',   head: 'bg-blue-100/70 border-blue-200',  text: 'text-blue-900',   icon: 'text-blue-600' },
    mandatory: { bg: 'bg-amber-50/60',  border: 'border-amber-200',  head: 'bg-amber-100/70 border-amber-200',text: 'text-amber-900',  icon: 'text-amber-600' },
  };
  const s = regimeStyles[variantsRegime] || regimeStyles.allowed;

  const regimeLabel = {
    forbidden: 'INTERDITES',
    allowed:   'AUTORISÉES',
    mandatory: 'OBLIGATOIRES',
  }[variantsRegime] || 'NON DÉFINI';

  const hasIllegalVariants = variantsRegime === 'forbidden' && variants.length > 0;
  const alertStyles = hasIllegalVariants
    ? { bg: 'bg-red-50/60', border: 'border-red-300', head: 'bg-red-100 border-red-300', text: 'text-red-900', icon: 'text-red-600' }
    : s;

  const fmtEUR = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const fmtDate = (iso) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return ''; }
  };

  return (
    <div className={`${alertStyles.bg} border ${alertStyles.border} rounded-2xl overflow-hidden shadow-sm`}>
      <div className={`flex items-center gap-3 px-5 py-3 ${alertStyles.head} border-b`}>
        <GitBranch size={18} className={`${alertStyles.icon} shrink-0`} />
        <div className="flex-1">
          <h3 className={`text-sm font-extrabold ${alertStyles.text} uppercase tracking-wide flex items-center gap-2 flex-wrap`}>
            Variantes proposées ({variants.length})
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${alertStyles.border} ${alertStyles.bg}`}>
              Régime : {regimeLabel}
            </span>
          </h3>
          <p className={`text-[11px] ${alertStyles.text} mt-0.5 leading-snug opacity-90`}>
            <ScrollText size={11} className="inline -mt-0.5 mr-1" />
            CCP R2151-8 à R2151-11. La variante retenue se substitue à la solution de base dans ses éléments différents.
          </p>
        </div>
        {canAdd && (
          <button
            onClick={onAddClick}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-purple-300 text-purple-700 hover:bg-purple-50 text-xs font-bold shadow-sm transition-all"
            title="Importer une variante depuis un fichier Excel"
          >
            <Plus size={13} />
            Ajouter
          </button>
        )}
      </div>

      <div className="p-5 space-y-3">
        {hasIllegalVariants && (
          <div className="flex items-start gap-2 px-3 py-2 bg-red-100 border border-red-300 rounded-xl text-xs text-red-900">
            <AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5" />
            <div>
              <strong>Variante non autorisée :</strong> les variantes sont interdites pour cette consultation mais l'entreprise en a proposé.
              Offre à classer <strong>irrégulière</strong> (article L2152-2 CCP).
            </div>
          </div>
        )}

        {variantsRequirements && variantsRegime !== 'forbidden' && (
          <div className="px-3 py-2 bg-white/70 border border-slate-200 rounded-xl">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
              Exigences minimales fixées dans la consultation
            </div>
            <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
              {variantsRequirements}
            </div>
          </div>
        )}

        {/* Liste des variantes */}
        {variants.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl bg-white/40">
            <GitBranch size={16} className="text-slate-300" />
            Aucune variante. Cliquez sur <strong>Ajouter</strong> pour importer un fichier Excel de variante.
          </div>
        ) : (
          <ul className="space-y-2">
            {variants.map((v, i) => (
              <VariantCard
                key={v.id || i}
                variant={v}
                index={i + 1}
                fmtEUR={fmtEUR}
                fmtDate={fmtDate}
                onRemove={onRemoveVariant ? () => onRemoveVariant(analysisCompany.id, v.id) : null}
                onToggleRetained={onToggleRetained ? () => onToggleRetained(analysisCompany.id, v.id) : null}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function VariantCard({ variant: v, index, fmtEUR, fmtDate, onRemove, onToggleRetained }) {
  const [expanded, setExpanded] = useState(false);

  // Filtrer les lignes à impact 0 — ne pas polluer le détail
  const newItemsNonZero = (v.newItems || []).filter(it => Number(it.lineTotal || 0) !== 0);
  const removedItemsNonZero = (v.removedItems || []).filter(it => Number(it.lostAmount || 0) !== 0);
  const qtyChangeImpacts = (v.mismatchesVsMoe || [])
    .map(m => {
      const pu = Number(v.offers?.[m.itemId] || 0);
      return { ...m, impact: Math.round((m.delta * pu) * 100) / 100 };
    })
    .filter(m => m.impact !== 0);

  const nbNew = newItemsNonZero.length;
  const nbRemoved = removedItemsNonZero.length;
  const nbQtyChanged = qtyChangeImpacts.length;
  const hasDetails = nbNew > 0 || nbRemoved > 0 || nbQtyChanged > 0;

  return (
    <li className={`bg-white border rounded-xl overflow-hidden transition-all ${
      v.retained
        ? 'border-emerald-400 ring-2 ring-emerald-100 shadow-sm shadow-emerald-100'
        : 'border-slate-200'
    }`}>
      <div className="flex items-start gap-3 px-4 py-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
          v.retained ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'
        }`}>
          V{index}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-900">{v.label || `Variante ${index}`}</span>
            {v.retained && (
              <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500 text-white uppercase shadow-sm">
                <Check size={10} strokeWidth={3} /> Retenue
              </span>
            )}
            {v.total > 0 && (
              <span className="text-xs font-mono font-bold text-purple-700 tabular-nums">
                {fmtEUR(v.total)}
              </span>
            )}
            {nbNew > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 border border-emerald-200">
                +{nbNew} ajouté{nbNew > 1 ? 's' : ''}
              </span>
            )}
            {nbRemoved > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                −{nbRemoved} supprimé{nbRemoved > 1 ? 's' : ''}
              </span>
            )}
            {nbQtyChanged > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 border border-amber-200">
                ± {nbQtyChanged} qté modifiée{nbQtyChanged > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {v.description && (
            <p className="text-xs text-slate-600 mt-1 leading-snug">{v.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 flex-wrap">
            {v.fileName && (
              <span className="flex items-center gap-1">
                <FileSpreadsheet size={11} /> {v.fileName}
              </span>
            )}
            {v.importedAt && (
              <span className="flex items-center gap-1">
                <Calendar size={11} /> {fmtDate(v.importedAt)}
              </span>
            )}
            {v.totalNew > 0 && (
              <span className="text-emerald-600 font-semibold">+ {fmtEUR(v.totalNew)}</span>
            )}
            {v.totalRemoved > 0 && (
              <span className="text-slate-500 font-semibold">− {fmtEUR(v.totalRemoved)}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onToggleRetained && (
            <button
              onClick={onToggleRetained}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                v.retained
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm'
                  : 'text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
              }`}
              title={v.retained ? 'Retirer du récapitulatif RAO' : 'Retenir cette variante pour le récapitulatif'}
            >
              <Check size={11} strokeWidth={3} />
              {v.retained ? 'Retenue' : 'Retenir'}
            </button>
          )}
          {hasDetails && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-all"
              title={expanded ? 'Masquer les détails' : 'Voir le détail des modifications'}
            >
              <ScrollText size={14} />
            </button>
          )}
          {onRemove && (
            <button
              onClick={onRemove}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
              title="Supprimer la variante"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {expanded && hasDetails && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3 space-y-3">

          {/* Articles ajoutés (+) */}
          {nbNew > 0 && (
            <DiffSection
              title="Articles ajoutés"
              icon={<Plus size={11} />}
              tone="emerald"
              items={newItemsNonZero.map(it => ({
                sign: '+',
                label: it.designation,
                meta: `${it.qty} ${it.unit || ''} × ${it.price}`,
                amount: it.lineTotal,
              }))}
              fmtEUR={fmtEUR}
            />
          )}

          {/* Articles supprimés (−) */}
          {nbRemoved > 0 && (
            <DiffSection
              title="Articles supprimés du DQE"
              icon={<Trash2 size={11} />}
              tone="slate"
              items={removedItemsNonZero.map(it => ({
                sign: '−',
                label: it.designation,
                meta: `${it.moeQty} ${it.unit || ''} × ${it.basePrice || 0}`,
                amount: -it.lostAmount,
                strike: true,
              }))}
              fmtEUR={fmtEUR}
            />
          )}

          {/* Quantités modifiées (±) */}
          {nbQtyChanged > 0 && (
            <DiffSection
              title="Quantités modifiées"
              icon={<ScrollText size={11} />}
              tone="amber"
              items={qtyChangeImpacts.map(m => ({
                sign: m.delta > 0 ? '+' : '−',
                label: m.designation,
                meta: `${m.moeQty} → ${m.offerQty} ${m.unit || ''} (Δ ${m.delta > 0 ? '+' : ''}${m.delta})`,
                amount: m.impact,
              }))}
              fmtEUR={fmtEUR}
            />
          )}

        </div>
      )}
    </li>
  );
}

// ─── Section de différence (ajoutés / supprimés / qté modifiée) ────────────
function DiffSection({ title, icon, tone, items, fmtEUR }) {
  const tones = {
    emerald: { title: 'text-emerald-700', sign: 'text-emerald-600 bg-emerald-50 border-emerald-200', amount: 'text-emerald-700' },
    slate:   { title: 'text-slate-600',   sign: 'text-slate-600 bg-slate-100 border-slate-200',     amount: 'text-slate-600' },
    amber:   { title: 'text-amber-700',   sign: 'text-amber-700 bg-amber-50 border-amber-200',     amount: 'text-amber-700' },
  };
  const t = tones[tone] || tones.emerald;

  return (
    <div>
      <div className={`text-[10px] font-black uppercase tracking-wider mb-1.5 flex items-center gap-1.5 ${t.title}`}>
        {icon} {title} ({items.length})
      </div>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-2 px-2 py-1.5 bg-white border border-slate-100 rounded-lg text-[11px]">
            <span className={`shrink-0 w-5 h-5 rounded flex items-center justify-center font-black border ${t.sign}`}>
              {it.sign}
            </span>
            <div className="flex-1 min-w-0">
              <div className={`text-slate-700 truncate ${it.strike ? 'line-through decoration-1 text-slate-500' : ''}`} title={it.label}>
                {it.label}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">{it.meta}</div>
            </div>
            <span className={`shrink-0 font-mono tabular-nums font-bold ${t.amount}`}>
              {it.amount >= 0 ? '+' : '−'} {fmtEUR(Math.abs(it.amount))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
