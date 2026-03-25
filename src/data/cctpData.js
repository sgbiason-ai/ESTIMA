// ─────────────────────────────────────────────────────────────────────────────
// SMART_MAPPING — Détection automatique des chapitres CCTP depuis les devis
//
// OPTIMISÉ POUR LE MOTEUR DE SCORING :
// - Zéro accent, zéro majuscule, ponctuation simplifiée (ex: "fil d eau").
// - Listes de 3 mots-clés maximum pour garantir un déclenchement franc (seuil = 1).
// - Utilisation d'expressions exactes ("beton desactive") plutôt que mots isolés.
// ─────────────────────────────────────────────────────────────────────────────

export const SMART_MAPPING = [

  // ── INSTALLATION DE CHANTIER (3) ──────────────────────────────────────────
  {
    keywords: ["installation de chantier", "base vie", "baraquement"],
    targetIds: ["3"],
    mustNotContain: []
  },
  {
    keywords: ["repli de chantier", "nettoyage du chantier", "remise en etat"],
    targetIds: ["3"],
    mustNotContain: []
  },
  {
    keywords: ["cloture de chantier", "panneau de chantier", "signalisation"],
    targetIds: ["3"],
    mustNotContain: ["definitive", "marquage"]
  },

  // ── TERRASSEMENTS GÉNÉRAUX (4.2) ─────────────────────────────────────────
  {
    keywords: ["terre vegetale", "debroussaillage", "dessouchage"],
    targetIds: ["4.2"],
    mustNotContain: []
  },
  {
    keywords: ["terrassement", "decaissement", "excavation"],
    targetIds: ["4.2", "4.2.1"],
    // Évite de cocher le terrassement si c'est juste la ligne de transport/décharge
    mustNotContain: ["evacuation", "transport", "mise en decharge"] 
  },
  {
    keywords: ["deblai", "fouille en pleine masse"],
    targetIds: ["4.2", "4.2.1"],
    mustNotContain: []
  },
  {
    keywords: ["remblai", "apport de materiaux", "comblement"],
    targetIds: ["4.2", "4.2.2"],
    mustNotContain: []
  },
  {
    keywords: ["purge", "remplacement de sol", "substitution"],
    targetIds: ["4.2", "4.2.1"],
    mustNotContain: []
  },
  {
    keywords: ["compactage", "essai de plaque", "portance"],
    targetIds: ["4.2", "4.2.2"],
    mustNotContain: []
  },

  // ── COUCHES DE FORME ET FONDATION (4.2.5) ────────────────────────────────
  {
    keywords: ["grave non traitee", "gnt", "granulat"],
    targetIds: ["4.2.5"],
    mustNotContain: []
  },
  {
    keywords: ["couche de forme", "couche de fondation", "couche de base"],
    targetIds: ["4.2.5", "4.4"],
    mustNotContain: []
  },
  {
    keywords: ["geotextile", "geomembrane", "bidim"],
    targetIds: ["4.2"],
    mustNotContain: []
  },

  // ── BORDURES ET CANIVEAUX (4.3) ──────────────────────────────────────────
  {
    keywords: ["t1", "t2", "t3"],
    targetIds: ["4.3", "4.3.1", "4.3.2"],
    mustNotContain: ["depose", "pvc", "tuyau", "fourreau"]
  },
  {
    keywords: ["a1", "a2", "cs1", "cs2", "p1", "i1"],
    targetIds: ["4.3", "4.3.1", "4.3.2"],
    mustNotContain: ["depose", "pvc", "tuyau"]
  },
  {
    keywords: ["bordure beton", "bordure granit", "bordures"],
    targetIds: ["4.3", "4.3.1", "4.3.2"],
    mustNotContain: ["depose"]
  },
  {
    keywords: ["caniveau", "fil d eau", "noue"], // "fil d'eau" transformé en "fil d eau"
    targetIds: ["4.3", "4.3.1", "4.3.2"],
    mustNotContain: ["depose"]
  },

  // ── REVÊTEMENTS BITUMINEUX (4.4.4) ───────────────────────────────────────
  {
    keywords: ["enrobe", "bbsg", "bbme"],
    targetIds: ["4.4", "4.4.4"],
    mustNotContain: ["decoupe", "scellement"] // Évite l'enrobé si c'est juste "scellement de regard au mortier et enrobé"
  },
  {
    keywords: ["bbtm", "grave bitume", "couche d accrochage"],
    targetIds: ["4.4", "4.4.4"],
    mustNotContain: []
  },
  {
    keywords: ["fraisage", "reprofilage", "point a temps"],
    targetIds: ["4.4", "4.4.4"],
    mustNotContain: []
  },

  // ── REVÊTEMENTS BÉTON (4.4.5) ────────────────────────────────────────────
  {
    keywords: ["beton desactive", "beton lave", "beton imprime"],
    targetIds: ["4.4.5"],
    mustNotContain: []
  },
  {
    keywords: ["beton balaye", "beton lisse", "dalle beton"],
    targetIds: ["4.4.5"],
    // Le bouclier ultime : évite de cocher "Revêtement Béton" pour un simple regard coulé en place
    mustNotContain: ["regard", "bordure", "tuyau", "fondation", "scellement"] 
  },

  // ── PAVAGE ET DALLAGE (4.4.7) ────────────────────────────────────────────
  {
    keywords: ["pavage", "pave granit", "pave beton"],
    targetIds: ["4.4.7"],
    mustNotContain: ["bordure"]
  },
  {
    keywords: ["dallage", "dalle granit", "dalle calcaire", "pierre naturelle"],
    targetIds: ["4.4.7"],
    mustNotContain: ["beton arme", "regard"]
  },

  // ── SABLE ET REVÊTEMENTS SOUPLES (4.4.8) ─────────────────────────────────
  {
    keywords: ["sable stabilise", "sable compacte", "voie douce"],
    targetIds: ["4.4.8"],
    mustNotContain: ["lit de pose", "enrobage"] // Évite le sable stabilisé si c'est juste le lit de pose d'un tuyau !
  },

  // ── TRANCHÉES RÉSEAUX (5.3) ──────────────────────────────────────────────
  {
    keywords: ["fouille en tranchee", "remblai de tranchee", "grillage avertisseur"],
    targetIds: ["5.3"],
    mustNotContain: []
  },

  // ── CANALISATIONS EU / EP (5.5) ──────────────────────────────────────────
  {
    keywords: ["pvc cr8", "pvc cr16", "canalisation pvc"],
    targetIds: ["5", "5.5"],
    mustNotContain: []
  },
  {
    keywords: ["tuyau fonte", "canalisation fonte"],
    targetIds: ["5", "5.5"],
    mustNotContain: ["tampon", "cadre", "grille"] // Distingue la canalisation en fonte de la plaque d'égout en fonte
  },
  {
    keywords: ["tuyau beton", "tuyau ba", "canalisation ba"],
    targetIds: ["5", "5.5"],
    mustNotContain: []
  },
  {
    keywords: ["eaux usees", "eaux pluviales"],
    targetIds: ["5", "5.5"],
    mustNotContain: []
  },
  {
    keywords: ["reseau ep", "reseau eu", "collecteur"],
    targetIds: ["5", "5.5"],
    mustNotContain: []
  },

  // ── REGARDS ET OUVRAGES (5.6) ────────────────────────────────────────────
  {
    keywords: ["regard de visite", "boite de branchement", "regard borgne"],
    targetIds: ["5", "5.6"],
    mustNotContain: []
  },
  {
    keywords: ["tampon fonte", "cadre fonte", "grille avaloir"],
    targetIds: ["5", "5.6"],
    mustNotContain: []
  },
  {
    keywords: ["tampon d400", "tampon c250", "bouche d egout"],
    targetIds: ["5", "5.6"],
    mustNotContain: []
  },

  // ── FOURREAUX / RÉSEAUX SECS ─────────────────────────────────────────────
  {
    keywords: ["fourreau", "tpc", "pe aiguillable"],
    targetIds: ["5"],
    mustNotContain: ["assainissement", "eu", "ep"]
  },

  // ── DÉPOSE ET DÉMOLITION ─────────────────────────────────────────────────
  {
    keywords: ["depose de", "demolition de", "deconstruction"],
    targetIds: ["4.2"],
    mustNotContain: []
  }
];