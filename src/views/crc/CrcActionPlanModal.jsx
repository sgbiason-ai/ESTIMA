// src/views/crc/CrcActionPlanModal.jsx
//
// Plan d'actions transversal : toutes les actions datees (« POUR LE ») non
// soldees du dernier CR de chaque chantier EN COURS, en un seul echeancier
// (sections En retard / Sous 7 jours / Plus tard) filtrable par chantier et
// par responsable (pastilles PAR). Clic sur une ligne → ouvre l'affaire.
//
// Aucune lecture Firestore : s'appuie sur les chantiers deja charges par CrcView.

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, CalendarClock, AlertCircle, FolderOpen, Filter,
  MinusCircle, Circle, Loader, CheckCircle2, ChevronDown,
} from 'lucide-react';
import {
  buildActionRows, collectResponsables, filterRows,
  SECTION_ORDER, SECTION_LABELS,
} from '../../utils/crcActionPlan';
import { OBSERVATION_STATUSES } from '../../data/crrData';
import { normalizeObsText } from '../../utils/formatObsText';
import { sanitizeHtml } from '../../utils/helpers';

// "mer. 29 juil." — jour de semaine inclus : c'est un echeancier
const formatDeadline = (isoDate) => {
  if (!isoDate) return '';
  try {
    const d = new Date(isoDate + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const opts = d.getFullYear() === now.getFullYear()
      ? { weekday: 'short', day: 'numeric', month: 'short' }
      : { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
    return d.toLocaleDateString('fr-FR', opts);
  } catch { return ''; }
};

const SECTION_STYLES = {
  overdue: 'bg-red-50 text-red-700 border-red-200',
  week: 'bg-amber-50 text-amber-700 border-amber-200',
  later: 'bg-gray-50 text-gray-500 border-gray-200',
};

const STATUS_ICONS = {
  minus: MinusCircle,
  circle: Circle,
  loader: Loader,
  check: CheckCircle2,
};

// Statut editable depuis le plan. Menu explicite (et non le bouton cyclique de
// CrrObservations) : depuis un echeancier on vise « FAIT » directement, pas
// deux clics pour traverser les etats intermediaires.
const MENU_HEIGHT = 132; // 4 statuts x 27px + padding — suffit pour choisir le sens

const StatusPicker = ({ status, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  // Position fixe calculee a l'ouverture : le menu est rendu en PORTAIL car la
  // carte du tableau est en `overflow-hidden` — en absolute il y serait rogne
  // (constate en prod : menu coupe sous la carte).
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    // Le menu vit dans un portail : il n'est PAS un descendant de `ref`. Sans
    // ce second test, le mousedown (capture, donc avant le clic) fermerait le
    // menu et le choix ne partirait jamais.
    const close = (e) => {
      if (ref.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    // capture : le clic est intercepte avant le handler de ligne (ouvrir l'affaire)
    document.addEventListener('mousedown', close, true);
    // Le menu ne suit pas la page : on le ferme plutot que de le laisser flotter
    const onScroll = () => setOpen(false);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', close, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const toggle = (e) => {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const r = e.currentTarget.getBoundingClientRect();
    // Vers le haut quand le bas de fenetre est trop proche (dernieres lignes)
    const flipUp = r.bottom + MENU_HEIGHT > window.innerHeight;
    setPos({
      top: flipUp ? r.top - MENU_HEIGHT - 4 : r.bottom + 4,
      right: Math.max(8, window.innerWidth - r.right),
    });
    setOpen(true);
  };

  const st = OBSERVATION_STATUSES.find((s) => s.value === status) || OBSERVATION_STATUSES[0];
  const Icon = STATUS_ICONS[st.icon];

  const chip = (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold whitespace-nowrap ${st.bg} ${st.color}`}>
      {Icon && <Icon size={11} className={st.icon === 'loader' ? 'animate-spin' : ''} />}
      {st.label}
      {!disabled && <ChevronDown size={10} className="opacity-60" />}
    </span>
  );

  if (disabled) {
    return <span title="Seul le créateur du CRC peut modifier ce statut">{chip}</span>;
  }

  return (
    <span ref={ref} className="inline-block">
      <button onClick={toggle} className="transition-all hover:scale-105" title="Changer le statut">
        {chip}
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="fixed z-modal-stack bg-white rounded-xl shadow-lg border border-gray-200/60 py-1 min-w-[120px]"
          style={{ top: pos.top, right: pos.right }}
          onClick={(e) => e.stopPropagation()}
        >
          {OBSERVATION_STATUSES.map((s) => {
            const SIcon = STATUS_ICONS[s.icon];
            return (
              <button
                key={s.value}
                onClick={(e) => { e.stopPropagation(); setOpen(false); if (s.value !== status) onChange(s.value); }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold hover:bg-gray-50 transition-colors ${s.color} ${
                  s.value === status ? 'bg-gray-50' : ''
                }`}
              >
                {SIcon && <SIcon size={12} />}
                {s.label}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </span>
  );
};

const ParBadges = ({ value }) => {
  const names = (value || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (names.length === 0) return <span className="text-gray-300">—</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {names.map((n) => (
        <span key={n} className="px-1.5 py-0.5 rounded-md bg-gray-100 border border-gray-200/60 text-[10px] font-medium text-gray-600 whitespace-nowrap">
          {n}
        </span>
      ))}
    </span>
  );
};

export default function CrcActionPlanModal({ isOpen, onClose, chantiers, onOpenChantier, onChangeStatus, currentUserId }) {
  const [filterChantier, setFilterChantier] = useState('');
  const [filterResp, setFilterResp] = useState('');

  // Recalcule a chaque ouverture (les chantiers peuvent avoir change)
  const allRows = useMemo(
    () => (isOpen ? buildActionRows(chantiers) : []),
    [isOpen, chantiers]
  );

  const responsables = useMemo(() => collectResponsables(allRows), [allRows]);

  // Options du filtre chantier : uniquement ceux qui ont des actions
  const chantierOptions = useMemo(() => {
    const seen = new Map();
    for (const r of allRows) if (!seen.has(r.chantierId)) seen.set(r.chantierId, r.chantierNom);
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], 'fr'));
  }, [allRows]);

  const rows = useMemo(
    () => filterRows(allRows, { chantierId: filterChantier || null, responsable: filterResp || null }),
    [allRows, filterChantier, filterResp]
  );

  const overdueCount = useMemo(() => rows.filter((r) => r.section === 'overdue').length, [rows]);

  // Reinitialiser les filtres a l'ouverture ; ESC pour fermer
  useEffect(() => {
    if (!isOpen) return;
    setFilterChantier('');
    setFilterResp('');
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sections = SECTION_ORDER
    .map((s) => ({ id: s, rows: rows.filter((r) => r.section === s) }))
    .filter((s) => s.rows.length > 0);

  // Plein ecran : le plan est un tableau de travail, pas une boite de dialogue —
  // toute la largeur sert aux colonnes Observation / Par. Plus de fond
  // cliquable : fermeture par le bouton X ou Echap.
  return createPortal(
    <div className="fixed inset-0 z-modal-backdrop flex">
      <div className="bg-[#f5f5f7] w-full h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 bg-white/80 backdrop-blur-xl border-b border-gray-200/60 px-6 py-4 flex items-center gap-4 flex-wrap">
          <CalendarClock size={18} className="text-blue-500" />
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">Plan d'actions</h2>
          <div className="text-xs text-gray-400">
            {rows.length} action{rows.length > 1 ? 's' : ''}
            {(filterChantier || filterResp) && ` (filtrées sur ${allRows.length})`}
          </div>
          {overdueCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold border border-red-200">
              <AlertCircle size={10} />
              {overdueCount} en retard
            </span>
          )}
          <div className="flex-1" />

          {/* Filtres */}
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-gray-400" />
            <select
              value={filterChantier}
              onChange={(e) => setFilterChantier(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-gray-100 border border-gray-200/60 text-xs focus:outline-none focus:border-blue-400 max-w-[200px]"
            >
              <option value="">Tous les chantiers</option>
              {chantierOptions.map(([id, nom]) => (
                <option key={id} value={id}>{nom}</option>
              ))}
            </select>
            <select
              value={filterResp}
              onChange={(e) => setFilterResp(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-gray-100 border border-gray-200/60 text-xs focus:outline-none focus:border-blue-400 max-w-[170px]"
            >
              <option value="">Tous les responsables</option>
              {responsables.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all"
            title="Fermer (Echap)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tableau */}
        <div className="flex-1 overflow-y-auto p-6">
          {rows.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 py-20">
              <CalendarClock size={48} strokeWidth={1.5} className="mb-3 opacity-50" />
              <p className="text-sm">
                {allRows.length === 0
                  ? 'Aucune action datée à venir sur les chantiers en cours.'
                  : 'Aucune action ne correspond à ces filtres.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200/60 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-200/60">
                    <th className="px-4 py-2.5 font-semibold w-[110px]">Pour le</th>
                    <th className="px-3 py-2.5 font-semibold w-[80px]">N°</th>
                    <th className="px-3 py-2.5 font-semibold w-[220px] min-w-[180px]">Chantier</th>
                    <th className="px-3 py-2.5 font-semibold min-w-[320px]">Observation</th>
                    <th className="px-3 py-2.5 font-semibold w-[150px]">Par</th>
                    <th className="px-4 py-2.5 font-semibold w-[90px]">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((section) => (
                    <React.Fragment key={section.id}>
                      <tr>
                        <td colSpan={6} className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wide border-y ${SECTION_STYLES[section.id]}`}>
                          {SECTION_LABELS[section.id]} · {section.rows.length}
                        </td>
                      </tr>
                      {section.rows.map((r) => (
                        <tr
                          key={r.key}
                          onClick={() => onOpenChantier(r)}
                          className="border-b border-gray-100 last:border-0 hover:bg-blue-50/50 cursor-pointer transition-colors"
                          title={`Aller à l'observation ${r.number || ''} — « ${r.chantierNom} » (CR n°${r.meetingNumber})`}
                        >
                          <td className="px-4 py-2.5 whitespace-nowrap align-top">
                            <div className={`font-semibold ${r.section === 'overdue' ? 'text-red-700' : 'text-gray-800'}`}>
                              {formatDeadline(r.deadline)}
                            </div>
                            {r.section === 'overdue' && (
                              <div className="text-[10px] text-red-500">
                                {r.daysLate} j de retard
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[10px] text-gray-500 whitespace-nowrap align-top">{r.number || '—'}</td>
                          <td className="px-3 py-2.5 align-top">
                            {/* Nom complet sur plusieurs lignes : tronquer masquait
                                la tranche/le lot, qui distingue deux affaires voisines. */}
                            <div className="flex items-start gap-1.5 text-gray-700 font-medium">
                              <FolderOpen size={11} className="shrink-0 text-gray-300 mt-0.5" />
                              <span className="break-words">{r.chantierNom}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-gray-600 align-top">
                            {r.text ? (
                              // Le texte d'observation est du HTML (gras, listes,
                              // surlignage — cf. formatObsText) : le rendre tel quel
                              // afficherait les balises. Affiche en entier, avec
                              // retour a la ligne — l'ecran est en plein ecran, la
                              // troncature cachait la fin des consignes.
                              <div
                                className="break-words whitespace-normal [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-4 [&_ol]:pl-4 [&_li]:list-item"
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(normalizeObsText(r.text)) }}
                              />
                            ) : (
                              <span className="text-gray-300">(sans texte)</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 align-top"><ParBadges value={r.actionBy} /></td>
                          <td className="px-4 py-2.5 align-top">
                            <StatusPicker
                              status={r.status}
                              disabled={!onChangeStatus || r.ownerId !== currentUserId}
                              onChange={(s) => onChangeStatus(r, s)}
                            />
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
