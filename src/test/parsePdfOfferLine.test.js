import { describe, it, expect } from 'vitest';
import { parseArticleLine, isGarbledText } from '../utils/parsePdfOffer';

// Lignes réelles extraites du calque texte d'un DQE PDF d'entreprise (SPIE
// BATIGNOLLES MALET, affaire BOUT DU PONT DE L'ARN). Chaque montant y est suffixé
// « € », qui devient un token isolé : la passe token-based prenait ce symbole pour
// l'unité et n'extrayait aucun article, ce qui faisait basculer tout l'import sur
// l'OCR alors que le PDF contient un calque texte parfaitement lisible.
describe('parseArticleLine — montants suffixés d’un symbole monétaire', () => {
  it('lit une ligne au forfait avec séparateur de milliers', () => {
    expect(parseArticleLine('P.01 INSTALLATION DE CHANTIER FT 1 7 740.00 € 7 740.00 €')).toEqual({
      ref: 'P.01', designation: 'INSTALLATION DE CHANTIER', unit: 'FT',
      qty: 1, price: 7740, montant: 7740,
    });
  });

  it('tranche l’ambiguïté « 1 550,00 » via la cohérence qté × P.U. = montant', () => {
    // "1 550.00" peut se lire qté 1 × P.U. 550,00 OU P.U. 1550,00 : seul le
    // montant de la ligne permet de choisir. Une simple jonction des milliers
    // (joinThousandsSpaces) retiendrait 1550,00 et perdrait la quantité.
    const r = parseArticleLine('P.03 CONSTAT D’HUISSIER FT 1 550.00 € 550.00 €');
    expect(r).toMatchObject({ qty: 1, price: 550, montant: 550 });
  });

  it('lit une ligne au métré avec décimales', () => {
    expect(parseArticleLine('P.07 DÉCROUTAGE DALLE SPORTIVE EXISTANTE M2 229 7.10 € 1 625.90 €'))
      .toMatchObject({ ref: 'P.07', unit: 'M2', qty: 229, price: 7.1, montant: 1625.9 });
  });

  it('conserve les caractères techniques de la désignation', () => {
    expect(parseArticleLine('P.43 CANALISATION EP PVC CR8 - Ø200 ML 33 103.20 € 3 405.60 €'))
      .toMatchObject({ ref: 'P.43', designation: 'CANALISATION EP PVC CR8 - Ø200', qty: 33, price: 103.2 });
  });

  it('accepte la virgule décimale française', () => {
    expect(parseArticleLine('P.08 DÉMOLITION DES BORDURES ML 66 10,60 € 699,60 €'))
      .toMatchObject({ qty: 66, price: 10.6, montant: 699.6 });
  });

  it('ignore les lignes de sous-total et de récapitulatif', () => {
    expect(parseArticleLine('SOUS-TOTAL INSTALLATION DE CHANTIER 13 607.00 €')).toBeNull();
    expect(parseArticleLine('INSTALLATION DE CHANTIER 13 607.00 €')).toBeNull();
    expect(parseArticleLine('TVA (20%) 56 240.63 €')).toBeNull();
  });

  it('laisse la passe historique traiter les lignes sans symbole monétaire', () => {
    // Format DQE classique (aucun €) : le comportement d'origine est préservé.
    expect(parseArticleLine('P.13 DÉCAPAGE TERRE VÉGÉTALE M3 637 3.30 2102.10'))
      .toMatchObject({ ref: 'P.13', unit: 'M3', qty: 637, price: 3.3 });
  });
});

