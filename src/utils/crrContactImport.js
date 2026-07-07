// src/utils/crrContactImport.js
//
// Parsing des lignes Excel/CSV vers des contacts de la bibliotheque CRC.
// Logique pure (sans React ni XLSX) pour etre testable independamment.
//
// Entree attendue : un tableau de tableaux (lignes brutes), tel que produit par
//   XLSX.utils.sheet_to_json(ws, { header: 1 })
// On lit ainsi TOUTES les lignes (aucune n'est consommee comme cle d'objet), ce
// qui permet de gerer sans perte les fichiers SANS ligne d'en-tete (positionnel).
//
// Deux modes, decides d'apres la 1re ligne non vide :
//  - En-tetes : la 1re ligne contient des libelles reconnus (dont un nom OU un
//    email). Les colonnes sont mappees PAR NOM (gere l'ordre libre + synonymes).
//  - Positionnel : sinon, toutes les lignes sont des donnees, mappees par
//    position canonique : Sous-label | NOM Prenom | Telephone | Email | Fonction.

// Normalise : retire les accents, minuscule, trim.
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Libelles d'en-tete reconnus, par champ (compares en egalite exacte apres norm).
const HEADER_SYNONYMS = {
  subLabel: ['sous-label', 'sous label', 'sublabel', 'label', 'societe', 'entreprise', 'organisme'],
  name: ['nom prenom', 'nom', 'name', 'contact', 'participant', 'intervenant'],
  fonction: ['fonction', 'function', 'poste', 'titre', 'qualite', 'role'],
  phone: ['telephone', 'tel', 'phone', 'portable', 'mobile', 'gsm'],
  email: ['email', 'mail', 'e-mail', 'courriel', 'mel'],
};

// Retourne le champ contact correspondant a un libelle d'en-tete, ou null.
export const fieldForHeader = (label) => {
  const n = norm(label);
  if (!n) return null;
  for (const field in HEADER_SYNONYMS) {
    if (HEADER_SYNONYMS[field].includes(n)) return field;
  }
  return null;
};

// Positions canoniques (fichier sans en-tete).
const POSITIONAL = { subLabel: 0, name: 1, phone: 2, email: 3, fonction: 4 };

// Transforme des lignes brutes (tableau de tableaux) en contacts bibliotheque.
// Retourne { contacts, skipped } ou skipped = nb de lignes de donnees sans nom
// ni email (donc non importables).
export const parseParticipantRows = (rows, idPrefix = 'lib') => {
  const empty = { contacts: [], skipped: 0 };
  if (!Array.isArray(rows)) return empty;

  // Retire les lignes entierement vides.
  const nonEmpty = rows.filter((r) => Array.isArray(r) && r.some((v) => norm(v) !== ''));
  if (nonEmpty.length === 0) return empty;

  // Detection d'en-tete : mappe chaque cellule de la 1re ligne a un champ connu.
  const headerMap = {};
  nonEmpty[0].forEach((cell, idx) => {
    const field = fieldForHeader(cell);
    if (field && !(field in headerMap)) headerMap[field] = idx;
  });
  const hasHeader = 'name' in headerMap || 'email' in headerMap;

  const map = hasHeader ? headerMap : POSITIONAL;
  const dataRows = hasHeader ? nonEmpty.slice(1) : nonEmpty;
  const get = (row, field) => (map[field] === undefined ? '' : String(row[map[field]] ?? '').trim());

  const contacts = [];
  let skipped = 0;
  dataRows.forEach((row, i) => {
    const c = {
      id: `${idPrefix}_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
      subLabel: get(row, 'subLabel'),
      name: get(row, 'name'),
      fonction: get(row, 'fonction'),
      phone: get(row, 'phone'),
      email: get(row, 'email'),
    };
    if (c.name || c.email) contacts.push(c);
    else skipped += 1;
  });

  return { contacts, skipped };
};
