export const MASTER_RC = [
  {
    id: "1",
    title: "OBJET DE LA CONSULTATION",
    level: 1,
    children: [
      {
        id: "1.1",
        title: "Acheteur",
        level: 2,
        content: `Le présent marché est passé par : {{client}}.\nAdresse : {{clientAddress}}, {{clientZip}} {{clientCity}}.`
      },
      {
        id: "1.2",
        title: "Objet et description du marché",
        level: 2,
        content: `L'opération a pour objet : {{projectDescription}}.\nLocalisation : {{location}}.`
      }
    ]
  },
  {
    id: "2",
    title: "CONDITIONS DE LA CONSULTATION",
    level: 1,
    content: "La présente consultation est soumise aux dispositions du Code de la Commande Publique."
  },
  {
    id: "3",
    title: "PRÉSENTATION DES OFFRES",
    level: 1,
    content: "Les candidats transmettent leur offre de manière dématérialisée."
  }
];

export const SMART_MAPPING_RC = [
  // Tu pourras ajouter ici des règles pour sélectionner automatiquement 
  // des clauses du RC en fonction du contenu du devis si tu le souhaites.
];