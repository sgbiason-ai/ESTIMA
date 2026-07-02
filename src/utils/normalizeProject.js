// src/utils/normalizeProject.js
//
// Couche de normalisation du schéma projet.
// Appelée à CHAQUE chargement depuis Firebase (ou fichier JSON local).
//
// Rôle : garantir que tous les champs attendus par les hooks existent,
// même si le projet a été créé avec une ancienne version de l'application.
//
// ⚠️  Ne jamais modifier la logique métier ici.
//      Cette fonction doit être PURE et SANS EFFETS DE BORD.
//
// Versions du schéma :
//   v0  (legacy)  – pas de champ `schemaVersion`, pas de `tranches`
//   v1            – tranches, scoringConfig
//   v2            – rao.includedOptions, rao.raoTrancheId
//   v3            – subtitle1/subtitle2, signatories, branding
//   v4  (current) – champs RC : lotName, moeAddress, spsLevel, startDate,
//                   validityDays, platformUrl
//
// À chaque évolution du schéma, incrémenter CURRENT_SCHEMA_VERSION
// et ajouter un bloc de migration numéroté ci-dessous.

export const CURRENT_SCHEMA_VERSION = 4;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Garantit qu'un tableau est bien un tableau (jamais null/undefined). */
const arr  = (v)  => Array.isArray(v) ? v : [];

/** Garantit qu'un objet est bien un objet (jamais null/undefined). */
const obj  = (v)  => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};

/** Garantit qu'une chaîne est bien une chaîne. */
const str  = (v, fallback = '') => (typeof v === 'string' ? v : fallback);

/** Garantit qu'un nombre est fini. */
const num  = (v, fallback = 0)  => (Number.isFinite(Number(v)) ? Number(v) : fallback);

/** Garantit qu'un booléen est bien un booléen. */
const bool = (v, fallback = false) => (typeof v === 'boolean' ? v : fallback);

// ─── NORMALISATION DES NŒUDS DE L'ARBRE ──────────────────────────────────────

/**
 * Normalise récursivement chaque nœud de l'arbre `chapters`.
 * Ajoute les champs manquants avec leurs valeurs par défaut.
 */
function normalizeNode(node) {
  if (!node || typeof node !== 'object') return null;

  if (node.type === 'item') {
    const item = {
      type:               'item',
      id:                 str(node.id),
      uid:                str(node.uid),
      designation:        str(node.designation),
      unit:               str(node.unit),
      price:              num(node.price),
      qty:                num(node.qty),
      formula:            str(node.formula),
      quantities:         obj(node.quantities),
      quantitiesFormula:  obj(node.quantitiesFormula),
      bpuNum:             str(node.bpuNum),
      isFixed:            bool(node.isFixed),
    };
    // Article "libre" : saisi de zéro dans le projet (non lié au BPU, uid vide).
    if (node.isFree) item.isFree = true;
    // Quantité figée : jamais majorée en mode rendu (indépendant du forfait).
    if (node.qtyLocked) item.qtyLocked = true;
    // Composant de bloc : facteur de conversion mémorisé (PU moyen, affichage).
    if (node.blocFactor != null) item.blocFactor = num(node.blocFactor);
    return item;
  }

  // chapter / subChapter
  const chapter = {
    type:     str(node.type, 'chapter'),
    id:       str(node.id),
    title:    str(node.title),
    isOption: bool(node.isOption),
    children: arr(node.children).map(normalizeNode).filter(Boolean),
  };
  // PSE substitution : la PSE (option) remplace une prestation de base ; son prix
  // affiché = montant PSE − montant base. pseMode absent ou 'simple' = PSE classique.
  if (node.pseMode === 'substitution') {
    chapter.pseMode = 'substitution';
    chapter.pseBaseId = str(node.pseBaseId);
  }
  // Description / justification de la PSE (HTML riche : gras, listes). Persistée
  // par projet, reprise dans les exports (page PSE PDF, bloc Excel, récap).
  if (node.isOption && node.pseDescription) {
    chapter.pseDescription = str(node.pseDescription);
  }
  // Commentaire de chapitre (texte simple) : affiché sous le titre, repris dans
  // les exports client (DQE PDF, Excel).
  if (node.comment) chapter.comment = str(node.comment);
  // Sous-chapitre "bloc" (ouvrage composite) : conserver unité + surface (Qté/tranches).
  if (node.isBloc) {
    chapter.isBloc = true;
    chapter.unit = str(node.unit);
    chapter.qty = num(node.qty);
    chapter.quantities = obj(node.quantities);
    chapter.quantitiesFormula = obj(node.quantitiesFormula);
  }
  return chapter;
}

