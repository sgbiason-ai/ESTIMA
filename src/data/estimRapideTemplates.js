// src/data/estimRapideTemplates.js
//
// Catalogue des grands lots VRD + ratios par défaut (€ HT, à calibrer) et
// templates projet-type du module Estimation Rapide.
// Aucune dépendance React/Firebase — données + petites factories.

import { generateId } from '../utils/helpers';
import { commonUnitSymbols } from './units';

// Unités proposées dans l'éditeur — dérivées du catalogue central (source unique).
export const UNITS = commonUnitSymbols();

// ─── Catalogue des grands lots VRD ──────────────────────────────────────────
// Chaque lot regroupe quelques macro-postes (logique « rapide »). `ratio` = prix
// unitaire HT par défaut (France 2026, indicatif), librement éditable.
export const BASE_LOTS = [
  {
    key: 'install',
    label: 'Installation de chantier & généralités',
    postes: [
      { label: 'Amenée, installation et repli de chantier', unit: 'forfait', ratio: 4000 },
      { label: 'Signalisation temporaire & maintien de circulation', unit: 'forfait', ratio: 2500 },
      { label: "Constat d'huissier / état des lieux", unit: 'forfait', ratio: 800 },
    ],
  },
  {
    key: 'terrassement',
    label: 'Terrassements généraux',
    postes: [
      { label: 'Décapage de la terre végétale', unit: 'm²', ratio: 3 },
      { label: 'Déblais / remblais en grande masse', unit: 'm³', ratio: 14 },
      { label: 'Évacuation des excédents en décharge', unit: 'm³', ratio: 15 },
    ],
  },
  {
    key: 'voirie',
    label: 'Voirie & chaussées',
    postes: [
      { label: 'Structure de chaussée complète (forme + GNT + enrobés)', unit: 'm²', ratio: 45 },
      { label: 'Bordures & caniveaux', unit: 'ml', ratio: 32 },
      { label: 'Trottoirs & cheminements', unit: 'm²', ratio: 38 },
    ],
  },
  {
    key: 'assainEU',
    label: 'Assainissement EU (eaux usées)',
    postes: [
      { label: 'Réseau gravitaire ø200 (tranchée comprise)', unit: 'ml', ratio: 180 },
      { label: 'Regards de visite ø1000', unit: 'u', ratio: 900 },
      { label: 'Branchements particuliers', unit: 'u', ratio: 650 },
    ],
  },
  {
    key: 'assainEP',
    label: 'Assainissement EP (eaux pluviales)',
    postes: [
      { label: 'Réseau ø300 (tranchée comprise)', unit: 'ml', ratio: 220 },
      { label: "Avaloirs / bouches d'égout", unit: 'u', ratio: 600 },
      { label: 'Ouvrage de rétention / noue', unit: 'forfait', ratio: 8000 },
    ],
  },
  {
    key: 'aep',
    label: 'Adduction eau potable (AEP)',
    postes: [
      { label: 'Canalisation PEHD / fonte ø100-160', unit: 'ml', ratio: 130 },
      { label: 'Branchements eau potable', unit: 'u', ratio: 700 },
      { label: 'Poteau incendie & accessoires', unit: 'u', ratio: 2500 },
    ],
  },
  {
    key: 'reseauxSecs',
    label: 'Réseaux secs (élec, télécom, éclairage)',
    postes: [
      { label: 'Tranchée commune (élec BT + télécom)', unit: 'ml', ratio: 90 },
      { label: "Candélabres d'éclairage public", unit: 'u', ratio: 2200 },
      { label: 'Coffrets / chambres télécom', unit: 'u', ratio: 1200 },
    ],
  },
  {
    key: 'espacesVerts',
    label: 'Espaces verts & plantations',
    postes: [
      { label: 'Engazonnement (terre végétale + semis)', unit: 'm²', ratio: 8 },
      { label: "Plantation d'arbres tiges", unit: 'u', ratio: 350 },
      { label: "Réseau d'arrosage automatique", unit: 'ml', ratio: 25 },
    ],
  },
  {
    key: 'signalisation',
    label: 'Signalisation & mobilier urbain',
    postes: [
      { label: 'Signalisation horizontale (marquage)', unit: 'forfait', ratio: 3500 },
      { label: 'Signalisation verticale (panneaux)', unit: 'u', ratio: 250 },
      { label: 'Mobilier urbain (bancs, corbeilles, potelets)', unit: 'forfait', ratio: 4000 },
    ],
  },
];

const ALL_KEYS = BASE_LOTS.map(l => l.key);

// ─── Templates projet-type ──────────────────────────────────────────────────
// `lotKeys` = sous-ensemble du catalogue pré-chargé à la création.
export const TEMPLATES = [
  {
    id: 'lotissement',
    name: 'Lotissement résidentiel',
    description: 'VRD complet : voirie, assainissement EU/EP, AEP, réseaux secs, espaces verts.',
    lotKeys: ['install', 'terrassement', 'voirie', 'assainEU', 'assainEP', 'aep', 'reseauxSecs', 'espacesVerts'],
  },
  {
    id: 'zac',
    name: 'ZAC / aménagement urbain',
    description: 'Tous les lots VRD, signalisation et mobilier urbain inclus.',
    lotKeys: ALL_KEYS,
  },
  {
    id: 'voirieCommunale',
    name: 'Voirie communale / réfection',
    description: 'Terrassement, chaussées, eaux pluviales et signalisation.',
    lotKeys: ['install', 'terrassement', 'voirie', 'assainEP', 'signalisation'],
  },
  {
    id: 'parking',
    name: 'Parking / aire de stationnement',
    description: 'Plateforme, chaussées, eaux pluviales, espaces verts et signalisation.',
    lotKeys: ['install', 'terrassement', 'voirie', 'assainEP', 'espacesVerts', 'signalisation'],
  },
  {
    id: 'vierge',
    name: 'Grille vierge',
    description: 'Tous les lots, quantités à zéro — point de départ libre.',
    lotKeys: ALL_KEYS,
  },
];

// ─── Factories ──────────────────────────────────────────────────────────────

/** Instancie un lot depuis le catalogue (ids uniques, quantités à 0). */
export const buildLot = (key) => {
  const base = BASE_LOTS.find(l => l.key === key);
  if (!base) return null;
  return {
    id: generateId(),
    key: base.key,
    label: base.label,
    postes: base.postes.map(p => ({
      id: generateId(),
      label: p.label,
      unit: p.unit,
      qty: 0,
      ratio: p.ratio,
    })),
  };
};

/** Métadonnées vides communes à toute estimation. */
const emptyMeta = (name) => ({
  id: generateId(),
  name: name || '',
  client: '',
  location: '',
  aleas: { enabled: false, percent: 10 },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

/** Crée une estimation à partir d'un template intégré (fallback 'vierge'). */
export const createEstimateFromTemplate = (templateId, { name } = {}) => {
  const template = TEMPLATES.find(t => t.id === templateId)
    || TEMPLATES.find(t => t.id === 'vierge');
  return {
    ...emptyMeta(name),
    templateId: template.id,
    lots: template.lotKeys.map(buildLot).filter(Boolean),
  };
};

/** Crée une estimation depuis un modèle utilisateur sauvegardé (clone des lots). */
export const createEstimateFromCustomTemplate = (customTemplate, { name } = {}) => ({
  ...emptyMeta(name),
  templateId: customTemplate?.id || null,
  lots: (customTemplate?.lots || []).map(lot => ({
    ...lot,
    id: generateId(),
    postes: (lot.postes || []).map(p => ({ ...p, id: generateId() })),
  })),
});
