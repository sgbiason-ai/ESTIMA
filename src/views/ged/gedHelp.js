// src/views/ged/gedHelp.js
// Contenu d'aide contextuelle du module GED « Documents émis ».
// Même structure qu'une entrée de src/data/helpContent.js, consommée par
// <HelpPanel content={gedHelp} /> (aide co-localisée dans le module).

export const gedHelp = {
  title: 'Documents émis',
  subtitle: 'Versionnage de l\'étude de prix',
  tabs: [
    // ─── Onglet : Principe ──────────────────────────────────────────────
    {
      id: 'principe',
      label: 'Principe',
      icon: 'Info',
      sections: [
        {
          type: 'intro',
          text: 'Ce module conserve une trace de chaque version de l\'étude de prix transmise au client. Figer une version en crée une copie immuable et horodatée, identifiée par un indice. Le projet de travail, lui, reste toujours librement modifiable.',
        },
        {
          type: 'card',
          icon: 'Lock',
          color: 'indigo',
          title: 'Une version figée est immuable',
          description: 'Une fois figée, une version ne change plus jamais — même si vous modifiez ensuite le projet. C\'est la garantie d\'avoir l\'exact contenu envoyé au client à une date donnée.',
          tip: 'Figez une version juste avant chaque envoi client (estimation, DQE, mise à jour).',
        },
        {
          type: 'card',
          icon: 'GitBranch',
          color: 'emerald',
          title: 'Indice par phase',
          description: 'Chaque version reçoit un indice lettre selon la phase du projet : DCE-A, DCE-B, EXE-A… L\'indice s\'incrémente automatiquement à chaque nouveau gel dans la même phase.',
        },
        {
          type: 'warning',
          text: 'Figer une version ne remplace pas la sauvegarde du projet : c\'est une photographie en lecture seule, pas un point de restauration. Pour revenir en arrière sur le projet de travail, utilisez l\'historique / annuler dans l\'étude.',
        },
      ],
    },

    // ─── Onglet : Figer & consulter ─────────────────────────────────────
    {
      id: 'versions',
      label: 'Figer',
      icon: 'PlusCircle',
      sections: [
        {
          type: 'steps',
          items: [
            { title: 'Figer la version', description: 'Bouton « Figer la version » en haut à droite. Choisissez la phase, renseignez l\'objet, le destinataire, le statut et une note éventuelle.', color: 'indigo' },
            { title: 'Statut du document', description: 'Émis au client = version officiellement transmise. Brouillon interne = version de travail conservée pour mémoire.', color: 'amber' },
            { title: 'Consulter', description: 'Bouton œil sur une version : ouvre le contenu figé en lecture seule (chapitres, articles, montants).', color: 'blue' },
            { title: 'Supprimer', description: 'Bouton corbeille : supprime définitivement une version figée. Action irréversible.', color: 'red' },
          ],
        },
        {
          type: 'card',
          icon: 'Send',
          color: 'emerald',
          title: 'Métadonnées d\'émission',
          description: 'Objet, destinataire et note sont facultatifs mais recommandés : ils tracent à qui et pourquoi chaque version a été transmise. Ils apparaissent sur la liste et dans le visualiseur.',
        },
        {
          type: 'tip',
          title: 'Filtrer par phase',
          text: 'Quand les versions s\'accumulent, utilisez les filtres de phase (ESQ, AVP, PRO, DCE, EXE…) en haut de la liste pour ne voir que celles qui vous intéressent.',
        },
      ],
    },

    // ─── Onglet : Comparer (audit) ──────────────────────────────────────
    {
      id: 'comparer',
      label: 'Comparer',
      icon: 'BarChart3',
      sections: [
        {
          type: 'intro',
          text: 'L\'audit comparatif met deux versions face à face (ou une version figée et le travail en cours) pour visualiser précisément ce qui a changé entre deux émissions.',
        },
        {
          type: 'steps',
          items: [
            { title: 'Lancer une comparaison', description: 'Bouton graphique sur une version : elle devient la version « source » de la comparaison.', color: 'indigo' },
            { title: 'Choisir la cible', description: 'Dans la fenêtre, sélectionnez la version à comparer (une autre version figée, ou la version de travail actuelle).', color: 'blue' },
          ],
        },
        {
          type: 'table',
          title: 'Trois niveaux de lecture',
          rows: [
            { label: 'Synthèse', desc: 'Écart de total HT, nombre d\'articles ajoutés / supprimés / modifiés' },
            { label: 'Chapitres', desc: 'Comparaison du montant de chaque chapitre, avec l\'écart' },
            { label: 'Articles', desc: 'Détail ligne par ligne : ajouts, suppressions, variations de quantité et de prix' },
          ],
        },
        {
          type: 'tip',
          title: 'Justifier un écart de prix',
          text: 'Comparez la dernière version émise au client avec votre travail en cours pour produire instantanément la liste des modifications à expliquer (avenant, mise au point, négociation).',
        },
      ],
    },

    // ─── Onglet : Exporter ──────────────────────────────────────────────
    {
      id: 'exporter',
      label: 'Exporter',
      icon: 'FileDown',
      sections: [
        {
          type: 'intro',
          text: 'Une version figée peut être ré-imprimée à tout moment, à l\'identique de son contenu au moment du gel.',
        },
        {
          type: 'grid',
          items: [
            { title: 'PDF — DQE', text: 'Détail Quantitatif Estimatif au format PDF, avec page de garde.', color: 'red' },
            { title: 'PDF — Estimation', text: 'Estimation confidentielle au format PDF.', color: 'red' },
            { title: 'Excel — DQE', text: 'DQE au format tableur, réutilisable.', color: 'emerald' },
            { title: 'Excel — Estimation', text: 'Estimation au format tableur.', color: 'emerald' },
          ],
        },
        {
          type: 'card',
          icon: 'FileText',
          color: 'blue',
          title: 'Depuis le visualiseur',
          description: 'Ouvrez une version (œil), puis menu « Exporter » en haut à droite. Pour le PDF, un aperçu s\'affiche avant la sauvegarde.',
        },
        {
          type: 'card',
          icon: 'CheckCircle2',
          color: 'emerald',
          title: 'Quantités fidèles au gel',
          description: 'Les quantités, tranches et majorations client sont recalculées exactement comme au moment du gel : le document exporté reflète fidèlement la version figée.',
        },
      ],
    },
  ],
};

export default gedHelp;
