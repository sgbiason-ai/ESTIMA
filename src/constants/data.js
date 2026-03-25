export const UNIT_MAPPING = {
  'm2': 'LE METRE CARRE',
  'm3': 'LE METRE CUBE',
  'ml': 'LE METRE LINEAIRE',
  'u': 'L\'UNITE',
  'ens': 'L\'ENSEMBLE',
  't': 'LA TONNE',
  'f': 'LE FORFAIT',
  'h': 'L\'HEURE'
};

export const UNIT_OPTIONS = Object.keys(UNIT_MAPPING);

export const INITIAL_BPU = [
  { 
    id: '1105', 
    code: '1105', 
    designation: 'Installation de chantier', 
    description: "Ce prix rémunère au forfait l'installation de chantier. Il comprend :<ul><li>Les amenées et replis de matériel</li><li>La mise en place des installations de vie (bungalows)</li><li>Les raccordements provisoires (eau, électricité)</li></ul>",
    unit: 'f', 
    price: 1500.00 
  },
  { 
    id: '1205', 
    code: '1205', 
    designation: 'Démolition de maçonneries', 
    description: "Démolition de maçonneries de toutes natures, y compris fondations éventuelles. <b>Comprend le chargement, le transport et l'évacuation</b> des gravois à la décharge publique.",
    unit: 'm3', 
    price: 45.00 
  },
  { 
    id: '1305', 
    code: '1305', 
    designation: 'Décapage de terre végétale', 
    description: "Décapage de la terre végétale sur une épaisseur moyenne de 20cm.",
    unit: 'm3', 
    price: 4.50 
  },
  { 
    id: '1472', 
    code: '1472', 
    designation: 'Bordures T2', 
    description: "Fourniture et pose de bordures de type T2 en béton, classe U+NF.",
    unit: 'ml', 
    price: 28.00 
  },
];