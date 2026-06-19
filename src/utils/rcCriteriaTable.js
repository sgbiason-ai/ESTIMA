// src/utils/rcCriteriaTable.js
//
// Construit le tableau HTML des critères d'attribution du RC à partir des
// critères du module RAO (project.rao.criteria / DEFAULT_CRITERIA).
// Le HTML produit est consommé par la variable {{criteresTable}} du RC,
// rendue en aperçu (RcPreview) et en Word (rcExport).

const escapeHtml = (str) =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/**
 * @param {Array<{label:string, weight:number, description?:string, subCriteria?:Array}>} criteria
 * @returns {string} tableau HTML (colonnes Critère / Pondération)
 */
export const buildCriteriaTableHtml = (criteria) => {
  const list = Array.isArray(criteria) ? criteria.filter(Boolean) : [];
  if (list.length === 0) return '';

  const rows = list
    .map((c) => {
      const label = escapeHtml(c.label || 'Critère');
      const weight = Number.isFinite(Number(c.weight)) ? `${Number(c.weight)} %` : '';
      const desc = c.description ? `<br/><span style="font-size:0.9em;color:#555">${escapeHtml(c.description)}</span>` : '';
      // Sous-critères éventuels listés sous le critère parent
      const subs = Array.isArray(c.subCriteria) && c.subCriteria.length > 0
        ? '<br/>' + c.subCriteria
            .map((s) => `<span style="font-size:0.9em">— ${escapeHtml(s.label || '')}${Number.isFinite(Number(s.weight)) ? ` (${Number(s.weight)} %)` : ''}</span>`)
            .join('<br/>')
        : '';
      return `<tr><td><strong>${label}</strong>${desc}${subs}</td><td style="text-align:center;white-space:nowrap"><strong>${weight}</strong></td></tr>`;
    })
    .join('');

  return `<table><thead><tr><th>Critère</th><th>Pondération</th></tr></thead><tbody>${rows}</tbody></table>`;
};
