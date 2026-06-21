// src/views/estimaTp/sousDetail/sdFormat.js
// ESTIMA TP — helpers purs du sous-détail (formats + aplatissement des articles).
import { refMapOf } from '../bordereau/tpBordereauModel';

export const fmt = (n) => `${Math.round(Number(n || 0)).toLocaleString('fr-FR')} €`;
export const fmt2 = (n) => `${(Number(n || 0)).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/** Aplati les articles du bordereau, avec n° (refMap), chapitre et présence de sous-détail. */
export function flattenArticles(chapters) {
  const refMap = refMapOf(chapters || []);
  const out = [];
  const walk = (nodes, chapterTitle) => {
    (nodes || []).forEach(n => {
      if (!n) return;
      if (n.type === 'item') {
        out.push({
          id: n.id, num: refMap.get(n.id) || '—',
          designation: n.designation || 'Article sans nom',
          unit: n.unit || '', qty: Number(n.qty || 0),
          price: Number(n.price || 0), hasDetail: !!n.detail, chapterTitle,
        });
      } else if (n.children) {
        walk(n.children, n.title || chapterTitle);
      }
    });
  };
  walk(chapters, '');
  return out;
}
