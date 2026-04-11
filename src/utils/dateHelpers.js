// src/utils/dateHelpers.js
// Centralise le formatage de dates FR — remplace 15+ copies locales

// Re-export du splitter ISO (YYYY-MM-DD → DD/MM/YYYY)
export { formatDateFr, formatDateLong } from './pdf/pdfSharedHelpers';

/**
 * Formate une date (Date object ou ISO string) en français.
 * @param {Date|string} input
 * @param {object} opts
 * @param {string} opts.fallback  Valeur si input vide/invalide (défaut: '')
 * @param {'short'|'medium'|'long'} opts.format  'short' = DD/MM/YYYY, 'medium' = DD MMM YY, 'long' = jour complet
 */
export const formatDateLocale = (input, { fallback = '', format = 'short' } = {}) => {
  if (!input) return fallback;
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return fallback;
  const options = format === 'long'
    ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
    : format === 'medium'
    ? { day: '2-digit', month: 'short', year: '2-digit' }
    : { day: '2-digit', month: '2-digit', year: 'numeric' };
  return d.toLocaleDateString('fr-FR', options);
};
