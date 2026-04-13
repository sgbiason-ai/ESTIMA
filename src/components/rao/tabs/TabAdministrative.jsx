// src/components/rao/tabs/TabAdministrative.jsx
import React, { useState } from 'react';
import { FileText, Target, MessageSquare, Users, Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { Field, Textarea, OuiNonToggle } from '../RaoUI';
import { COMPANY_UI_COLORS, CONCLUSION_OPTIONS } from '../RaoConstants';
import CompanySidebar from '../CompanySidebar';

const ROLES = ['Mandataire', 'Cotraitant'];

// ── Composant pièce éditable ──
const EditablePiece = ({ piece, pieceKey, pieceValue, onToggle, onRename, onRemove }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(piece.label);

  const commitRename = () => {
    if (draft.trim() && draft.trim() !== piece.label) onRename(draft.trim());
    setEditing(false);
  };

  return (
    <div className="group/piece flex items-center justify-between gap-3 py-1.5 border-b border-slate-50 last:border-0">
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
  adminPieces, offerPieces, setAdminPieces, setOfferPieces
}) => {

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

  // ── Handlers pièces offre ──
  const addOfferPiece = () => {
    const id = `custom_offer_${Date.now()}`;
    setOfferPieces([...offerPieces, { id, label: 'Nouvelle pièce d\'offre' }]);
  };
  const removeOfferPiece = (pieceId) => setOfferPieces(offerPieces.filter(p => p.id !== pieceId));
  const renameOfferPiece = (pieceId, newLabel) => setOfferPieces(offerPieces.map(p => p.id === pieceId ? { ...p, label: newLabel } : p));

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
                  <div className="space-y-2">
                    {adminPieces.map(p => {
                      const pieceKey = entity.key === '_self' ? p.id : `${entity.key}_${p.id}`;
                      return (
                        <EditablePiece
                          key={pieceKey}
                          piece={p}
                          pieceKey={pieceKey}
                          pieceValue={pieces[pieceKey]}
                          onToggle={v => updateAdminPiece(name, pieceKey, v)}
                          onRename={newLabel => renameAdminPiece(p.id, newLabel)}
                          onRemove={() => removeAdminPiece(p.id)}
                        />
                      );
                    })}
                  </div>
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
              <div className="space-y-2">
                {offerPieces.map(p => (
                  <EditablePiece
                    key={p.id}
                    piece={p}
                    pieceKey={p.id}
                    pieceValue={pieces[p.id]}
                    onToggle={v => updateAdminPiece(name, p.id, v)}
                    onRename={newLabel => renameOfferPiece(p.id, newLabel)}
                    onRemove={() => removeOfferPiece(p.id)}
                  />
                ))}
              </div>
              <div className="mt-6 pt-5 border-t border-slate-100">
                <Field label="Observations éventuelles" icon={MessageSquare}>
                  <Textarea value={admin.obsOffre || ''} onChange={v => updateAdminField(name, 'obsOffre', v)} placeholder="Notes sur le contenu de l'offre…" rows={2} />
                </Field>
              </div>
            </div>
          </div>

          {/* ── Conclusion ── */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-1">Conclusion de l'analyse</h4>
              <p className="text-xs text-slate-500">Statut officiel de la candidature pour la suite de l'analyse.</p>
            </div>
            <div className="flex flex-wrap gap-2 p-1.5 bg-slate-50 rounded-xl border border-slate-100 shadow-inner">
              {CONCLUSION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => updateAdminField(name, 'conclusion', opt.value)}
                  className={`px-5 py-2.5 rounded-lg text-xs font-black transition-all duration-300 ${
                    concl === opt.value
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
