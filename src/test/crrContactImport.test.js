// src/test/crrContactImport.test.js
import { describe, it, expect } from 'vitest';
import { parseParticipantRows, fieldForHeader } from '../utils/crrContactImport';

describe('crrContactImport — fieldForHeader', () => {
  it('reconnaît les libellés (casse/accents/synonymes ignorés)', () => {
    expect(fieldForHeader('NOM Prenom')).toBe('name');
    expect(fieldForHeader('Contact')).toBe('name');
    expect(fieldForHeader('Téléphone')).toBe('phone');
    expect(fieldForHeader('Portable')).toBe('phone');
    expect(fieldForHeader('Courriel')).toBe('email');
    expect(fieldForHeader('Fonction')).toBe('fonction');
    expect(fieldForHeader('Poste')).toBe('fonction');
    expect(fieldForHeader('Rôle')).toBe('fonction');
    expect(fieldForHeader('Sous-label')).toBe('subLabel');
    expect(fieldForHeader('bidon')).toBeNull();
    expect(fieldForHeader('')).toBeNull();
  });
});

describe('crrContactImport — mode en-têtes', () => {
  it('mappe une ligne complète, Fonction incluse (ordre canonique)', () => {
    const rows = [
      ['Sous-label', 'NOM Prenom', 'Telephone', 'Email', 'Fonction'],
      ['MOE', 'DUPONT Jean', '0612', 'j@x.fr', 'Conducteur de travaux'],
    ];
    const { contacts, skipped } = parseParticipantRows(rows);
    expect(skipped).toBe(0);
    expect(contacts[0]).toMatchObject({
      subLabel: 'MOE', name: 'DUPONT Jean',
      phone: '0612', email: 'j@x.fr', fonction: 'Conducteur de travaux',
    });
    expect(contacts[0].id).toBeTruthy();
  });

  it('gère l\'ordre des colonnes libre + synonymes FR sans inverser tél/email (Finding 3)', () => {
    // En-têtes non standard, ordre : société | nom | email | tél | fonction
    const rows = [
      ['Société', 'Contact', 'Courriel', 'Portable', 'Rôle'],
      ['ENT', 'MARTIN Paul', 'm@e.fr', '0699', 'Chef de chantier'],
    ];
    const { contacts } = parseParticipantRows(rows);
    expect(contacts[0]).toMatchObject({
      subLabel: 'ENT', name: 'MARTIN Paul',
      email: 'm@e.fr', phone: '0699', fonction: 'Chef de chantier',
    });
  });

  it('reconnaît les synonymes de Fonction (Poste / Titre / Qualité)', () => {
    const mk = (h) => parseParticipantRows([['Nom', h, 'Email'], ['A', 'Chef', 'a@b.fr']]).contacts[0].fonction;
    expect(mk('Poste')).toBe('Chef');
    expect(mk('Titre')).toBe('Chef');
    expect(mk('Qualité')).toBe('Chef');
  });

  it('compte les lignes de données sans nom ni email dans skipped', () => {
    const rows = [
      ['Sous-label', 'NOM Prenom', 'Telephone', 'Email'],
      ['Grp', '', '0611', ''],           // ni nom ni email → skipped
      ['Réel', 'DURAND', '0612', 'd@x.fr'],
    ];
    const { contacts, skipped } = parseParticipantRows(rows);
    expect(contacts).toHaveLength(1);
    expect(contacts[0].name).toBe('DURAND');
    expect(skipped).toBe(1);
  });
});

describe('crrContactImport — mode positionnel (sans en-tête)', () => {
  it('n\'inverse pas tél/email et n\'ajoute pas de fonction fantôme', () => {
    const rows = [['MOA', 'BERNARD Luc', '0688', 'l@z.fr']];
    const { contacts } = parseParticipantRows(rows);
    expect(contacts[0]).toMatchObject({
      subLabel: 'MOA', name: 'BERNARD Luc',
      phone: '0688', email: 'l@z.fr', fonction: '',
    });
  });

  it('ne perd PAS la 1re ligne (Finding 1) : toutes les personnes sont importées', () => {
    const rows = [
      ['MOA', 'BERNARD Luc', '0688', 'l@z.fr'],
      ['ENT', 'DURAND Max', '0699', 'm@z.fr'],
    ];
    const { contacts } = parseParticipantRows(rows);
    expect(contacts).toHaveLength(2);
    expect(contacts.map((c) => c.name)).toEqual(['BERNARD Luc', 'DURAND Max']);
  });

  it('un email gmail en 1re ligne ne bascule PAS en mode en-têtes (Finding 2)', () => {
    const rows = [['ENT', 'DUPONT Jean', '0612', 'jean.dupont@gmail.com', 'Chef']];
    const { contacts } = parseParticipantRows(rows);
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({
      subLabel: 'ENT', name: 'DUPONT Jean',
      phone: '0612', email: 'jean.dupont@gmail.com', fonction: 'Chef',
    });
  });

  it('convertit les cellules numériques (téléphone) en chaîne', () => {
    const rows = [['MOE', 'X', 612, 'x@y.fr']];
    expect(parseParticipantRows(rows).contacts[0].phone).toBe('612');
  });
});

describe('crrContactImport — round-trip export → import', () => {
  it('préserve la Fonction et l\'ordre tél/email', () => {
    // Lignes telles que relues d'un classeur exporté (en-têtes + données)
    const rows = [
      ['Sous-label', 'NOM Prenom', 'Telephone', 'Email', 'Fonction'],
      ['ENT', 'PETIT Marie', '0611223344', 'm@e.fr', 'Chef de chantier'],
    ];
    const { contacts } = parseParticipantRows(rows);
    expect(contacts[0]).toMatchObject({
      phone: '0611223344', email: 'm@e.fr', fonction: 'Chef de chantier',
    });
  });
});

describe('crrContactImport — bords', () => {
  it('retourne {contacts:[], skipped:0} pour des données vides', () => {
    expect(parseParticipantRows([])).toEqual({ contacts: [], skipped: 0 });
    expect(parseParticipantRows(null)).toEqual({ contacts: [], skipped: 0 });
    expect(parseParticipantRows(undefined)).toEqual({ contacts: [], skipped: 0 });
    expect(parseParticipantRows([['', ''], ['']])).toEqual({ contacts: [], skipped: 0 });
  });
});
