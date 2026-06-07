// src/data/helpContent.js
// Contenu d'aide centralise pour tous les modules EstimaVRD.
// Chaque cle = moduleId utilise par HelpPanel.

export const helpContent = {

  // ──────────────────────────────────────────────────────────────────────────
  // ESTIMATION (module principal — ProjectView)
  // ──────────────────────────────────────────────────────────────────────────
  estimation: {
    title: 'Guide — Estimation',
    subtitle: 'Construire votre devis VRD chapitre par chapitre',
    tabs: [
      {
        id: 'structure', label: 'Structure', icon: 'ListTree',
        sections: [
          { type: 'intro', text: "L'estimation s'organise comme un bordereau : chapitres → sous-chapitres → articles. Les totaux et sous-totaux se recalculent en direct." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Chapitre', description: "Bouton « Chapitre » (à droite du ruban). Un chapitre est numéroté et sous-totalisé ; il contient sous-chapitres et articles." },
              { color: 'emerald', title: 'Sous-chapitre', description: "Regroupement intermédiaire à l'intérieur d'un chapitre. Sélectionnez un chapitre puis ajoutez-y un sous-chapitre." },
              { color: 'amber', title: 'Article', description: "Ligne de prix issue du BPU. Ouvrez le volet « BPU » et cliquez un article : il s'ajoute à l'élément sélectionné." },
              { color: 'purple', title: 'Option', description: "Le toggle « option » sort un poste du total principal (affiché à part, barré). Utile pour les variantes / PSE." },
              { color: 'rose', title: 'Glisser-déposer', description: "Réorganisez chapitres, sous-chapitres et articles par glisser-déposer (poignée ⋮⋮)." },
            ],
          },
          { type: 'tip', text: "Cliquez une ligne pour la sélectionner (surbrillance verte) : c'est la cible des ajouts BPU et de la barre de formule." },
        ],
      },
      {
        id: 'saisie', label: 'Saisie & formules', icon: 'Edit3',
        sections: [
          { type: 'intro', text: "Renseignez les quantités dans le tableau. Une quantité peut aussi être une formule qui se calcule à partir d'autres articles." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Volet BPU', description: "Bouton « BPU » : ouvre la bibliothèque (articles + blocs). Recherche plein texte et filtre par catégorie. Le clic ajoute au chapitre sélectionné." },
              { color: 'emerald', title: 'Quantités', description: "Tapez la quantité dans la colonne Qté. Les articles forfaitaires (ENS, FT, U…) sont figés à 1." },
              { color: 'amber', title: 'Formules ƒ(x)', description: "Une quantité peut être une formule, ex : =[FOUILLE EN MASSE]*1.1. Référencez d'autres articles par clic." },
              { color: 'purple', title: '% à valoir', description: "Bouton « % à valoir » : applique un pourcentage aux petites quantités / forfaits pour couvrir les aléas." },
            ],
          },
          { type: 'tip', title: 'Aide formules dédiée', text: "Le détail de la syntaxe, l'insertion par clic et les raccourcis sont dans l'« Aide formules » (bouton flottant en bas à droite, ou icône ƒ(x) de la barre de formule)." },
        ],
      },
      {
        id: 'tranches', label: 'Tranches', icon: 'GitBranch',
        sections: [
          { type: 'intro', text: "Un projet VRD peut être découpé en tranches (Ferme, Conditionnelles). Chaque article porte une quantité par tranche." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Gérer les tranches', description: "Barre des tranches sous le ruban : ajoutez TF, TC1, TC2…, renommez, réordonnez." },
              { color: 'emerald', title: 'Global vs par tranche', description: "« Global » additionne toutes les tranches (synthèse). Sélectionnez une tranche précise pour saisir ses quantités." },
              { color: 'amber', title: 'Formules propagées', description: "Une formule saisie dans la barre se propage automatiquement à toutes les tranches." },
            ],
          },
          { type: 'warning', text: "En vue « Global », la saisie des quantités est désactivée — sélectionnez une tranche pour éditer." },
        ],
      },
      {
        id: 'blocs', label: 'Blocs', icon: 'Boxes',
        sections: [
          { type: 'intro', text: "Un bloc regroupe plusieurs articles à insérer en un clic. Ouvrez la zone « Blocs » en bas du volet BPU, filtrez par Tous / Calculé / Agrégat, puis cliquez pour insérer." },
          {
            type: 'card', icon: 'Calculator', color: 'indigo', title: 'Bloc Calculé',
            description: "Inséré en sous-chapitre avec une quantité pilote sur l'en-tête : surface (bloc m²), longueur (ml) ou volume (m³). Les quantités des composants se calculent automatiquement.",
          },
          {
            type: 'card', icon: 'Layers', color: 'violet', title: 'Bloc Agrégat',
            description: "Inséré en chapitre ou sous-chapitre (au choix). Aucun calcul : saisissez les quantités ligne par ligne, comme des articles classiques.",
          },
          { type: 'tip', text: "Les blocs se créent dans le Catalogue BPU (onglet Blocs). Voir l'aide du Catalogue pour la géométrie (épaisseur, densité, largeur, perte)." },
        ],
      },
      {
        id: 'modes', label: 'Modes & exports', icon: 'FileDown',
        sections: [
          { type: 'intro', text: "Deux modes d'affichage et des exports rapides DQE / Estimation." },
          {
            type: 'grid',
            items: [
              { title: 'Mode Étude', text: "Édition complète : ajout, formules, prix, numérotation. C'est votre espace de travail.", color: 'emerald' },
              { title: 'Mode Rendu', text: "Lecture seule, vue client. Applique le % client et débloque les exports + la comparaison des écarts.", color: 'indigo' },
            ],
          },
          {
            type: 'card', icon: 'FileDown', color: 'red', title: 'Exports rapides (mode Rendu)',
            description: "Disponibles via le ruban en mode Rendu.",
            steps: [
              "PDF DQE — Détail Quantitatif Estimatif",
              "PDF Estimation — version chiffrée MOE",
              "Excel DQE / Excel Estimation — données pour traitement externe",
            ],
          },
          {
            type: 'card', icon: 'BarChart3', color: 'amber', title: 'Écarts',
            description: "En mode Rendu, le bouton « Écarts » affiche la comparaison visuelle (base vs rendu / % client).",
          },
        ],
      },
      {
        id: 'outils', label: 'Outils & sauvegarde', icon: 'Settings',
        sections: [
          { type: 'intro', text: "Sauvegarde, contrôles qualité et numérotation du bordereau." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Sauvegarde Cloud', description: "« Sauver Cloud » enregistre tout sur Firebase ; « Ouvrir Cloud » recharge un projet. L'état est indiqué en haut à droite." },
              { color: 'emerald', title: 'Fichier JSON', description: "« Enregistrer JSON » / « Ouvrir JSON » : sauvegarde et restauration hors-ligne (archivage, transfert)." },
              { color: 'amber', title: 'Audit prix', description: "Compare les prix du projet à la base BPU et signale les écarts." },
              { color: 'violet', title: 'Vérif. n° prix', description: "Contrôle l'unicité des numéros de prix (même libellé + même unité partout). Badge rouge = anomalies à corriger." },
              { color: 'teal', title: 'Audit bordereau', description: "Audite prix, unités, désignations et descriptions du bordereau vs la base BPU (mode Étude)." },
              { color: 'slate', title: 'Annuler', description: "« Annuler » (Ctrl+Z) revient sur la dernière action." },
            ],
          },
          {
            type: 'card', icon: 'ListTree', color: 'blue', title: 'Numérotation Auto / Manuel',
            description: "Basculez la numérotation du bordereau entre automatique (séquentielle) et manuelle (numéros saisis / repris du BPU).",
          },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // GESTION DE PROJETS
  // ──────────────────────────────────────────────────────────────────────────
  projectManager: {
    title: 'Guide — Gestion de Projets',
    subtitle: 'Organiser et sauvegarder vos projets',
    tabs: [
      {
        id: 'sauvegarder', label: 'Sauvegarder', icon: 'Upload',
        sections: [
          { type: 'intro', text: "Vous disposez de 3 methodes de sauvegarde, chacune avec un role different." },
          {
            type: 'card', icon: 'Upload', color: 'emerald', title: 'CLOUD SAVE — Sauvegarde principale', badge: 'Recommande',
            description: "Sauvegarde tout sur Firebase : chapitres, quantites, formules, cases CCTP/RC cochees, analyse des prix.",
            steps: [
              'Cliquez sur le bouton vert "CLOUD SAVE" dans la colonne du milieu',
              "Une animation confirme la sauvegarde",
              "Le projet est accessible depuis n'importe quel ordinateur",
            ],
            tip: "Sauvegardez a chaque fin de session ou apres une modification importante.",
          },
          {
            type: 'card', icon: 'Save', color: 'blue', title: 'EXPORT JSON — Sauvegarde hors-ligne', badge: 'Archivage',
            description: "Telecharge un fichier .json sur votre disque dur. Utile pour archiver ou transferer un projet.",
            steps: [
              'Cliquez sur "EXPORT JSON" dans la colonne du milieu',
              "Un fichier PROJET_NOM.json est telecharge",
              "Gardez ce fichier en lieu sur (cle USB, email...)",
            ],
            tip: "Faites un export JSON avant chaque grosse modification — c'est votre filet de securite.",
          },
          {
            type: 'card', icon: 'Clock', color: 'slate', title: 'Cache Local — Historique rapide', badge: 'Automatique',
            description: "Enregistrement automatique dans le navigateur a chaque ouverture de projet.",
            steps: [
              "Aucune action requise — c'est automatique",
              'Visible dans la colonne de droite, onglet "Local"',
              "Disparait si vous videz le cache du navigateur",
            ],
            tip: "Ne pas compter dessus comme sauvegarde principale.",
          },
        ],
      },
      {
        id: 'restaurer', label: 'Restaurer', icon: 'Cloud',
        sections: [
          { type: 'intro', text: "Pour reprendre un projet existant, utilisez la colonne de droite." },
          {
            type: 'card', icon: 'Cloud', color: 'emerald', title: 'Depuis le Cloud',
            steps: [
              'Assurez-vous d\'etre sur l\'onglet "Cloud" dans la colonne de droite',
              "Vous voyez la liste de tous vos projets sauvegardes",
              'Le projet actif est marque "EN COURS"',
              "Cliquez sur un projet pour l'ouvrir",
              "Si la liste est vide, cliquez sur l'icone de rafraichissement",
            ],
          },
          {
            type: 'card', icon: 'FileJson', color: 'purple', title: 'Depuis un fichier JSON',
            steps: [
              'Cliquez sur "Charger JSON" dans la colonne du milieu',
              "Selectionnez votre fichier .json",
              "Confirmez l'ouverture — tout est restaure automatiquement",
              "Cases CCTP/RC, analyse des prix et config BPU sont aussi restaures",
            ],
          },
          {
            type: 'tip',
            title: "Changer d'ordinateur ?",
            text: 'Faites un Cloud Save sur l\'ancien PC. Sur le nouveau, ouvrez l\'app → onglet "Cloud" → cliquez sur votre projet. C\'est tout.',
          },
        ],
      },
      {
        id: 'organiser', label: 'Organiser', icon: 'Layers',
        sections: [
          { type: 'intro', text: "Quelques outils pour gerer plusieurs projets efficacement." },
          {
            type: 'card', icon: 'PlusCircle', color: 'blue', title: 'Creer un nouveau projet',
            description: 'Cliquez sur "Nouveau" en haut a droite. Un projet vide est cree avec un chapitre par defaut.',
            warning: "Le projet en cours n'est pas perdu — il reste sauvegarde sur le Cloud.",
          },
          {
            type: 'card', icon: 'Copy', color: 'emerald', title: 'Dupliquer un projet',
            description: "Cliquez sur \"Dupliquer\" dans la carte session. Utile pour creer une variante sans toucher a l'original.",
            warning: "Le clone est cree localement — pensez a faire un Cloud Save apres.",
          },
          {
            type: 'card', icon: 'Folder', color: 'amber', title: 'Organiser en dossiers',
            description: "Dans l'onglet Cloud, utilisez le panneau de gauche pour creer des dossiers et sous-dossiers. Survolez une affaire puis cliquez l'icone dossier pour la deplacer.",
            warning: "Les dossiers sont partages entre tous les membres de votre societe.",
          },
          {
            type: 'card', icon: 'Trash2', color: 'red', title: 'Supprimer un projet du Cloud',
            description: "Dans la liste Cloud a droite, survolez un projet → icone corbeille apparait → cliquez pour supprimer.",
            warning: "La suppression est definitive. Faites un Export JSON avant si vous voulez garder une archive.",
          },
        ],
      },
      {
        id: 'exporter', label: 'Export / Import', icon: 'FileJson',
        sections: [
          { type: 'intro', text: "Le fichier JSON est une copie complete de votre projet — utilisable sans internet." },
          {
            type: 'table', title: 'Contenu du fichier JSON exporte',
            rows: [
              { label: 'Chapitres & items', desc: 'Tous les postes, quantites et formules' },
              { label: 'Cases CCTP cochees', desc: "Selections et etats d'expansion" },
              { label: 'Cases RC cochees', desc: "Selections et etats d'expansion" },
              { label: 'Analyse des prix', desc: 'Toutes les lignes de decomposition' },
              { label: 'Config numerotation', desc: 'Mode auto/manuel du BPU' },
              { label: '% frais client', desc: 'Taux applique aux calculs' },
              { label: 'Infos fiche projet', desc: 'Client, lieu, dates, tranches...' },
            ],
          },
          {
            type: 'card', icon: 'Upload', color: 'blue', title: 'Importer un fichier JSON',
            steps: [
              'Cliquez sur "Charger JSON" dans la colonne de gauche',
              "Selectionnez le fichier .json",
              "Confirmez l'ouverture — tout est restaure automatiquement",
            ],
          },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // ADMINISTRATION
  // ──────────────────────────────────────────────────────────────────────────
  admin: {
    title: 'Guide Administrateur',
    subtitle: 'Gerer les clients et les entreprises',
    tabs: [
      {
        id: 'nouveau_client', label: 'Ajouter un client', icon: 'UserPlus',
        sections: [
          { type: 'intro', text: "Pour onboarder un nouveau client, suivez ces 5 etapes dans l'ordre. Ca prend environ 3 minutes." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Creer son compte Firebase', description: 'Allez dans Firebase Console → Authentication → "Ajouter un utilisateur". Entrez son email + un mot de passe temporaire.', link: 'https://console.firebase.google.com' },
              { color: 'amber', title: 'Copier son UID', description: "Toujours dans Authentication, trouvez l'utilisateur dans la liste. Copiez la valeur de la colonne \"User UID\"." },
              { color: 'emerald', title: 'Creer son entreprise ici', description: "Tapez le nom de l'entreprise dans le champ en haut de cette page, puis cliquez \"Creer\"." },
              { color: 'purple', title: "Assigner l'utilisateur", description: "Collez l'UID copie a l'etape 2, choisissez l'entreprise, et cliquez \"Assigner\"." },
              { color: 'slate', title: 'Envoyer les identifiants', description: "Envoyez au client l'URL de l'application, son email et le mot de passe temporaire." },
            ],
          },
        ],
      },
      {
        id: 'supprimer', label: 'Supprimer', icon: 'Trash2',
        sections: [
          { type: 'intro', text: "La suppression d'une entreprise efface toutes ses donnees definitivement. Elle est protegee par une confirmation obligatoire." },
          {
            type: 'card', icon: 'Trash2', color: 'red', title: 'Comment supprimer une entreprise',
            steps: [
              "Cliquez sur l'icone corbeille rouge a droite de l'entreprise",
              "Une fenetre s'ouvre avec la liste de tout ce qui sera supprime",
              "Tapez exactement le nom de l'entreprise pour confirmer",
              'Cliquez "Supprimer definitivement"',
            ],
          },
          {
            type: 'table', title: 'Donnees supprimees automatiquement',
            rows: [
              { label: 'Articles BPU' }, { label: 'Categories' }, { label: 'Unites' }, { label: 'Projets' },
              { label: 'CCTP maitre' }, { label: 'RC maitre' }, { label: 'Charte graphique' }, { label: 'Acces membres' },
            ],
          },
          {
            type: 'warning',
            text: "La suppression ne supprime pas le compte Firebase Auth de l'utilisateur. Pour supprimer son acces, allez dans Firebase Console → Authentication et supprimez-le manuellement.",
          },
        ],
      },
      {
        id: 'isolation', label: 'Isolation', icon: 'Shield',
        sections: [
          { type: 'intro', text: "Chaque entreprise a son propre espace ferme dans Firebase. Un client ne peut jamais voir les donnees d'un autre client." },
          {
            type: 'table', title: 'Donnees isolees par entreprise',
            rows: [
              { label: 'Articles BPU', desc: 'Base de prix propre a chaque client' },
              { label: 'Categories', desc: "Organisation de la bibliotheque" },
              { label: 'Unites', desc: 'Unites de mesure personnalisees' },
              { label: 'Projets', desc: 'Tous les projets et leurs chiffres' },
              { label: 'CCTP maitre', desc: 'Clauses techniques personnalisees' },
              { label: 'RC maitre', desc: 'Reglement de consultation' },
              { label: 'Charte graphique', desc: 'Logo, couleurs, coordonnees' },
            ],
          },
        ],
      },
      {
        id: 'firebase', label: 'Firebase Console', icon: 'ExternalLink',
        sections: [
          { type: 'intro', text: "Firebase Console est le tableau de bord de Google ou sont stockees toutes les donnees. Vous en avez besoin principalement pour creer les comptes utilisateurs." },
          {
            type: 'card', icon: 'ExternalLink', color: 'blue', title: 'Ouvrir Firebase Console',
            description: 'console.firebase.google.com',
            link: 'https://console.firebase.google.com',
          },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Authentication', description: "Pour creer, voir et supprimer les comptes utilisateurs. C'est ici que vous trouvez les UID." },
              { color: 'emerald', title: 'Firestore Database', description: "Pour voir toutes les donnees stockees. Naviguez dans les donnees de chaque entreprise via la collection companies." },
              { color: 'amber', title: 'Firestore → Regles', description: "Les regles de securite qui isolent les donnees entre entreprises. Ne pas modifier sans savoir ce que vous faites." },
            ],
          },
          {
            type: 'tip',
            title: 'Astuce',
            text: "Vous n'avez besoin d'aller sur Firebase Console que pour creer les comptes (etape 1). Tout le reste se fait directement ici dans l'app.",
          },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // COMPTE RENDU DE REUNION (CRC)
  // ──────────────────────────────────────────────────────────────────────────
  crc: {
    title: 'Aide — Compte Rendu',
    subtitle: 'Guide complet du module CRC',
    tabs: [
      {
        id: 'reunions', label: 'Reunions', icon: 'Calendar',
        sections: [
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Creer un chantier', description: 'Utilisez le menu deroulant "Chantier" dans le ruban pour creer ou selectionner un chantier. Chaque chantier contient ses propres reunions, participants et categories.' },
              { color: 'emerald', title: 'Creer une reunion', description: 'Cliquez sur "Nouveau CR" pour creer une reunion vierge. Le numero est attribue automatiquement.' },
              { color: 'amber', title: 'Dupliquer une reunion', description: '"Dupliquer CR" copie la reunion courante avec report automatique des observations non resolues (carry-forward). Ideal pour les reunions periodiques.' },
              { color: 'purple', title: 'Audit entre reunions', description: '"Audit CR" compare la reunion courante avec la precedente pour identifier les changements de statut des observations.' },
              { color: 'rose', title: 'Navigation', description: "Naviguez entre les reunions via la liste laterale gauche. Le numero et la date sont affiches, ainsi qu'un indicateur du nombre d'observations ouvertes." },
            ],
          },
          { type: 'tip', title: 'Conseil', text: "Pensez a renseigner la date et le lieu de la prochaine reunion dans l'en-tete. Ces informations apparaissent en evidence dans les exports." },
        ],
      },
      {
        id: 'participants', label: 'Participants', icon: 'Users',
        sections: [
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Groupes participants', description: "Les participants sont organises par groupes (MOA, MOE, SPS, Entreprises...). Chaque groupe a une pastille coloree unique dans les exports." },
              { color: 'emerald', title: 'Ajouter des contacts', description: "Ouvrez le panneau \"Participants\" du ruban. Ajoutez des contacts manuellement ou importez depuis un fichier Excel." },
              { color: 'amber', title: 'Presence et diffusion', description: "Pour chaque contact, cliquez sur le toggle de presence pour cycler : P = Present, E = Excuse, A = Absent, NC = Non convoque." },
              { color: 'purple', title: 'CPR et Diffusion', description: "CPR = le contact recoit le compte rendu. Diffusion = le contact est en copie de diffusion." },
              { color: 'rose', title: 'Bibliotheque de contacts', description: "La bibliotheque sauvegarde vos contacts frequents. Glissez-deposez ou importez depuis Excel pour reutiliser entre chantiers." },
            ],
          },
        ],
      },
      {
        id: 'observations', label: 'Observations', icon: 'ClipboardList',
        sections: [
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Ajouter une observation', description: "Cliquez sur \"+ Ajouter\" en bas de chaque categorie. Renseignez l'emetteur, le texte, et attribuez un responsable." },
              { color: 'emerald', title: 'Statuts', description: "Chaque observation a un statut cliquable qui cycle entre : Vide, Ouvert, En cours, FAIT. Le statut \"Vide\" n'affiche aucune pastille." },
              { color: 'amber', title: 'Mise en forme du texte', description: "Utilisez la barre d'outils au-dessus du champ texte : Gras (Ctrl+B), Souligne (Ctrl+U), Fluo (Ctrl+H)." },
              { color: 'purple', title: 'Photos jointes', description: "Ajoutez des photos aux observations via le bouton \"Photo\". Les images sont incluses dans les exports PDF et Word." },
              { color: 'rose', title: 'Categories et carry-forward', description: "Les observations sont classees par categories. Lors de la duplication d'une reunion, les observations non resolues sont automatiquement reportees." },
            ],
          },
        ],
      },
      {
        id: 'exports', label: 'Exports', icon: 'FileDown',
        sections: [
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Export PDF / Word', description: "Genere un document PDF ou Word professionnel avec en-tete, participants, observations (formatage preserve) et pied de page." },
              { color: 'emerald', title: 'Envoi par email (Outlook)', description: "Telecharge un script VBS auto-porte (PDF embarque) - cliquez \"Ouvrir\" dans la barre de telechargements pour lancer Outlook avec destinataires et CR en piece jointe. Le PDF est aussi archive dans le dossier projet." },
              { color: 'amber', title: 'Dossier et nom de fichier', description: "Dans \"Info Chantier\", configurez le dossier d'export et le pattern de nom ({N} = numero, {NOM} = chantier, {DATE} = date)." },
              { color: 'purple', title: 'Archiver / Importer (.crcestima)', description: "\"Archiver\" exporte l'affaire complete dans un fichier .crcestima. \"Importer\" permet de restaurer une affaire archivee." },
              { color: 'rose', title: 'Mode apercu', description: "Basculez en mode \"Apercu\" pour visualiser le rendu final avant export. L'apercu reproduit fidelement le PDF." },
            ],
          },
        ],
      },
      {
        id: 'astuces', label: 'Astuces', icon: 'Lightbulb',
        sections: [
          {
            type: 'grid',
            items: [
              { title: 'Correcteur orthographique', text: "Les champs texte integrent le correcteur du navigateur. Clic droit pour voir les suggestions." },
              { title: 'Glisser-deposer', text: "Reorganisez les groupes et contacts par glisser-deposer." },
              { title: 'Import Excel', text: "Importez vos listes de participants depuis un fichier Excel (.xlsx). Colonnes : Nom, Email, Telephone." },
              { title: 'Toggles rapides', text: "Cliquez sur les boutons de presence pour cycler : P → E → A → NC → P. Meme principe pour les statuts." },
              { title: 'Raccourcis formatage', text: "Ctrl+B = Gras, Ctrl+U = Souligne, Ctrl+H = Fluo. Selectionnez du texte puis utilisez le raccourci." },
              { title: 'Sauvegarde automatique', text: "Toutes les modifications sont sauvegardees automatiquement dans le cloud. Pas besoin de bouton \"Enregistrer\"." },
            ],
          },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // CATALOGUE BPU (DATABASE)
  // ──────────────────────────────────────────────────────────────────────────
  database: {
    title: 'Guide du Catalogue',
    subtitle: 'Gerer votre base de prix unitaires',
    tabs: [
      {
        id: 'modes', label: 'Cloud vs Local', icon: 'Cloud',
        sections: [
          { type: 'intro', text: "Votre catalogue BPU peut fonctionner en mode Cloud (synchronise) ou Local (fichier importe)." },
          {
            type: 'grid',
            items: [
              { title: 'Mode Cloud', text: "C'est votre base officielle. Toutes les modifications sont synchronisees sur le serveur et visibles par l'equipe.", color: 'emerald' },
              { title: 'Mode Local', text: "Activez-le en important un JSON. Ideal pour travailler sur un catalogue specifique sans modifier la base commune.", color: 'amber' },
            ],
          },
        ],
      },
      {
        id: 'articles', label: 'Articles', icon: 'List',
        sections: [
          { type: 'intro', text: "Gerez vos articles BPU : creation, edition, categorisation et prix." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Ajouter un article', description: "Cliquez sur \"+ Nouvel article\" dans la categorie souhaitee. Renseignez la designation, la description CCTP, l'unite et le prix unitaire." },
              { color: 'emerald', title: 'Editer un article', description: "Cliquez sur un article pour le selectionner. Modifiez les champs directement dans le panneau de droite." },
              { color: 'amber', title: 'Organiser par categories', description: "Creez des categories et sous-categories pour structurer votre catalogue. Glissez-deposez les articles entre categories." },
              { color: 'purple', title: 'Rechercher', description: "Utilisez la barre de recherche pour trouver un article par numero, designation ou description." },
            ],
          },
        ],
      },
      {
        id: 'blocs', label: 'Blocs', icon: 'Boxes',
        sections: [
          { type: 'intro', text: "Un bloc regroupe plusieurs articles reutilisables, inseres en un clic dans l'estimation. Basculez sur l'onglet « Blocs » (toggle Articles / Blocs en haut de la bibliotheque) pour les creer et les gerer." },
          {
            type: 'card', icon: 'Boxes', color: 'emerald', title: 'Creer un bloc', badge: 'Nouveau',
            description: "Un bloc est sauvegarde dans votre bibliotheque et reste disponible pour tous vos projets.",
            steps: [
              'Cliquez sur « Nouveau bloc » en haut de la colonne de gauche',
              "Donnez-lui un nom (ex : Voirie legere en granulaire)",
              "Choisissez le type : Formule (calcule) ou Agregat (regroupement)",
              "Ajoutez des articles depuis le volet de droite (recherche + clic)",
              'Cliquez « Creer » / « Enregistrer »',
            ],
            tip: "« Comme nouveau » cree une variante (autre nom) a partir du bloc courant sans toucher a l'original.",
          },
          {
            type: 'grid',
            items: [
              { title: 'Bloc Formule', text: "Ouvrage composite avec une unite pilote (m², ml ou m³). Chaque article est ramene a cette unite : le bloc a un prix unitaire unique (PU / m², / ml…).", color: 'indigo' },
              { title: 'Bloc Agregat', text: "Simple regroupement d'articles, sans calcul. Chaque article garde son unite ; les quantites se saisissent dans l'estimation. Peut imbriquer d'autres blocs.", color: 'violet' },
            ],
          },
          {
            type: 'card', icon: 'Calculator', color: 'indigo', title: 'Bloc Formule — geometrie des composants',
            description: "Pour ramener chaque article a l'unite du bloc, renseignez sa geometrie. Les champs demandes dependent de l'unite du bloc et de celle de l'article.",
            steps: [
              "Epaisseur (m) : pour convertir un article m³ ou tonne vers une surface/longueur",
              "Densite (t/m³) : pour les articles en tonnes (T)",
              "Largeur (m) : uniquement pour un bloc lineaire (ml)",
              "Perte (%) : majore tous les articles (chutes, foisonnement) — ex : 5 → ×1,05",
            ],
            tip: "Le prix du bloc se met a jour en direct (Σ prix × facteur) et s'affiche en bas de la composition.",
          },
          {
            type: 'table', title: "Saisie selon l'unite du bloc",
            headers: ['Unite bloc', 'Pilote (estimation)', 'Champs composants'],
            rows: [
              { label: 'm² — surface', desc: 'surface', extra: 'Ep. + Densite' },
              { label: 'ml — lineaire', desc: 'longueur', extra: 'Largeur + Ep. + Densite' },
              { label: 'm³ — volume', desc: 'volume', extra: 'Densite (tonnes)' },
            ],
          },
          {
            type: 'card', icon: 'GitBranch', color: 'violet', title: 'Sous-blocs imbriques (agregats)',
            description: "Un bloc Agregat peut contenir d'autres blocs (templates « bloc de blocs », ex : Lotissement ⊃ Voirie ⊃ articles). Volet d'ajout : basculez sur « Blocs ».",
            warning: "Les references circulaires (A contient B qui contient A) sont automatiquement bloquees a l'edition.",
          },
          {
            type: 'card', icon: 'List', color: 'blue', title: 'Retrouver un bloc',
            description: "La colonne de gauche se filtre par type (Tous / Formule / Agregat), par unite, et se trie par nom / unite / prix. La recherche cible le nom OU un article contenu.",
          },
          { type: 'warning', text: "Supprimer un bloc n'affecte pas les articles de la bibliotheque ni les estimations ou il a deja ete insere — seul le modele reutilisable disparait." },
        ],
      },
      {
        id: 'import_export', label: 'Import / Export', icon: 'FileJson',
        sections: [
          {
            type: 'card', icon: 'Upload', color: 'blue', title: 'Importer depuis Excel',
            description: "Votre fichier Excel (.xlsx) doit contenir les colonnes : Numero (Col A), Designation (Col B), Description CCTP (Col C), Unite (Col D), Prix U. (Col E).",
            steps: [
              "Preparez votre fichier avec les 5 colonnes dans l'ordre",
              'Cliquez sur "Importer Excel" dans la toolbar',
              "Selectionnez le fichier — les articles sont ajoutes automatiquement",
            ],
            tip: "La premiere ligne (en-tetes) est ignoree automatiquement.",
          },
          {
            type: 'card', icon: 'Download', color: 'emerald', title: 'Exporter en JSON',
            description: "Exportez l'ensemble du catalogue dans un fichier JSON pour archivage ou transfert.",
            steps: [
              'Cliquez sur "Exporter JSON"',
              "Le fichier est telecharge sur votre disque",
              "Reimportez-le a tout moment avec \"Charger JSON\"",
            ],
          },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // FORMULES (ProjectView formula bar)
  // ──────────────────────────────────────────────────────────────────────────
  formulaBar: {
    title: 'Aide — Barre de formule',
    subtitle: 'Style Excel · Referencement entre articles',
    tabs: [
      {
        id: 'syntaxe', label: 'Syntaxe', icon: 'BookOpen',
        sections: [
          { type: 'intro', text: "Toute formule commence obligatoirement par le signe =" },
          {
            type: 'shortcuts',
            items: [
              { key: '=[FOUILLE EN MASSE] * 1.1', desc: "Quantite d'un article x 1.1" },
              { key: '=[BETON C25] + [BETON C30]', desc: 'Somme de deux articles' },
              { key: '=([DEBLAI] - [REMBLAI]) / 2', desc: 'Expression avec parentheses' },
              { key: '=[SURFACE TOTALE] * 0.05', desc: "5% d'une autre quantite" },
            ],
          },
          { type: 'tip', text: "Les operateurs supportes sont + - * / ( ) ainsi que toute expression JavaScript valide." },
        ],
      },
      {
        id: 'clic', label: 'Insert par clic', icon: 'MousePointerClick',
        sections: [
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Selectionner un article', description: "Selectionnez un article dans le tableau (il se surligne en vert)." },
              { color: 'emerald', title: 'Ouvrir la barre', description: "Cliquez sur l'icone f(x) ou directement sur la barre de formule pour passer en mode edition." },
              { color: 'amber', title: 'Taper =', description: "Tapez = pour commencer votre expression." },
              { color: 'purple', title: 'Cliquer sur un article', description: "Cliquez sur un autre article du tableau : sa designation s'insere automatiquement entre crochets." },
              { color: 'rose', title: 'Valider', description: "Ajoutez des operateurs et d'autres references au besoin, puis validez avec Entree." },
            ],
          },
        ],
      },
      {
        id: 'tranches', label: 'Tranches', icon: 'GitBranch',
        sections: [
          { type: 'intro', text: "Lorsque votre projet contient plusieurs tranches, une formule saisie dans la barre est automatiquement appliquee a toutes les tranches simultanement." },
          { type: 'tip', text: "Modifiez la formule une seule fois — elle se propage a toutes les tranches." },
        ],
      },
      {
        id: 'raccourcis', label: 'Raccourcis', icon: 'Keyboard',
        sections: [
          {
            type: 'shortcuts',
            items: [
              { key: 'Entree', desc: 'Valider et enregistrer la formule' },
              { key: 'Echap', desc: 'Annuler sans sauvegarder' },
              { key: 'Clic f(x)', desc: 'Ouvrir / valider la barre de formule' },
              { key: 'Clic Effacer', desc: 'Supprimer la formule sur toutes les tranches' },
            ],
          },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // PARAMETRES
  // ──────────────────────────────────────────────────────────────────────────
  settings: {
    title: 'Guide — Parametres',
    subtitle: 'Configurer votre compte et vos preferences',
    tabs: [
      {
        id: 'compte', label: 'Compte', icon: 'User',
        sections: [
          { type: 'intro', text: "Gerez vos informations de compte, votre mot de passe et les preferences generales." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Informations personnelles', description: "Modifiez votre nom d'affichage et votre email de contact depuis la section \"Profil\"." },
              { color: 'emerald', title: 'Mot de passe', description: "Cliquez sur \"Modifier le mot de passe\" pour changer votre mot de passe. Vous devrez saisir l'ancien mot de passe pour confirmer." },
              { color: 'amber', title: 'Deconnexion', description: "Cliquez sur \"Se deconnecter\" pour quitter votre session. Vos donnees sont sauvegardees automatiquement." },
            ],
          },
        ],
      },
      {
        id: 'excel', label: 'Format Excel', icon: 'FileSpreadsheet',
        sections: [
          { type: 'intro', text: "Configurez le format d'import pour votre fichier Excel BPU." },
          {
            type: 'table', title: 'Format des colonnes attendu',
            headers: ['Colonne', 'Contenu', 'Obligatoire'],
            rows: [
              { label: 'Col A', desc: 'Numero de l\'article', extra: 'Oui' },
              { label: 'Col B', desc: 'Designation', extra: 'Oui' },
              { label: 'Col C', desc: 'Description (CCTP)', extra: 'Non' },
              { label: 'Col D', desc: 'Unite', extra: 'Oui' },
              { label: 'Col E', desc: 'Prix unitaire', extra: 'Oui' },
            ],
          },
          { type: 'tip', text: "La colonne A (Numero) est utilisee comme ID technique et comme numero d'affichage si le \"Mode Manuel\" est active." },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // MODULE HUB
  // ──────────────────────────────────────────────────────────────────────────
  moduleHub: {
    title: 'Guide — EstimaVRD',
    subtitle: "Vue d'ensemble de l'application",
    tabs: [
      {
        id: 'modules', label: 'Modules', icon: 'LayoutGrid',
        sections: [
          { type: 'intro', text: "EstimaVRD est compose de modules specialises. Chaque carte du hub donne acces a un module." },
          {
            type: 'grid',
            items: [
              { title: 'Estimation', text: "Module principal — creez et gerez vos devis de projets VRD avec chapitres, articles et formules.", color: 'blue' },
              { title: 'Gestion de Projets', text: "Sauvegardez, restaurez et organisez vos projets en dossiers. Import/Export JSON.", color: 'emerald' },
              { title: 'Analyse RAO', text: "Analysez les offres des entreprises, comparez les prix et generez les rapports d'analyse.", color: 'indigo' },
              { title: 'Compte Rendu', text: "Redigez vos comptes rendus de reunion avec participants, observations et exports PDF/Word.", color: 'teal' },
              { title: 'Documents Admin', text: "Generez les documents administratifs de marche : OS, avenants, fiches.", color: 'amber' },
              { title: 'Branding', text: "Personnalisez votre identite visuelle : logo, couleurs, coordonnees, polices.", color: 'violet' },
            ],
          },
        ],
      },
      {
        id: 'navigation', label: 'Navigation', icon: 'Compass',
        sections: [
          { type: 'intro', text: "Cliquez sur une carte pour ouvrir le module correspondant. Le bouton \"← Hub\" en haut a gauche vous ramene ici." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Ouvrir un module', description: "Cliquez sur la carte du module souhaite. Certains modules necessitent d'avoir un projet charge." },
              { color: 'emerald', title: 'Revenir au hub', description: "Depuis n'importe quel module, cliquez sur le bouton \"← Hub\" en haut a gauche." },
              { color: 'amber', title: 'Meteo et infos', description: "Le hub affiche la meteo locale, les statistiques de votre espace (projets, articles BPU) et les derniers changements." },
            ],
          },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // BRANDING
  // ──────────────────────────────────────────────────────────────────────────
  branding: {
    title: 'Guide — Identite visuelle',
    subtitle: 'Personnaliser votre charte graphique',
    tabs: [
      {
        id: 'identite', label: 'Identite', icon: 'Building2',
        sections: [
          { type: 'intro', text: "Renseignez les coordonnees de votre entreprise : nom, adresse, telephone, email. Ces informations apparaissent dans les en-tetes de vos documents exports." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Logo', description: "Importez votre logo au format PNG ou JPG. Il sera utilise sur les pages de garde et en-tetes PDF." },
              { color: 'emerald', title: 'Coordonnees', description: "Renseignez nom de societe, adresse, telephone, email et site web." },
              { color: 'amber', title: 'Signature', description: "Ajoutez un texte de signature qui apparaitra en bas de vos documents." },
            ],
          },
        ],
      },
      {
        id: 'couleurs', label: 'Couleurs', icon: 'Palette',
        sections: [
          { type: 'intro', text: "Definissez les couleurs principales et secondaires de vos documents." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Couleur principale', description: "Utilisee pour les en-tetes, titres de chapitres et bandes laterales dans les PDF." },
              { color: 'emerald', title: 'Couleur secondaire', description: "Utilisee pour les accents, sous-titres et elements decoratifs." },
              { color: 'amber', title: 'Couleur de fond', description: "Couleur d'arriere-plan des bandes d'en-tete et pieds de page." },
            ],
          },
          { type: 'tip', text: "Cliquez sur le carre colore pour ouvrir le selecteur de couleur. Vous pouvez aussi saisir un code hexadecimal directement." },
        ],
      },
      {
        id: 'typographie', label: 'Typographie', icon: 'Type',
        sections: [
          { type: 'intro', text: "Choisissez les polices utilisees dans vos documents PDF et Word." },
          {
            type: 'grid',
            items: [
              { title: 'Police titres', text: "Police utilisee pour les titres H1, H2, H3 dans les exports PDF." },
              { title: 'Police corps', text: "Police du texte courant dans les documents." },
              { title: 'Tailles', text: "H1 = 14pt, H2 = 12pt, H3 = 11pt, Corps = 10pt. Ces tailles sont fixes pour la coherence." },
            ],
          },
        ],
      },
      {
        id: 'application', label: 'Application', icon: 'FileCheck',
        sections: [
          { type: 'intro', text: "Votre branding est applique automatiquement a tous les exports : PDF, Word, Excel, pages de garde." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Pages de garde', description: "Le logo et les coordonnees sont places sur la page de garde des CCTP, RC et rapports." },
              { color: 'emerald', title: 'En-tetes PDF', description: "Chaque page des documents PDF affiche votre logo et nom de societe en en-tete." },
              { color: 'amber', title: 'BPU', description: "L'apercu BPU utilise votre charte pour les couleurs de chapitres et la page de titre." },
            ],
          },
          { type: 'tip', text: "Apres modification du branding, rafraichissez les exports en cours (Ctrl+Shift+R) pour voir les changements." },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // CCTP
  // ──────────────────────────────────────────────────────────────────────────
  cctp: {
    title: 'Guide — Generateur CCTP',
    subtitle: 'Creer votre Cahier des Clauses Techniques',
    tabs: [
      {
        id: 'navigation', label: 'Navigation', icon: 'FolderTree',
        sections: [
          { type: 'intro', text: "Le CCTP est organise en arborescence : parties, chapitres et articles. Naviguez dans le panneau de gauche." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Arborescence', description: "Depliez/repliez les sections en cliquant sur les fleches. Les cases a cocher permettent de selectionner les clauses a inclure dans l'export." },
              { color: 'emerald', title: 'Recherche', description: "Utilisez la barre de recherche en haut pour trouver une clause par mot-cle." },
              { color: 'amber', title: 'Filtres', description: "Filtrez par type (titre, article, sous-article) pour naviguer plus rapidement." },
            ],
          },
        ],
      },
      {
        id: 'redaction', label: 'Redaction', icon: 'Edit3',
        sections: [
          { type: 'intro', text: "Chaque clause peut etre editee avec l'editeur enrichi." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Editer une clause', description: "Cliquez sur une clause dans l'arborescence pour ouvrir l'editeur. Le texte est modifiable directement." },
              { color: 'emerald', title: 'Formatage enrichi', description: "Utilisez la barre d'outils pour le gras, l'italique, les listes, les tableaux et les titres." },
              { color: 'amber', title: 'Variables', description: "Inserez des variables dynamiques (nom du projet, date, etc.) qui seront remplacees automatiquement a l'export." },
            ],
          },
        ],
      },
      {
        id: 'favoris', label: 'Favoris', icon: 'Star',
        sections: [
          { type: 'intro', text: "Marquez vos clauses les plus utilisees en favoris pour les retrouver facilement." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Ajouter un favori', description: "Cliquez sur l'etoile a cote d'une clause pour l'ajouter aux favoris." },
              { color: 'emerald', title: 'Panneau favoris', description: "Ouvrez le panneau lateral des favoris pour voir et inserer vos clauses preferees." },
              { color: 'amber', title: 'Organiser', description: "Les favoris sont classes par type (CCTP/RC) et triables par date d'ajout." },
            ],
          },
        ],
      },
      {
        id: 'export', label: 'Export', icon: 'FileDown',
        sections: [
          { type: 'intro', text: "Exportez votre CCTP en document PDF professionnel avec page de garde, sommaire et mise en page automatique." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Generer le PDF', description: "Cliquez sur \"Exporter PDF\" dans la toolbar. Seules les clauses cochees sont incluses." },
              { color: 'emerald', title: 'Page de garde', description: "La page de garde utilise votre branding (logo, couleurs, coordonnees) automatiquement." },
              { color: 'amber', title: 'Options', description: "Choisissez d'inclure ou non le sommaire, la numerotation, et les annexes." },
            ],
          },
          { type: 'tip', text: "Les clauses non cochees ne sont pas exportees — utilisez les cases pour personnaliser chaque export projet par projet." },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // RC (Reglement de Consultation)
  // ──────────────────────────────────────────────────────────────────────────
  rc: {
    title: 'Guide — Generateur RC',
    subtitle: 'Creer votre Reglement de Consultation',
    tabs: [
      {
        id: 'navigation', label: 'Navigation', icon: 'FolderTree',
        sections: [
          { type: 'intro', text: "Le RC est organise en arborescence similaire au CCTP. Naviguez et cochez les articles a inclure." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Structure', description: "Le RC est organise en parties et articles. Chaque element peut etre coche/decoche pour l'export." },
              { color: 'emerald', title: 'Recherche', description: "Utilisez la barre de recherche pour trouver un article par mot-cle." },
            ],
          },
        ],
      },
      {
        id: 'redaction', label: 'Redaction', icon: 'Edit3',
        sections: [
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Editer un article', description: "Cliquez sur un article dans l'arborescence pour l'editer avec l'editeur enrichi." },
              { color: 'emerald', title: 'Formatage', description: "Memes outils que le CCTP : gras, italique, listes, tableaux." },
            ],
          },
        ],
      },
      {
        id: 'favoris', label: 'Favoris', icon: 'Star',
        sections: [
          { type: 'intro', text: "Les favoris RC fonctionnent exactement comme ceux du CCTP. Marquez vos articles recurrents." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Ajouter un favori', description: "Cliquez sur l'etoile a cote d'un article RC." },
              { color: 'emerald', title: 'Reutiliser', description: "Retrouvez vos favoris dans le panneau lateral (filtrez par type RC)." },
            ],
          },
        ],
      },
      {
        id: 'export', label: 'Export', icon: 'FileDown',
        sections: [
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Generer le PDF', description: "Cliquez sur \"Exporter PDF\" pour generer le document RC avec page de garde et votre branding." },
              { color: 'emerald', title: 'Options d\'export', description: "Choisissez d'inclure le sommaire et la numerotation automatique." },
            ],
          },
          { type: 'tip', text: "Comme pour le CCTP, seuls les articles coches sont inclus dans l'export." },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // DOCUMENTS ADMINISTRATIFS
  // ──────────────────────────────────────────────────────────────────────────
  docAdmin: {
    title: 'Guide — Documents Admin',
    subtitle: 'Generer les documents administratifs de marche',
    tabs: [
      {
        id: 'fiches', label: 'Fiches Marche', icon: 'FileText',
        sections: [
          { type: 'intro', text: "Creez et gerez les fiches de marche : informations generales, entreprises, lots et montants." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Fiche recapitulative', description: "Renseignez les informations du marche : maitre d'ouvrage, maitre d'oeuvre, entreprise, montants, delais." },
              { color: 'emerald', title: 'Lots', description: "Definissez les lots du marche avec leurs montants respectifs." },
              { color: 'amber', title: 'Intervenants', description: "Ajoutez les intervenants du marche : MOA, MOE, SPS, Bureau de controle, etc." },
            ],
          },
        ],
      },
      {
        id: 'exe', label: 'Documents EXE', icon: 'ClipboardList',
        sections: [
          { type: 'intro', text: "Generez les documents d'execution necessaires au suivi de chantier." },
          {
            type: 'grid',
            items: [
              { title: 'EXE 4 — Planning', text: "Tableau de suivi du planning previsionnel et reel du chantier." },
              { title: 'EXE 5 — Decomptes', text: "Decomptes mensuels et situations de travaux." },
              { title: 'EXE 6 — Avenants', text: "Tableau recapitulatif des avenants au marche." },
              { title: 'EXE 8 — Visa', text: "Fiches de visa des documents d'execution." },
              { title: 'EXE 9 — Reserves', text: "Tableau des reserves lors de la reception." },
              { title: 'EXE 10 — Reception', text: "Proces-verbal de reception des travaux." },
            ],
          },
        ],
      },
      {
        id: 'os', label: 'Ordres de service', icon: 'Send',
        sections: [
          { type: 'intro', text: "Redigez les ordres de service (OS) et suivez leur chronologie." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Creer un OS', description: "Cliquez sur \"Nouvel OS\" et renseignez l'objet, le destinataire et la date d'effet." },
              { color: 'emerald', title: 'Types d\'OS', description: "OS de demarrage, d'arret, de reprise, de modification... Chaque type a un modele adapte." },
              { color: 'amber', title: 'Chronologie', description: "Les OS sont affiches dans l'ordre chronologique avec leur statut (emis, recu, execute)." },
            ],
          },
        ],
      },
      {
        id: 'export', label: 'Export', icon: 'FileDown',
        sections: [
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Exporter un document', description: "Selectionnez le type de document, puis cliquez sur \"Generer\". Le PDF est telecharge avec votre branding." },
              { color: 'emerald', title: 'Export lot', description: "Exportez tous les documents d'un lot en une seule operation." },
            ],
          },
          { type: 'tip', text: "Tous les documents utilisent automatiquement votre charte graphique (logo, couleurs, coordonnees)." },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // ANALYSE FINANCIÈRE (sous-onglet du module RAO)
  // ──────────────────────────────────────────────────────────────────────────
  priceAnalysis: {
    title: 'Guide — Analyse financière',
    subtitle: 'Comparer les offres prix par prix',
    tabs: [
      {
        id: 'import', label: 'Import offres', icon: 'Upload',
        sections: [
          { type: 'intro', text: "Importez les offres des entreprises soumissionnaires depuis Excel ou PDF. Les prix sont automatiquement associés aux articles du DQE." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Import Excel', description: "Bouton « Importer » dans la toolbar. Le fichier doit contenir une colonne de référence (P.01, 1005, ...) et une colonne de prix unitaire." },
              { color: 'emerald', title: 'Import PDF', description: "Le module accepte aussi les PDF natifs (texte). Cascade de matching : référence exacte → désignation → préfixe de référence." },
              { color: 'amber', title: 'PDF scannés (OCR)', description: "Pour les PDF scannés (images), un OCR Tesseract.js est lancé automatiquement avec barre de progression. La reconnaissance reste limitée sur les scans très dégradés." },
              { color: 'purple', title: 'Saisie manuelle', description: "Vous pouvez aussi ajouter une entreprise sans import puis taper les prix directement dans le tableau." },
            ],
          },
          { type: 'tip', text: "Le bouton « Dépouillement » dans la toolbar du RAO permet de pré-déclarer les entreprises consultées et leur montant AE avant l'import des prix." },
          {
            type: 'card',
            icon: 'AlertTriangle', color: 'amber',
            title: 'Alerte AE vs total recalculé',
            description: "Après l'import, si le total calculé à partir du BPU diffère du montant AE annoncé dans la modale Dépouillement, une alerte apparaît dans l'onglet Admin du RAO et la section Conformité du PDF.",
          },
        ],
      },
      {
        id: 'variantes', label: 'Variantes', icon: 'GitBranch',
        sections: [
          { type: 'intro', text: "Chaque entreprise peut proposer une ou plusieurs variantes (CCP R2151-8 à R2151-11). Elles s'affichent en colonnes parallèles à l'offre de base." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Importer une variante', description: "Sur la ligne d'une entreprise déjà importée, bouton « + Variante » (Excel ou PDF). Une variante peut contenir des prix nouveaux, des articles supprimés et des quantités modifiées." },
              { color: 'emerald', title: 'Articles ajoutés', description: "Les articles « hors DQE » (nouveaux prix) apparaissent dans une section dédiée en bas du tableau d'analyse financière." },
              { color: 'amber', title: 'Articles supprimés', description: "Les articles que l'entreprise propose de retirer sont marqués « supprimé » dans le tableau (cellule grisée italique)." },
              { color: 'rose', title: 'Quantités modifiées', description: "Une colonne dédiée « Qté var » apparaît avec la quantité proposée par l'entreprise. La modification est mise en gras orange si différente du DQE." },
              { color: 'purple', title: 'Retenir une variante', description: "Dans l'onglet Admin du RAO, cochez « Retenue » pour qu'une variante remplace la base de l'entreprise dans le classement final (R2151-11)." },
            ],
          },
        ],
      },
      {
        id: 'conformite', label: 'Conformité', icon: 'Shield',
        sections: [
          { type: 'intro', text: "La conformité CCP L2152-2 est vérifiée automatiquement. Une offre qui modifie les quantités du DQE est signalée comme irrégulière." },
          {
            type: 'table',
            title: "Cas détectés automatiquement",
            rows: [
              { label: "Écart Acte d'Engagement (AE) vs total recalculé", desc: "Le montant annoncé sur l'AE diffère du total calculé via le BPU." },
              { label: "Quantités modifiées par rapport au DQE", desc: "L'entreprise a saisi des quantités différentes de celles fournies." },
              { label: "Conclusion modifiable", desc: "Régulière / Irrégulière / Inacceptable / Inappropriée — voir onglet Admin." },
            ],
          },
          { type: 'warning', text: "Une offre déclarée Irrégulière peut être régularisée manuellement par décision motivée du pouvoir adjudicateur (CCP R2152-2)." },
          {
            type: 'card',
            icon: 'Info', color: 'blue',
            title: 'Note importante',
            description: "Les variantes ne sont PAS automatiquement irrégulières même si la base l'est. Le statut variant.adminConclusion est indépendant.",
          },
        ],
      },
      {
        id: 'modes', label: 'Modes analyse', icon: 'BarChart3',
        sections: [
          { type: 'intro', text: "Deux modes d'analyse visuelle viennent enrichir le tableau de comparaison." },
          {
            type: 'card',
            icon: 'BarChart3', color: 'rose',
            title: 'Mode Heatmap',
            description: "Colore chaque prix unitaire selon son écart vs l'estimation MOE. Du vert intense (-50 % et plus) au rouge (+50 % et plus).",
            steps: [
              "Activé via le segmented control en haut de la toolbar",
              "Les écarts sont calculés ligne par ligne (PU vs PU estimation)",
              "Permet d'identifier visuellement les articles surévalués / sous-évalués",
            ],
          },
          {
            type: 'card',
            icon: 'AlertTriangle', color: 'amber',
            title: 'Mode OAB (Offre Anormalement Basse)',
            description: "Méthode de la double moyenne pour détecter les prix anormalement bas — articles L2152-5 et R2152-3 du CCP.",
            steps: [
              "M1 = moyenne arithmétique de tous les prix de la ligne",
              "Borne haute = M1 × 1,20 (offres supérieures écartées)",
              "M2 = moyenne des prix ≤ borne haute",
              "Seuil OAB = M2 × 0,90 (10 % sous M2)",
              "Cellule fond orange si prix < seuil OAB",
            ],
            tip: "Une OAB ne peut pas être rejetée automatiquement : le PA doit demander des précisions au soumissionnaire avant tout rejet motivé.",
          },
          {
            type: 'card',
            icon: 'Calculator', color: 'indigo',
            title: 'Détail OAB d\'un article',
            description: "Cliquez sur l'icône OAB d'une cellule pour ouvrir la modale détail : calcul M1/M2/seuil + visualisation des prix vs seuil.",
          },
        ],
      },
      {
        id: 'outils', label: 'Outils', icon: 'Settings',
        sections: [
          { type: 'intro', text: "Plusieurs outils complémentaires pour exploiter l'analyse." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Mode rendu / client', description: "Le mode « Rendu » applique le pourcentage client (clientPercent) sur les quantités. Permet de basculer entre quantités MOE et quantités majorées client." },
              { color: 'emerald', title: 'Multi-tranches', description: "Si le projet a des tranches (TF, TC1, TC2...), un sélecteur permet de filtrer l'analyse par tranche ou de tout afficher (Global)." },
              { color: 'amber', title: 'Pousser les moyennes vers le BPU', description: "Bouton « Pousser moyennes vers BPU » : copie les moyennes hors OAB dans les prix unitaires du BPU. Utile après l'analyse pour mettre à jour l'estimation MOE de référence." },
              { color: 'purple', title: 'Observatoire des prix', description: "Bouton « Sauvegarder » : enregistre l'instantané dans l'observatoire (history) pour comparaison ultérieure. Undo possible (10 derniers)." },
              { color: 'rose', title: 'Export JSON / Import JSON', description: "Sauvegarde locale au format JSON portable. Utile pour backup ou transfert entre projets." },
            ],
          },
          {
            type: 'card',
            icon: 'FileDown', color: 'teal',
            title: 'Exports',
            description: "Deux formats disponibles depuis la toolbar.",
            steps: [
              "PDF — Analyse comparative avec mise en page Vert Papyrus",
              "Excel — Données brutes pour traitement externe (toutes colonnes)",
            ],
          },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // RAO — Rapport d'Analyse des Offres (sous-onglets de la vue RAO)
  // ──────────────────────────────────────────────────────────────────────────
  rao: {
    title: 'Guide — Rapport RAO',
    subtitle: "Rédaction du rapport CCP-compliant",
    tabs: [
      {
        id: 'workflow', label: 'Workflow', icon: 'ListTree',
        sections: [
          { type: 'intro', text: "Le RAO suit un workflow en 6 étapes correspondant aux onglets de la vue." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: '1. Consultation', description: "Critères de notation + sous-critères. La fiche affaire (modale icône stylo dans le ribbon) regroupe les infos du projet." },
              { color: 'amber', title: '2. Dépouillement', description: "Déclarez les entreprises consultées, le régime des variantes et les exigences minimales. Génère un PV de dépouillement automatique." },
              { color: 'emerald', title: '3. Administratif', description: "Cochez les pièces fournies, gérez les groupements et statuez sur la conformité de chaque offre (régulière / irrégulière / inacceptable / inappropriée)." },
              { color: 'purple', title: '4. Technique', description: "Notez chaque offre sur les critères techniques, rédigez les commentaires, justifiez l'acceptation des variantes." },
              { color: 'rose', title: '5. Négociation', description: "Optionnel — Suivez les phases de négociation et les engagements des entreprises." },
              { color: 'indigo', title: '6. Récapitulatif', description: "Classement final combiné (Prix × Valeur technique), recommandation MOE et export PDF du rapport complet." },
            ],
          },
          { type: 'tip', text: "Le bouton « Sauvegarder » dans le ribbon enregistre le RAO entier dans Firestore (projects/.../rao/data). Pensez à sauvegarder régulièrement — pas d'auto-save sur cette partie." },
        ],
      },
      {
        id: 'consultation', label: 'Consultation', icon: 'FileSearch',
        sections: [
          { type: 'intro', text: "Onglet Consultation : critères de notation et sous-critères. Les infos de l'affaire sont saisies dans la modale « Fiche affaire » (icône stylo dans le ribbon)." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Critère Prix (auto)', description: "Le critère Prix est généré automatiquement à partir de l'analyse financière. Vous choisissez seulement sa pondération (50 % par défaut) et la formule de scoring (f1 à f9)." },
              { color: 'emerald', title: 'Critères techniques', description: "Ajoutez les critères de valeur technique (méthodologie, délais, sécurité…) avec leur pondération. La somme des pondérations = 100." },
              { color: 'amber', title: 'Sous-critères', description: "Chaque critère peut être détaillé en sous-critères avec leur propre pondération. La pondération du critère parent = somme des sous-critères." },
              { color: 'purple', title: 'Description', description: "Pour chaque critère/sous-critère, une description longue peut être saisie. Elle sera reprise dans le PDF (section 3 — Rappel des critères de notation)." },
            ],
          },
          {
            type: 'card',
            icon: 'FunctionSquare', color: 'indigo',
            title: 'Formules de scoring Prix',
            description: "9 formules disponibles (f1 à f9) pour calculer la note prix. La plus courante : f1 = Nmax × (Pmin / P). Voir Annexe B du PDF pour le détail.",
          },
        ],
      },
      {
        id: 'depouillement', label: 'Dépouillement', icon: 'ClipboardList',
        sections: [
          { type: 'intro', text: "Modale ouverte automatiquement au premier import. Pré-déclare les entreprises consultées et le régime des variantes — base du PV de dépouillement (CCP L2113-1)." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Entreprises consultées', description: "Liste des soumissionnaires + montant AE (Acte d'Engagement) annoncé. Si une offre est importée avec un total différent, une alerte apparaît." },
              { color: 'emerald', title: 'Régime des variantes', description: "Autorisées / Interdites / Obligatoires (CCP R2151-8 à R2151-11) + exigences minimales fixées dans la consultation." },
              { color: 'amber', title: 'Date d\'ouverture des plis', description: "Date à laquelle les plis ont été ouverts. Reprise sur le PV." },
              { color: 'purple', title: 'PV automatique', description: "Le PV de dépouillement est généré automatiquement dans le PDF (section 4) à partir de ces infos + des montants AE." },
            ],
          },
          { type: 'tip', text: "Vous pouvez rouvrir la modale Dépouillement à tout moment via le bouton « Dépouillement » dans le ribbon." },
        ],
      },
      {
        id: 'admin', label: 'Administratif', icon: 'Shield',
        sections: [
          { type: 'intro', text: "Onglet Administratif : pièces de candidature et d'offre, groupements, statut de conformité." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Pièces administratives + d\'offre', description: "Cochez OUI / NON pour chaque pièce demandée. Liste paramétrable et drag-and-drop pour réordonner." },
              { color: 'emerald', title: 'Groupement d\'entreprises', description: "Si l'entreprise est en groupement, cochez « En groupement » et listez les membres (Mandataire / Cotraitant) avec leurs pièces individuelles." },
              { color: 'amber', title: 'Conclusion admin', description: "Déclarez : Régulière / Irrégulière / Inacceptable / Inappropriée. Une offre non régulière est exclue de la notation et du classement final." },
              { color: 'rose', title: 'Variantes — admin', description: "Pour chaque variante importée, choisir « Retenue » ou « Non retenue ». Une variante retenue se substitue à la base dans le classement final (CCP R2151-11)." },
              { color: 'purple', title: 'Alertes Quantités / AE', description: "Panneaux dédiés affichent les écarts de quantités vs DQE et les écarts entre AE annoncé et total recalculé." },
            ],
          },
        ],
      },
      {
        id: 'technique', label: 'Technique', icon: 'Settings',
        sections: [
          { type: 'intro', text: "Onglet Technique : notation détaillée + commentaires + justification des variantes. Tout est repris dans le PDF (sections 7.bis + 8)." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Note + barème', description: "Pour chaque critère/sous-critère, saisissez la note (ex: 4) et le barème (ex: 5). Le score pondéré est calculé automatiquement (note/barème × poids)." },
              { color: 'emerald', title: 'Commentaires', description: "Saisie libre pour chaque critère et sous-critère, repris intégralement dans le PDF section 8 (Analyse technique)." },
              { color: 'amber', title: 'Synthèse globale', description: "Champ « Synthèse pour le rapport » par critère : conclusion synthétique reprise en gras dans le PDF." },
              { color: 'purple', title: 'Justification variantes', description: "Si l'entreprise propose une variante, un encadré dédié permet de justifier son acceptation ou son rejet. Ce texte apparaît en encadré vert dans la section 7.bis du PDF." },
            ],
          },
          {
            type: 'card',
            icon: 'GitBranch', color: 'purple',
            title: 'Bloc Variantes proposées',
            description: "Visible uniquement si l'entreprise sélectionnée a au moins une variante. Affiche pour chaque variante : numéro, label, statut (RETENUE / NON RETENUE), montant HT, et un textarea de justification.",
          },
        ],
      },
      {
        id: 'negociation', label: 'Négociation', icon: 'MessageSquare',
        sections: [
          { type: 'intro', text: "Onglet Négociation (optionnel) : points négociés et engagements pris par chaque entreprise." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Points de négociation', description: "Liste des points discutés avec chaque entreprise (délais, méthodes, prix unitaires…)." },
              { color: 'emerald', title: 'Réponses et engagements', description: "Texte libre par point. Cette section n'est PAS reprise dans le PDF (exclue par défaut)." },
            ],
          },
          { type: 'warning', text: "Section confidentielle : les négociations ne sont pas exportées dans le PDF du rapport final." },
        ],
      },
      {
        id: 'recap', label: 'Récapitulatif', icon: 'Award',
        sections: [
          { type: 'intro', text: "Synthèse finale : classement combiné Prix + Valeur technique avec recommandation MOE et export PDF." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Classement étendu', description: "Inclut la base + les variantes retenues, recalcule Pmin/Pmoy/Pmax sur les seules offres régulières, attribue les rangs." },
              { color: 'emerald', title: 'Mieux-disant', description: "Le rang 1 est mis en avant. Si une variante retenue gagne, c'est elle qui est désignée mieux-disante (et pas la base de l'entreprise)." },
              { color: 'amber', title: 'Recommandation MOE', description: "Phrase générée automatiquement : « L'offre de l'entreprise X (variante V1 retenue) est l'offre économiquement la plus avantageuse — Score / Montant ». Reprise dans le PDF." },
              { color: 'purple', title: 'Visualisation barres', description: "Graphique empilé Prix (vert) + Technique (bleu) par entreprise. Les variantes apparaissent en couleur plus claire de leur entreprise." },
              { color: 'rose', title: 'Export PDF final', description: "Bouton « Générer le PDF final » : compile l'ensemble en un rapport CCP-compliant (cover + sommaire + 9 sections + annexes A/B/C)." },
            ],
          },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // BPU (Apercu & Export)
  // ──────────────────────────────────────────────────────────────────────────
  bpu: {
    title: 'Guide — Apercu BPU',
    subtitle: 'Mise en page et export du Bordereau de Prix',
    tabs: [
      {
        id: 'mise_en_page', label: 'Mise en page', icon: 'LayoutDashboard',
        sections: [
          { type: 'intro', text: "L'apercu BPU genere une mise en page professionnelle de votre bordereau de prix, prete a l'export." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Navigation', description: "Utilisez le zoom et les fleches pour naviguer entre les pages du BPU." },
              { color: 'emerald', title: 'Tri', description: "Les articles sont tries par categorie et par numero. Vous pouvez changer l'ordre de tri dans les options." },
              { color: 'amber', title: 'Mise en page automatique', description: "La pagination est calculee automatiquement. Les chapitres ne sont jamais coupes entre deux pages." },
            ],
          },
        ],
      },
      {
        id: 'personnalisation', label: 'Personnalisation', icon: 'Paintbrush',
        sections: [
          { type: 'intro', text: "Personnalisez l'apparence du BPU avant l'export." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Overrides', description: "Modifiez les titres, numeros et designations directement dans l'apercu. Ces modifications n'affectent que l'export." },
              { color: 'emerald', title: 'Branding', description: "Les couleurs de chapitres et la page de titre utilisent automatiquement votre charte graphique." },
            ],
          },
        ],
      },
      {
        id: 'export', label: 'Export', icon: 'FileDown',
        sections: [
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Export Word (.docx)', description: "Genere un document Word editable avec mise en page, tableaux et branding." },
              { color: 'emerald', title: 'Export PDF', description: "Genere un PDF non-editable, ideal pour la diffusion officielle." },
              { color: 'amber', title: 'Export Excel', description: "Exporte les donnees dans un tableur pour manipulation externe." },
            ],
          },
          { type: 'tip', text: "L'export Word est recommande si vous souhaitez faire des ajustements manuels avant impression." },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // VISITES DE CHANTIER
  // ──────────────────────────────────────────────────────────────────────────
  siteVisits: {
    title: 'Guide — Visites de Chantier',
    subtitle: 'Suivi des visites terrain',
    tabs: [
      {
        id: 'visites', label: 'Visites', icon: 'MapPin',
        sections: [
          { type: 'intro', text: "Consultez l'historique des visites de chantier effectuees depuis l'application mobile." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Liste des visites', description: "Les visites sont classees par date. Chaque visite contient les observations et photos prises sur site." },
              { color: 'emerald', title: 'Details', description: "Cliquez sur une visite pour voir le detail : observations, photos, position GPS et conditions meteo." },
            ],
          },
        ],
      },
      {
        id: 'observations', label: 'Observations', icon: 'ClipboardList',
        sections: [
          { type: 'intro', text: "Les observations terrain sont enregistrees depuis l'application mobile." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Consulter', description: "Chaque observation contient un texte, des photos et une position GPS." },
              { color: 'emerald', title: 'Statuts', description: "Les observations peuvent etre marquees comme : A traiter, En cours, Resolu." },
            ],
          },
        ],
      },
      {
        id: 'carte', label: 'Carte GPS', icon: 'Map',
        sections: [
          { type: 'intro', text: "Visualisez les observations sur une carte interactive." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Carte', description: "Les observations avec coordonnees GPS sont affichees sur une carte. Cliquez sur un marqueur pour voir le detail." },
              { color: 'emerald', title: 'Trace GPS', description: "Si le suivi GPS etait actif pendant la visite, le parcours est affiche sur la carte." },
            ],
          },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // DEVIS MOE
  // ──────────────────────────────────────────────────────────────────────────
  devisMoe: {
    title: 'Guide — Devis MOE',
    subtitle: 'Creer un devis de maitrise d\'oeuvre',
    tabs: [
      {
        id: 'creation', label: 'Creer un devis', icon: 'FilePlus',
        sections: [
          { type: 'intro', text: "Creez un devis de maitrise d'oeuvre avec les phases loi MOP et le calcul automatique des honoraires." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Informations projet', description: "Renseignez le nom du projet, le client, l'objet de la mission et le montant des travaux." },
              { color: 'emerald', title: 'Choisir les phases', description: "Selectionnez les phases de mission (ESQ, APS, APD, PRO, ACT, VISA, DET, AOR...) selon votre mission." },
              { color: 'amber', title: 'Taux d\'honoraires', description: "Definissez le taux global ou par phase. Le montant des honoraires est calcule automatiquement." },
            ],
          },
        ],
      },
      {
        id: 'phases', label: 'Phases MOP', icon: 'ListTree',
        sections: [
          { type: 'intro', text: "Les phases de mission suivent la loi MOP. Chaque phase a un pourcentage du montant total des honoraires." },
          {
            type: 'grid',
            items: [
              { title: 'ESQ — Esquisse', text: "Premiere approche du projet. Definition des grandes lignes." },
              { title: 'APS — Avant-Projet Sommaire', text: "Composition du projet, choix constructifs principaux." },
              { title: 'APD — Avant-Projet Definitif', text: "Determination precise du projet, estimation definitive." },
              { title: 'PRO — Projet', text: "Documents techniques detailles pour la consultation." },
              { title: 'ACT — Assistance Contrats', text: "Analyse des offres, mise au point des marches." },
              { title: 'DET — Direction Travaux', text: "Suivi de l'execution, ordres de service, situations." },
            ],
          },
        ],
      },
      {
        id: 'honoraires', label: 'Honoraires', icon: 'Calculator',
        sections: [
          { type: 'intro', text: "Le calcul des honoraires est base sur le montant des travaux et le taux de remuneration." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Montant travaux', description: "Saisissez le montant previsionnel des travaux HT. C'est la base de calcul." },
              { color: 'emerald', title: 'Taux global', description: "Definissez le taux d'honoraires global (ex: 8% du montant travaux)." },
              { color: 'amber', title: 'Repartition par phase', description: "Repartissez le montant total entre les phases selectionnees. Les pourcentages doivent totaliser 100%." },
            ],
          },
          { type: 'tip', text: "Utilisez l'onglet Recapitulatif pour verifier la coherence de votre devis avant export." },
        ],
      },
      {
        id: 'export', label: 'Export', icon: 'FileDown',
        sections: [
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Generer le devis', description: "Cliquez sur \"Exporter\" pour generer le document avec votre branding." },
              { color: 'emerald', title: 'Format', description: "Le devis est genere au format PDF avec page de garde, detail des phases et recapitulatif financier." },
            ],
          },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // RAO & ANALYSE DES PRIX — Module standalone (landing + workflow général)
  // ──────────────────────────────────────────────────────────────────────────
  raoAnalysis: {
    title: 'Guide — RAO & Analyse des Prix',
    subtitle: 'Module complet CCP-compliant',
    tabs: [
      {
        id: 'presentation', label: 'Présentation', icon: 'Info',
        sections: [
          { type: 'intro', text: "Module complet pour analyser les offres entreprises et rédiger le Rapport d'Analyse des Offres conforme au Code de la Commande Publique." },
          {
            type: 'grid',
            items: [
              { title: 'RAO', text: "Workflow en 6 onglets : Consultation, Dépouillement, Admin, Technique, Négo, Récap. Auto-sauvegarde 1.5s + sauvegarde manuelle.", color: 'blue' },
              { title: 'Analyse financière', text: "Comparaison prix par prix avec heatmap, mode OAB, variantes intégrées, conformité automatique, push moyennes vers BPU.", color: 'indigo' },
            ],
          },
          {
            type: 'card',
            icon: 'Shield', color: 'emerald',
            title: 'Conformité CCP',
            description: "Le module applique automatiquement les articles : L2113-1 (AE), L2152-2 (irrégularité), L2152-5 / R2152-3 (OAB), R2151-8 à R2151-11 (variantes), R2152-7 (pondération critères).",
          },
        ],
      },
      {
        id: 'workflow', label: 'Workflow', icon: 'ListTree',
        sections: [
          { type: 'intro', text: "Étapes recommandées d'un RAO de A à Z. Le module guide automatiquement à travers les choix." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: '1. Créer le RAO depuis l\'estimation MOE', description: "Bouton « Nouveau RAO » sur la landing : import du fichier Excel d'estimation MOE (.xlsx). Le module détecte les chapitres/sous-chapitres et les articles." },
              { color: 'emerald', title: '2. Valider la structure', description: "Modale de validation post-import : vérifier la hiérarchie chapitres → sous-chapitres → articles. Possibilité de réorganiser avant création." },
              { color: 'amber', title: '3. Définir les critères de notation', description: "Onglet Consultation : critère Prix (auto) + critères techniques avec sous-critères. Pondérations = 100." },
              { color: 'purple', title: '4. Dépouillement', description: "Modale Dépouillement : entreprises consultées, régime variantes, date d'ouverture. Génère le PV automatique." },
              { color: 'rose', title: '5. Importer les offres', description: "Pour chaque entreprise : import Excel ou PDF (avec OCR si scanné). Variantes en + via bouton dédié." },
              { color: 'indigo', title: '6. Saisir l\'analyse', description: "Onglets Admin (pièces, groupement, conformité, variantes retenues) + Technique (notes, commentaires, justifications variantes)." },
              { color: 'teal', title: '7. Générer le PDF', description: "Onglet Récap : bouton « Générer le PDF final ». Export A4 (rapport) + A3 (détail prix unitaires) avec annexes CCP." },
            ],
          },
          { type: 'tip', text: "Le RAO peut être autonome (créé depuis une estimation MOE) ou rattaché à un projet existant via le module Gestion de Projets." },
        ],
      },
      {
        id: 'sauvegarde', label: 'Sauvegarde', icon: 'Save',
        sections: [
          { type: 'intro', text: "Les données sont sauvegardées dans Firestore sur 3 documents distincts pour éviter de saturer la limite 1MB par document." },
          {
            type: 'table',
            title: "Stockage Firestore",
            headers: ['Type', 'Document', 'Sauvegarde'],
            rows: [
              { label: 'Projet (chapitres, branding, fiche affaire)', desc: 'projects/{id}', extra: 'Manuel (bouton)' },
              { label: 'Analyse financière (offres, variantes, observatoire)', desc: 'projects/{id}/analysis/data', extra: 'Auto (800ms)' },
              { label: 'Rapport RAO (consultation, critères, notes, commentaires)', desc: 'projects/{id}/rao/data', extra: 'Auto (1.5s)' },
            ],
          },
          {
            type: 'card',
            icon: 'Save', color: 'emerald',
            title: 'Sauvegarde automatique',
            description: "L'auto-save est actif sur l'analyse (800ms debounced) ET sur le RAO (1.5s debounced). Un indicateur « Dernière sauvegarde : il y a Xs » apparaît dans le ribbon.",
          },
          {
            type: 'card',
            icon: 'FileJson', color: 'amber',
            title: 'Export / Import JSON',
            description: "Bouton « Export JSON » dans la toolbar de l'analyse financière. Permet de sauvegarder l'état complet localement (backup, transfert entre projets, archive).",
          },
        ],
      },
      {
        id: 'ccp', label: 'CCP', icon: 'Shield',
        sections: [
          { type: 'intro', text: "Articles du Code de la Commande Publique appliqués par le module. Les références sont reprises dans le PDF (annexe C)." },
          {
            type: 'table',
            title: "Articles CCP appliqués",
            rows: [
              { label: 'L2113-1', desc: "Engagement contractuel via l'AE (Acte d'Engagement)" },
              { label: 'L2152-2', desc: "Irrégularité : offre qui modifie les quantités du DQE" },
              { label: 'L2152-5 / R2152-3', desc: "Offre Anormalement Basse (OAB) — détection via double moyenne" },
              { label: 'R2151-8 à R2151-11', desc: "Variantes : autorisées, interdites, obligatoires ; règles de substitution" },
              { label: 'R2152-1, R2152-6, R2152-7', desc: "Critères d'attribution, offre économiquement la plus avantageuse, pondération" },
              { label: 'R2152-2', desc: "Régularisation manuelle d'une offre irrégulière par décision motivée du PA" },
            ],
          },
          {
            type: 'card',
            icon: 'AlertTriangle', color: 'amber',
            title: 'Responsabilité du pouvoir adjudicateur',
            description: "Le module détecte et signale automatiquement les non-conformités, mais c'est le PA qui décide en dernier ressort (notation, attribution, régularisation, rejet OAB).",
          },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // SMTP — CONFIGURATION EMAIL
  // ──────────────────────────────────────────────────────────────────────────
  smtp: {
    title: 'Guide — Configuration Email (SMTP)',
    subtitle: 'Envoyer le CR depuis EstimaVRD sans Outlook',
    tabs: [
      {
        id: 'overview', label: "Vue d'ensemble", icon: 'BookOpen',
        sections: [
          {
            type: 'intro',
            text: "EstimaVRD peut envoyer vos comptes rendus de chantier directement par email depuis le serveur, sans passer par Outlook. Vous configurez une seule fois votre serveur SMTP (Gmail, Outlook, OVH, etc.), puis chaque envoi part avec votre propre adresse comme expéditeur.",
          },
          {
            type: 'card', icon: 'Send', color: 'emerald', title: 'Pourquoi cette feature ?', badge: 'Nouveau',
            description: "L'ancien workflow Outlook (script .vbs) n'est compatible qu'avec Windows + Outlook installé. Le nouvel envoi serveur marche partout : Mac, Linux, mobile, tablette, navigateur quelconque.",
            steps: [
              "Vos identifiants restent les vôtres — l'email part de votre adresse",
              "Le PDF du CR est généré et joint automatiquement",
              "Le destinataire voit votre nom et adresse, comme un envoi classique",
              "Chaque envoi est tracé dans Firestore pour audit (date, sujet, destinataires)",
            ],
          },
          {
            type: 'card', icon: 'Settings', color: 'blue', title: 'Étapes de configuration',
            steps: [
              "1. Choisir votre fournisseur dans le menu déroulant (Gmail, Outlook, OVH...)",
              "2. Le serveur, port et chiffrement sont auto-remplis par le preset",
              "3. Saisir votre identifiant (= votre email dans la plupart des cas)",
              "4. Saisir votre mot de passe (parfois un mot de passe d'application — voir onglet Fournisseurs)",
              "5. Renseigner l'adresse expéditeur (From) — généralement la même que l'identifiant",
              "6. Cliquer 'Tester la connexion' pour valider",
              "7. Cliquer 'Enregistrer' une fois le test OK",
            ],
            tip: "Le test envoie une commande de vérification au serveur sans envoyer de mail. Sans risque.",
          },
          {
            type: 'card', icon: 'ClipboardList', color: 'purple', title: "Comment l'utiliser ensuite",
            steps: [
              "Aller dans le module CRC, ouvrir un chantier et un CR",
              "Dans le ruban, cliquer le bouton 'Envoyer (web)' (icône avion en papier)",
              "Une modale s'ouvre avec les destinataires pré-remplis depuis la liste de diffusion",
              "Ajuster sujet/destinataires si besoin, ajouter un message personnel optionnel",
              "Cliquer 'Envoyer' — le PDF se génère et part automatiquement",
            ],
          },
        ],
      },
      {
        id: 'providers', label: 'Fournisseurs', icon: 'Cloud',
        sections: [
          {
            type: 'intro',
            text: "Chaque fournisseur a ses propres règles. Sélectionnez le vôtre dans le menu déroulant pour pré-remplir host/port/chiffrement, puis suivez les instructions ci-dessous.",
          },
          {
            type: 'card', icon: 'CheckCircle2', color: 'emerald', title: 'Gmail / Google Workspace', badge: 'Le plus simple',
            description: "smtp.gmail.com:465 (SSL/TLS). Nécessite la double authentification et un mot de passe d'application.",
            steps: [
              "1. Vérifier que la validation en 2 étapes est active sur votre compte Google",
              "2. Aller sur la page des mots de passe d'application",
              "3. Créer un mot de passe 'EstimaVRD' (16 caractères, affichés en 4 groupes de 4)",
              "4. Coller ce mot de passe (avec ou sans espaces — Estima les supprime)",
              "5. Identifiant = votre email Gmail complet (ex: nom@gmail.com)",
            ],
            link: "https://myaccount.google.com/apppasswords",
            warning: "N'utilisez JAMAIS votre mot de passe Gmail principal — Google le refusera systématiquement.",
          },
          {
            type: 'card', icon: 'Shield', color: 'blue', title: 'Activer la validation en 2 étapes (préalable Gmail)',
            description: "Sans 2FA, Google ne vous laisse pas créer de mots de passe d'application.",
            link: "https://myaccount.google.com/security",
          },
          {
            type: 'card', icon: 'AlertTriangle', color: 'amber', title: 'Outlook 365 / Microsoft', badge: 'Complexe',
            description: "smtp.office365.com:587 (STARTTLS). Microsoft désactive SMTP AUTH par défaut depuis 2022 — votre administrateur doit l'autoriser explicitement.",
            steps: [
              "1. Demander à votre admin Microsoft 365 d'activer 'Authenticated SMTP'",
              "2. Soit au niveau du tenant entier (admin.microsoft.com → Paramètres organisation → Authentification moderne → cocher 'SMTP authentifié')",
              "3. Soit au niveau d'un mailbox via PowerShell : Set-CASMailbox -Identity user@domain -SmtpClientAuthenticationDisabled $false",
              "4. Mot de passe d'application Microsoft généralement requis aussi (si MFA active)",
              "5. Identifiant = votre adresse email professionnelle",
            ],
            link: "https://aka.ms/smtp_auth_disabled",
            warning: "Si vous obtenez l'erreur '535 5.7.139 SmtpClientAuthentication is disabled', c'est ce point qu'il faut résoudre côté admin.",
          },
          {
            type: 'card', icon: 'Cloud', color: 'purple', title: 'OVH Mail Pro / OVH Mail',
            description: "ssl0.ovh.net:465 (SSL/TLS). Identifiants standards de votre messagerie OVH, sans configuration spéciale.",
            steps: [
              "Identifiant = adresse email complète OVH (ex: nom@votredomaine.fr)",
              "Mot de passe = celui de votre messagerie OVH",
              "Aucune activation ou mot de passe d'app nécessaire",
            ],
            link: "https://www.ovhcloud.com/fr/mail/parameters/",
          },
          {
            type: 'card', icon: 'Cloud', color: 'slate', title: 'Free.fr',
            description: "smtp.free.fr:465 (SSL/TLS). Identifiants standards Free.",
            steps: [
              "Identifiant = votre identifiant Free (sans @free.fr en général)",
              "Mot de passe = mot de passe de votre messagerie Free",
              "Doit être un abonné Free actif",
            ],
            link: "https://assistance.free.fr/articles/175",
          },
          {
            type: 'card', icon: 'Cloud', color: 'rose', title: 'Orange',
            description: "smtp.orange.fr:465 (SSL/TLS). Nécessite parfois un mot de passe applicatif Orange.",
            steps: [
              "Identifiant = votre adresse @orange.fr ou @wanadoo.fr",
              "Si SMTP refuse votre mot de passe principal, générer un mot de passe spécifique sur l'espace client Orange",
            ],
            link: "https://assistance.orange.fr/ordinateurs-peripheriques/installer-et-utiliser/la-suite-logicielle/le-mail-orange/parametrer-le-logiciel-de-messagerie/parametres-pop-imap-et-smtp-pour-configurer-votre-messagerie-orange_12110-12117",
          },
          {
            type: 'card', icon: 'Settings', color: 'indigo', title: 'Autre / Personnalisé',
            description: "Si votre fournisseur n'est pas listé, choisissez 'Autre / Personnalisé' et saisissez les paramètres fournis par votre hébergeur ou administrateur.",
            steps: [
              "Demander à votre admin/hébergeur : host SMTP, port (souvent 465 ou 587), chiffrement (SSL/TLS ou STARTTLS)",
              "Vérifier dans la doc de votre fournisseur — c'est souvent dans 'Configuration client mail' ou 'POP/IMAP/SMTP'",
              "Ports courants : 465 = SSL implicite, 587 = STARTTLS, 25 = sans chiffrement (à éviter)",
            ],
            tip: "La plupart des hébergeurs web (Gandi, Infomaniak, IONOS, Hostinger...) fournissent un SMTP avec leur offre mail.",
          },
        ],
      },
      {
        id: 'security', label: 'Sécurité', icon: 'Shield',
        sections: [
          {
            type: 'intro',
            text: "Votre mot de passe SMTP est l'identifiant le plus sensible que vous saisirez dans EstimaVRD. Voici comment il est protégé.",
          },
          {
            type: 'card', icon: 'Shield', color: 'emerald', title: 'Chiffrement AES-256-GCM côté serveur', badge: 'Robuste',
            description: "Quand vous enregistrez, le mot de passe est immédiatement chiffré avec une clé AES-256 stockée dans Firebase Secret Manager. Ni vous, ni l'admin EstimaVRD, ni quelqu'un qui aurait accès en lecture à la base de données ne peut le lire.",
            steps: [
              "Le chiffrement utilise un IV (vecteur d'initialisation) aléatoire à chaque écriture",
              "Le tag d'authentification empêche toute altération du ciphertext",
              "Seules les Cloud Functions (avec accès au secret) peuvent déchiffrer pour envoyer un mail",
            ],
          },
          {
            type: 'card', icon: 'Cloud', color: 'blue', title: 'Stockage Firestore en deux documents',
            description: "Configuration publique et mot de passe sont séparés pour limiter l'exposition.",
            steps: [
              "users/{uid}/preferences/smtp — config 'publique' (host, port, fromEmail, fromName) — lisible par vous uniquement",
              "users/{uid}/private/smtpPassword — ciphertext du mot de passe — invisible côté client (règles Firestore = deny)",
              "Seul le backend (admin SDK) peut lire le doc /private/ via les Cloud Functions",
            ],
          },
          {
            type: 'card', icon: 'Send', color: 'purple', title: "Trace d'envoi (audit)",
            description: "Chaque envoi laisse une trace dans Firestore pour pouvoir prouver et auditer.",
            steps: [
              "Sous-collection : companies/{cid}/crr/{crrId}/emails/{emailId}",
              "Champs : date d'envoi, expéditeur (uid), destinataires (to/cc/bcc), sujet, statut, messageId SMTP",
              "Visible par tous les membres de l'entreprise — pas modifiable côté client",
            ],
          },
          {
            type: 'card', icon: 'AlertTriangle', color: 'amber', title: 'Ce que vous voyez quand même',
            description: "Le destinataire de l'email voit toujours votre adresse comme expéditeur (c'est l'objectif). Reply-To est aussi votre adresse, donc les réponses arrivent dans votre boite.",
          },
          {
            type: 'tip',
            title: "Bonne pratique",
            text: "Pour Gmail, créez un mot de passe d'application dédié à EstimaVRD plutôt que de réutiliser celui d'une autre app. En cas de fuite, vous le supprimez sans impacter le reste.",
          },
        ],
      },
      {
        id: 'troubleshoot', label: 'Dépannage', icon: 'AlertTriangle',
        sections: [
          {
            type: 'intro',
            text: "Les erreurs les plus fréquentes lors de la configuration ou de l'envoi, et comment les résoudre.",
          },
          {
            type: 'card', icon: 'AlertTriangle', color: 'red', title: 'Gmail : 535-5.7.8 Username and Password not accepted',
            description: "Gmail refuse les identifiants. Les causes les plus fréquentes :",
            steps: [
              "Vous avez utilisé votre mot de passe Gmail principal — il faut un mot de passe d'application",
              "La double authentification n'est pas active — pré-requis pour les app passwords",
              "Le mot de passe d'application a été supprimé ou recopié avec une erreur — régénérez-en un",
              "Le compte est suspendu pour activité inhabituelle — vérifiez via Google Security",
            ],
            link: "https://support.google.com/mail/?p=BadCredentials",
          },
          {
            type: 'card', icon: 'AlertTriangle', color: 'red', title: 'Outlook : 535 5.7.139 SmtpClientAuthentication is disabled',
            description: "Microsoft 365 a désactivé SMTP AUTH au niveau tenant (défaut depuis 2022). L'admin doit l'autoriser.",
            steps: [
              "Solution propre (par mailbox) : PowerShell Set-CASMailbox -Identity user@domain -SmtpClientAuthenticationDisabled $false",
              "Solution rapide (tout le tenant) : admin.microsoft.com → Paramètres organisation → Authentification moderne → 'SMTP authentifié'",
              "Si pas d'accès admin, demandez-leur ou passez par Gmail comme contournement",
            ],
            link: "https://aka.ms/smtp_auth_disabled",
          },
          {
            type: 'card', icon: 'AlertTriangle', color: 'amber', title: 'Connection timeout / ETIMEDOUT',
            description: "Le serveur SMTP est inaccessible depuis EstimaVRD.",
            steps: [
              "Vérifier l'orthographe du host (smtp.gmail.com, pas smpt.gmail.com)",
              "Vérifier le port — 465 pour SSL/TLS, 587 pour STARTTLS",
              "Si vous êtes derrière un firewall d'entreprise, ports 465/587 peuvent être bloqués sortants",
              "Tester depuis un autre réseau (4G/partage de connexion)",
            ],
          },
          {
            type: 'card', icon: 'AlertTriangle', color: 'amber', title: 'Self-signed certificate / Certificate has expired',
            description: "Problème de chiffrement TLS — le serveur SMTP a un certificat invalide ou expiré.",
            steps: [
              "Cocher/décocher la case 'Chiffrement' pour passer entre SSL/TLS et STARTTLS",
              "Vérifier que le port correspond bien au mode de chiffrement",
              "Contacter votre admin SMTP — le certificat doit être renouvelé",
            ],
          },
          {
            type: 'card', icon: 'AlertTriangle', color: 'amber', title: 'Relay denied / 550 5.7.1',
            description: "Le serveur accepte l'auth mais refuse de relayer le message.",
            steps: [
              "L'adresse 'From' ne correspond pas à votre identifiant — ils doivent matcher",
              "Vous tentez d'envoyer depuis un domaine que le serveur ne gère pas",
              "Solution : mettre identifiant et adresse expéditeur identiques",
            ],
          },
          {
            type: 'card', icon: 'AlertTriangle', color: 'amber', title: 'Daily quota exceeded',
            description: "Vous avez atteint la limite quotidienne d'envoi de votre fournisseur.",
            steps: [
              "Gmail gratuit : 500 emails/jour ; Workspace : 2000/jour",
              "Outlook : 10 000/jour mais 30/minute",
              "OVH : variable selon offre",
              "Attendre 24h ou passer à une offre supérieure",
            ],
          },
          {
            type: 'card', icon: 'Info', color: 'blue', title: 'Vérifier les statuts fournisseurs',
            description: "Si tout semble correct mais l'envoi échoue, vérifier que votre fournisseur n'a pas un incident en cours.",
            steps: [
              "Google : https://www.google.com/appsstatus",
              "Microsoft : https://status.cloud.microsoft",
              "OVH : https://www.status-ovhcloud.com",
            ],
            link: "https://www.google.com/appsstatus",
          },
          {
            type: 'tip',
            title: "Tester rapidement avec un Gmail perso",
            text: "Si votre SMTP pro coince, créez temporairement un compte Gmail perso, activez 2FA, générez un mot de passe d'application et utilisez-le pour valider que le flow EstimaVRD est OK. Une fois validé, repassez sur votre SMTP pro avec l'admin.",
          },
        ],
      },
    ],
  },
};