// ─── NORMALISATION DES TRANCHES ───────────────────────────────────────────────

function normalizeTranche(t) {
  if (!t || typeof t !== 'object') return null;
  return {
    id:   str(t.id),
    name: str(t.name, `Tranche ${str(t.id)}`),
  };
}

// ─── NORMALISATION DU MODULE RAO ─────────────────────────────────────────────

function normalizeRao(raw) {
  const r = obj(raw);
  return {
    consultation:    obj(r.consultation),
    criteria:        arr(r.criteria),
    companies:       obj(r.companies),
    // v2 — sélecteur de tranche RAO et PSE incluses
    raoTrancheId:    str(r.raoTrancheId,    'global'),
    includedOptions: obj(r.includedOptions),
  };
}

// ─── NORMALISATION DU SCORING ─────────────────────────────────────────────────

function normalizeScoringConfig(raw) {
  const s = obj(raw);
  return {
    maxScore: num(s.maxScore, 40),
    mode:     str(s.mode,     'f1'),
  };
}

// ─── NORMALISATION DES SIGNATAIRES ───────────────────────────────────────────

function normalizeSignatory(s) {
  if (!s || typeof s !== 'object') return null;
  return {
    name:     str(s.name),
    title:    str(s.title),
    location: str(s.location),
  };
}

// ─── MIGRATIONS VERSIONNÉES ───────────────────────────────────────────────────
//
// Chaque migration est appliquée dans l'ordre croissant.
// Elle reçoit le projet (déjà partiellement normalisé) et retourne
// le projet mis à jour + le nouveau numéro de version.

const migrations = [
  // v0 → v1 : tranches, scoringConfig
  {
    from: 0,
    description: 'Ajout de tranches et scoringConfig',
    run: (p) => ({
      ...p,
      tranches:      arr(p.tranches),
      sourceIds:     arr(p.sourceIds),
      scoringConfig: p.scoringConfig || { maxScore: 40, mode: 'f1' },
    }),
  },

  // v1 → v2 : rao.includedOptions, rao.raoTrancheId
  {
    from: 1,
    description: 'Migration RAO — includedOptions et raoTrancheId',
    run: (p) => ({
      ...p,
      rao: {
        ...obj(p.rao),
        raoTrancheId:    p.rao?.raoTrancheId    ?? 'global',
        includedOptions: p.rao?.includedOptions  ?? {},
      },
    }),
  },

  // v2 → v3 : subtitle1/2, signatories, clientPercent min
  {
    from: 2,
    description: 'Ajout de subtitle1/subtitle2, signatories, clientPercent',
    run: (p) => ({
      ...p,
      subtitle1:     str(p.subtitle1),
      subtitle2:     str(p.subtitle2),
      clientPercent: num(p.clientPercent, 10),
      signatories:   arr(p.signatories).map(normalizeSignatory).filter(Boolean),
      showSignatures: bool(p.showSignatures, false),
    }),
  },

  // v3 → v4 : champs RC (lot, MOE, SPS, démarrage, validité, plateforme)
  {
    from: 3,
    description: 'RC — lotName, moeAddress, spsLevel, startDate, validityDays, platformUrl',
    run: (p) => ({
      ...p,
      lotName:      str(p.lotName),
      moeAddress:   str(p.moeAddress),
      spsLevel:     str(p.spsLevel, 'II'),
      startDate:    str(p.startDate),
      validityDays: num(p.validityDays, 120),
      platformUrl:  str(p.platformUrl),
    }),
  },
];

// ─── FONCTION PRINCIPALE ──────────────────────────────────────────────────────

/**
 * normalizeProject(raw)
 *
 * Prend un objet projet brut (tel que retourné par Firebase ou un fichier JSON)
 * et retourne un objet garanti conforme au schéma courant.
 *
 * @param {object} raw – données brutes
 * @returns {object}   – projet normalisé
 */
