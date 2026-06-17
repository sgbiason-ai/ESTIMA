// src/components/crr/CrrParticipants.jsx
import React, { useState, useRef, useCallback } from 'react';
import { Plus, Trash2, UserPlus, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Users, Check, X, Minus, Edit2, GripVertical } from 'lucide-react';
import { PRESENCE_OPTIONS } from '../../data/crrData';
import { confirm } from '../../utils/globalUI';
import GroupBadge from './GroupBadge';

const PresenceButton = ({ value, onChange }) => {
  const cycle = () => {
    const states = ['present', 'excused', 'absent', 'not_summoned'];
    const idx = states.indexOf(value || 'absent');
    onChange(states[(idx + 1) % states.length]);
  };

  const display = {
    present:       { label: 'P',  cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    excused:       { label: 'E',  cls: 'bg-slate-100 text-slate-700 border-slate-300' },
    absent:        { label: 'A',  cls: 'bg-red-500 text-white border-red-600' },
    not_summoned:  { label: 'NC', cls: 'bg-purple-100 text-purple-700 border-purple-300' },
  };

  const d = display[value] || display.absent;

  return (
    <button
      onClick={cycle}
      className={`w-8 h-8 rounded-md border text-xs font-bold transition-all hover:scale-110 ${d.cls}`}
      title={PRESENCE_OPTIONS.find((p) => p.value === value)?.label || 'Absent'}
    >
      {d.label}
    </button>
  );
};

const DiffusionCheckbox = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`w-8 h-8 rounded-md border text-xs font-bold transition-all hover:scale-110 ${
      checked
        ? 'bg-blue-100 text-blue-700 border-blue-300'
        : 'bg-slate-100 text-slate-400 border-slate-200'
    }`}
    title={checked ? 'Diffuse' : 'Non diffuse'}
  >
    {checked ? 'x' : '-'}
  </button>
);

