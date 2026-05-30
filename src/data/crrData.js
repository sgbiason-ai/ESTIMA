// src/data/crrData.js
//
// Donnees par defaut pour le module Compte Rendu de Reunion (CRR).
// Categories d'observations, texte legal, et structure initiale.

export const DEFAULT_CATEGORIES = [
  'Administratif',
  'Planning - DESC',
  'Travaux',
];

export const MEETING_TYPES = [
  { value: 'preparation', label: 'Réunion de Préparation' },
  { value: 'chantier',    label: 'Réunion de chantier' },
];

export const PRESENCE_OPTIONS = [
  { value: 'present',       label: 'Présent',       short: 'P' },
  { value: 'excused',       label: 'Excusé',        short: 'E' },
  { value: 'absent',        label: 'Absent',        short: 'A' },
  { value: 'not_summoned',  label: 'Non convoqué',  short: 'NC' },
];

export const OBSERVATION_STATUSES = [
  { value: 'empty',       label: 'Vide',     color: 'text-slate-400',   bg: 'bg-slate-50',   icon: 'minus' },
  { value: 'open',        label: 'Ouvert',   color: 'text-orange-500',  bg: 'bg-orange-50',  icon: 'circle' },
  { value: 'in_progress', label: 'En cours', color: 'text-blue-500',    bg: 'bg-blue-50',    icon: 'loader' },
  { value: 'done',        label: 'FAIT',     color: 'text-emerald-500', bg: 'bg-emerald-50', icon: 'check' },
];

export const LEGAL_TEXT = `OBSERVATIONS SUR LE COMPTE-RENDU : Il est rappelé aux entreprises que les observations portées sur les comptes rendus ne sont que la confirmation des ordres donnés soit au cours de visites de chantier, soit au cours des rendez-vous de chantier et qu'il leur appartient de les appliquer immédiatement. La date de réception du présent compte rendu ne peut en aucun cas être une excuse aux retards apportés dans la réalisation des travaux. Le présent compte rendu est considéré comme définitivement approuvé s'il n'a fait l'objet d'observations écrites dans un délai qui expire 48 heures après la date de diffusion.`;

// Palette de couleurs pour les pastilles de groupes participants
// rgb = couleurs pour le PDF (jsPDF), les classes Tailwind pour le preview/UI
export const GROUP_COLORS = [
  { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-300',    dot: 'bg-blue-500',    rgb: [59,130,246],  rgbBg: [219,234,254] },
  { bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-300',   dot: 'bg-amber-500',   rgb: [245,158,11],  rgbBg: [254,243,199] },
  { bg: 'bg-purple-100',  text: 'text-purple-700',  border: 'border-purple-300',  dot: 'bg-purple-500',  rgb: [168,85,247],  rgbBg: [243,232,255] },
  { bg: 'bg-rose-100',    text: 'text-rose-700',    border: 'border-rose-300',    dot: 'bg-rose-500',    rgb: [244,63,94],   rgbBg: [255,228,230] },
  { bg: 'bg-cyan-100',    text: 'text-cyan-700',    border: 'border-cyan-300',    dot: 'bg-cyan-500',    rgb: [6,182,212],   rgbBg: [207,250,254] },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500', rgb: [16,185,129],  rgbBg: [209,250,229] },
  { bg: 'bg-orange-100',  text: 'text-orange-700',  border: 'border-orange-300',  dot: 'bg-orange-500',  rgb: [249,115,22],  rgbBg: [255,237,213] },
  { bg: 'bg-indigo-100',  text: 'text-indigo-700',  border: 'border-indigo-300',  dot: 'bg-indigo-500',  rgb: [99,102,241],  rgbBg: [224,231,255] },
];

export const getGroupColor = (index) => GROUP_COLORS[index % GROUP_COLORS.length];

// Abbreviations courtes (5 car max) pour les noms de groupes
const GROUP_ABBREVS = {
  "maitre d'ouvrage": 'MOA',
  "maitrise d'ouvrage": 'MOA',
  "maitre d'oeuvre": 'MOE',
  "maitrise d'oeuvre": 'MOE',
  'concessionnaires': 'CONC',
  'concessionnaire': 'CONC',
  'entreprises': 'ENT',
  'entreprise': 'ENT',
};

/**
 * Retourne une abbreviation de 5 caracteres max.
 * Cherche d'abord dans le dictionnaire, sinon tronque intelligemment.
 */
export const abbreviateGroup = (name) => {
  if (!name) return '';
  const key = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[']/g, "'");
  if (GROUP_ABBREVS[key]) return GROUP_ABBREVS[key];
  // Deja court → tel quel
  if (name.length <= 5) return name.toUpperCase();
  // Prendre les initiales des mots (ex: "IMS Networks" → "IMSN")
  const words = name.trim().split(/\s+/);
  if (words.length > 1) {
    const initials = words.map((w) => w[0]).join('').toUpperCase();
    if (initials.length <= 5) return initials;
  }
  // Dernier recours : tronquer a 5 caracteres
  return name.slice(0, 5).toUpperCase();
};

export const DEFAULT_PARTICIPANT_GROUPS = [
  {
    id: 'g_moa',
    name: "Maître d'ouvrage",
    subLabel: '',
    contacts: [],
  },
  {
    id: 'g_moe',
    name: "Maître d'oeuvre",
    subLabel: '',
    contacts: [],
  },
  {
    id: 'g_sps',
    name: 'SPS',
    subLabel: '',
    contacts: [],
  },
  {
    id: 'g_conc',
    name: 'Concessionnaires',
    subLabel: '',
    contacts: [],
  },
  {
    id: 'g_ent',
    name: 'Entreprises',
    subLabel: '',
    contacts: [],
  },
];

// Genere un nouvel ID unique
export const generateCrrId = () =>
  `crr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

// Cree une reunion vide
export const createEmptyMeeting = (number) => ({
  id: generateCrrId(),
  number,
  type: 'preparation',
  date: new Date().toISOString().split('T')[0],
  nextMeeting: {
    lieu: '',
    heure: '',
    date: '',
  },
  attendance: {},
  diffusion: {},
  observations: [],
});

// Cree une observation vide
export const createEmptyObservation = (category) => ({
  id: `obs_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
  category,
  emitter: '',
  date: new Date().toISOString().split('T')[0],
  text: '',
  actionBy: '',
  actionDeadline: '',
  status: 'empty',
  originMeetingNumber: null,
  images: [],
});
