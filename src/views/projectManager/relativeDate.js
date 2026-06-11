// Formatage de dates relatives en français : « à l'instant », « il y a 2 h »,
// « hier », puis date courte au-delà d'une semaine.
const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });

export const formatRelativeDate = (isoOrDate) => {
  if (!isoOrDate) return '';
  const date = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(date.getTime())) return '';
  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return 'à l\'instant';
  if (abs < 3600) return rtf.format(Math.trunc(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.trunc(diffSec / 3600), 'hour');
  if (abs < 7 * 86400) return rtf.format(Math.trunc(diffSec / 86400), 'day');
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
