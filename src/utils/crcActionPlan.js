// src/utils/crcActionPlan.js
//
// Plan d'actions transversal CRC : croise tous les chantiers EN COURS
// (non archives, cf. crcChantierStatus) avec les observations DATEES et non
// soldees de leur DERNIER compte rendu.
//
// Pourquoi le dernier CR uniquement : les observations non soldees sont
// reportees de CR en CR (useCrrManager.createMeeting) — le dernier CR est donc
// l'etat courant du chantier ; remonter plus loin dupliquerait chaque action.
//
// Conventions reprises du module (CrrObservations, CrcView.overdueCount) :
// dates ISO YYYY-MM-DD comparees en chaines, « non soldee » = status !== 'done'.
// Partage desktop (CrcActionPlanModal) / mobile (useMobileCrc) — aucune
// dependance UI ici.

import { isChantierArchived } from './crcChantierStatus';
import { obsDisplayNumber } from '../data/crrData';

/** Date du jour en ISO local YYYY-MM-DD (pas d'UTC : minuit local fait foi). */
export const todayISO = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

/** ISO + n jours. */
const addDaysISO = (iso, days) => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Jours d'ecart signes entre deux ISO (b - a). */
export const diffDays = (a, b) =>
  Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);

export const SECTION_ORDER = ['overdue', 'week', 'later'];

export const SECTION_LABELS = {
  overdue: 'En retard',
  week: 'Sous 7 jours',
  later: 'Plus tard',
};

/** Section d'une echeance : passee, sous 7 jours (aujourd'hui inclus), au-dela. */
export const classifyDeadline = (deadline, today = todayISO()) => {
  if (deadline < today) return 'overdue';
  if (deadline <= addDaysISO(today, 7)) return 'week';
  return 'later';
};

/**
 * Lignes du plan d'actions, triees par echeance croissante (les retards les
 * plus anciens en tete). Une ligne = une observation datee non soldee du
 * dernier CR d'un chantier en cours.
 *
 * @param {Array} chantiers docs crr complets ({ crrConfig, crrMeetings, ... })
 * @param {string} [today] ISO — injectable pour les tests
 */
export const buildActionRows = (chantiers = [], today = todayISO()) => {
  const rows = [];
  for (const chantier of chantiers) {
    if (isChantierArchived(chantier)) continue;
    const meetings = chantier.crrMeetings || [];
    if (meetings.length === 0) continue;
    const last = meetings[meetings.length - 1];
    const codes = chantier.crrConfig?.categoryCodes || {};
    const nom = chantier.crrConfig?.chantierInfo?.nom || 'Sans nom';

    for (const obs of last.observations || []) {
      if (!obs.actionDeadline || obs.status === 'done') continue;
      rows.push({
        key: `${chantier.id}_${obs.id}`,
        chantierId: chantier.id,
        chantierNom: nom,
        obsId: obs.id,
        number: obsDisplayNumber(obs, codes),
        category: obs.category || '',
        text: obs.text || '',
        actionBy: obs.actionBy || '',
        deadline: obs.actionDeadline,
        status: obs.status,
        section: classifyDeadline(obs.actionDeadline, today),
        // > 0 = jours de retard ; <= 0 = jours restants (en valeur absolue)
        daysLate: diffDays(obs.actionDeadline, today),
        meetingNumber: last.number,
      });
    }
  }
  rows.sort((a, b) => a.deadline.localeCompare(b.deadline) || a.chantierNom.localeCompare(b.chantierNom));
  return rows;
};

/** Noms de responsables (pastilles PAR) presents dans les lignes, tries. */
export const collectResponsables = (rows) => {
  const names = new Set();
  for (const r of rows) {
    for (const n of (r.actionBy || '').split(',').map((s) => s.trim()).filter(Boolean)) {
      names.add(n);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'fr'));
};

/** Filtre par chantier (id ou null) et responsable (nom de pastille ou null). */
export const filterRows = (rows, { chantierId = null, responsable = null } = {}) =>
  rows.filter((r) => {
    if (chantierId && r.chantierId !== chantierId) return false;
    if (responsable) {
      const names = (r.actionBy || '').split(',').map((s) => s.trim());
      if (!names.includes(responsable)) return false;
    }
    return true;
  });
