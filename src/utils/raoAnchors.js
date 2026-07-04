// src/utils/raoAnchors.js
// Navigation vers un champ précis d'un onglet RAO : scroll fluide + surbrillance
// pulsée (classe rao-highlight-pulse, définie dans index.css).
// Utilisé par TabAlertBanner (intra-onglet) et PreExportChecklistModal
// (inter-onglets : l'élément cible peut ne pas encore être monté → retries).

export const flashAnchor = (anchorId, { delay = 0, attempts = 6 } = {}) => {
  if (!anchorId) return;
  const tryScroll = (remaining) => {
    const el = document.getElementById(anchorId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('rao-highlight-pulse');
      setTimeout(() => el.classList.remove('rao-highlight-pulse'), 2000);
      return;
    }
    if (remaining > 0) setTimeout(() => tryScroll(remaining - 1), 150);
  };
  setTimeout(() => requestAnimationFrame(() => tryScroll(attempts)), delay);
};

export default flashAnchor;
