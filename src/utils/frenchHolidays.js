// src/utils/frenchHolidays.js
// Jours feries francais (metropole) : 11 jours fixes/mobiles.
//
// Fixes : 1er janvier, 1er mai, 8 mai, 14 juillet, 15 aout, 1er novembre,
//          11 novembre, 25 decembre.
// Mobiles (bases sur Paques, calcul de Gauss) : Lundi de Paques, Ascension
//          (J+39), Lundi de Pentecote (J+50).
//
// API :
//   - getFrenchHolidays(year) : Map<'YYYY-MM-DD', label>
//   - getHolidayLabel(isoDate) : string | null
//   - isWeekend(isoDate)       : boolean

const HOLIDAY_CACHE = new Map(); // year -> Map<isoDate, label>

/**
 * Date de Paques (dimanche) pour une annee donnee.
 * Algorithme anonyme gregorien (Meeus).
 */
function easterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const fmtIso = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const addDays = (d, n) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

export function getFrenchHolidays(year) {
  const y = Number(year);
  if (HOLIDAY_CACHE.has(y)) return HOLIDAY_CACHE.get(y);

  const map = new Map();
  // Fixes
  map.set(`${y}-01-01`, "Jour de l'an");
  map.set(`${y}-05-01`, 'Fête du Travail');
  map.set(`${y}-05-08`, 'Victoire 1945');
  map.set(`${y}-07-14`, 'Fête nationale');
  map.set(`${y}-08-15`, 'Assomption');
  map.set(`${y}-11-01`, 'Toussaint');
  map.set(`${y}-11-11`, 'Armistice 1918');
  map.set(`${y}-12-25`, 'Noël');

  // Mobiles (Paques + offsets)
  const easter = easterDate(y);
  map.set(fmtIso(addDays(easter, 1)), 'Lundi de Pâques');
  map.set(fmtIso(addDays(easter, 39)), 'Ascension');
  map.set(fmtIso(addDays(easter, 50)), 'Lundi de Pentecôte');

  HOLIDAY_CACHE.set(y, map);
  return map;
}

/** Retourne le label du jour ferie pour cette date ISO, ou null si ce n'en est pas un. */
export function getHolidayLabel(isoDate) {
  if (!isoDate || isoDate.length < 10) return null;
  const year = parseInt(isoDate.slice(0, 4), 10);
  if (!Number.isFinite(year)) return null;
  const map = getFrenchHolidays(year);
  return map.get(isoDate) || null;
}

/** True si la date ISO tombe un samedi ou un dimanche. */
export function isWeekend(isoDate) {
  if (!isoDate) return false;
  const d = new Date(isoDate + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return false;
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

/** Nom court du jour de semaine (Sam, Dim) pour une date ISO de weekend. */
export function getWeekendName(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  const dow = d.getDay();
  if (dow === 6) return 'Samedi';
  if (dow === 0) return 'Dimanche';
  return null;
}
