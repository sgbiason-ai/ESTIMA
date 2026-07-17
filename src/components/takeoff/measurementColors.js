const buildOptions = (familyLabel, colors) => colors.map((color, index) => ({
  color,
  label: `${familyLabel} — nuance ${index + 1}`,
}));

export const NETWORK_MEASUREMENT_PALETTES = [
  {
    id: 'electricite',
    label: 'Électricité / éclairage',
    keywords: /élec|elec|éclairage|eclairage|\bhta\b|\bhtb\b|\bbt\b|signalisation/i,
    colors: ['#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d', '#450a0a'],
  },
  {
    id: 'gaz',
    label: 'Gaz / hydrocarbures',
    keywords: /gaz|hydrocarbure/i,
    colors: ['#fde68a', '#facc15', '#eab308', '#ca8a04', '#a16207', '#854d0e', '#713f12', '#422006'],
  },
  {
    id: 'chimique',
    label: 'Produits chimiques',
    keywords: /chimique|produit chim/i,
    colors: ['#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c', '#9a3412', '#7c2d12', '#431407'],
  },
  {
    id: 'eau_potable',
    label: 'Eau potable',
    keywords: /eau potable|adduction|\baep\b/i,
    colors: ['#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1', '#075985', '#0c4a6e', '#082f49'],
  },
  {
    id: 'assainissement',
    label: 'Assainissement / pluvial',
    keywords: /assainissement|eaux usées|eaux usees|\be\.?u\b|pluvial|eaux pluviales|\be\.?p\b/i,
    colors: ['#d6b38c', '#b98b62', '#9a7355', '#8b6a50', '#7c5638', '#5c3213', '#422006', '#2b1605'],
  },
  {
    id: 'chauffage',
    label: 'Chauffage / climatisation',
    keywords: /chauffage|climatisation|climatique|réseau de chaleur|reseau de chaleur/i,
    colors: ['#d8b4fe', '#c084fc', '#a855f7', '#9333ea', '#7e22ce', '#6b21a8', '#581c87', '#3b0764'],
  },
  {
    id: 'telecom',
    label: 'Télécommunications / TBT',
    keywords: /télécom|telecom|fibre|\btbt\b|courant faible/i,
    colors: ['#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d', '#166534', '#14532d', '#052e16'],
  },
  {
    id: 'multireseaux',
    label: 'Emprise multiréseaux',
    keywords: /multi.?réseau|multi.?reseau|emprise/i,
    colors: ['#fda4af', '#fb7185', '#f43f5e', '#e11d48', '#be123c', '#9f1239', '#881337', '#4c0519'],
  },
].map((palette) => ({
  ...palette,
  options: buildOptions(palette.label, palette.colors),
}));

export const OTHER_MEASUREMENT_COLORS = [
  { color: '#083344', label: 'Cyan profond' },
  { color: '#0e7490', label: 'Cyan' },
  { color: '#155e75', label: 'Bleu pétrole' },
  { color: '#172554', label: 'Bleu marine' },
  { color: '#1e3a8a', label: 'Bleu nuit' },
  { color: '#134e4a', label: 'Turquoise profond' },
  { color: '#14b8a6', label: 'Turquoise' },
  { color: '#365314', label: 'Vert olive' },
  { color: '#65a30d', label: 'Vert lime' },
  { color: '#701a75', label: 'Fuchsia profond' },
  { color: '#c026d3', label: 'Fuchsia' },
  { color: '#334155', label: 'Gris ardoise' },
  { color: '#111827', label: 'Noir' },
  { color: '#92400e', label: 'Ocre' },
  { color: '#881337', label: 'Bordeaux' },
  { color: '#4338ca', label: 'Indigo' },
];

export const MEASUREMENT_COLOR_GROUPS = [
  ...NETWORK_MEASUREMENT_PALETTES.map((palette) => ({
    id: palette.id,
    label: palette.label,
    options: palette.options,
    isNetwork: true,
  })),
  { id: 'other', label: 'Hors réseaux', options: OTHER_MEASUREMENT_COLORS },
];

export const NETWORK_MEASUREMENT_COLORS = NETWORK_MEASUREMENT_PALETTES
  .flatMap((palette) => palette.options);

export const MEASUREMENT_COLORS = MEASUREMENT_COLOR_GROUPS
  .flatMap((group) => group.options.map((option) => option.color));

const NETWORK_DETECTION_ORDER = [
  'multireseaux',
  'telecom',
  'electricite',
  'gaz',
  'chimique',
  'eau_potable',
  'assainissement',
  'chauffage',
];

export function detectMeasurementNetwork(label) {
  const text = String(label || '');
  return NETWORK_DETECTION_ORDER
    .map((id) => NETWORK_MEASUREMENT_PALETTES.find((palette) => palette.id === id))
    .find((palette) => palette?.keywords.test(text)) || null;
}

export function measurementColorAt(index) {
  const safeIndex = Math.max(0, Number(index) || 0);
  return MEASUREMENT_COLORS[safeIndex % MEASUREMENT_COLORS.length];
}

function nextAvailableColor(options, selections) {
  const colors = options.map((option) => option.color);
  const used = new Set((selections || []).map((selection) => selection.highlightColor).filter(Boolean));
  return colors.find((color) => !used.has(color))
    || colors[(selections || []).filter((selection) => colors.includes(selection.highlightColor)).length % colors.length];
}

export function nextMeasurementColor(selections) {
  return nextAvailableColor(OTHER_MEASUREMENT_COLORS, selections);
}

export function suggestMeasurementColor(label, selections = []) {
  const network = detectMeasurementNetwork(label);
  return network
    ? nextAvailableColor(network.options, selections)
    : nextMeasurementColor(selections);
}

// Les anciennes couleurs automatiques sont redistribuées par famille au chargement.
// Un choix explicite de l'utilisateur (colorLocked) reste toujours prioritaire.
export function assignMeasurementColors(selections) {
  const assigned = [];
  for (const selection of selections || []) {
    const next = {
      ...selection,
      highlightColor: selection.colorLocked && selection.highlightColor
        ? selection.highlightColor
        : suggestMeasurementColor(selection.label, assigned),
    };
    assigned.push(next);
  }
  return assigned;
}

export const assignMissingMeasurementColors = assignMeasurementColors;
