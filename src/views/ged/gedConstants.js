// src/views/ged/gedConstants.js
// Constantes partagées de la GED (Gestion Électronique des Documents émis).

// Phases d'un projet, dans l'ordre chronologique.
export const PHASES = ['ESQ', 'AVP', 'PRO', 'DCE', 'DCE+', 'EXE'];

// Styles Tailwind par phase (badges, pastilles).
export const PHASE_STYLES = {
  ESQ:    { bg: 'bg-purple-500',  light: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200' },
  AVP:    { bg: 'bg-amber-500',   light: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  PRO:    { bg: 'bg-blue-500',    light: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  DCE:    { bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'DCE+': { bg: 'bg-teal-500',    light: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200' },
  EXE:    { bg: 'bg-red-500',     light: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
};

export const getPhaseStyle = (phase) => PHASE_STYLES[phase] || PHASE_STYLES.DCE;

// Format date FR long (ex: "lundi 28 mai 2026 à 14:32").
export const formatDateLong = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

// Format date FR court (ex: "28 mai 2026").
export const formatDateShort = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};
