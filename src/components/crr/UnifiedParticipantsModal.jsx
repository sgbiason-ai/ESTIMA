// src/components/crr/UnifiedParticipantsModal.jsx
//
// Modale unifiee : arborescence participants (gauche) + bibliotheque (droite)
// Drag & drop : biblio → groupes, contact entre groupes

import React, { useState, useRef } from 'react';
import {
  X, Plus, Trash2, Check, Edit2, Edit3, ChevronDown, ChevronRight,
  Users, BookUser, Upload, Download, Info, UserPlus, GripVertical, Copy,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import * as XLSX from 'xlsx';
import { toast } from '../../utils/globalUI';
import { getGroupColor, abbreviateGroup, generateCrrId } from '../../data/crrData';
import { confirm } from '../../utils/globalUI';

// ── PANNEAU GAUCHE : ARBORESCENCE GROUPES ──────────────────────────────────

const GroupTree = ({
  participantGroups,
  addContact,
  updateContact,
  deleteContact,
  addParticipantGroup,
  updateParticipantGroup,
  deleteParticipantGroup,
}) => {
  const [expandedGroups, setExpandedGroups] = useState(
    new Set((participantGroups || []).map((g) => g.id))
  );
  const [editingGroup, setEditingGroup] = useState(null);
  const [editingContact, setEditingContact] = useState(null);
  const [editData, setEditData] = useState({});

  const toggleGroup = (gid) => {
    const s = new Set(expandedGroups);
    if (s.has(gid)) s.delete(gid);
    else s.add(gid);
    setExpandedGroups(s);
  };

  const handleDeleteGroup = async (gid) => {
    const ok = await confirm('Supprimer ce groupe et tous ses contacts ?', { danger: true });
    if (ok) deleteParticipantGroup(gid);
  };

  const handleDeleteContact = async (gid, cid) => {
    const ok = await confirm('Supprimer ce contact ?', { danger: true });
    if (ok) deleteContact(gid, cid);
  };

  const startEditContact = (contact) => {
    setEditingContact(contact.id);
    setEditData({ name: contact.name, email: contact.email, phone: contact.phone || '' });
  };

  const saveEditContact = (groupId, contactId) => {
    updateContact(groupId, contactId, editData);
    setEditingContact(null);
  };

  const totalContacts = (participantGroups || []).reduce((n, g) => n + (g.contacts?.length || 0), 0);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-emerald-500" />
          <span className="text-xs font-bold text-slate-700">Chantier</span>
          <span className="text-[10px] text-slate-400">({totalContacts})</span>
        </div>
        <button
          onClick={() => addParticipantGroup()}
          className="flex items-center gap-1 px-2 py-1 text-[10px] bg-emerald-50 text-emerald-600 rounded-md hover:bg-emerald-100 transition-all font-medium"
        >
          <Plus size={10} /> Groupe
        </button>
      </div>

      {/* Arborescence */}
      <div className="flex-1 overflow-y-auto">
        {(participantGroups || []).map((group, groupIdx) => {
          const isExpanded = expandedGroups.has(group.id);
          const isEditingG = editingGroup === group.id;
          const gc = getGroupColor(groupIdx);
          const abbr = abbreviateGroup(group.name);

          return (
            <Droppable droppableId={`group-${group.id}`} key={group.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`border-b border-slate-100 last:border-b-0 transition-colors ${
                    snapshot.isDraggingOver ? 'bg-emerald-50/70' : ''
                  }`}
                >
                  {/* Header groupe */}
                  <div
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-50/80 cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => toggleGroup(group.id)}
                  >
                    {isExpanded ? <ChevronDown size={12} className="text-slate-400 shrink-0" /> : <ChevronRight size={12} className="text-slate-400 shrink-0" />}

                    {isEditingG ? (
                      <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text" value={group.name}
                          onChange={(e) => updateParticipantGroup(group.id, { name: e.target.value })}
                          className="text-[11px] font-bold px-1.5 py-0.5 border border-emerald-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-400 w-28 text-slate-800"
                          autoFocus onKeyDown={(e) => e.key === 'Enter' && setEditingGroup(null)}
                        />
                        <input
                          type="text" value={group.subLabel || ''}
                          onChange={(e) => updateParticipantGroup(group.id, { subLabel: e.target.value })}
                          placeholder="Sous-label..."
                          className="text-[11px] px-1.5 py-0.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-400 w-36 text-slate-800"
                          onKeyDown={(e) => e.key === 'Enter' && setEditingGroup(null)}
                        />
                        <button onClick={() => setEditingGroup(null)} className="p-0.5 text-emerald-600 hover:bg-emerald-100 rounded">
                          <Check size={11} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className={`inline-flex items-center gap-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${gc.bg} ${gc.text} ${gc.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${gc.dot}`} />{abbr}
                        </span>
                        <span className="text-[11px] font-bold text-slate-700 uppercase truncate">{group.name}</span>
                        {group.subLabel && <span className="text-[10px] text-slate-400 truncate">{group.subLabel}</span>}
                        <span className="text-[9px] text-slate-400">({group.contacts.length})</span>
                        <div className="flex items-center gap-0.5 ml-auto shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => setEditingGroup(group.id)} className="p-0.5 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded" title="Modifier">
                            <Edit2 size={10} />
                          </button>
                          <button onClick={() => handleDeleteGroup(group.id)} className="p-0.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded" title="Supprimer">
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Contacts */}
                  {isExpanded && group.contacts.map((contact, contactIdx) => {
                    const isEditingC = editingContact === contact.id;

                    return (
                      <Draggable draggableId={`chantier-${contact.id}`} index={contactIdx} key={contact.id}>
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className={`flex items-center gap-1.5 pl-7 pr-3 py-1.5 hover:bg-slate-50 transition-colors group/row text-[11px] ${
                              dragSnapshot.isDragging ? 'bg-emerald-50 shadow-md rounded-lg' : ''
                            }`}
                          >
                            <div {...dragProvided.dragHandleProps} className="text-slate-200 hover:text-slate-400 cursor-grab shrink-0">
                              <GripVertical size={12} />
                            </div>

                            {isEditingC ? (
                              <div className="flex items-center gap-1 flex-1 min-w-0">
                                <input type="text" value={editData.name || ''} onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                  placeholder="NOM Prenom" autoFocus onKeyDown={(e) => e.key === 'Enter' && saveEditContact(group.id, contact.id)}
                                  className="text-[11px] px-1.5 py-0.5 border border-emerald-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-400 w-28 text-slate-800" />
                                <input type="email" value={editData.email || ''} onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                                  placeholder="email" onKeyDown={(e) => e.key === 'Enter' && saveEditContact(group.id, contact.id)}
                                  className="text-[11px] px-1.5 py-0.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-400 w-32 text-slate-800" />
                                <input type="tel" value={editData.phone || ''} onChange={(e) => {
                                  const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
                                  setEditData({ ...editData, phone: raw.replace(/(\d{2})(?=\d)/g, '$1 ').trim() });
                                }} placeholder="06 00 00 00 00" onKeyDown={(e) => e.key === 'Enter' && saveEditContact(group.id, contact.id)}
                                  className="text-[11px] px-1.5 py-0.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-400 w-28 text-slate-800" />
                                <button onClick={() => saveEditContact(group.id, contact.id)} className="p-0.5 text-emerald-600 hover:bg-emerald-100 rounded"><Check size={11} /></button>
                                <button onClick={() => setEditingContact(null)} className="p-0.5 text-slate-400 hover:bg-slate-100 rounded"><X size={11} /></button>
                              </div>
                            ) : (
                              <>
                                <span className="font-medium text-slate-700 truncate min-w-[80px]">{contact.name || '—'}</span>
                                <span className="text-slate-400 truncate flex-1">{contact.email || ''}</span>
                                {contact.phone && <span className="text-[10px] text-slate-300 shrink-0">{contact.phone}</span>}
                                <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-all shrink-0">
                                  <button onClick={() => startEditContact(contact)} className="p-0.5 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded"><Edit2 size={10} /></button>
                                  <button onClick={() => handleDeleteContact(group.id, contact.id)} className="p-0.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 size={10} /></button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </Draggable>
                    );
                  })}

                  {provided.placeholder}

                  {/* Ajouter contact */}
                  {isExpanded && (
                    <div className="pl-7 pr-3 py-1">
                      <button
                        onClick={() => addContact(group.id)}
                        className="flex items-center gap-1 text-[10px] text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 px-1.5 py-0.5 rounded transition-all"
                      >
                        <UserPlus size={10} /> Ajouter
                      </button>
                    </div>
                  )}
                </div>
              )}
            </Droppable>
          );
        })}

        {(participantGroups || []).length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-xs">
            <Users size={24} className="mb-2 text-slate-300" />
            <p>Aucun groupe</p>
            <button onClick={() => addParticipantGroup()} className="mt-2 text-emerald-500 hover:underline text-[11px]">
              Creer un groupe
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── PANNEAU DROIT : BIBLIOTHEQUE ──────────────────────────────────────────

const LibraryPanel = ({ contacts, onSave }) => {
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [filter, setFilter] = useState('');
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [showHelp, setShowHelp] = useState(false);
  const fileRef = useRef(null);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const filtered = (() => {
    let list = filter
      ? contacts.filter((c) => [c.subLabel, c.name, c.email, c.phone].join(' ').toLowerCase().includes(filter.toLowerCase()))
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

  const handleDelete = async (id) => {
    const ok = await confirm('Supprimer ce contact ?', { danger: true });
    if (ok) onSave(contacts.filter((c) => c.id !== id));
  };

  const findCol = (row, ...candidates) => {
    const keys = Object.keys(row);
    for (const cand of candidates) {
      const norm = cand.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const found = keys.find((k) => k.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === norm);
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
      e.target.value = ''; return;
    }
    const reader = new FileReader();
    reader.onerror = () => { toast.error('Impossible de lire le fichier.'); e.target.value = ''; };
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        if (!wb.SheetNames.length) { toast.error('Aucune feuille.'); return; }
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        if (data.length === 0) { toast.warning('Fichier vide.'); return; }

        const firstRowKeys = Object.keys(data[0]);
        const usePositional = firstRowKeys.every(
          (k) => k.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().search(/sous|label|nom|prenom|mail|email|tel|phone/) === -1
        );

        const imported = data.map((row, i) => {
          if (usePositional) {
            const vals = firstRowKeys.map((k) => String(row[k] || ''));
            return { id: `lib_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`, subLabel: vals[0] || '', name: vals[1] || '', email: vals[2] || '', phone: vals[3] || '' };
          }
          return {
            id: `lib_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
            subLabel: findCol(row, 'Sous-label', 'Sous label', 'SubLabel', 'Label'),
            name: findCol(row, 'NOM Prenom', 'NOM Prénom', 'Nom Prenom', 'Nom Prénom', 'Nom', 'Name', 'Contact'),
            phone: findCol(row, 'Telephone', 'Téléphone', 'Tel', 'Phone'),
            email: findCol(row, 'Email', 'Mail', 'E-mail'),
          };
        }).filter((c) => c.name || c.email);

        const skipped = data.length - imported.length;

        // Dedup
        const norm = (s) => (s || '').trim().toLowerCase();
        const existingEmails = new Set(contacts.filter((c) => c.email).map((c) => norm(c.email)));
        const existingNames = new Set(contacts.filter((c) => c.name && !c.email).map((c) => norm(c.name)));
        const seenEmails = new Set();
        const seenNames = new Set();
        const uniqueImported = imported.filter((c) => {
          if (c.email && existingEmails.has(norm(c.email))) return false;
          if (!c.email && c.name && existingNames.has(norm(c.name))) return false;
          if (c.email) { const e = norm(c.email); if (seenEmails.has(e)) return false; seenEmails.add(e); }
          else if (c.name) { const n = norm(c.name); if (seenNames.has(n)) return false; seenNames.add(n); }
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
        toast.error(`Erreur : ${err.message || 'format invalide'}`);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleExcelExport = () => {
    const data = contacts.map((c) => ({
      'Sous-label': c.subLabel || '', 'NOM Prenom': c.name || '',
      'Telephone': c.phone || '', 'Email': c.email || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 25 }, { wch: 25 }, { wch: 16 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Participants');
    XLSX.writeFile(wb, 'bibliotheque_participants.xlsx');
    toast.success(`${contacts.length} contact(s) exporte(s).`);
  };

  const handleRemoveDuplicates = () => {
    const norm = (s) => (s || '').trim().toLowerCase();
    const seenEmails = new Set();
    const seenNames = new Set();
    const unique = [];
    for (const c of contacts) {
      if (c.email) { const e = norm(c.email); if (seenEmails.has(e)) continue; seenEmails.add(e); }
      else if (c.name) { const n = norm(c.name); if (seenNames.has(n)) continue; seenNames.add(n); }
      unique.push(c);
    }
    const removed = contacts.length - unique.length;
    if (removed === 0) { toast.info('Aucun doublon.'); return; }
    onSave(unique);
    toast.success(`${removed} doublon(s) supprime(s).`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 bg-violet-50/50 shrink-0 flex-wrap">
        <BookUser size={14} className="text-violet-500 shrink-0" />
        <span className="text-xs font-bold text-slate-700 shrink-0">Bibliotheque</span>
        <span className="text-[10px] text-slate-400 shrink-0">({contacts.length})</span>

        <input
          type="text" value={filter} onChange={(e) => setFilter(e.target.value)}
          placeholder="Rechercher..."
          className="text-[11px] px-2 py-1 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-400 w-32 ml-auto text-slate-800"
        />

        <div className="flex items-center gap-0.5">
          <button onClick={handleAdd} className="p-1.5 text-violet-500 hover:bg-violet-100 rounded-lg transition-all" title="Ajouter un contact">
            <Plus size={14} />
          </button>
          <button onClick={handleRemoveDuplicates} disabled={contacts.length < 2}
            className={`p-1.5 rounded-lg transition-all ${contacts.length < 2 ? 'opacity-40 text-slate-300' : 'text-red-400 hover:bg-red-50 hover:text-red-500'}`} title="Supprimer les doublons">
            <Copy size={14} />
          </button>

          <div className="w-px h-5 bg-slate-200 mx-0.5" />

          <button onClick={() => fileRef.current?.click()} className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all" title="Import Excel">
            <Upload size={14} />
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelImport} />
          <button onClick={handleExcelExport} disabled={contacts.length === 0}
            className={`p-1.5 rounded-lg transition-all ${contacts.length === 0 ? 'opacity-40 text-slate-300' : 'text-blue-500 hover:bg-blue-50'}`} title="Export Excel">
            <Download size={14} />
          </button>
          <button onClick={() => setShowHelp(!showHelp)}
            className={`p-1.5 rounded-lg transition-all ${showHelp ? 'bg-slate-200 text-slate-600' : 'text-slate-400 hover:bg-slate-100'}`} title="Aide">
            <Info size={14} />
          </button>
        </div>
      </div>

      {/* Aide */}
      {showHelp && (
        <div className="px-3 py-2 border-b border-slate-200 bg-amber-50 text-[10px] text-slate-600 shrink-0">
          <p className="font-bold text-slate-700 mb-1">Format Excel : Sous-label | NOM Prenom | Telephone | Email</p>
          <p>Glissez un contact de la bibliotheque vers un groupe a gauche pour l'ajouter au chantier.</p>
        </div>
      )}

      {/* Liste */}
      <Droppable droppableId="library" isDropDisabled>
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="flex-1 overflow-y-auto">
            {/* En-tete colonnes */}
            <div className="grid grid-cols-[1fr_1.5fr_1.5fr_40px] gap-1 px-3 py-1.5 bg-slate-100 border-b border-slate-200 text-[9px] font-bold text-slate-400 uppercase tracking-wider sticky top-0 z-10">
              <span className="cursor-pointer hover:text-violet-600" onClick={() => toggleSort('subLabel')}>
                Label {sortCol === 'subLabel' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </span>
              <span className="cursor-pointer hover:text-violet-600" onClick={() => toggleSort('name')}>
                Nom {sortCol === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </span>
              <span>Email / Tel</span>
              <span />
            </div>

            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-xs">
                <BookUser size={20} className="mb-2 text-slate-300" />
                <p>{filter ? 'Aucun resultat' : 'Bibliotheque vide'}</p>
              </div>
            )}

            {filtered.map((c, idx) => {
              const isEditing = editingId === c.id;

              return (
                <Draggable draggableId={`lib-${c.id}`} index={idx} key={c.id}>
                  {(dragProvided, dragSnapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      {...dragProvided.dragHandleProps}
                      className={`grid grid-cols-[1fr_1.5fr_1.5fr_40px] gap-1 px-3 py-1.5 border-b border-slate-50 hover:bg-violet-50/40 transition-colors group/lib text-[11px] cursor-grab ${
                        dragSnapshot.isDragging ? 'bg-violet-100 shadow-lg rounded-lg' : ''
                      }`}
                    >
                      {isEditing ? (
                        <>
                          <input type="text" value={editData.subLabel || ''} onChange={(e) => setEditData({ ...editData, subLabel: e.target.value })}
                            placeholder="Label" className="text-[11px] px-1.5 py-0.5 border border-violet-300 rounded focus:outline-none text-slate-800 w-full" autoFocus />
                          <input type="text" value={editData.name || ''} onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                            placeholder="NOM Prenom" className="text-[11px] px-1.5 py-0.5 border border-violet-300 rounded focus:outline-none text-slate-800 w-full"
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()} />
                          <div className="flex flex-col gap-0.5">
                            <input type="email" value={editData.email || ''} onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                              placeholder="email" className="text-[11px] px-1.5 py-0.5 border border-slate-200 rounded focus:outline-none text-slate-800 w-full"
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()} />
                            <input type="tel" value={editData.phone || ''} onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                              placeholder="telephone" className="text-[10px] px-1.5 py-0.5 border border-slate-200 rounded focus:outline-none text-slate-800 w-full"
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()} />
                          </div>
                          <div className="flex items-center gap-0.5">
                            <button onClick={handleSaveEdit} className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded"><Check size={11} /></button>
                            <button onClick={() => setEditingId(null)} className="p-0.5 text-slate-400 hover:bg-slate-100 rounded"><X size={11} /></button>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="text-slate-500 truncate">{c.subLabel || '—'}</span>
                          <span className="font-medium text-slate-700 truncate">{c.name || '—'}</span>
                          <div className="flex flex-col min-w-0">
                            <span className="text-blue-600 truncate text-[11px]">{c.email || ''}</span>
                            {c.phone && <span className="text-[10px] text-slate-400">{c.phone}</span>}
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover/lib:opacity-100 transition-all">
                            <button onClick={() => { setEditingId(c.id); setEditData(c); }} className="p-0.5 text-slate-300 hover:text-violet-600 hover:bg-violet-50 rounded"><Edit3 size={10} /></button>
                            <button onClick={() => handleDelete(c.id)} className="p-0.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 size={10} /></button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};

// ── MODALE UNIFIEE ────────────────────────────────────────────────────────

const UnifiedParticipantsModal = ({
  isOpen,
  onClose,
  // Chantier participants
  participantGroups,
  addContact,
  updateContact,
  deleteContact,
  addParticipantGroup,
  updateParticipantGroup,
  deleteParticipantGroup,
  reorderParticipantGroups,
  importContactsFromLibrary,
  moveContactBetweenGroups,
  // Library
  libraryContacts,
  onSaveLibrary,
}) => {
  if (!isOpen) return null;

  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    const srcId = source.droppableId;
    const dstId = destination.droppableId;

    // Biblio → groupe chantier
    if (srcId === 'library' && dstId.startsWith('group-')) {
      // Retrouver le contact par son ID (draggableId = "lib-{contactId}")
      const contactId = draggableId.replace('lib-', '');
      const contact = libraryContacts.find((c) => c.id === contactId);
      if (!contact) return;
      const targetGroupId = dstId.replace('group-', '');
      importContactsFromLibrary([{ contact, targetGroupId }]);
      toast.success(`${contact.name || contact.email} ajoute au groupe.`);
      return;
    }

    // Drop dans library = ignore
    if (dstId === 'library') return;

    // Contact chantier → autre groupe (draggableId = "chantier-{contactId}")
    if (srcId.startsWith('group-') && dstId.startsWith('group-')) {
      const fromGroupId = srcId.replace('group-', '');
      const toGroupId = dstId.replace('group-', '');

      if (fromGroupId === toGroupId && source.index === destination.index) return;

      const contactId = draggableId.replace('chantier-', '');
      moveContactBetweenGroups(fromGroupId, toGroupId, contactId, destination.index);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[1100px] max-h-[85vh] overflow-hidden flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-violet-50 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <Users size={16} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Gestion des participants</h3>
                <p className="text-[10px] text-slate-500">
                  Glissez les contacts de la bibliotheque vers un groupe pour les ajouter
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
          </div>
        </div>

        {/* Body : 2 panneaux */}
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex flex-1 overflow-hidden min-h-0">
            {/* Gauche : arborescence groupes */}
            <div className="w-[480px] border-r border-slate-200 flex flex-col overflow-hidden">
              <GroupTree
                participantGroups={participantGroups}
                addContact={addContact}
                updateContact={updateContact}
                deleteContact={deleteContact}
                addParticipantGroup={addParticipantGroup}
                updateParticipantGroup={updateParticipantGroup}
                deleteParticipantGroup={deleteParticipantGroup}
              />
            </div>

            {/* Droite : bibliotheque */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <LibraryPanel contacts={libraryContacts} onSave={onSaveLibrary} />
            </div>
          </div>
        </DragDropContext>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
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

export default UnifiedParticipantsModal;
