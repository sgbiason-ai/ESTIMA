// src/views/expenseNotes/MonthCalendarView.jsx
// Vue calendrier mensuelle des trajets (alternative a la liste).
//
// - Grille 7 colonnes (lun -> dim), jours du mois + debordements grises.
// - Chaque jour : pastilles motif (getMotifColor) + km/jour, teinte weekend/ferie.
// - Clic sur un jour : popover listant les trajets du jour + bouton d'ajout.
// - Glisser-deposer d'une pastille vers un autre jour : change la date du trajet
//   (intra-mois uniquement — les jours hors mois ne sont pas des cibles).
//
// Aucune logique de calcul ici : on consomme `tripsWithAmount` deja calcule par
// la vue mois (effectiveKm + amount par trajet).

import React, { useMemo, useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, Trash2, Copy, Pencil, MoveRight, X } from 'lucide-react';
import { getMotifColor } from '../../utils/motifColors';
import { getHolidayLabel, getWeekendName } from '../../utils/frenchHolidays';

const WEEKDAYS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];

const formatEur = (n) => {
  if (!n) return '0 €';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);
};
const formatKm = (n) => `${(n || 0).toLocaleString('fr-FR')} km`;

const isoOf = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const formatDateLong = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
};

const todayIso = () => isoOf(new Date());

