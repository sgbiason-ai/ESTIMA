export const INITIAL_UNITS = [
  { symbol: "u", label: "Unité" },
  { symbol: "h", label: "Heure" },
  { symbol: "m", label: "Mètre linéaire" },
  { symbol: "m2", label: "Mètre carré" },
  { symbol: "m3", label: "Mètre cube" },
  { symbol: "ens", label: "Ensemble" },
  { symbol: "f", label: "Forfait" },
  { symbol: "t", label: "Tonne" }
];

export const INITIAL_CATEGORIES = [
  { id: "cat_1", name: "Terrassement" },
  { id: "cat_2", name: "Assainissement" },
  { id: "cat_3", name: "Voirie" }
];

export const INITIAL_BPU = [
  { id: "1", designation: "FOUILLE EN TRANCHÉE", unit: "m3", price: 15.00, categoryId: "cat_1", description: "" },
  { id: "2", designation: "BORDURE T2", unit: "m", price: 28.50, categoryId: "cat_3", description: "" }
];

export const INITIAL_PROJECT = {
  name: "MON PROJET VRD",
  chapters: [
    { id: "c1", title: "TRAVAUX PRÉPARATOIRES", children: [], type: 'chapter' }
  ]
};