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
// ─────────────────────────────────────────────────────────────────────────────
// VRD_CONCEPTS — Taxonomie métier pour l auto-sélection CCTP (agnostique aux IDs)
//
// Chaque concept relie le vocabulaire d une LIGNE DE DEVIS (devisKeywords) aux mots
// d un TITRE DE CHAPITRE CCTP (titleSynonyms). La résolution se fait par les titres,
// donc fonctionne aussi bien sur le CCTP maître que sur un CCTP importé (PDF/Word).
// mustNotContain lève les ambiguïtés (ex. terre végétale : terrassement vs espaces verts).
// Consommé par src/utils/cctpAutoSelect.js (computeAutoSelection).
// ─────────────────────────────────────────────────────────────────────────────

export const VRD_CONCEPTS = [
  {
    concept: "installations_chantier",
    devisKeywords: ["installation de chantier", "installations de chantier", "amenee et repli de materiel", "amenee et repliement", "panneau de chantier", "base vie", "cantonnement", "constat d huissier", "frais d installation", "branchement provisoire"],
    titleSynonyms: ["installations de chantier", "dispositions generales", "installation et reglement de chantier", "prescriptions generales", "organisation du chantier"],
    mustNotContain: ["signalisation"],
  },
  {
    concept: "signalisation_chantier",
    devisKeywords: ["signalisation de chantier", "signalisation temporaire", "balisage de chantier", "signalisation tricolore", "feux de chantier", "alternat", "panneaux de signalisation temporaire", "deviation"],
    titleSynonyms: ["signalisation de chantier", "signalisation temporaire", "signalisation et balisage de chantier", "maintien de la circulation"],
    mustNotContain: ["signalisation verticale", "signalisation horizontale", "permanente"],
  },
  {
    concept: "protection_reseaux_existants",
    devisKeywords: ["protection des reseaux existants", "protection de reseaux", "sondage de reconnaissance", "detection de reseaux", "localisation des reseaux", "fouille de reconnaissance", "grillage avertisseur de protection", "croisement de reseaux"],
    titleSynonyms: ["protection des reseaux existants", "reseaux existants", "detection et protection des reseaux", "sauvegarde des reseaux"],
    mustNotContain: ["pose de canalisation", "grillage avertisseur de pose"],
  },
  {
    concept: "decapage_terre_vegetale",
    devisKeywords: ["decapage de terre vegetale", "decapage terre vegetale", "decapage de la terre vegetale", "decapage terrain", "decapage en pleine masse", "enlevement terre vegetale", "depot terre vegetale", "mise en stock terre vegetale"],
    titleSynonyms: ["terrassements generaux", "travaux preparatoires", "preparation des emprises", "nettoyage et decapage"],
    mustNotContain: ["engazonnement", "plantation", "espaces verts", "regalage terre vegetale", "fourniture de terre vegetale"],
  },
  {
    concept: "debroussaillage_dessouchage",
    devisKeywords: ["debroussaillage", "debroussaillage du terrain", "dessouchage", "abattage et dessouchage", "abattage d arbre", "essouchement", "nettoyage du terrain", "arrachage de haies", "elagage"],
    titleSynonyms: ["travaux preparatoires", "terrassements generaux", "demolition et terrassement", "preparation du terrain", "debroussaillage et abattage"],
    mustNotContain: ["espaces verts", "entretien des plantations", "plantation"],
  },
  {
    concept: "demolition_chaussee_ouvrages",
    devisKeywords: ["demolition", "demolition de chaussee", "demolition d ouvrage", "demolition de maconnerie", "depose de bordure", "depose de revetement", "sciage de chaussee", "decoupe de chaussee", "demolition de dallage"],
    titleSynonyms: ["demolitions", "demolition et terrassement", "demolition des ouvrages existants", "travaux preparatoires", "depose et demolition"],
    mustNotContain: ["fraisage", "rabotage", "demolition de canalisation"],
  },
  {
    concept: "terrassement_general",
    devisKeywords: ["terrassement", "terrassements mecaniques", "terrassements manuels", "terrassement en deblai", "terrassement pleine masse", "terrassement en grande masse", "decaissement", "excavation", "terrassement general", "mouvement de terre"],
    titleSynonyms: ["terrassements generaux", "demolition et terrassement", "terrassements et demolitions", "mouvements de terres", "terrassements de masse"],
    mustNotContain: ["terrassement de tranchee", "terrassement pour canalisation", "fouille en tranchee"],
  },
  {
    concept: "deblai",
    devisKeywords: ["deblai", "deblais", "deblais en grande masse", "deblais en pleine masse", "deblais mis en depot", "deblais mis en remblais", "deblais en faible epaisseur", "deblais sous chaussee", "fouille en pleine masse", "extraction de deblais"],
    titleSynonyms: ["terrassements generaux", "deblais et remblais", "terrassements en deblai", "mouvements de terres"],
    mustNotContain: ["deblais de tranchee", "tranchee", "fouille en rigole", "fouille pour canalisation"],
  },
  {
    concept: "remblai",
    devisKeywords: ["remblai", "remblais", "mise en oeuvre de remblais", "remblais avec materiaux d apport", "remblais avec deblais stockes", "remblai contigu", "remblai d apport", "apport de materiaux", "comblement", "remblaiement general"],
    titleSynonyms: ["terrassements generaux", "deblais et remblais", "remblais et compactage", "mouvements de terres", "remblaiement general"],
    mustNotContain: ["remblai de tranchee", "remblaiement de tranchee", "remblai de fouille", "tranchee"],
  },
  {
    concept: "purge_substitution_sol",
    devisKeywords: ["purge", "purge de sol", "purge de mauvais sol", "remplacement de sol", "substitution de sol", "substitution de materiaux", "purge ponctuelle", "purge et remplacement", "consolidation de fond de forme"],
    titleSynonyms: ["terrassements generaux", "purges et substitutions", "traitement de la plateforme", "preparation du fond de forme", "consolidation des sols"],
    mustNotContain: ["purge des reseaux", "vidange"],
  },
  {
    concept: "evacuation_deblais_decharge",
    devisKeywords: ["evacuation des deblais", "transport et mise en decharge", "mise en decharge de deblais", "transport de deblais", "evacuation en decharge agreee", "chargement et evacuation", "mise en depot definitif", "frais de decharge"],
    titleSynonyms: ["terrassements generaux", "evacuation et mise en decharge", "gestion des deblais", "transport et mise en depot"],
    mustNotContain: ["deblais mis en remblais", "deblais stockes sur site"],
  },
  {
    concept: "compactage_portance",
    devisKeywords: ["compactage", "compactage de la plate forme", "compactage du fond de forme", "essai de plaque", "essai a la plaque", "essai de portance", "portance", "reglage et compactage", "controle de compactage"],
    titleSynonyms: ["terrassements generaux", "compactage et controle", "preparation du fond de forme", "essais et controles", "portance de la plateforme"],
    mustNotContain: ["compactage de tranchee", "compactage enrobe"],
  },
  {
    concept: "scarification_decompactage",
    devisKeywords: ["scarification", "scarification de chaussee", "scarification du fond de forme", "sous solage", "decompactage", "reprise du fond de forme", "ameublissement"],
    titleSynonyms: ["terrassements generaux", "preparation du fond de forme", "scarification et reprofilage", "preparation des supports"],
    mustNotContain: ["rabotage", "fraisage enrobe"],
  },
  {
    concept: "fond_de_forme_arase",
    devisKeywords: ["fond de forme", "reglage du fond de forme", "preparation du fond de forme", "arase terrassement", "plate forme support", "plateforme terrassement", "reglage de plateforme", "nivellement fond de forme"],
    titleSynonyms: ["terrassements generaux", "fond de forme", "preparation du fond de forme", "arase de terrassement", "plateforme support de chaussee"],
    mustNotContain: ["couche de forme", "couche de roulement"],
  },
  {
    concept: "couche_de_forme",
    devisKeywords: ["couche de forme", "couche de forme en grave", "couche de forme gnt 0/80", "couche de forme en grave naturelle", "couche de forme en grave recyclee", "couche de forme 0/60", "couche de forme 0/100"],
    titleSynonyms: ["couches de forme", "couche de forme", "structure de chaussee", "corps de chaussee", "assises de chaussee"],
    mustNotContain: ["couche de roulement", "couche d accrochage", "couche bitumineuse"],
  },
  {
    concept: "couche_de_fondation",
    devisKeywords: ["couche de fondation", "couche de base ou de fondation", "couche de base", "couche d assise", "assise en grave", "couche de fondation gnt 0/20", "couche de base en gnt 0/31.5"],
    titleSynonyms: ["couches de forme", "structure de chaussee", "corps de chaussee", "assises de chaussee", "couches d assise", "couche de fondation et de base"],
    mustNotContain: ["fondation beton", "fondation de bordure", "couche de roulement", "massif de fondation"],
  },
  {
    concept: "grave_non_traitee",
    devisKeywords: ["grave non traitee", "gnt", "gnt 0/20", "gnt 0/31.5", "gnt 0/60", "gnt 0/80", "grave naturelle 0/80", "grave concassee 0/20", "grave calcaire concassee", "grave de recyclage", "grave recyclee 0/80", "grave 0/31.5", "tout venant"],
    titleSynonyms: ["couches de forme", "graves non traitees", "materiaux d assise", "structure de chaussee", "graves naturelles et recyclees"],
    mustNotContain: ["grave bitume", "grave emulsion", "grave ciment", "grave traitee", "grave hydraulique", "enrobe"],
  },
  {
    concept: "traitement_sol_liants",
    devisKeywords: ["traitement de sol", "traitement de sol a la chaux", "traitement de sol au liant routier", "traitement de sol au liant hydraulique", "traitement a la chaux", "traitement au ciment", "traitement aux liants hydrauliques", "stabilisation au liant", "malaxage en place"],
    titleSynonyms: ["grave traitee aux liants hydrauliques", "traitement de sol", "traitement des sols en place", "stabilisation des sols", "sols traites"],
    mustNotContain: ["traitement de surface", "traitement mineralisant", "traitement hydrofuge", "traitement de joint", "grave ciment"],
  },
  {
    concept: "grave_traitee_liant_hydraulique",
    devisKeywords: ["grave traitee aux liants hydrauliques", "grave ciment", "couche de base en grave ciment", "grave laitier", "grave hydraulique", "grave traitee au ciment", "sol ciment"],
    titleSynonyms: ["grave traitee aux liants hydrauliques", "graves traitees", "assises traitees", "couches traitees aux liants hydrauliques", "structure de chaussee"],
    mustNotContain: ["grave non traitee", "grave bitume", "grave emulsion", "enrobe bitumineux"],
  },
  {
    concept: "grave_bitume",
    devisKeywords: ["grave bitume", "gb3", "gb 0/14", "gb 0/20", "grave bitume 0/14", "grave bitume 0/20", "couche de base grave bitume", "couche de fondation grave bitume", "gb3 0/14"],
    titleSynonyms: ["grave bitume", "graves bitumes", "couche de base", "couche d assise", "assises de chaussee", "assise traitee aux liants hydrocarbones"],
    mustNotContain: ["grave non traitee", "grave traitee aux liants hydrauliques", "grave ciment"],
  },
  {
    concept: "eme_module_eleve",
    devisKeywords: ["eme 0/10", "eme 0/14", "enrobe a module eleve", "grave enrobe a module eleve", "couche de base eme", "eme2", "enrobe module eleve assise"],
    titleSynonyms: ["enrobe a module eleve", "enrobes a module eleve", "couche de base", "assises de chaussee", "graves bitumes a module eleve"],
    mustNotContain: ["bbme", "couche de roulement", "beton bitumineux a module eleve"],
  },
  {
    concept: "couche_accrochage_impregnation",
    devisKeywords: ["couche d accrochage", "couche daccrochage", "emulsion de bitume", "emulsion daccrochage", "emulsion cationique", "couche d impregnation", "impregnation", "repandage emulsion", "couche d accrochage a l emulsion"],
    titleSynonyms: ["couche d accrochage", "couche d impregnation", "liants d accrochage", "couches d accrochage et d impregnation", "revetements bitumineux"],
    mustNotContain: ["enduit superficiel", "enrobe a froid"],
  },
  {
    concept: "bbsg",
    devisKeywords: ["bbsg 0/10", "bbsg 0/14", "bbsg 0/6", "beton bitumineux semi grenu", "couche de roulement bbsg", "enrobe bbsg", "bb 0/10", "fourniture et mise en oeuvre bbsg"],
    titleSynonyms: ["beton bitumineux semi-grenu", "beton bitumineux semi grenu", "couche de roulement", "revetements bitumineux", "voirie - revetements", "couche de roulement en enrobe"],
    mustNotContain: ["bordure", "regard", "canalisation"],
  },
  {
    concept: "bbme_roulement",
    devisKeywords: ["bbme 0/10", "bbme 0/14", "beton bitumineux a module eleve", "enrobe bbme", "couche de roulement bbme"],
    titleSynonyms: ["beton bitumineux a module eleve", "couche de roulement", "revetements bitumineux", "enrobes a module eleve"],
    mustNotContain: ["eme", "grave bitume", "assise"],
  },
  {
    concept: "bbtm",
    devisKeywords: ["bbtm 0/6", "bbtm 0/10", "beton bitumineux tres mince", "enrobe bbtm", "couche de roulement bbtm"],
    titleSynonyms: ["beton bitumineux tres mince", "couche de roulement", "revetements bitumineux", "enrobes minces"],
    mustNotContain: ["bbme", "beton bitumineux mince"],
  },
  {
    concept: "bbm",
    devisKeywords: ["bbm 0/10", "bbm 0/6", "beton bitumineux mince", "enrobe bbm", "couche de roulement bbm"],
    titleSynonyms: ["beton bitumineux mince", "couche de roulement", "revetements bitumineux", "enrobes minces"],
    mustNotContain: ["bbtm", "bbme", "bbsg"],
  },
  {
    concept: "enrobe_a_chaud_generique",
    devisKeywords: ["enrobe a chaud", "enrobe noir", "enrobe bitumineux", "couche de roulement en enrobe", "tapis d enrobe", "fourniture et pose d enrobe", "enrobe pour trottoir", "enrobe pour chaussee", "mise en oeuvre d enrobe"],
    titleSynonyms: ["revetements bitumineux", "enrobes a chaud", "voirie - revetements", "couche de roulement", "mise en oeuvre des enrobes"],
    mustNotContain: ["a froid", "grave bitume", "bordure"],
  },
  {
    concept: "enrobe_a_froid",
    devisKeywords: ["enrobe a froid", "enrobe stockable", "enrobe a froid stockable", "enrobe coule a froid", "ecf", "reparation enrobe a froid", "enrobe a froid pour reparation", "point a temps"],
    titleSynonyms: ["enrobes a froid", "enrobe coule a froid", "techniques a froid", "revetements bitumineux", "entretien des chaussees"],
    mustNotContain: ["a chaud", "bbsg"],
  },
  {
    concept: "enduit_superficiel",
    devisKeywords: ["enduit superficiel", "enduit superficiel d usure", "esu", "enduit monocouche", "enduit bicouche", "enduit tricouche", "gravillonnage", "enduit gravillonne", "revetement gravillonne", "enrobage gravillon"],
    titleSynonyms: ["enduits superficiels", "enduit superficiel d usure", "enduits superficiels d usure", "revetements gravillonnes", "techniques d enduisage", "revetements bitumineux"],
    mustNotContain: ["couche d accrochage", "enrobe"],
  },
  {
    concept: "fraisage_rabotage",
    devisKeywords: ["fraisage", "rabotage", "fraisage de chaussee", "rabotage d enrobe", "fraisage d enrobe", "decaissement enrobe", "fraisage en pleine largeur", "raccordement par fraisage", "fraisage et evacuation"],
    titleSynonyms: ["fraisage", "rabotage", "fraisage des chaussees", "demolition de chaussee existante", "travaux preparatoires", "rabotage et fraisage"],
    mustNotContain: ["pose", "fourniture enrobe"],
  },
  {
    concept: "reprofilage",
    devisKeywords: ["reprofilage", "couche de reprofilage", "reprofilage en enrobe", "reprofilage en grave bitume", "reglage et reprofilage", "couche de reglage", "rechargement"],
    titleSynonyms: ["reprofilage", "couche de reprofilage", "remise a niveau", "revetements bitumineux", "couche de reglage"],
    mustNotContain: ["fraisage", "couche d accrochage"],
  },
  {
    concept: "bordures_caniveaux",
    devisKeywords: ["bordure t2", "bordure t1", "bordure t3", "bordure a1", "bordure p1", "fourniture et pose de bordure", "caniveau cs1", "caniveau cc1", "bordure caniveau", "bordure beton", "pose de bordure"],
    titleSynonyms: ["bordures", "bordures et caniveaux", "bordures - caniveaux", "bordures et bordurettes", "ouvrages de voirie"],
    mustNotContain: ["bordure de regard", "bordure paysagere bois"],
  },
  {
    concept: "fondation_pose_bordure",
    devisKeywords: ["fondation de bordure", "beton de fondation de bordure", "massif de fondation bordure", "solin beton", "epaulement beton bordure", "beton de calage bordure"],
    titleSynonyms: ["bordures", "bordures et caniveaux", "betons et mortiers", "fondation des bordures", "pose des bordures"],
    mustNotContain: ["couche de fondation", "beton desactive"],
  },
  {
    concept: "pavage_dallage",
    devisKeywords: ["pave", "paves", "pave beton", "pave granit", "pave porphyre", "dalle podotactile", "dallage pierre", "fourniture et pose de paves", "pose de dalles", "mosaique de granit"],
    titleSynonyms: ["pavage", "pavages et dallages", "revetements modulaires", "paves et dalles", "revetements en pierre naturelle"],
    mustNotContain: ["dallage beton arme", "dalle de regard"],
  },
  {
    concept: "beton_voirie_desactive",
    devisKeywords: ["beton desactive", "beton de voirie desactive", "revetement beton desactive", "beton lave desactive", "beton desactive grenaille", "dallage beton desactive"],
    titleSynonyms: ["beton desactive", "betons desactives", "revetements en beton", "beton de voirie", "revetements decoratifs en beton", "betons et mortiers"],
    mustNotContain: ["beton balaye", "beton imprime", "beton bitumineux", "regard"],
  },
  {
    concept: "beton_voirie_balaye_brut",
    devisKeywords: ["beton balaye", "beton de voirie balaye", "revetement beton balaye", "beton brosse", "beton imprime", "beton matrice", "dalle beton balaye", "beton brut de voirie"],
    titleSynonyms: ["betons et mortiers", "beton de voirie", "revetements en beton", "beton balaye et imprime", "amenagements en beton"],
    mustNotContain: ["beton desactive", "beton bitumineux", "regard"],
  },
  {
    concept: "betons_mortiers_ouvrages",
    devisKeywords: ["beton de proprete", "beton arme", "beton c25/30", "mortier de pose", "mortier de scellement", "beton de calage", "beton pour ouvrage", "gros beton", "beton de masse"],
    titleSynonyms: ["betons et mortiers", "beton et mortier", "ouvrages en beton", "betons hydrauliques", "maconnerie et beton"],
    mustNotContain: ["beton bitumineux", "beton desactive", "grave ciment"],
  },
  {
    concept: "canalisation_assainissement",
    devisKeywords: ["tuyau pvc cr8", "tuyau pvc dn200", "canalisation pvc", "canalisation beton", "tuyau fonte assainissement", "collecteur eaux usees", "collecteur eaux pluviales", "tuyau cr8 dn315", "fourniture et pose de canalisation", "buse beton"],
    titleSynonyms: ["canalisations", "canalisations d assainissement", "reseaux d assainissement", "collecteurs", "reseau eaux usees et eaux pluviales"],
    mustNotContain: ["canalisation d eau potable", "gaine electrique", "fourreau"],
  },
  {
    concept: "tranchee_reseaux",
    devisKeywords: ["tranchee", "terrassement en tranchee", "fouille en tranchee", "ouverture de tranchee", "remblai de tranchee", "remblaiement de tranchee", "lit de pose", "enrobage de canalisation", "grillage avertisseur"],
    titleSynonyms: ["tranchees", "terrassement des tranchees", "fouilles et tranchees", "tranchees et remblaiement", "pose en tranchee"],
    mustNotContain: ["terrassement general", "deblai en grande masse"],
  },
  {
    concept: "regards_ouvrages_annexes",
    devisKeywords: ["regard de visite", "regard borgne", "regard prefabrique", "tampon fonte", "cadre et tampon", "grille avaloir", "boite de branchement", "tete de buse", "fourniture et pose de regard", "tampon hydraulique"],
    titleSynonyms: ["regards", "regards et ouvrages annexes", "ouvrages annexes d assainissement", "regards et boites de branchement", "ouvrages de collecte"],
    mustNotContain: ["regard de chaussee enrobe", "chambre telecom"],
  },
  {
    concept: "drainage",
    devisKeywords: ["drain", "drain routier", "drainage", "tuyau de drainage", "drain agricole", "tranchee drainante", "massif drainant", "drain pvc", "collecteur de drainage", "barbacane"],
    titleSynonyms: ["drainage", "reseau de drainage", "drains et drainage", "ouvrages de drainage", "assainissement et drainage"],
    mustNotContain: ["canalisation d assainissement", "regard de visite"],
  },
  {
    concept: "reseau_eau_potable",
    devisKeywords: ["canalisation d eau potable", "tuyau fonte eau potable", "tuyau pehd eau potable", "branchement eau potable", "robinet vanne", "poteau incendie", "bouche a cle", "conduite d eau potable", "piece de raccord eau"],
    titleSynonyms: ["reseau d eau potable", "adduction d eau potable", "canalisations d eau potable", "reseau aep", "distribution d eau potable"],
    mustNotContain: ["assainissement", "eaux usees", "eaux pluviales", "gaine electrique"],
  },
  {
    concept: "reseaux_secs",
    devisKeywords: ["fourreau", "gaine tpc", "gaine electrique", "reseau sec", "chambre telecom", "chambre l1t", "tranchee reseaux secs", "cable basse tension", "fourreau aiguille", "grillage avertisseur rouge"],
    titleSynonyms: ["reseaux secs", "reseaux divers", "fourreaux et chambres", "genie civil telecom et electricite", "reseaux d energie et telecom"],
    mustNotContain: ["assainissement", "eau potable", "drainage"],
  },
  {
    concept: "eclairage_public",
    devisKeywords: ["candelabre", "mat d eclairage", "massif de candelabre", "luminaire", "point lumineux", "cable eclairage", "fourniture et pose de candelabre", "crosse d eclairage", "armoire d eclairage"],
    titleSynonyms: ["eclairage public", "reseau d eclairage public", "installation d eclairage", "equipements d eclairage"],
    mustNotContain: ["signalisation tricolore", "reseaux secs fourreau"],
  },
  {
    concept: "signalisation_horizontale",
    devisKeywords: ["marquage au sol", "signalisation horizontale", "bande axiale", "passage pieton marquage", "peinture routiere", "marquage resine", "fleche directionnelle", "ligne continue", "zebra", "marquage place de parking"],
    titleSynonyms: ["signalisation horizontale", "marquage au sol", "marquage routier", "signalisation de marquage"],
    mustNotContain: ["signalisation verticale", "signalisation de chantier", "panneau"],
  },
  {
    concept: "signalisation_verticale",
    devisKeywords: ["panneau de signalisation", "panneau ab", "panneau b", "support de panneau", "mat de panneau", "fourniture et pose de panneau", "panneau de police", "panneau directionnel", "poteau de signalisation"],
    titleSynonyms: ["signalisation verticale", "signalisation de police", "panneaux de signalisation", "signalisation directionnelle"],
    mustNotContain: ["signalisation horizontale", "signalisation de chantier", "marquage"],
  },
  {
    concept: "mobilier_urbain",
    devisKeywords: ["potelet", "barriere", "banc", "corbeille", "arceau velo", "borne", "mobilier urbain", "ralentisseur", "cale roue", "poteau anti stationnement"],
    titleSynonyms: ["mobilier urbain", "equipements urbains", "amenagements de surface", "mobilier et equipements"],
    mustNotContain: ["candelabre", "panneau de signalisation"],
  },
  {
    concept: "espaces_verts_plantations",
    devisKeywords: ["fourniture de terre vegetale", "regalage terre vegetale", "engazonnement", "ensemencement", "plantation d arbre", "plantation d arbustes", "gazon", "paillage", "fosse de plantation", "arrosage integre"],
    titleSynonyms: ["espaces verts", "amenagements paysagers", "plantations et engazonnement", "travaux paysagers", "espaces verts et plantations"],
    mustNotContain: ["decapage terre vegetale", "debroussaillage", "terrassement"],
  },
  {
    concept: "geotextile_geosynthetiques",
    devisKeywords: ["geotextile", "geotextile classe 3", "geotextile de separation", "geotextile anticontaminant", "geotextile pour stabilisation du fond de forme", "geomembrane", "geogrille", "geocomposite", "nappe geotextile"],
    titleSynonyms: ["geotextiles et geosynthetiques", "geosynthetiques", "terrassements generaux", "couches de forme", "geotextiles de separation et de renforcement"],
    mustNotContain: ["grillage avertisseur", "feutre bitumineux"],
  },
  {
    concept: "assainissement_pluvial_ouvrages",
    devisKeywords: ["noue", "bassin de retention", "puits d infiltration", "ouvrage de regulation", "limiteur de debit", "cloison siphoide", "separateur hydrocarbures", "ouvrage de gestion des eaux pluviales", "massif d infiltration"],
    titleSynonyms: ["gestion des eaux pluviales", "ouvrages d infiltration", "assainissement pluvial", "ouvrages de retention", "techniques alternatives"],
    mustNotContain: ["canalisation", "regard de visite", "drainage routier"],
  },
  {
    concept: "controles_essais",
    devisKeywords: ["essai de compactage", "controle de compacite", "essai a la plaque", "essai au gammadensimetre", "passage camera", "test d etancheite", "controle de reseau", "essai de plaque", "epreuve de pression"],
    titleSynonyms: ["essais et controles", "controles et essais", "controles de qualite", "essais de reception", "epreuves et controles"],
    mustNotContain: ["essai de portance plateforme"],
  },
];