const MonthCalendarView = ({
  month,                // 'YYYY-MM'
  tripsWithAmount,      // [{ id, date, motif, effectiveKm, amount, departure, arrival, roundTrip, waypoints }]
  onEditTrip,           // (trip) => void
  onAddTripForDate,     // (isoDate) => void
  onMoveTrip,           // (tripId, newIsoDate) => void
  onCopyTrip,           // (tripId, newIsoDate) => void
  onDeleteTrip,         // (trip) => void
  onDuplicateTrip,      // (trip) => void
}) => {
  const [popover, setPopover] = useState(null);       // { date, top, left }
  const [dropAction, setDropAction] = useState(null); // { tripId, toDate, top, left } — choix deplacer/dupliquer

  const [yStr, mStr] = month.split('-');
  const year = Number(yStr);
  const monthIdx = Number(mStr) - 1;

  // ── Construction de la grille (lundi en premier) ──────────────────────────
  const cells = useMemo(() => {
    const first = new Date(year, monthIdx, 1);
    const leadBlanks = (first.getDay() + 6) % 7; // getDay() 0=dim..6=sam -> lundi=0
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
    const totalCells = Math.ceil((leadBlanks + daysInMonth) / 7) * 7;
    const start = new Date(year, monthIdx, 1 - leadBlanks);
    const out = [];
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push(d);
    }
    return out;
  }, [year, monthIdx]);

  // ── Regroupement des trajets par date ─────────────────────────────────────
  const tripsByDate = useMemo(() => {
    const map = {};
    for (const t of tripsWithAmount) {
      if (!t.date) continue;
      (map[t.date] ||= []).push(t);
    }
    return map;
  }, [tripsWithAmount]);

  // Legende couleurs : motifs distincts presents dans le mois (couleur = type)
  const motifLegend = useMemo(() => {
    const map = new Map();
    for (const t of tripsWithAmount) {
      const m = (t.motif || '').trim();
      if (!m || map.has(m)) continue;
      map.set(m, getMotifColor(m));
    }
    return [...map.entries()];
  }, [tripsWithAmount]);

  const today = todayIso();

  // Fermeture des popovers sur Echap
  useEffect(() => {
    if (!popover && !dropAction) return;
    const onKey = (e) => { if (e.key === 'Escape') { setPopover(null); setDropAction(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [popover, dropAction]);

  const openDay = (iso, e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const POP_W = 300;
    const POP_H = 280;
    let left = r.left;
    if (left + POP_W > window.innerWidth - 12) left = window.innerWidth - POP_W - 12;
    if (left < 12) left = 12;
    let top = r.bottom + 6;
    if (top + POP_H > window.innerHeight - 12) top = Math.max(12, r.top - POP_H - 6);
    setPopover({ date: iso, top, left });
  };

  const handleDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return; // meme jour : rien a faire

    // On ne mute pas tout de suite : on propose Deplacer / Dupliquer au point de depot.
    // Ancrage sur la cellule du jour cible (le drag ne fournit pas les coords du curseur).
    const cell = document.querySelector(`[data-day="${destination.droppableId}"]`);
    const POP_W = 212;
    const POP_H = 116;
    let top = window.innerHeight / 2;
    let left = window.innerWidth / 2;
    if (cell) {
      const r = cell.getBoundingClientRect();
      left = Math.min(Math.max(12, r.left), window.innerWidth - POP_W - 12);
      top = Math.min(r.bottom + 6, window.innerHeight - POP_H - 12);
    }
    setDropAction({ tripId: draggableId, toDate: destination.droppableId, top, left });
  };

  const popTrips = popover ? (tripsByDate[popover.date] || []) : [];
  const popHoliday = popover ? getHolidayLabel(popover.date) : null;
  const popWeekend = popover && !popHoliday ? getWeekendName(popover.date) : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-4">
      {/* En-tete jours de la semaine */}
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center py-1">
            {w}
          </div>
        ))}
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((d) => {
            const iso = isoOf(d);
            const inMonth = d.getMonth() === monthIdx;
            const dayTrips = tripsByDate[iso] || [];
            const holiday = inMonth ? getHolidayLabel(iso) : null;
            const weekend = inMonth && !holiday ? getWeekendName(iso) : null;
            const isToday = iso === today;
            const dayKm = dayTrips.reduce((s, t) => s + (t.effectiveKm || 0), 0);

            // Cellule hors mois : inerte (ni clic, ni cible de drop)
            if (!inMonth) {
              return (
                <div
                  key={iso}
                  className="min-h-[92px] rounded-xl border border-dashed border-gray-100 bg-transparent p-1.5"
                >
                  <span className="text-[11px] font-medium text-gray-300 tabular-nums">{d.getDate()}</span>
                </div>
              );
            }

            const dayTint = holiday ? 'bg-rose-50/40' : weekend ? 'bg-amber-50/40' : 'bg-white';
            const dayNumColor = holiday ? 'text-rose-700' : weekend ? 'text-amber-700' : 'text-gray-600';

            return (
              <Droppable droppableId={iso} key={iso}>
                {(drop, dropSnap) => (
                  <div
                    ref={drop.innerRef}
                    {...drop.droppableProps}
                    data-day={iso}
                    onClick={(e) => openDay(iso, e)}
                    className={`min-h-[92px] rounded-xl border p-1.5 flex flex-col gap-1 cursor-pointer transition-colors ${
                      dropSnap.isDraggingOver
                        ? 'border-blue-300 bg-blue-50/50 ring-2 ring-blue-100'
                        : isToday
                          ? 'border-amber-300 ring-2 ring-amber-100 ' + dayTint
                          : 'border-gray-200/70 hover:border-gray-300 ' + dayTint
                    }`}
                    title={`${formatDateLong(iso)}${holiday ? ` — ${holiday}` : weekend ? ` — ${weekend}` : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-bold tabular-nums ${dayNumColor}`}>{d.getDate()}</span>
                      {(holiday || weekend) && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${holiday ? 'bg-rose-500' : 'bg-amber-500'}`}
                          title={holiday || weekend}
                        />
                      )}
                    </div>

                    <div className="flex flex-col gap-1 min-h-0">
                      {dayTrips.map((t, idx) => {
                        const color = getMotifColor(t.motif);
                        const steps = (t.waypoints || []).map((w) => w?.label).filter(Boolean);
                        const dest = t.arrival || t.motif || 'Trajet';
                        const pathTitle = [t.departure || '?', ...steps, t.arrival || '?'].join(' → ');
                        return (
                          <Draggable draggableId={t.id} index={idx} key={t.id}>
                            {(prov, snap) => (
                              <div
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                {...prov.dragHandleProps}
                                className={`px-1.5 py-0.5 rounded-md border cursor-grab active:cursor-grabbing ${color.tag} ${
                                  snap.isDragging ? 'shadow-lg ring-2 ring-blue-200 rotate-1' : ''
                                }`}
                                title={`${pathTitle} · ${formatKm(t.effectiveKm)}${t.roundTrip ? ' · A/R' : ''}${t.motif ? ` · ${t.motif}` : ''}`}
                              >
                                <span className="block text-[10px] font-bold leading-tight truncate">{dest}</span>
                                {steps.length > 0 && (
                                  <span className="block text-[8px] font-semibold leading-tight truncate opacity-70">
                                    via {steps.join(' · ')}
                                  </span>
                                )}
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {drop.placeholder}
                    </div>

                    {dayKm > 0 && (
                      <span className="mt-auto text-[10px] text-gray-400 tabular-nums text-right">
                        {formatKm(dayKm)}
                      </span>
                    )}
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>

      <div className="mt-3 flex items-center justify-between gap-x-4 gap-y-2 flex-wrap">
        {motifLegend.length > 0 ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Type</span>
            {motifLegend.map(([m, color]) => (
              <span key={m} className="inline-flex items-center gap-1 text-[10px] text-gray-600">
                <span className={`w-2.5 h-2.5 rounded-sm border ${color.tag}`} />
                {m}
              </span>
            ))}
          </div>
        ) : <span />}
        <p className="text-[11px] text-gray-400 flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1"><MoveRight size={12} /> Glissez pour déplacer</span>
          <span className="text-gray-300">·</span>
          <span>Cliquez un jour pour voir ou ajouter</span>
        </p>
      </div>

      {/* Popover du jour */}
      {popover && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPopover(null)} />
          <div
            className="fixed z-50 w-[300px] bg-white rounded-2xl shadow-2xl border border-gray-200/80 overflow-hidden"
            style={{ top: popover.top, left: popover.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
              <div className="min-w-0">
                <div className="text-xs font-bold text-gray-900 capitalize truncate">{formatDateLong(popover.date)}</div>
                {(popHoliday || popWeekend) && (
                  <div className={`text-[10px] font-semibold ${popHoliday ? 'text-rose-600' : 'text-amber-600'}`}>
                    {popHoliday || popWeekend}
                  </div>
                )}
              </div>
              <button
                onClick={() => setPopover(null)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 shrink-0"
                title="Fermer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="max-h-[220px] overflow-y-auto p-2 space-y-1.5">
              {popTrips.length === 0 ? (
                <div className="text-[11px] text-gray-400 italic px-1 py-3 text-center">Aucun trajet ce jour-là.</div>
              ) : (
                popTrips.map((t) => {
                  const color = getMotifColor(t.motif);
                  const steps = (t.waypoints || []).map((w) => w?.label).filter(Boolean);
                  const route = [t.departure || '?', ...steps, t.arrival || '?'].join(' → ');
                  return (
                    <div
                      key={t.id}
                      className="group flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      <button
                        onClick={() => { onEditTrip?.(t); setPopover(null); }}
                        className="flex-1 min-w-0 flex flex-col items-start text-left"
                        title="Modifier ce trajet"
                      >
                        <span className="flex items-center gap-1.5 w-full">
                          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold border ${color.tag}`}>
                            {t.motif || 'Sans motif'}
                          </span>
                          <span className="text-[11px] font-bold text-emerald-700 tabular-nums ml-auto">{formatEur(t.amount)}</span>
                        </span>
                        <span className="text-[10px] text-gray-500 truncate w-full mt-0.5" title={route}>
                          {route} · {formatKm(t.effectiveKm)}{t.roundTrip ? ' (A/R)' : ''}
                        </span>
                      </button>
                      <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => { onDuplicateTrip?.(t); setPopover(null); }}
                          className="p-1 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600"
                          title="Dupliquer"
                        >
                          <Copy size={12} />
                        </button>
                        <button
                          onClick={() => { onEditTrip?.(t); setPopover(null); }}
                          className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                          title="Modifier"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => onDeleteTrip?.(t)}
                          className="p-1 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"
                          title="Supprimer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-gray-100 p-2">
              <button
                onClick={() => { onAddTripForDate?.(popover.date); setPopover(null); }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-colors text-[11px] font-bold uppercase tracking-wider"
              >
                <Plus size={13} />
                Ajouter un trajet
              </button>
            </div>
          </div>
        </>
      )}

      {/* Choix au depot d'un trajet : deplacer ou dupliquer */}
      {dropAction && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setDropAction(null)} />
          <div
            className="fixed z-50 w-[212px] bg-white rounded-2xl shadow-2xl border border-gray-200/80 overflow-hidden"
            style={{ top: dropAction.top, left: dropAction.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2 border-b border-gray-100 text-[11px] text-gray-500">
              Vers le <span className="font-bold text-gray-900 capitalize">{formatDateLong(dropAction.toDate)}</span>
            </div>
            <div className="p-1.5 flex flex-col">
              <button
                onClick={() => { onMoveTrip?.(dropAction.tripId, dropAction.toDate); setDropAction(null); }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 text-left text-xs font-semibold text-gray-700 transition-colors"
              >
                <MoveRight size={14} className="text-blue-500" />
                Déplacer ici
              </button>
              <button
                onClick={() => { onCopyTrip?.(dropAction.tripId, dropAction.toDate); setDropAction(null); }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 text-left text-xs font-semibold text-gray-700 transition-colors"
              >
                <Copy size={14} className="text-emerald-500" />
                Dupliquer ici
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MonthCalendarView;
