// Métadonnées métier des affaires : statuts (cycle de mission MOE) et formats.

export const PROJECT_STATUSES = [
  { id: 'etude',   label: 'En étude', badge: 'bg-blue-50 text-blue-600 border-blue-200/60',     dot: 'bg-blue-500' },
  { id: 'dce',     label: 'DCE',      badge: 'bg-violet-50 text-violet-600 border-violet-200/60', dot: 'bg-violet-500' },
  { id: 'travaux', label: 'Travaux',  badge: 'bg-amber-50 text-amber-600 border-amber-200/60',   dot: 'bg-amber-500' },
  { id: 'clos',    label: 'Clos',     badge: 'bg-gray-100 text-gray-500 border-gray-200/60',     dot: 'bg-gray-400' },
];

export const getStatusInfo = (id) => PROJECT_STATUSES.find(s => s.id === id) || null;

// "142 380 €" — null si la valeur n'est pas un nombre (projets jamais resauvegardés
// depuis l'ajout du champ dénormalisé totalHT)
export const formatEuro = (v) => {
  const n = Number(v);
  if (v === null || v === undefined || !Number.isFinite(n)) return null;
  return `${Math.round(n).toLocaleString('fr-FR')} €`;
};

export const formatEuroHT = (v) => {
  const e = formatEuro(v);
  return e ? `${e} HT` : null;
};
