// src/views/CrcView.jsx
//
// Module Compte Rendu de Reunion — totalement autonome.
// Interface avec ruban style Office en haut.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, ClipboardList, FileDown, Mail, Eye, Edit3, Plus, X, Trash2, Check,
  ChevronDown, ChevronLeft, ChevronRight, FolderOpen, Info, MapPin, Calendar, Clock, Building2,
  Users, ListTree, FileText as FileWord, Copy, ArrowLeftRight, BookUser, Upload, Download, UserPlus,
  GripVertical, HelpCircle, Compass,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import * as XLSX from 'xlsx';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_BRANDING } from '../data/branding';

import { useCrrManager } from '../hooks/useCrrManager';
import CrrHeader from '../components/crr/CrrHeader';
import CrrParticipants from '../components/crr/CrrParticipants';
import CrrObservations from '../components/crr/CrrObservations';
import CrrPreview from '../components/crr/CrrPreview';
import UnifiedParticipantsModal from '../components/crr/UnifiedParticipantsModal';
import CrcHelpPanel from '../components/crr/CrcHelpPanel';
import CrcGuidedTour from '../components/crr/CrcGuidedTour';
import { toast, confirm } from '../utils/globalUI';

// ── SELECTEUR DE CHANTIER (dropdown) ──────────────────────────────────────────