// Le PDF fournit chaque colonne comme un item texte distinct. L'aplatir crée des
// ambiguïtés arithmétiquement insolubles, que seules les cellules lèvent.
describe('parseArticleLine — découpage en cellules fourni par le PDF', () => {
  const cells = (...strs) => strs.map((str, i) => ({ x: 60 + i * 50, str }));

  it('lève l’ambiguïté « 1 1 100,00 » que la cohérence ne peut pas trancher', () => {
    // Ligne réelle (EIFFAGE, P.59). Aplatie, elle se lit aussi bien
    // qté 1 × 1 100,00 que qté 11 × 100,00 : les deux donnent 1 100,00.
    // Les cellules disent « 1 » et « 1 100,00 » — sans ambiguïté.
    const items = cells('P.59', ' ', 'PLAQUE PLEINE, VIDANGE ET VENTOUSE', ' ', 'FT', ' ',
                        '1', ' ', '1 100,00', ' ', '€', ' ', '1 100,00', ' ', '€');
    const flat = 'P.59 PLAQUE PLEINE, VIDANGE ET VENTOUSE FT 1 1 100,00 € 1 100,00 €';

    expect(parseArticleLine(flat, items)).toMatchObject({
      ref: 'P.59', unit: 'FT', qty: 1, price: 1100, montant: 1100,
    });
    // Sans les cellules, la lecture erronée qté 11 est retenue — d'où la passe.
    expect(parseArticleLine(flat).qty).toBe(11);
  });

  it('reste inerte sans cellules : le chemin OCR n’est pas affecté', () => {
    const flat = 'P.07 DÉCROUTAGE DALLE SPORTIVE EXISTANTE M2 229 7.10 € 1 625.90 €';
    const attendu = { ref: 'P.07', unit: 'M2', qty: 229, price: 7.1 };
    expect(parseArticleLine(flat)).toMatchObject(attendu);
    expect(parseArticleLine(flat, null)).toMatchObject(attendu);
    expect(parseArticleLine(flat, [])).toMatchObject(attendu);
  });

  it('rend la main aux passes texte si les cellules sont incohérentes', () => {
    // Nombre fragmenté sur deux items : qté × P.U. ≠ montant → repli, pas de
    // résultat faux. La passe monétaire reprend depuis la ligne aplatie.
    const items = cells('P.07', 'DÉCROUTAGE DALLE SPORTIVE EXISTANTE', 'M2', '229', '7', '.10', '1 625.90');
    const flat = 'P.07 DÉCROUTAGE DALLE SPORTIVE EXISTANTE M2 229 7.10 € 1 625.90 €';
    expect(parseArticleLine(flat, items)).toMatchObject({ qty: 229, price: 7.1 });
  });

  it('recompose une désignation éclatée sur plusieurs cellules', () => {
    const items = cells('P.18', 'REPRISE ET MISE EN PLACE', 'DE LA TERRE VÉGÉTALE', 'M3', '73', '5,40', '394,20');
    expect(parseArticleLine('', items)).toMatchObject({
      ref: 'P.18', designation: 'REPRISE ET MISE EN PLACE DE LA TERRE VÉGÉTALE',
      unit: 'M3', qty: 73, price: 5.4,
    });
  });

  it('accepte une unité hors catalogue quand l’arithmétique la valide (cellules)', () => {
    // « FT / MOIS » wrappé par le PDF : la cellule unité ne contient que « MOIS ».
    // La structure en colonnes + qté × P.U. = montant suffisent comme preuve —
    // l'exigence stricte du catalogue laissait l'article à 0 € (cas réel
    // GESTION DE LA CIRCULATION, offre BRESSOLLES).
    const items = cells('P.02', 'GESTION DE LA CIRCULATION', 'MOIS', '2', '900,00 €', '1 800,00 €');
    expect(parseArticleLine('', items)).toMatchObject({
      ref: 'P.02', designation: 'GESTION DE LA CIRCULATION', qty: 2, price: 900, montant: 1800,
    });
  });

  it('rejette toujours une ligne incohérente, même à unité plausible', () => {
    // Sans cohérence qté × P.U. ≈ montant, l'unité souple ne doit rien laisser passer.
    const items = cells('P.99', 'LIGNE DOUTEUSE', 'XYZ', '2', '10,00', '95,00');
    expect(parseArticleLine('', items)).toBeNull();
  });
});

describe('isGarbledText — pages au calque texte corrompu', () => {
  it('détecte un texte de police sans table Unicode', () => {
    // Motif réel (offre BRESSOLLES, pages tranches 2/3) : glyphes PUA/combinants
    expect(isGarbledText('͖((³ϙ( i[ϙ@)b)[ϙ ͕͔͒ ϙ͓͑͐Ϡ͔͏ϙ ь ͖((³ϙ(')).toBe(true);
  });
  it('laisse passer un bordereau français normal', () => {
    expect(isGarbledText('P.08 DÉCROUTAGE VOIRIE BICOUCHE / TRICOUCHE m² 583 5,50 € 3 206,50 €')).toBe(false);
  });
  it('ignore les textes trop courts pour juger', () => {
    expect(isGarbledText('͖((')).toBe(false);
  });
});