export function normalizeProject(raw) {
  if (!raw || typeof raw !== 'object') {
    console.warn('[normalizeProject] données nulles ou invalides, retour du schéma par défaut');
    return defaultProject();
  }

  // 1. Champs de base toujours présents
  let p = {
    id:             str(raw.id,          `project_${Date.now()}`),
    name:           str(raw.name),
    subtitle1:      str(raw.subtitle1),
    subtitle2:      str(raw.subtitle2),

    // Identité client
    client:         str(raw.client),
    clientAddress:  str(raw.clientAddress),
    clientCity:     str(raw.clientCity),
    clientZip:      str(raw.clientZip),
    clientLogo:     str(raw.clientLogo),
    coTraitantLogos: arr(raw.coTraitantLogos).filter((l) => typeof l === 'string' && l),

    // Projet
    code:           str(raw.code),
    location:       str(raw.location),
    department:     str(raw.department),
    moe:            str(raw.moe),
    moeAddress:     str(raw.moeAddress),
    marketType:     str(raw.marketType, 'Public'),
    phase:          str(raw.phase,      'DCE'),
    dateRemise:     str(raw.dateRemise),
    timeRemise:     str(raw.timeRemise),
    duration:       str(raw.duration),
    prepPeriod:     str(raw.prepPeriod),
    projectDescription: str(raw.projectDescription),
    hasPSE:         bool(raw.hasPSE,    false),

    // Règlement de la consultation (RC)
    lotName:        str(raw.lotName),
    spsLevel:       str(raw.spsLevel, 'II'),
    startDate:      str(raw.startDate),
    validityDays:   num(raw.validityDays, 120),
    platformUrl:    str(raw.platformUrl),

    // Signatures
    showSignatures: bool(raw.showSignatures, false),
    signatories:    arr(raw.signatories).map(normalizeSignatory).filter(Boolean),

    // Calcul
    clientPercent:  num(raw.clientPercent, 10),
    clientQtyThreshold: num(raw.clientQtyThreshold, 20),
    tauxTVA:        num(raw.tauxTVA, 20),
    scoringConfig:  normalizeScoringConfig(raw.scoringConfig),

    // Arbre des chapitres
    chapters:  arr(raw.chapters).map(normalizeNode).filter(Boolean),
    tranches:  arr(raw.tranches).map(normalizeTranche).filter(Boolean),
    sourceIds: arr(raw.sourceIds),

    // Modules imbriqués
    rao:      normalizeRao(raw.rao),
    branding: obj(raw.branding),
    // Surcharges BPU — désignations et descriptions modifiées dans cette affaire
    bpuOverrides: typeof raw.bpuOverrides === 'object' && !Array.isArray(raw.bpuOverrides)
      ? raw.bpuOverrides
      : {},

    // Analyse financière — companies + offres (persistées en Firebase depuis v3)
    analysis: {
      companies: Array.isArray(raw.analysis?.companies) ? raw.analysis.companies : [],
    },

    // Sélections CCTP / RC
    cctpSelectedIds:  arr(raw.cctpSelectedIds),
    cctpExpandedIds:  arr(raw.cctpExpandedIds),
    rcSelectedIds:    arr(raw.rcSelectedIds),
    rcExpandedIds:    arr(raw.rcExpandedIds),

    // Méta Firebase (conservés tels quels)
    lastSaved:  raw.lastSaved  ?? null,
    updatedBy:  raw.updatedBy  ?? null,
    schemaVersion: num(raw.schemaVersion, 0),
  };

  // 2. Migrations versionnées (si schéma antérieur)
  const currentVersion = num(raw.schemaVersion, 0);
  if (currentVersion < CURRENT_SCHEMA_VERSION) {
    const pending = migrations.filter(m => m.from >= currentVersion);
    if (pending.length > 0) {
      console.info(
        `[normalizeProject] Migration ${currentVersion} → ${CURRENT_SCHEMA_VERSION} :`,
        pending.map(m => m.description).join(', ')
      );
      pending.forEach(m => { p = m.run(p); });
    }
    p.schemaVersion = CURRENT_SCHEMA_VERSION;
    // Note : la sauvegarde Firebase avec schemaVersion à jour se fera
    // naturellement au prochain handleSaveProject().
  }

  return p;
}

/**
 * defaultProject()
 * Retourne un projet vide conforme au schéma courant.
 * Utilisé par resetProject() dans useProjectManager.
 */
export function defaultProject(overrides = {}) {
  return normalizeProject({
    id:           `project_${Date.now()}`,
    name:         '',
    chapters:     [{ id: 'c1', type: 'chapter', title: 'TRAVAUX PRÉPARATOIRES', children: [], isOption: false }],
    tranches:     [],
    schemaVersion: CURRENT_SCHEMA_VERSION,
    __isNew:      true,
    ...overrides,
  });
}