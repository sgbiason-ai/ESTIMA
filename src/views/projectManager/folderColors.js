// src/views/projectManager/folderColors.js
// Palette de couleurs TRANCHÉES pour les dossiers — bien visibles, pas pastel.

const FOLDER_PALETTE = [
  {
    name: 'blue',
    sidebar:     'bg-blue-100 text-blue-700 font-semibold',
    sidebarIcon: 'text-blue-600',
    badge:       'bg-blue-200 text-blue-700',
    card:        'border-blue-300 bg-blue-50',
    cardHover:   'hover:bg-blue-100/80 hover:shadow-blue-200/40',
    cardActive:  'border-blue-500 ring-2 ring-blue-200 bg-blue-100',
    dot:         'bg-blue-500',
    stripe:      'bg-blue-500',
    accent:      'text-blue-700',
    iconBg:      'bg-blue-100',
    iconColor:   'text-blue-600',
  },
  {
    name: 'amber',
    sidebar:     'bg-amber-100 text-amber-700 font-semibold',
    sidebarIcon: 'text-amber-600',
    badge:       'bg-amber-200 text-amber-700',
    card:        'border-amber-300 bg-amber-50',
    cardHover:   'hover:bg-amber-100/80 hover:shadow-amber-200/40',
    cardActive:  'border-amber-500 ring-2 ring-amber-200 bg-amber-100',
    dot:         'bg-amber-500',
    stripe:      'bg-amber-500',
    accent:      'text-amber-700',
    iconBg:      'bg-amber-100',
    iconColor:   'text-amber-600',
  },
  {
    name: 'violet',
    sidebar:     'bg-violet-100 text-violet-700 font-semibold',
    sidebarIcon: 'text-violet-600',
    badge:       'bg-violet-200 text-violet-700',
    card:        'border-violet-300 bg-violet-50',
    cardHover:   'hover:bg-violet-100/80 hover:shadow-violet-200/40',
    cardActive:  'border-violet-500 ring-2 ring-violet-200 bg-violet-100',
    dot:         'bg-violet-500',
    stripe:      'bg-violet-500',
    accent:      'text-violet-700',
    iconBg:      'bg-violet-100',
    iconColor:   'text-violet-600',
  },
  {
    name: 'emerald',
    sidebar:     'bg-emerald-100 text-emerald-700 font-semibold',
    sidebarIcon: 'text-emerald-600',
    badge:       'bg-emerald-200 text-emerald-700',
    card:        'border-emerald-300 bg-emerald-50',
    cardHover:   'hover:bg-emerald-100/80 hover:shadow-emerald-200/40',
    cardActive:  'border-emerald-500 ring-2 ring-emerald-200 bg-emerald-100',
    dot:         'bg-emerald-500',
    stripe:      'bg-emerald-500',
    accent:      'text-emerald-700',
    iconBg:      'bg-emerald-100',
    iconColor:   'text-emerald-600',
  },
  {
    name: 'rose',
    sidebar:     'bg-rose-100 text-rose-700 font-semibold',
    sidebarIcon: 'text-rose-600',
    badge:       'bg-rose-200 text-rose-700',
    card:        'border-rose-300 bg-rose-50',
    cardHover:   'hover:bg-rose-100/80 hover:shadow-rose-200/40',
    cardActive:  'border-rose-500 ring-2 ring-rose-200 bg-rose-100',
    dot:         'bg-rose-500',
    stripe:      'bg-rose-500',
    accent:      'text-rose-700',
    iconBg:      'bg-rose-100',
    iconColor:   'text-rose-600',
  },
  {
    name: 'cyan',
    sidebar:     'bg-cyan-100 text-cyan-700 font-semibold',
    sidebarIcon: 'text-cyan-600',
    badge:       'bg-cyan-200 text-cyan-700',
    card:        'border-cyan-300 bg-cyan-50',
    cardHover:   'hover:bg-cyan-100/80 hover:shadow-cyan-200/40',
    cardActive:  'border-cyan-500 ring-2 ring-cyan-200 bg-cyan-100',
    dot:         'bg-cyan-500',
    stripe:      'bg-cyan-500',
    accent:      'text-cyan-700',
    iconBg:      'bg-cyan-100',
    iconColor:   'text-cyan-600',
  },
];

// Couleur neutre pour "Sans dossier"
export const NEUTRAL_COLOR = {
  name: 'gray',
  sidebar:     'bg-gray-100 text-gray-600',
  sidebarIcon: 'text-gray-400',
  badge:       'bg-gray-200 text-gray-500',
  card:        'border-gray-200 bg-white',
  cardHover:   'hover:bg-gray-50 hover:shadow-gray-200/40',
  cardActive:  'border-gray-400 ring-2 ring-gray-200 bg-gray-50',
  dot:         'bg-gray-400',
  stripe:      'bg-gray-400',
  accent:      'text-gray-600',
  iconBg:      'bg-gray-100',
  iconColor:   'text-gray-500',
};

/**
 * Retourne un mapping { folderId → couleur }.
 * Priorité au champ persisté `colorIndex` (stable : ne bouge plus jamais) ;
 * repli sur l'index alphabétique pour les dossiers pas encore migrés.
 */
export function buildFolderColorMap(folders) {
  const map = {};
  folders.forEach((folder, idx) => {
    const ci = Number.isInteger(folder.colorIndex) ? folder.colorIndex : idx;
    map[folder.id] = FOLDER_PALETTE[((ci % FOLDER_PALETTE.length) + FOLDER_PALETTE.length) % FOLDER_PALETTE.length];
  });
  return map;
}

/**
 * Choisit l'index de couleur le moins utilisé parmi les dossiers existants
 * (pour qu'un nouveau dossier se distingue au maximum des voisins).
 */
export function pickLeastUsedColorIndex(folders) {
  const counts = new Array(FOLDER_PALETTE.length).fill(0);
  folders.forEach((f, idx) => {
    const ci = Number.isInteger(f.colorIndex) ? f.colorIndex : idx;
    counts[((ci % FOLDER_PALETTE.length) + FOLDER_PALETTE.length) % FOLDER_PALETTE.length]++;
  });
  let best = 0;
  counts.forEach((c, i) => { if (c < counts[best]) best = i; });
  return best;
}

export { FOLDER_PALETTE };
