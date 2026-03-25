import { cleanText } from '../../../utils/helpers';

// ── RÉSOLUTION DE LA DESCRIPTION BRUTE ───────────────────────────────────────
// Cherche d'abord une description partielle (split), puis dans articlesDb,
// puis dans l'item lui-même.

export const getRawDescription = (item, articlesDb = []) => {
  if (item.partialDescription) return item.partialDescription;
  const searchName = cleanText(item.designation || '').toLowerCase().trim();
  const originalItem = articlesDb.find(
    (dbItem) =>
      (item.articleId && dbItem.id === item.articleId) ||
      cleanText(dbItem.designation || '').toLowerCase().trim() === searchName
  );
  return originalItem?.description || item.description || '';
};

// ── NORMALISATION HTML ────────────────────────────────────────────────────────
// Si la description ne contient aucun tag HTML, on convertit les \n en <br/>.

export const normalizeToHtml = (raw) => {
  const str = raw || '';
  const hasHtmlTags = /<[a-z][\s\S]*>/i.test(str);
  return hasHtmlTags ? str : str.replace(/\n/g, '<br/>');
};

// ── ÉCHAPPEMENT HTML (mesures DOM) ───────────────────────────────────────────
export const escapeHtml = (s) =>
  (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
