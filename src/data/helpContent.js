// src/data/helpContent.js
// Contenu d'aide centralise pour tous les modules EstimaVRD.
// Chaque cle = moduleId utilise par HelpPanel.

export const helpContent = {

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
              { color: 'emerald', title: 'Envoi par email (Outlook)', description: "Sauvegarde le PDF dans le dossier configure, genere un script VBS qui ouvre Outlook avec les destinataires et le CR en piece jointe." },
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
  // ANALYSE DES PRIX
  // ──────────────────────────────────────────────────────────────────────────
  priceAnalysis: {
    title: 'Guide — Analyse des prix',
    subtitle: 'Comparer les offres des entreprises',
    tabs: [
      {
        id: 'entreprises', label: 'Entreprises', icon: 'Building2',
        sections: [
          { type: 'intro', text: "Ajoutez les entreprises soumissionnaires et importez leurs offres de prix." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Ajouter une entreprise', description: "Cliquez sur \"+ Entreprise\" dans la toolbar. Donnez-lui un nom et une couleur." },
              { color: 'emerald', title: 'Importer les prix', description: "Importez les prix depuis un fichier Excel. Les prix sont automatiquement associes aux articles du BPU par numero de reference." },
              { color: 'amber', title: 'Saisie manuelle', description: "Vous pouvez aussi saisir les prix manuellement dans le tableau, cellule par cellule." },
            ],
          },
          { type: 'tip', text: "L'import Excel utilise le numero de reference (colonne A) pour faire le lien avec vos articles BPU." },
        ],
      },
      {
        id: 'comparaison', label: 'Comparaison', icon: 'BarChart3',
        sections: [
          { type: 'intro', text: "Comparez les offres visuellement avec le mode heatmap et les indicateurs de prix." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Mode heatmap', description: "Activez le mode heatmap dans la toolbar pour colorer les cellules du moins cher (vert) au plus cher (rouge)." },
              { color: 'emerald', title: 'Ecarts', description: "Les ecarts en pourcentage sont affiches par rapport a l'estimation. Survolez une cellule pour plus de details." },
              { color: 'amber', title: 'Totaux', description: "Les totaux par entreprise sont affiches en bas du tableau, avec le classement automatique." },
            ],
          },
        ],
      },
      {
        id: 'notation', label: 'Notation', icon: 'Award',
        sections: [
          { type: 'intro', text: "Evaluez les entreprises avec un systeme de notation multi-criteres." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Criteres', description: "Definissez vos criteres de notation (prix, delai, references...) avec leur ponderation." },
              { color: 'emerald', title: 'Sous-criteres', description: "Chaque critere peut avoir des sous-criteres avec leur propre ponderation." },
              { color: 'amber', title: 'Notation technique', description: "Notez chaque entreprise sur chaque critere. La note finale est calculee automatiquement." },
              { color: 'purple', title: 'OAB', description: "L'Offre Anormalement Basse (OAB) est detectee automatiquement via la methode de la Double Moyenne." },
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
              { color: 'blue', title: 'Export PDF', description: "Generez un rapport d'analyse complet au format PDF avec tableaux comparatifs et graphiques." },
              { color: 'emerald', title: 'Export Excel', description: "Exportez les donnees brutes au format Excel pour un traitement complementaire." },
            ],
          },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // RAO (Rapport d'Analyse des Offres)
  // ──────────────────────────────────────────────────────────────────────────
  rao: {
    title: 'Guide — Rapport RAO',
    subtitle: "Rapport d'Analyse des Offres",
    tabs: [
      {
        id: 'consultation', label: 'Consultation', icon: 'FileSearch',
        sections: [
          { type: 'intro', text: "L'onglet Consultation regroupe les informations generales de la consultation : objet, date, lots." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Informations generales', description: "Renseignez l'objet de la consultation, le maitre d'ouvrage, les dates de publication et de remise." },
              { color: 'emerald', title: 'Lots', description: "Definissez les lots du marche, leur description et les entreprises attributaires." },
            ],
          },
        ],
      },
      {
        id: 'administratif', label: 'Administratif', icon: 'Shield',
        sections: [
          { type: 'intro', text: "Verifiez la conformite administrative des candidatures." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Pieces administratives', description: "Cochez les pieces fournies par chaque entreprise : Kbis, attestations, assurances..." },
              { color: 'emerald', title: 'Groupements', description: "Si une entreprise est en groupement, renseignez les membres et leur role (mandataire, cotraitant)." },
              { color: 'amber', title: 'Conformite', description: "Le statut de conformite est calcule automatiquement en fonction des pieces fournies." },
            ],
          },
        ],
      },
      {
        id: 'technique', label: 'Technique', icon: 'Settings',
        sections: [
          { type: 'intro', text: "Evaluez les offres sur les criteres techniques definis." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Criteres et sous-criteres', description: "Definissez vos criteres techniques avec leur ponderation. Ajoutez des sous-criteres si necessaire." },
              { color: 'emerald', title: 'Notation', description: "Notez chaque entreprise sur chaque critere. Les notes sont ponderees automatiquement." },
              { color: 'amber', title: 'Commentaires', description: "Ajoutez des commentaires justifiant chaque note pour le rapport final." },
            ],
          },
        ],
      },
      {
        id: 'negociation', label: 'Negociation', icon: 'MessageSquare',
        sections: [
          { type: 'intro', text: "Gerez les phases de negociation et les demandes de precisions." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Points de negociation', description: "Listez les points a negocier avec chaque entreprise." },
              { color: 'emerald', title: 'Reponses', description: "Enregistrez les reponses et engagements des entreprises." },
            ],
          },
        ],
      },
      {
        id: 'recap', label: 'Recapitulatif', icon: 'BarChart3',
        sections: [
          { type: 'intro', text: "Le recapitulatif presente la synthese de l'analyse : classement final, attribution proposee." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Classement', description: "Le classement combine les notes techniques et financieres selon les ponderations definies." },
              { color: 'emerald', title: 'Proposition d\'attribution', description: "Redigez la proposition d'attribution avec la justification." },
              { color: 'amber', title: 'Export du rapport', description: "Cliquez sur \"Sauvegarder\" pour enregistrer, puis exportez le rapport complet en PDF." },
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
  // ANALYSE RAO (standalone)
  // ──────────────────────────────────────────────────────────────────────────
  raoAnalysis: {
    title: 'Guide — Analyse RAO',
    subtitle: 'Analyse financiere des offres',
    tabs: [
      {
        id: 'presentation', label: 'Presentation', icon: 'Info',
        sections: [
          { type: 'intro', text: "Le module Analyse RAO combine l'analyse financiere des prix et le rapport d'analyse des offres. Il se compose de deux parties principales." },
          {
            type: 'grid',
            items: [
              { title: 'Analyse Financiere', text: "Comparez les prix unitaires des entreprises avec votre estimation. Mode heatmap, ecarts, classement automatique.", color: 'blue' },
              { title: 'Rapport RAO', text: "Redigez le rapport complet d'analyse des offres avec les 5 volets : consultation, administratif, technique, negociation et recapitulatif.", color: 'indigo' },
            ],
          },
        ],
      },
      {
        id: 'import', label: 'Import', icon: 'Upload',
        sections: [
          { type: 'intro', text: "Importez les offres des entreprises depuis des fichiers Excel." },
          {
            type: 'steps',
            items: [
              { color: 'blue', title: 'Import Excel', description: "Cliquez sur \"Importer\" dans la toolbar. Selectionnez le fichier Excel de l'entreprise." },
              { color: 'emerald', title: 'Multi-onglets', description: "Si votre fichier contient plusieurs onglets (tranches), ils sont importes automatiquement." },
              { color: 'amber', title: 'Correspondance automatique', description: "Les prix sont associes aux articles par numero de reference. Un fallback par prefixe (P.01...) est utilise si le numero exact n'est pas trouve." },
            ],
          },
          { type: 'tip', text: "Verifiez que la colonne A de votre fichier Excel contient les numeros de reference identiques a ceux de votre BPU." },
        ],
      },
      {
        id: 'sauvegarde', label: 'Sauvegarde', icon: 'Save',
        sections: [
          { type: 'intro', text: "L'analyse financiere et le rapport RAO sont sauvegardes separement dans Firestore." },
          {
            type: 'grid',
            items: [
              { title: 'Analyse (auto-save)', text: "Les donnees de l'analyse financiere sont sauvegardees automatiquement apres chaque modification.", color: 'emerald' },
              { title: 'Rapport (save manuel)', text: "Le rapport RAO doit etre sauvegarde manuellement via le bouton \"Sauvegarder\".", color: 'amber' },
            ],
          },
          { type: 'warning', text: "N'oubliez pas de cliquer \"Sauvegarder\" dans le rapport RAO — contrairement a l'analyse, il n'y a pas d'auto-save." },
        ],
      },
    ],
  },
};