const ChantierDropdown = ({ chantiers, activeId, onSelect, onCreate, onDelete }) => {
  const [open, setOpen] = useState(false);
  const active = chantiers.find((c) => c.id === activeId);
  const nom = active?.crrConfig?.chantierInfo?.nom || 'Selectionner...';

  const handleDelete = async (e, chantier) => {
    e.stopPropagation();
    const ok = await confirm(`Supprimer le chantier "${chantier.crrConfig?.chantierInfo?.nom || 'Sans nom'}" et tous ses comptes rendus ?`, { danger: true });
    if (ok) { onDelete(chantier.id); setOpen(false); }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-400 text-sm transition-all min-w-[180px] max-w-[260px] shadow-sm"
      >
        <FolderOpen size={14} className="text-emerald-600 shrink-0" />
        <span className="text-slate-700 font-medium truncate flex-1 text-left">{nom}</span>
        <ChevronDown size={12} className="text-slate-400 shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-72 overflow-y-auto">
            <button
              onClick={() => { onCreate(); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50 transition-colors border-b border-slate-100 flex items-center gap-2 font-medium"
            >
              <Plus size={14} /> Nouveau chantier
            </button>
            {chantiers.length === 0 && (
              <div className="px-4 py-3 text-xs text-slate-400">Aucun chantier.</div>
            )}
            {chantiers.map((c) => {
              const cnom = c.crrConfig?.chantierInfo?.nom || 'Sans nom';
              const lieu = c.crrConfig?.chantierInfo?.lieu || '';
              return (
                <button
                  key={c.id}
                  onClick={() => { onSelect(c); setOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 group flex items-center justify-between ${
                    c.id === activeId ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{cnom}</div>
                    {lieu && <div className="text-[10px] text-slate-400 truncate">{lieu}</div>}
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, c)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-all shrink-0 ml-2"
                  >
                    <Trash2 size={12} />
                  </button>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

// ── BOUTON DU RUBAN ──────────────────────────────────────────────────────────

const RibbonButton = ({ icon: Icon, label, onClick, disabled, variant = 'default', active, title }) => {
  const base = 'flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all text-center min-w-[56px]';
  const variants = {
    default: `${base} ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-100 text-slate-600 hover:text-slate-800'}`,
    primary: `${base} ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800'}`,
    accent: `${base} ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-blue-50 text-blue-600 hover:text-blue-700'}`,
    active: `${base} bg-emerald-100 text-emerald-800 shadow-inner`,
  };

  return (
    <button onClick={onClick} disabled={disabled} title={title || label} className={active ? variants.active : variants[variant]}>
      <Icon size={18} />
      <span className="text-[9px] font-semibold leading-tight whitespace-nowrap">{label}</span>
    </button>
  );
};

// ── SEPARATEUR DE SECTION RUBAN ──────────────────────────────────────────────

const RibbonDivider = () => (
  <div className="w-px bg-slate-200 mx-1.5 self-stretch my-1" />
);

const RibbonGroup = ({ label, children, dataTour }) => (
  <div className="flex flex-col items-center" data-tour={dataTour}>
    <div className="flex items-center gap-0.5 flex-1">
      {children}
    </div>
    <span className="text-[8px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">{label}</span>
  </div>
);

// ── MODAL CATEGORIES ────────────────────────────────────────────────────────

const CategoriesModal = ({ isOpen, onClose, categories, addCategory, renameCategory, deleteCategory, reorderCategories }) => {
  const [newCat, setNewCat] = useState('');
  const [editingCat, setEditingCat] = useState(null);
  const [editValue, setEditValue] = useState('');

  if (!isOpen) return null;

  const handleAdd = () => {
    if (newCat.trim()) { addCategory(newCat.trim()); setNewCat(''); }
  };

  const startEdit = (cat) => { setEditingCat(cat); setEditValue(cat); };

  const confirmEdit = () => {
    if (editValue.trim() && editValue !== editingCat) renameCategory(editingCat, editValue.trim());
    setEditingCat(null);
  };

  const handleDelete = async (cat) => {
    const ok = await confirm(`Supprimer la categorie "${cat}" ?`, { danger: true });
    if (ok) deleteCategory(cat);
  };

  const handleDragEnd = (result) => {
    if (!result.destination || result.source.index === result.destination.index) return;
    const reordered = [...categories];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    reorderCategories(reordered);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[420px] max-h-[80vh] overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-800">Gestion des categories</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
        </div>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="categories-list">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="p-5 space-y-2 overflow-y-auto max-h-[50vh]">
                {categories.map((cat, index) => (
                  <Draggable key={cat} draggableId={cat} index={index} isDragDisabled={editingCat === cat}>
                    {(prov, snapshot) => (
                      <div ref={prov.innerRef} {...prov.draggableProps}
                        className={`flex items-center gap-2 group rounded-lg transition-shadow ${snapshot.isDragging ? 'shadow-lg bg-white ring-2 ring-emerald-300' : ''}`}>
                        {editingCat === cat ? (
                          <>
                            <div className="w-6" />
                            <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                              className="flex-1 text-sm px-3 py-2 border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 text-slate-800"
                              autoFocus onKeyDown={(e) => e.key === 'Enter' && confirmEdit()} />
                            <button onClick={confirmEdit} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Check size={14} /></button>
                          </>
                        ) : (
                          <>
                            <div {...prov.dragHandleProps} className="p-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing">
                              <GripVertical size={14} />
                            </div>
                            <span className="flex-1 text-sm text-slate-700 px-3 py-2 bg-slate-50 rounded-lg">{cat}</span>
                            <button onClick={() => startEdit(cat)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Edit3 size={12} /></button>
                            <button onClick={() => handleDelete(cat)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={12} /></button>
                          </>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
        <div className="px-5 py-3 border-t border-slate-200 flex gap-2">
          <input type="text" value={newCat} onChange={(e) => setNewCat(e.target.value)}
            placeholder="Nouvelle categorie..." className="flex-1 text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 text-slate-800"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
          <button onClick={handleAdd} disabled={!newCat.trim()}
            className="flex items-center gap-1 px-3 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 disabled:opacity-40 transition-all">
            <Plus size={14} /> Ajouter
          </button>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between rounded-b-2xl">
          <p className="text-[10px] text-slate-400 italic">Glissez-deposez pour reordonner</p>
          <button onClick={onClose}
            className="px-5 py-2 bg-emerald-500 text-white text-sm font-medium rounded-xl hover:bg-emerald-600 transition-all shadow-sm">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

// ── MODAL PARTICIPANTS ──────────────────────────────────────────────────────

const ParticipantsModal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[900px] max-h-[85vh] overflow-hidden flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <h3 className="text-sm font-bold text-slate-800">Gestion des participants</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between rounded-b-2xl shrink-0">
          <p className="text-[10px] text-slate-400 italic">Les modifications sont sauvegardees automatiquement</p>
          <button onClick={onClose}
            className="px-5 py-2 bg-emerald-500 text-white text-sm font-medium rounded-xl hover:bg-emerald-600 transition-all shadow-sm">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

// ── MODAL INFO CHANTIER ─────────────────────────────────────────────────────

const ChantierField = ({ label, icon: Icon, field, type = 'text', placeholder, chantierInfo, updateChantierInfo }) => (
  <div>
    <label className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mb-1.5">
      {Icon && <Icon size={11} />}
      {label}
    </label>
    <input
      type={type}
      value={chantierInfo[field] || ''}
      onChange={(e) => updateChantierInfo({ [field]: e.target.value })}
      placeholder={placeholder}
      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all text-slate-800"
    />
  </div>
);

const InfoChantierModal = ({ isOpen, onClose, chantierInfo, updateChantierInfo }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[520px] overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-teal-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100">
              <Building2 size={18} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Fiche Info Chantier</h3>
              <p className="text-[10px] text-slate-500">Informations generales du chantier</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-all">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <ChantierField label="Nom du chantier" icon={Building2} field="nom" placeholder="Ex: AMENAGEMENT TRAVERSE ST ALBY" chantierInfo={chantierInfo} updateChantierInfo={updateChantierInfo} />
          <ChantierField label="Lieu" icon={MapPin} field="lieu" placeholder="Ex: Commune d'Aiguefonde (81)" chantierInfo={chantierInfo} updateChantierInfo={updateChantierInfo} />
          <div className="grid grid-cols-2 gap-4">
            <ChantierField label="Duree de preparation" icon={Clock} field="dureePreparation" placeholder="Ex: 1 mois" chantierInfo={chantierInfo} updateChantierInfo={updateChantierInfo} />
            <ChantierField label="Duree du chantier" icon={Clock} field="dureeChantier" placeholder="Ex: 8 mois" chantierInfo={chantierInfo} updateChantierInfo={updateChantierInfo} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ChantierField label="Date de debut" icon={Calendar} field="dateDebut" type="date" chantierInfo={chantierInfo} updateChantierInfo={updateChantierInfo} />
            <ChantierField label="Date de fin" icon={Calendar} field="dateFin" type="date" chantierInfo={chantierInfo} updateChantierInfo={updateChantierInfo} />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-emerald-500 text-white text-sm font-medium rounded-xl hover:bg-emerald-600 transition-all shadow-sm">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

// ── ONGLETS REUNIONS ────────────────────────────────────────────────────────

const MeetingTabs = ({ meetings, activeMeetingId, setActiveMeetingId, saveStatus }) => {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll);
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect(); };
  }, [meetings, checkScroll]);

  // Scroll vers l'onglet actif quand il change
  useEffect(() => {
    if (!activeMeetingId || !scrollRef.current) return;
    const tab = scrollRef.current.querySelector(`[data-mid="${activeMeetingId}"]`);
    tab?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [activeMeetingId]);

  const scroll = (dir) => scrollRef.current?.scrollBy({ left: dir * 200, behavior: 'smooth' });

  const fmtDate = (d) => { if (!d) return ''; const [, m, dd] = d.split('-'); return `${dd}/${m}`; };

  const si = {
    saved:   { dot: 'bg-emerald-500',                  label: 'Sauvegarde' },
    saving:  { dot: 'bg-blue-500 animate-pulse',       label: 'Sauvegarde...' },
    waiting: { dot: 'bg-amber-500',                    label: 'Modifie' },
    error:   { dot: 'bg-red-500',                      label: 'Erreur' },
  }[saveStatus] || { dot: 'bg-emerald-500', label: 'Sauvegarde' };

  return (
    <div className="flex items-center bg-slate-100 border-b border-slate-200 shrink-0 min-h-[34px]">
      {canScrollLeft && (
        <button onClick={() => scroll(-1)} className="px-1 py-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors shrink-0">
          <ChevronLeft size={14} />
        </button>
      )}

      <div
        ref={scrollRef}
        className="flex items-end flex-1 gap-px px-1 pt-1 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {meetings.length === 0 && (
          <span className="text-xs text-slate-400 italic px-3 py-1.5">Aucun compte rendu — cliquez Nouveau CR</span>
        )}
        {meetings.map((m) => {
          const active = m.id === activeMeetingId;
          return (
            <button
              key={m.id}
              data-mid={m.id}
              onClick={() => setActiveMeetingId(m.id)}
              className={`shrink-0 px-3 py-1.5 text-[11px] font-medium transition-all whitespace-nowrap rounded-t-lg ${
                active
                  ? 'bg-[#f8fafc] text-emerald-700 border-t-2 border-x border-t-emerald-500 border-x-slate-200 -mb-px z-10'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
              }`}
            >
              CR {String(m.number).padStart(2, '0')}{m.date ? ` - ${fmtDate(m.date)}` : ''}
            </button>
          );
        })}
      </div>

      {canScrollRight && (
        <button onClick={() => scroll(1)} className="px-1 py-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors shrink-0">
          <ChevronRight size={14} />
        </button>
      )}

      <div className="flex items-center gap-1.5 px-3 shrink-0 border-l border-slate-200 ml-1">
        <div className={`w-1.5 h-1.5 rounded-full ${si.dot}`} />
        <span className="text-[10px] text-slate-500">{si.label}</span>
      </div>
    </div>
  );
};

// ── MODAL DUPLICATION ──────────────────────────────────────────────────────

const DuplicateMeetingModal = ({ isOpen, onClose, onConfirm, defaultDate }) => {
  const [date, setDate] = useState(defaultDate || '');

  useEffect(() => { if (isOpen) setDate(defaultDate || ''); }, [isOpen, defaultDate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[400px] overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-teal-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100">
              <Copy size={18} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Dupliquer le compte rendu</h3>
              <p className="text-[10px] text-slate-500">Observations, presences et diffusion seront reportees</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <label className="block text-xs font-medium text-slate-600 mb-2">Date de la nouvelle reunion</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all text-slate-800"
            autoFocus
          />
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
            Annuler
          </button>
          <button
            onClick={() => { onConfirm(date); onClose(); }}
            disabled={!date}
            className="px-5 py-2 bg-emerald-500 text-white text-sm font-medium rounded-xl hover:bg-emerald-600 disabled:opacity-40 transition-all shadow-sm"
          >
            Dupliquer
          </button>
        </div>
      </div>
    </div>
  );
};

// ── MODAL BIBLIOTHEQUE PARTICIPANTS ─────────────────────────────────────────

const LibraryModal = ({ isOpen, onClose, contacts, onSave, onImportToChantier, hasChantier, participantGroups }) => {
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [filter, setFilter] = useState('');
  const [sortCol, setSortCol] = useState(null); // 'subLabel' | 'name'
  const [sortDir, setSortDir] = useState('asc');  // 'asc' | 'desc'
  const [showHelp, setShowHelp] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [groupMapping, setGroupMapping] = useState({});
  const fileRef = useRef(null);

  if (!isOpen) return null;

  const toggleSort = (col) => {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const filtered = (() => {
    let list = filter
      ? contacts.filter((c) =>
          [c.subLabel, c.name, c.email, c.phone].join(' ').toLowerCase().includes(filter.toLowerCase())
        )
      : [...contacts];
    if (sortCol) {
      list.sort((a, b) => {
        const va = (a[sortCol] || '').toLowerCase();
        const vb = (b[sortCol] || '').toLowerCase();
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    return list;
  })();

  const toggleSelect = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  const openImportPanel = () => {
    const selectedContacts = contacts.filter((c) => selected.has(c.id));
    if (selectedContacts.length === 0) return;
    // Pre-remplir le mapping : essayer de matcher subLabel avec un groupe existant
    const mapping = {};
    for (const c of selectedContacts) {
      const match = (participantGroups || []).find(
        (g) => (g.subLabel && g.subLabel === c.subLabel) || g.name === c.subLabel
      );
      mapping[c.id] = match?.id || (participantGroups?.[0]?.id || '');
    }
    setGroupMapping(mapping);
    setShowImportPanel(true);
  };

  const confirmImport = () => {
    const items = contacts
      .filter((c) => selected.has(c.id) && groupMapping[c.id])
      .map((c) => ({ contact: c, targetGroupId: groupMapping[c.id] }));
    if (items.length > 0) onImportToChantier(items);
    setShowImportPanel(false);
    setSelected(new Set());
  };

  const handleAdd = () => {
    const newContact = {
      id: `lib_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      subLabel: '', name: '', email: '', phone: '',
    };
    onSave([...contacts, newContact]);
    setEditingId(newContact.id);
    setEditData(newContact);
  };

  const handleSaveEdit = () => {
    onSave(contacts.map((c) => (c.id === editingId ? { ...c, ...editData } : c)));
    setEditingId(null);
  };

  const handleDelete = (id) => {
    onSave(contacts.filter((c) => c.id !== id));
  };

  // Cherche une valeur dans un objet row par nom de colonne (insensible a la casse/accents)
  const findCol = (row, ...candidates) => {
    const keys = Object.keys(row);
    for (const cand of candidates) {
      const norm = cand.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const found = keys.find((k) =>
        k.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === norm
      );
      if (found && row[found] !== undefined && row[found] !== null) return String(row[found]);
    }
    return '';
  };

  const handleExcelImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      toast.error('Format non supporte. Utilisez un fichier .xlsx, .xls ou .csv');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      toast.error('Impossible de lire le fichier. Verifiez qu\'il n\'est pas corrompu.');
      e.target.value = '';
    };
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        if (!wb.SheetNames.length) {
          toast.error('Le fichier Excel ne contient aucune feuille.');
          return;
        }
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          toast.warning('Le fichier est vide ou ne contient aucune ligne de donnees.');
          return;
        }

        const firstRowKeys = Object.keys(data[0]);
        if (firstRowKeys.length < 2) {
          toast.error('Le fichier doit contenir au moins 2 colonnes (Sous-label, NOM Prenom).');
          return;
        }

        const usePositional = firstRowKeys.every(
          (k) => k.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
            .search(/sous|label|nom|prenom|mail|email|tel|phone/) === -1
        );

        if (usePositional) {
          toast.info(`En-tetes non reconnus — import par position des colonnes (${firstRowKeys.length} colonnes detectees).`);
        }

        const imported = data
          .map((row, i) => {
            if (usePositional) {
              const vals = firstRowKeys.map((k) => String(row[k] || ''));
              return {
                id: `lib_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
                subLabel: vals[0] || '',
                name: vals[1] || '',
                phone: vals[2] || '',
                email: vals[3] || '',
              };
            }
            return {
              id: `lib_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
              subLabel: findCol(row, 'Sous-label', 'Sous label', 'SubLabel', 'Label'),
              name: findCol(row, 'NOM Prenom', 'NOM Prénom', 'Nom Prenom', 'Nom Prénom', 'Nom', 'Name', 'Contact'),
              phone: findCol(row, 'Telephone', 'Téléphone', 'Tel', 'Phone'),
              email: findCol(row, 'Email', 'Mail', 'E-mail'),
            };
          })
          .filter((c) => c.name || c.email);

        const skipped = data.length - imported.length;

        if (imported.length === 0) {
          toast.warning(`Aucun contact valide trouve dans les ${data.length} ligne(s). Chaque ligne doit avoir au moins un nom ou un email.`);
          return;
        }

        // Dedup : retirer les contacts deja presents dans la bibliotheque
        const norm = (s) => (s || '').trim().toLowerCase();
        const existingEmails = new Set(contacts.filter((c) => c.email).map((c) => norm(c.email)));
        const existingNames = new Set(contacts.filter((c) => c.name && !c.email).map((c) => norm(c.name)));

        const seenEmails = new Set();
        const seenNames = new Set();
        const uniqueImported = imported.filter((c) => {
          // Doublon avec la bibliotheque existante ?
          if (c.email && existingEmails.has(norm(c.email))) return false;
          if (!c.email && c.name && existingNames.has(norm(c.name))) return false;
          // Doublon au sein de l'import lui-meme ?
          if (c.email) {
            const e = norm(c.email);
            if (seenEmails.has(e)) return false;
            seenEmails.add(e);
          } else if (c.name) {
            const n = norm(c.name);
            if (seenNames.has(n)) return false;
            seenNames.add(n);
          }
          return true;
        });

        const duplicateCount = imported.length - uniqueImported.length;
        onSave([...contacts, ...uniqueImported]);
        const parts = [];
        if (uniqueImported.length > 0) parts.push(`${uniqueImported.length} contact(s) importe(s)`);
        if (duplicateCount > 0) parts.push(`${duplicateCount} doublon(s) ignore(s)`);
        if (skipped > 0) parts.push(`${skipped} ligne(s) sans nom ni email`);
        toast.success(parts.join('. ') + '.');
      } catch (err) {
        console.error('Erreur import Excel:', err);
        toast.error(`Erreur lors de la lecture du fichier : ${err.message || 'format invalide'}`);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleRemoveDuplicates = () => {
    const norm = (s) => (s || '').trim().toLowerCase();
    const seenEmails = new Set();
    const seenNames = new Set();
    const unique = [];
    for (const c of contacts) {
      if (c.email) {
        const e = norm(c.email);
        if (seenEmails.has(e)) continue;
        seenEmails.add(e);
      } else if (c.name) {
        const n = norm(c.name);
        if (seenNames.has(n)) continue;
        seenNames.add(n);
      }
      unique.push(c);
    }
    const removed = contacts.length - unique.length;
    if (removed === 0) {
      toast.info('Aucun doublon detecte.');
      return;
    }
    onSave(unique);
    toast.success(`${removed} doublon(s) supprime(s).`);
  };

  const handleExcelExport = () => {
    const data = contacts.map((c) => ({
      'Sous-label': c.subLabel || '',
      'NOM Prenom': c.name || '',
      'Telephone': c.phone || '',
      'Email': c.email || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    // Largeurs colonnes
    ws['!cols'] = [{ wch: 25 }, { wch: 25 }, { wch: 16 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Participants');
    XLSX.writeFile(wb, 'bibliotheque_participants.xlsx');
    toast.success(`${contacts.length} contact(s) exporte(s) dans bibliotheque_participants.xlsx`);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[900px] max-h-[85vh] overflow-hidden flex flex-col" onMouseDown={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-violet-50 to-purple-50 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-100">
                <BookUser size={18} className="text-violet-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Bibliotheque de participants</h3>
                <p className="text-[10px] text-slate-500">{contacts.length} contact{contacts.length > 1 ? 's' : ''} enregistre{contacts.length > 1 ? 's' : ''}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
          </div>
        </div>

        {/* Ruban Office-style */}
        <div className="flex items-end gap-1 px-4 py-2 border-b border-slate-200 bg-gradient-to-b from-white to-slate-50 shrink-0">
          {/* Recherche */}
          <div className="flex flex-col items-center mr-1">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Rechercher..."
              className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 w-40 text-slate-800"
            />
            {sortCol && (
              <button onClick={() => { setSortCol(null); setSortDir('asc'); }}
                className="text-[9px] text-slate-400 hover:text-red-500 mt-0.5 transition-colors">
                Reinitialiser tri
              </button>
            )}
          </div>

          <div className="w-px bg-slate-200 self-stretch my-1 mx-1" />

          {/* Groupe : Contacts */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-0.5">
              <button onClick={handleAdd}
                className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-violet-50 text-violet-600 hover:text-violet-700 transition-all min-w-[56px]">
                <Plus size={20} />
                <span className="text-[9px] font-semibold leading-tight whitespace-nowrap">Ajouter</span>
              </button>
              <button onClick={handleRemoveDuplicates} disabled={contacts.length < 2}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all min-w-[56px] ${
                  contacts.length < 2 ? 'opacity-40 cursor-not-allowed text-red-400' : 'hover:bg-red-50 text-red-500 hover:text-red-600'
                }`}>
                <Copy size={20} />
                <span className="text-[9px] font-semibold leading-tight whitespace-nowrap">Doublons</span>
              </button>
            </div>
            <span className="text-[8px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">Contacts</span>
          </div>

          <div className="w-px bg-slate-200 self-stretch my-1 mx-1" />

          {/* Groupe : Excel */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-0.5">
              <button onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 transition-all min-w-[56px]">
                <Upload size={20} />
                <span className="text-[9px] font-semibold leading-tight whitespace-nowrap">Import</span>
              </button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelImport} />
              <button onClick={handleExcelExport} disabled={contacts.length === 0}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all min-w-[56px] ${
                  contacts.length === 0 ? 'opacity-40 cursor-not-allowed text-blue-400' : 'hover:bg-blue-50 text-blue-600 hover:text-blue-700'
                }`}>
                <Download size={20} />
                <span className="text-[9px] font-semibold leading-tight whitespace-nowrap">Export</span>
              </button>
              <button onClick={() => setShowHelp(!showHelp)}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all min-w-[56px] ${
                  showHelp ? 'bg-slate-200 text-slate-700 shadow-inner' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'
                }`}>
                <Info size={20} />
                <span className="text-[9px] font-semibold leading-tight whitespace-nowrap">Aide</span>
              </button>
            </div>
            <span className="text-[8px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">Excel</span>
          </div>

          {hasChantier && (
            <>
              <div className="w-px bg-slate-200 self-stretch my-1 mx-1" />

              {/* Groupe : Chantier */}
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-0.5">
                  <button onClick={openImportPanel} disabled={selected.size === 0}
                    className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all min-w-[56px] ${
                      selected.size === 0 ? 'opacity-40 cursor-not-allowed text-amber-400' : 'hover:bg-amber-50 text-amber-600 hover:text-amber-700'
                    }`}>
                    <UserPlus size={20} />
                    <span className="text-[9px] font-semibold leading-tight whitespace-nowrap">
                      Importer{selected.size > 0 ? ` (${selected.size})` : ''}
                    </span>
                  </button>
                </div>
                <span className="text-[8px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">Chantier</span>
              </div>
            </>
          )}
        </div>

        {/* Aide import */}
        {showHelp && (
          <div className="px-5 py-3 border-b border-slate-200 bg-amber-50 shrink-0">
            <div className="flex items-start gap-3">
              <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-[11px] text-slate-700 space-y-1.5">
                <p className="font-bold text-slate-800">Format attendu du fichier Excel :</p>
                <div className="overflow-x-auto">
                  <table className="text-[10px] border border-slate-300 rounded">
                    <thead>
                      <tr className="bg-slate-200 text-slate-600">
                        <th className="px-3 py-1 border-r border-slate-300 text-left font-bold">Sous-label</th>
                        <th className="px-3 py-1 border-r border-slate-300 text-left font-bold">NOM Prenom</th>
                        <th className="px-3 py-1 border-r border-slate-300 text-left font-bold">Telephone</th>
                        <th className="px-3 py-1 text-left font-bold">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="text-slate-500">
                        <td className="px-3 py-1 border-r border-t border-slate-200">MOE</td>
                        <td className="px-3 py-1 border-r border-t border-slate-200">DUPONT Jean</td>
                        <td className="px-3 py-1 border-r border-t border-slate-200">06 12 34 56 78</td>
                        <td className="px-3 py-1 border-t border-slate-200">j.dupont@mail.fr</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                  <li>Formats acceptes : <span className="font-semibold">.xlsx</span>, <span className="font-semibold">.xls</span>, <span className="font-semibold">.csv</span></li>
                  <li>La 1ere ligne doit contenir les en-tetes (noms ci-dessus, accents facultatifs)</li>
                  <li>Si les en-tetes ne sont pas reconnus, les colonnes seront mappees par position (col 1 = Sous-label, col 2 = Nom, col 3 = Tel, col 4 = Email)</li>
                  <li>Les lignes sans nom ni email sont ignorees</li>
                  <li>Le <span className="font-semibold">Sous-label</span> sert a grouper les participants (ex: MOE, MOA, Entreprise...)</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Panneau d'import avec mapping de groupes */}
        {showImportPanel && (
          <div className="border-b border-amber-200 bg-amber-50 shrink-0">
            <div className="px-5 py-3 flex items-center justify-between border-b border-amber-200">
              <div className="flex items-center gap-2">
                <UserPlus size={14} className="text-amber-600" />
                <span className="text-xs font-bold text-amber-800">Affecter les {selected.size} contact(s) aux groupes du chantier</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowImportPanel(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                  Annuler
                </button>
                <button onClick={confirmImport}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all">
                  <Check size={12} /> Confirmer l'import
                </button>
              </div>
            </div>
            <div className="px-5 py-3 max-h-[200px] overflow-y-auto space-y-1.5">
              {contacts.filter((c) => selected.has(c.id)).map((c) => (
                <div key={c.id} className="flex items-center gap-3 text-xs">
                  <span className="w-32 truncate font-medium text-slate-700">{c.name || c.email}</span>
                  <span className="text-slate-400">→</span>
                  <select
                    value={groupMapping[c.id] || ''}
                    onChange={(e) => setGroupMapping({ ...groupMapping, [c.id]: e.target.value })}
                    className="flex-1 max-w-[250px] px-2 py-1 border border-amber-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 text-slate-800"
                  >
                    <option value="" disabled>Choisir un groupe...</option>
                    {(participantGroups || []).map((g) => (
                      <option key={g.id} value={g.id}>{g.name}{g.subLabel ? ` (${g.subLabel})` : ''}</option>
                    ))}
                  </select>
                  {c.subLabel && <span className="text-[10px] text-slate-400 italic">{c.subLabel}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-100 z-10">
              <tr className="text-[10px] text-slate-500 uppercase tracking-wider">
                {hasChantier && (
                  <th className="px-2 py-2 w-8">
                    <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-amber-500 focus:ring-amber-400 cursor-pointer" />
                  </th>
                )}
                <th className="text-left px-3 py-2 font-semibold cursor-pointer select-none hover:text-violet-600 transition-colors" onClick={() => toggleSort('subLabel')}>
                  Sous-label {sortCol === 'subLabel' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="text-left px-3 py-2 font-semibold cursor-pointer select-none hover:text-violet-600 transition-colors" onClick={() => toggleSort('name')}>
                  NOM Prenom {sortCol === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="text-left px-3 py-2 font-semibold">Telephone</th>
                <th className="text-left px-3 py-2 font-semibold">Email</th>
                <th className="px-2 py-2 w-16" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={hasChantier ? 6 : 5} className="text-center py-8 text-slate-400 italic">
                  {filter ? 'Aucun resultat' : 'Bibliotheque vide — ajoutez ou importez des contacts'}
                </td></tr>
              )}
              {filtered.map((c) => {
                const isEditing = editingId === c.id;
                const isSelected = selected.has(c.id);
                return (
                  <tr key={c.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors group ${isSelected ? 'bg-amber-50/50' : ''}`}>
                    {hasChantier && (
                      <td className="px-2 py-2 text-center">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(c.id)}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-amber-500 focus:ring-amber-400 cursor-pointer" />
                      </td>
                    )}
                    {isEditing ? (
                      <>
                        {['subLabel', 'name', 'phone', 'email'].map((f) => (
                          <td key={f} className="px-2 py-1.5">
                            <input
                              type="text"
                              value={editData[f] || ''}
                              onChange={(e) => setEditData({ ...editData, [f]: e.target.value })}
                              className="w-full text-xs px-2 py-1 border border-violet-300 rounded focus:outline-none focus:ring-1 focus:ring-violet-400 text-slate-800"
                              placeholder={f === 'phone' ? '06 00 00 00 00' : f === 'name' ? 'DUPONT Jean' : ''}
                              autoFocus={f === 'name'}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                            />
                          </td>
                        ))}
                        <td className="px-2 py-1.5 text-center">
                          <button onClick={handleSaveEdit} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check size={12} /></button>
                          <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><X size={12} /></button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 text-slate-600 font-medium">{c.subLabel}</td>
                        <td className="px-3 py-2 font-semibold text-slate-800">{c.name}</td>
                        <td className="px-3 py-2 text-slate-500">{c.phone}</td>
                        <td className="px-3 py-2 text-blue-600">{c.email}</td>
                        <td className="px-2 py-2 text-center">
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-all">
                            <button onClick={() => { setEditingId(c.id); setEditData(c); }}
                              className="p-1 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded"><Edit3 size={11} /></button>
                            <button onClick={() => handleDelete(c.id)}
                              className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 size={11} /></button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <p className="text-[10px] text-slate-400 italic">Les modifications sont sauvegardees automatiquement</p>
          <button onClick={onClose}
            className="px-5 py-2 bg-violet-500 text-white text-sm font-medium rounded-xl hover:bg-violet-600 transition-all shadow-sm">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

// ── MODAL AUDIT (DIFF ENTRE 2 CR) ──────────────────────────────────────────

const statusLabel = (s) => s === 'done' ? 'FAIT' : s === 'in_progress' ? 'En cours' : 'Ouvert';
const statusColor = (s) => s === 'done' ? 'text-emerald-700 bg-emerald-50' : s === 'in_progress' ? 'text-blue-700 bg-blue-50' : 'text-amber-700 bg-amber-50';

const presenceLabel = (s) => s === 'present' ? 'Present' : s === 'excused' ? 'Excuse' : 'Absent';
const presenceColor = (s) => s === 'present' ? 'text-emerald-700 bg-emerald-50' : s === 'excused' ? 'text-amber-700 bg-amber-50' : 'text-slate-500 bg-slate-50';

const AuditModal = ({ isOpen, onClose, currentMeeting, previousMeeting, participantGroups }) => {
  if (!isOpen || !currentMeeting || !previousMeeting) return null;

  // ── AUDIT PRESENCES ──────────────────────────────────────────────────
  const prevAtt = previousMeeting.attendance || {};
  const currAtt = currentMeeting.attendance || {};

  // Liste flat de tous les contacts avec leur nom
  const allContacts = [];
  for (const group of (participantGroups || [])) {
    for (const contact of group.contacts) {
      allContacts.push({ id: contact.id, name: contact.name || '(sans nom)', group: group.name });
    }
  }

  const attendanceChanges = [];
  for (const contact of allContacts) {
    const prev = prevAtt[contact.id] || 'absent';
    const curr = currAtt[contact.id] || 'absent';
    if (prev !== curr) {
      attendanceChanges.push({ contact, from: prev, to: curr });
    }
  }

  // ── AUDIT OBSERVATIONS ───────────────────────────────────────────────
  const prevObs = previousMeeting.observations || [];
  const currObs = currentMeeting.observations || [];

  // Matcher les observations entre les deux CR
  const matched = new Set(); // IDs du CR precedent deja matches
  const newObs = [];
  const changedObs = [];
  const unchangedCount = { value: 0 };

  for (const obs of currObs) {
    // Chercher le match dans le CR precedent
    let prev = null;

    // 1. Match par originObsId (fiable, pour les duplications recentes)
    if (obs.originObsId) {
      prev = prevObs.find((p) => p.id === obs.originObsId && !matched.has(p.id));
    }

    // 2. Fallback : match par categorie + texte (pour les anciennes donnees)
    if (!prev) {
      prev = prevObs.find(
        (p) => p.category === obs.category && p.text === obs.text && !matched.has(p.id)
      );
    }

    if (prev) {
      matched.add(prev.id);
      const changes = [];
      if (prev.status !== obs.status)
        changes.push({ field: 'Statut', from: statusLabel(prev.status), to: statusLabel(obs.status) });
      if ((prev.text || '') !== (obs.text || ''))
        changes.push({ field: 'Texte', from: prev.text, to: obs.text });
      if ((prev.actionBy || '') !== (obs.actionBy || ''))
        changes.push({ field: 'Responsable', from: prev.actionBy, to: obs.actionBy });
      if ((prev.actionDeadline || '') !== (obs.actionDeadline || ''))
        changes.push({ field: 'Echeance', from: prev.actionDeadline, to: obs.actionDeadline });

      if (changes.length > 0) changedObs.push({ obs, prev, changes });
      else unchangedCount.value++;
    } else {
      newObs.push(obs);
    }
  }

  const deletedObs = prevObs.filter((p) => !matched.has(p.id));

  const totalChanges = attendanceChanges.length + newObs.length + changedObs.length + deletedObs.length;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[640px] max-h-[85vh] overflow-hidden flex flex-col" onMouseDown={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <ArrowLeftRight size={18} className="text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Audit CR n{previousMeeting.number} → CR n{currentMeeting.number}
              </h3>
              <p className="text-[10px] text-slate-500">
                {totalChanges} changement{totalChanges > 1 ? 's' : ''} detecte{totalChanges > 1 ? 's' : ''}
                {unchangedCount.value > 0 && ` · ${unchangedCount.value} inchange${unchangedCount.value > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {totalChanges === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">Aucune difference detectee entre les deux comptes rendus.</div>
          )}

          {/* Changements de presence */}
          {attendanceChanges.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span className="text-xs font-bold text-purple-700 uppercase">Presences modifiees ({attendanceChanges.length})</span>
              </div>
              <div className="space-y-1.5">
                {attendanceChanges.map(({ contact, from, to }) => (
                  <div key={contact.id} className="flex items-center gap-2 px-3 py-2 bg-purple-50 rounded-lg border border-purple-100">
                    <span className="text-[10px] font-bold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded shrink-0">{contact.group}</span>
                    <span className="text-xs font-medium text-slate-700">{contact.name}</span>
                    <span className="ml-auto flex items-center gap-1.5 text-[10px]">
                      <span className={`font-bold px-1.5 py-0.5 rounded ${presenceColor(from)}`}>{presenceLabel(from)}</span>
                      <span className="text-slate-400">→</span>
                      <span className={`font-bold px-1.5 py-0.5 rounded ${presenceColor(to)}`}>{presenceLabel(to)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nouvelles observations */}
          {newObs.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold text-emerald-700 uppercase">Nouvelles observations ({newObs.length})</span>
              </div>
              <div className="space-y-1.5">
                {newObs.map((obs) => (
                  <div key={obs.id} className="flex items-start gap-2 px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-100">
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0">{obs.category}</span>
                    <span className="text-xs text-slate-700 line-clamp-2">{obs.text || '(vide)'}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ml-auto ${statusColor(obs.status)}`}>{statusLabel(obs.status)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observations modifiees */}
          {changedObs.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-xs font-bold text-blue-700 uppercase">Observations modifiees ({changedObs.length})</span>
              </div>
              <div className="space-y-1.5">
                {changedObs.map(({ obs, changes }) => (
                  <div key={obs.id} className="px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="flex items-start gap-2 mb-1">
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded shrink-0">{obs.category}</span>
                      <span className="text-xs text-slate-700 line-clamp-1">{obs.text || '(vide)'}</span>
                    </div>
                    <div className="space-y-0.5 ml-2">
                      {changes.map((c, i) => (
                        <div key={i} className="text-[10px] text-slate-600">
                          <span className="font-medium text-slate-500">{c.field} :</span>{' '}
                          <span className="line-through text-red-400">{c.from || '—'}</span>
                          {' → '}
                          <span className="font-semibold text-blue-700">{c.to || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observations supprimees */}
          {deletedObs.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-xs font-bold text-red-700 uppercase">Observations supprimees ({deletedObs.length})</span>
              </div>
              <div className="space-y-1.5">
                {deletedObs.map((obs) => (
                  <div key={obs.id} className="flex items-start gap-2 px-3 py-2 bg-red-50 rounded-lg border border-red-100 opacity-75">
                    <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded shrink-0">{obs.category}</span>
                    <span className="text-xs text-slate-500 line-through line-clamp-2">{obs.text || '(vide)'}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ml-auto ${statusColor(obs.status)}`}>{statusLabel(obs.status)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end shrink-0">
          <button onClick={onClose} className="px-5 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200 transition-all">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

// ── VUE PRINCIPALE ──────────────────────────────────────────────────────────

export default function CrcView({ onBackToHub, user, companyId }) {
  const [chantiers, setChantiers] = useState([]);
  const [crrDoc, setCrrDoc] = useState(null);
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const [participantLibrary, setParticipantLibrary] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadChantiers = useCallback(async () => {
    if (!companyId) return [];
    const snap = await getDocs(collection(db, 'companies', companyId, 'crr'));
    const docs = [];
    snap.forEach((d) => docs.push({ id: d.id, ...d.data() }));
    return docs;
  }, [companyId]);

  useEffect(() => {
    if (!user || !companyId) return;
    const load = async () => {
      setLoading(true);
      try {
        const docs = await loadChantiers();
        setChantiers(docs);
        const brandSnap = await getDoc(doc(db, 'companies', companyId, 'resources', 'branding'));
        if (brandSnap.exists()) setBranding(brandSnap.data().config);
        const libSnap = await getDoc(doc(db, 'companies', companyId, 'resources', 'participantLibrary'));
        if (libSnap.exists()) setParticipantLibrary(libSnap.data().contacts || []);
        const lastId = localStorage.getItem(`crr_active_chantier__${companyId}`);
        const target = docs.find((d) => d.id === lastId) || docs[0];
        if (target) setCrrDoc(target);
      } catch (e) {
        console.error('Erreur chargement CRR:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, companyId, loadChantiers]);

  const handleSaveCrrDoc = useCallback(
    async (data) => {
      if (!data || !companyId) return;
      const docId = data.id;
      await setDoc(doc(db, 'companies', companyId, 'crr', docId), {
        ...data,
        lastSaved: new Date().toISOString(),
        updatedBy: user?.email,
      });
      setChantiers((prev) =>
        prev.map((c) => (c.id === docId ? { ...data, lastSaved: new Date().toISOString() } : c))
      );
    },
    [companyId, user]
  );

  const handleCreateChantier = useCallback(async () => {
    const newId = `crr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const newDoc = {
      id: newId,
      crrConfig: {
        participantGroups: [],
        categories: [],
        legalText: '',
        chantierInfo: { nom: '', lieu: '', dureePreparation: '', dureeChantier: '', dateDebut: '', dateFin: '' },
      },
      crrMeetings: [],
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'companies', companyId, 'crr', newId), newDoc);
    setChantiers((prev) => [...prev, newDoc]);
    setCrrDoc(newDoc);
    localStorage.setItem(`crr_active_chantier__${companyId}`, newId);
    setShowInfoChantierModal(true);
  }, [companyId]);

  const handleDeleteChantier = useCallback(async (chantierId) => {
    await deleteDoc(doc(db, 'companies', companyId, 'crr', chantierId));
    setChantiers((prev) => prev.filter((c) => c.id !== chantierId));
    if (crrDoc?.id === chantierId) {
      const remaining = chantiers.filter((c) => c.id !== chantierId);
      setCrrDoc(remaining[0] || null);
    }
  }, [companyId, crrDoc, chantiers]);

  const handleSelectChantier = (c) => {
    setCrrDoc(c);
    localStorage.setItem(`crr_active_chantier__${companyId}`, c.id);
  };

  const manager = useCrrManager({
    project: crrDoc,
    onUpdateProject: setCrrDoc,
    onSaveProject: handleSaveCrrDoc,
    masterBranding: branding,
  });

  const chantierName = manager.crrConfig.chantierInfo?.nom || '';

  const [viewMode, setViewMode] = useState('edit');
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [showInfoChantierModal, setShowInfoChantierModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showHelpPanel, setShowHelpPanel] = useState(false);
  const [showGuidedTour, setShowGuidedTour] = useState(() => !localStorage.getItem('crc-tour-dismissed'));
  const handleSaveLibrary = useCallback(async (contacts) => {
    setParticipantLibrary(contacts);
    if (companyId) {
      await setDoc(doc(db, 'companies', companyId, 'resources', 'participantLibrary'), { contacts });
    }
  }, [companyId]);

  // CR precedent pour l'audit (le plus recent avant le CR actif)
  const previousMeeting = manager.activeMeeting
    ? manager.meetings
        .filter((m) => m.number < manager.activeMeeting.number)
        .sort((a, b) => b.number - a.number)[0] || null
    : null;

  // Date par defaut pour la duplication : date de la reunion active + 7 jours
  const defaultDuplicateDate = (() => {
    if (!manager.activeMeeting?.date) return '';
    try {
      const d = new Date(manager.activeMeeting.date + 'T00:00:00');
      d.setDate(d.getDate() + 7);
      return d.toISOString().split('T')[0];
    } catch { return ''; }
  })();

  const handleDuplicateMeeting = useCallback((newDate) => {
    manager.duplicateMeeting(newDate);
  }, [manager]);

  const handleDeleteActiveMeeting = useCallback(async () => {
    if (!manager.activeMeeting) return;
    const ok = await confirm(
      `Supprimer le CR n°${manager.activeMeeting.number} ?`,
      { title: 'Suppression', danger: true }
    );
    if (ok) manager.deleteMeeting(manager.activeMeetingId);
  }, [manager]);

  const handleExportPdf = useCallback(async () => {
    const { generatePdfCrr } = await import('../utils/pdfCrrGenerator');
    await generatePdfCrr(manager.activeMeeting, manager.crrConfig, chantierName, branding);
  }, [manager, chantierName, branding]);

  const handleExportWord = useCallback(async () => {
    const { generateWordCrr } = await import('../utils/crrWordExporter');
    generateWordCrr(manager.activeMeeting, manager.crrConfig, chantierName, branding);
  }, [manager, chantierName, branding]);

  const handleSendMail = useCallback(async () => {
    if (manager.diffusionEmails.length === 0) {
      toast.warning('Aucun destinataire avec email et diffusion cochee.');
      return;
    }
    // Generer le PDF en memoire
    const { generatePdfCrr } = await import('../utils/pdfCrrGenerator');
    const pdfData = await generatePdfCrr(
      manager.activeMeeting, manager.crrConfig, chantierName, branding, { returnBlob: true }
    );
    // Sauvegarder le PDF + generer le script Outlook
    const { openOutlookMail } = await import('../utils/crrMailer');
    const result = await openOutlookMail(manager.activeMeeting, manager.crrConfig, chantierName, manager.diffusionEmails, pdfData);
    if (!result.pdfSaved) {
      toast.info('Envoi annule.');
      return;
    }
    if (result.vbsCreated) {
      toast.success('Double-cliquez sur "Envoyer_CR.vbs" dans le dossier pour ouvrir Outlook avec le PDF joint.');
    } else if (result.fallback) {
      toast.success('PDF telecharge — glissez-le dans la fenetre Outlook.');
    }
  }, [manager, chantierName, branding]);

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#040a0e] text-white">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hasMeeting = !!manager.activeMeeting;

  return (
    <div className="flex flex-col h-screen bg-[#040a0e] text-slate-300 overflow-hidden">

      {/* ═══════════════════════════════════════════════════════════════════════
          RUBAN STYLE OFFICE
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="shrink-0 bg-white border-b border-slate-200 shadow-sm">

        {/* Ligne superieure : titre + retour */}
        <div className="flex items-center gap-3 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600">
          <button
            onClick={onBackToHub}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-white/80 hover:text-white hover:bg-white/10 transition-all text-xs"
          >
            <ArrowLeft size={14} />
            Hub
          </button>
          <div className="h-4 w-px bg-white/20" />
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-white/80" />
            <span className="text-sm font-bold text-white tracking-tight">Compte Rendu de Reunion</span>
          </div>
        </div>

        {/* Ruban principal */}
        <div className="flex items-end gap-1 px-3 py-1.5">

          {/* ── GROUPE : CHANTIER ── */}
          <RibbonGroup label="Chantier" dataTour="chantier">
            <ChantierDropdown
              chantiers={chantiers}
              activeId={crrDoc?.id}
              onSelect={handleSelectChantier}
              onCreate={handleCreateChantier}
              onDelete={handleDeleteChantier}
            />
          </RibbonGroup>

          <RibbonDivider />

          {/* ── GROUPE : REUNION ── */}
          <RibbonGroup label="Reunion" dataTour="reunion">
            <RibbonButton icon={Plus} label="Nouveau CR" onClick={manager.createMeeting} disabled={!crrDoc} variant="primary" title="Creer une nouvelle reunion de chantier" />
            <RibbonButton icon={Copy} label="Dupliquer CR" onClick={() => setShowDuplicateModal(true)} disabled={!hasMeeting} variant="primary" title="Dupliquer la reunion avec report des observations non resolues" />
            <RibbonButton icon={ArrowLeftRight} label="Audit CR" onClick={() => setShowAuditModal(true)} disabled={!previousMeeting} variant="accent" title="Comparer avec la reunion precedente" />
            <RibbonButton icon={Trash2} label="Supprimer CR" onClick={handleDeleteActiveMeeting} disabled={!hasMeeting} variant="default" title="Supprimer definitivement cette reunion" />
          </RibbonGroup>

          <RibbonDivider />

          {/* ── GROUPE : CONFIGURATION ── */}
          <RibbonGroup label="Configuration" dataTour="configuration">
            <RibbonButton icon={Building2} label="Info Chantier" onClick={() => setShowInfoChantierModal(true)} disabled={!crrDoc} variant="primary" title="Nom, adresse et infos du chantier" />
            <RibbonButton icon={Users} label="Participants" onClick={() => setShowParticipantsModal(true)} disabled={!crrDoc} variant="primary" title="Gerer les groupes et contacts participants" />
            <RibbonButton icon={ListTree} label="Categories" onClick={() => setShowCategoriesModal(true)} disabled={!crrDoc} variant="primary" title="Gerer les categories d'observations" />
          </RibbonGroup>

          <RibbonDivider />

          {/* ── GROUPE : MODE ── */}
          <RibbonGroup label="Mode" dataTour="mode">
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('edit')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-all ${
                  viewMode === 'edit'
                    ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Edit3 size={14} />
                EDITION
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-all ${
                  viewMode === 'preview'
                    ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Eye size={14} />
                APERCU
              </button>
            </div>
          </RibbonGroup>

          <RibbonDivider />

          {/* ── GROUPE : EXPORTS ── */}
          <RibbonGroup label="Exports" dataTour="exports">
            <RibbonButton icon={FileDown} label="Export PDF" onClick={handleExportPdf} disabled={!hasMeeting} variant="primary" title="Telecharger le compte rendu en PDF" />
            <RibbonButton icon={FileWord} label="Export Word" onClick={handleExportWord} disabled={!hasMeeting} variant="accent" title="Telecharger le compte rendu en Word (.doc)" />
            <RibbonButton icon={Mail} label="Envoyer" onClick={handleSendMail} disabled={!hasMeeting} variant="accent" title="Envoyer le CR par email aux participants" />
          </RibbonGroup>

          <RibbonDivider />

          {/* ── GROUPE : AIDE ── */}
          <RibbonGroup label="Aide">
            <RibbonButton icon={HelpCircle} label="Aide" onClick={() => setShowHelpPanel(true)} title="Ouvrir le guide d'aide complet" />
            <RibbonButton icon={Compass} label="Tour" onClick={() => setShowGuidedTour(true)} title="Lancer le tour guide interactif" />
          </RibbonGroup>

        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          CONTENU PRINCIPAL
          ═══════════════════════════════════════════════════════════════════════ */}
      {!crrDoc ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FolderOpen size={48} className="mx-auto mb-4 text-slate-600" />
            <p className="text-sm text-slate-500 mb-4">Creez ou selectionnez un chantier pour commencer</p>
            <button
              onClick={handleCreateChantier}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white text-sm font-medium rounded-xl hover:bg-emerald-600 transition-all mx-auto"
            >
              <Plus size={14} /> Nouveau chantier
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Onglets des reunions */}
          <div data-tour="meetings-list">
          <MeetingTabs
            meetings={manager.meetings}
            activeMeetingId={manager.activeMeetingId}
            setActiveMeetingId={manager.setActiveMeetingId}
            saveStatus={manager.saveStatus}
          />
          </div>

          {/* Contenu principal (pleine largeur) */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#f8fafc]" data-tour="content-area">
            <div className="flex-1 overflow-y-auto">
              {!manager.activeMeeting ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <Edit3 size={48} className="mb-4 opacity-30" />
                  <p className="text-sm">Cliquez sur "Nouveau CR" pour creer le premier compte rendu</p>
                </div>
              ) : viewMode === 'preview' ? (
                <div className="p-6 bg-slate-100 min-h-full">
                  <CrrPreview meeting={manager.activeMeeting} crrConfig={manager.crrConfig} projectName={chantierName} branding={branding} />
                </div>
              ) : (
                <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
                  <CrrHeader meeting={manager.activeMeeting} projectName={chantierName}
                    updateMeetingField={manager.updateMeetingField} updateNextMeeting={manager.updateNextMeeting} />
                  <CrrParticipants meeting={manager.activeMeeting} crrConfig={manager.crrConfig}
                    setAttendance={manager.setAttendance} setDiffusion={manager.setDiffusion}
                    addContact={manager.addContact} updateContact={manager.updateContact} deleteContact={manager.deleteContact}
                    addParticipantGroup={manager.addParticipantGroup} updateParticipantGroup={manager.updateParticipantGroup}
                    deleteParticipantGroup={manager.deleteParticipantGroup} showManagement={true}
                    reorderParticipantGroups={manager.reorderParticipantGroups} />
                  <CrrObservations meeting={manager.activeMeeting} categories={manager.crrConfig.categories}
                    observationsByCategory={manager.observationsByCategory} addObservation={manager.addObservation}
                    updateObservation={manager.updateObservation} deleteObservation={manager.deleteObservation}
                    legalText={manager.crrConfig.legalText}
                    participantGroups={manager.crrConfig.participantGroups} />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Modals ── */}
      <CategoriesModal isOpen={showCategoriesModal} onClose={() => setShowCategoriesModal(false)}
        categories={manager.crrConfig.categories} addCategory={manager.addCategory}
        renameCategory={manager.renameCategory} deleteCategory={manager.deleteCategory}
        reorderCategories={manager.reorderCategories} />

      <UnifiedParticipantsModal
        isOpen={showParticipantsModal}
        onClose={() => setShowParticipantsModal(false)}
        participantGroups={manager.activeParticipantGroups}
        addContact={manager.addContact}
        updateContact={manager.updateContact}
        deleteContact={manager.deleteContact}
        addParticipantGroup={manager.addParticipantGroup}
        updateParticipantGroup={manager.updateParticipantGroup}
        deleteParticipantGroup={manager.deleteParticipantGroup}
        reorderParticipantGroups={manager.reorderParticipantGroups}
        importContactsFromLibrary={manager.importContactsFromLibrary}
        moveContactBetweenGroups={manager.moveContactBetweenGroups}
        libraryContacts={participantLibrary}
        onSaveLibrary={handleSaveLibrary}
      />

      <InfoChantierModal
        isOpen={showInfoChantierModal}
        onClose={() => setShowInfoChantierModal(false)}
        chantierInfo={manager.crrConfig.chantierInfo}
        updateChantierInfo={manager.updateChantierInfo}
      />

      <DuplicateMeetingModal
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        onConfirm={handleDuplicateMeeting}
        defaultDate={defaultDuplicateDate}
      />

      <AuditModal
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        currentMeeting={manager.activeMeeting}
        previousMeeting={previousMeeting}
        participantGroups={manager.activeParticipantGroups}
      />

      {showHelpPanel && (
        <CrcHelpPanel
          onClose={() => setShowHelpPanel(false)}
          onStartTour={() => setShowGuidedTour(true)}
        />
      )}

      {showGuidedTour && (
        <CrcGuidedTour onClose={() => setShowGuidedTour(false)} />
      )}
    </div>
  );
}