const CrrParticipants = ({
  meeting,
  crrConfig,
  setAttendance,
  setDiffusion,
  addContact,
  updateContact,
  deleteContact,
  addParticipantGroup,
  updateParticipantGroup,
  deleteParticipantGroup,
  reorderParticipantGroups,
  showManagement = false,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  // Par defaut tous les groupes sont replies (on voit le nom du groupe + compte,
  // mais pas la liste des contacts). Meilleur scan visuel a l'ouverture d'un CRC.
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [editingGroup, setEditingGroup] = useState(null);
  const [editingContact] = useState(null);

  // Drag & drop state pour reordonner les groupes
  const dragIdx = useRef(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const handleDragStart = (e, idx) => {
    dragIdx.current = idx;
    e.dataTransfer.effectAllowed = 'move';
    // Rendre l'element semi-transparent
    e.currentTarget.style.opacity = '0.4';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    dragIdx.current = null;
    setDragOverIdx(null);
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (idx !== dragOverIdx) setDragOverIdx(idx);
  };

  const handleDrop = (e, toIdx) => {
    e.preventDefault();
    const fromIdx = dragIdx.current;
    if (fromIdx !== null && fromIdx !== toIdx && reorderParticipantGroups) {
      reorderParticipantGroups(fromIdx, toIdx);
    }
    dragIdx.current = null;
    setDragOverIdx(null);
  };

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

  // Extracted handlers for .map() rows
  const handleContactFieldChange = useCallback((groupId, contactId, field) => (e) => {
    updateContact(groupId, contactId, { [field]: e.target.value });
  }, [updateContact]);

  const handleContactPhoneChange = useCallback((groupId, contactId) => (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
    const formatted = raw.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
    updateContact(groupId, contactId, { phone: formatted });
  }, [updateContact]);

  const handleContactCprChange = useCallback((groupId, contactId) => (v) => {
    updateContact(groupId, contactId, { cpr: v });
  }, [updateContact]);

  if (!meeting) return null;

  // Les groupes sont stockes par reunion (fallback config globale pour anciens CR).
  // Doit refleter la meme source que useCrrManager.activeParticipantGroups,
  // sinon addParticipantGroup ecrit dans meeting mais l'UI lit crrConfig → rien ne s'affiche.
  const participantGroups = meeting.participantGroups || crrConfig.participantGroups;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* En-tete */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <button onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-emerald-600 transition-colors">
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          <Users size={14} className="text-emerald-500" />
          PARTICIPANTS
          <span className="text-[10px] font-normal text-slate-400">
            ({participantGroups.reduce((n, g) => n + (g.contacts?.length || 0), 0)})
          </span>
        </button>

        {!collapsed && (
          <div className="flex items-center gap-1.5">
            {/* Toggle tout déplier / tout replier */}
            {participantGroups.length > 0 && (() => {
              const allIds = participantGroups.map((g) => g.id);
              const allExpanded = allIds.length > 0 && allIds.every((id) => expandedGroups.has(id));
              return (
                <button
                  onClick={() => setExpandedGroups(allExpanded ? new Set() : new Set(allIds))}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200 transition-all"
                  title={allExpanded ? 'Replier tous les groupes' : 'Déplier tous les groupes'}
                >
                  {allExpanded ? <ChevronsDownUp size={10} /> : <ChevronsUpDown size={10} />}
                  {allExpanded ? 'Tout replier' : 'Tout déplier'}
                </button>
              );
            })()}
            {showManagement && (
              <button
                onClick={() => addParticipantGroup()}
                className="flex items-center gap-1 px-2 py-1 text-[11px] bg-emerald-50 text-emerald-600 rounded-md hover:bg-emerald-100 transition-all"
              >
                <Plus size={10} />
                Groupe
              </button>
            )}
          </div>
        )}
      </div>

      {!collapsed && (
        <>
          {/* En-tete tableau */}
          <div className="grid grid-cols-[1.5fr_1.2fr_1.5fr_2fr_50px_50px_50px] gap-1 px-4 py-2 bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <span>Role</span>
            <span>Label</span>
            <span>Contact</span>
            <span>Email</span>
            <span className="text-center">CPR</span>
            <span className="text-center">Pres.</span>
            <span className="text-center">Diff.</span>
          </div>

      {/* Groupes */}
      {participantGroups.map((group, groupIdx) => {
        const isExpanded = expandedGroups.has(group.id);
        const isEditing = editingGroup === group.id;
        const isDragOver = dragOverIdx === groupIdx;

        return (
          <div
            key={group.id}
            className={`border-b border-slate-100 last:border-b-0 transition-all ${isDragOver ? 'border-t-2 border-t-emerald-400' : ''}`}
            onDragOver={(e) => handleDragOver(e, groupIdx)}
            onDrop={(e) => handleDrop(e, groupIdx)}
          >
            {/* Ligne groupe */}
            <div
              className="grid grid-cols-[1.5fr_1.2fr_1.5fr_2fr_50px_50px_50px] gap-1 px-4 py-2 bg-emerald-50/50 cursor-pointer hover:bg-emerald-50 transition-colors items-center"
              onClick={() => toggleGroup(group.id)}
            >
              <div className="flex items-center gap-1 col-span-4">
                {/* Poignee drag (management uniquement) */}
                {showManagement && (
                  <div
                    draggable={!isEditing}
                    onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, groupIdx); }}
                    onDragEnd={handleDragEnd}
                    className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 shrink-0 mr-0.5"
                    onMouseDown={(e) => e.stopPropagation()}
                    title="Glisser pour reordonner"
                  >
                    <GripVertical size={14} />
                  </div>
                )}

                {isExpanded ? (
                  <ChevronDown size={12} className="text-slate-400 shrink-0" />
                ) : (
                  <ChevronRight size={12} className="text-slate-400 shrink-0" />
                )}

                {isEditing ? (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={group.name}
                      onChange={(e) =>
                        updateParticipantGroup(group.id, { name: e.target.value })
                      }
                      spellCheck
                      lang="fr"
                      className="text-xs font-bold px-2 py-1 border border-emerald-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-400 w-40 text-slate-800"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && setEditingGroup(null)}
                    />
                    <input
                      type="text"
                      value={group.subLabel || ''}
                      onChange={(e) =>
                        updateParticipantGroup(group.id, { subLabel: e.target.value })
                      }
                      placeholder="Label (ex: Mairie de...)"
                      spellCheck
                      lang="fr"
                      className="text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-400 w-48 text-slate-800"
                      onKeyDown={(e) => e.key === 'Enter' && setEditingGroup(null)}
                    />
                    <button
                      onClick={() => setEditingGroup(null)}
                      className="p-1 text-emerald-600 hover:bg-emerald-100 rounded"
                    >
                      <Check size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <GroupBadge name={group.name} colorIndex={groupIdx} />
                    <span className="text-xs font-bold text-slate-700 uppercase">
                      {group.name}
                    </span>
                    {group.subLabel && (
                      <span className="text-xs font-normal text-slate-500">
                        {group.subLabel}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">
                      ({group.contacts.length})
                    </span>
                  </div>
                )}

                {showManagement && !isEditing && (
                  <div className="flex items-center gap-0.5 ml-auto" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setEditingGroup(group.id)}
                      className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                      title="Modifier le groupe"
                    >
                      <Edit2 size={10} />
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(group.id)}
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                      title="Supprimer le groupe"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                )}
              </div>
              <span />
              <span />
              <span />
            </div>

            {/* Contacts */}
            {isExpanded &&
              group.contacts.map((contact) => {
                const isEditingC = editingContact === contact.id;

                return (
                  <div
                    key={contact.id}
                    className="grid grid-cols-[1.5fr_1.2fr_1.5fr_2fr_50px_50px_50px] gap-1 px-4 py-1.5 hover:bg-slate-50 transition-colors items-center group/row"
                  >
                    {/* Role (vide, herite du groupe) */}
                    <div className="pl-5 flex items-center gap-1">
                      {showManagement && (
                        <button
                          onClick={() => handleDeleteContact(group.id, contact.id)}
                          className="opacity-0 group-hover/row:opacity-100 p-0.5 text-slate-300 hover:text-red-500 rounded transition-all"
                        >
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>

                    {/* Label */}
                    {showManagement || isEditingC ? (
                      <input
                        type="text"
                        value={contact.subLabel || ''}
                        onChange={handleContactFieldChange(group.id, contact.id, 'subLabel')}
                        placeholder="Label"
                        spellCheck
                        lang="fr"
                        className="text-[11px] px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-400 text-slate-800"
                      />
                    ) : (
                      <span className="text-[11px] text-slate-500 truncate">{contact.subLabel || ''}</span>
                    )}

                    {/* Contact name */}
                    {showManagement || isEditingC ? (
                      <input
                        type="text"
                        value={contact.name}
                        onChange={handleContactFieldChange(group.id, contact.id, 'name')}
                        placeholder="NOM Prenom"
                        spellCheck
                        lang="fr"
                        className="text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-400 text-slate-800"
                      />
                    ) : (
                      <span className="text-xs text-slate-700">{contact.name}</span>
                    )}

                    {/* Email + Telephone */}
                    {showManagement || isEditingC ? (
                      <div className="flex flex-col gap-0.5">
                        <input
                          type="email"
                          value={contact.email}
                          onChange={handleContactFieldChange(group.id, contact.id, 'email')}
                          placeholder="email@exemple.fr"
                          className="text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-400 text-slate-800"
                        />
                        <input
                          type="tel"
                          value={contact.phone || ''}
                          onChange={handleContactPhoneChange(group.id, contact.id)}
                          placeholder="06 00 00 00 00"
                          className="text-[10px] px-2 py-0.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-400 text-slate-700"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <span className="text-xs text-blue-600 truncate">{contact.email}</span>
                        {contact.phone && (
                          <span className="text-[10px] text-slate-400">{contact.phone}</span>
                        )}
                      </div>
                    )}

                    {/* CPR */}
                    <div className="flex justify-center">
                      <DiffusionCheckbox
                        checked={contact.cpr}
                        onChange={handleContactCprChange(group.id, contact.id)}
                      />
                    </div>

                    {/* Presence */}
                    <div className="flex justify-center">
                      <PresenceButton
                        value={meeting.attendance?.[contact.id] || 'absent'}
                        onChange={(v) => setAttendance(contact.id, v)}
                      />
                    </div>

                    {/* Diffusion */}
                    <div className="flex justify-center">
                      <DiffusionCheckbox
                        checked={meeting.diffusion?.[contact.id] || false}
                        onChange={(v) => setDiffusion(contact.id, v)}
                      />
                    </div>
                  </div>
                );
              })}

            {/* Ajouter contact */}
            {isExpanded && showManagement && (
              <div className="px-4 py-1.5 pl-10">
                <button
                  onClick={() => addContact(group.id)}
                  className="flex items-center gap-1 text-[11px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2 py-1 rounded transition-all"
                >
                  <UserPlus size={10} />
                  Ajouter un contact
                </button>
              </div>
            )}
          </div>
        );
      })}
        </>
      )}
    </div>
  );
};

export default CrrParticipants;
