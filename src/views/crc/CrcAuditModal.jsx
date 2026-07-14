// src/views/crc/CrcAuditModal.jsx
// Modal d'audit (diff entre 2 comptes rendus CRC)
import React from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { renderFormattedText, stripHtml } from '../../utils/formatObsText';
import { flattenGroupContacts } from '../../utils/crrParticipantTree';

const statusLabel = (s) => s === 'done' ? 'FAIT' : s === 'in_progress' ? 'En cours' : 'Ouvert';
const statusColor = (s) => s === 'done' ? 'text-emerald-700 bg-emerald-50' : s === 'in_progress' ? 'text-blue-700 bg-blue-50' : 'text-amber-700 bg-amber-50';

const presenceLabel = (s) => s === 'present' ? 'Present' : s === 'excused' ? 'Excuse' : 'Absent';
const presenceColor = (s) => s === 'present' ? 'text-emerald-700 bg-emerald-50' : s === 'excused' ? 'text-amber-700 bg-amber-50' : 'text-slate-500 bg-slate-50';

export default function CrcAuditModal({ isOpen, onClose, currentMeeting, previousMeeting, participantGroups }) {
  if (!isOpen || !currentMeeting || !previousMeeting) return null;

  // ── AUDIT PRESENCES ──
  const prevAtt = previousMeeting.attendance || {};
  const currAtt = currentMeeting.attendance || {};

  const allContacts = [];
  for (const group of (participantGroups || [])) {
    // flattenGroupContacts descend dans les sous-groupes ET tolère l'absence
    // de tableau contacts (données legacy / archives importées).
    for (const contact of flattenGroupContacts(group)) {
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

  // ── AUDIT OBSERVATIONS ──
  const prevObs = previousMeeting.observations || [];
  const currObs = currentMeeting.observations || [];

  const matched = new Set();
  const newObs = [];
  const changedObs = [];
  const unchangedCount = { value: 0 };

  for (const obs of currObs) {
    let prev = null;

    if (obs.originObsId) {
      prev = prevObs.find((p) => p.id === obs.originObsId && !matched.has(p.id));
    }

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
                    <span className="text-xs text-slate-700 line-clamp-2">{stripHtml(obs.text) || '(vide)'}</span>
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
                      <span className="text-xs text-slate-700 line-clamp-1">{stripHtml(obs.text) || '(vide)'}</span>
                    </div>
                    <div className="space-y-1 ml-2">
                      {changes.map((c, i) => {
                        const isHtmlField = c.field === 'Texte';
                        if (isHtmlField) {
                          // Layout vertical pour le champ Texte (HTML potentiellement multi-lignes)
                          return (
                            <div key={i} className="text-[10px] text-slate-600 space-y-1">
                              <div className="font-medium text-slate-500">{c.field} :</div>
                              <div className="px-2 py-1 bg-red-50/70 border-l-2 border-red-300 rounded-r text-red-700 line-through">
                                {renderFormattedText(c.from) || <span className="italic text-slate-400">(vide)</span>}
                              </div>
                              <div className="px-2 py-1 bg-emerald-50/70 border-l-2 border-emerald-400 rounded-r text-slate-800">
                                {renderFormattedText(c.to) || <span className="italic text-slate-400">(vide)</span>}
                              </div>
                            </div>
                          );
                        }
                        // Layout inline pour les autres champs (Statut, Echeance, Responsable)
                        return (
                          <div key={i} className="text-[10px] text-slate-600">
                            <span className="font-medium text-slate-500">{c.field} :</span>{' '}
                            <span className="line-through text-red-400">{c.from || '—'}</span>
                            {' → '}
                            <span className="font-semibold text-blue-700">{c.to || '—'}</span>
                          </div>
                        );
                      })}
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
                    <span className="text-xs text-slate-500 line-through line-clamp-2">{stripHtml(obs.text) || '(vide)'}</span>
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
}
