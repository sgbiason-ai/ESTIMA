// src/test/crrParticipantTree.test.js
import { describe, it, expect } from 'vitest';
import {
  flattenGroupContacts, countGroupContacts, flattenAllContacts,
  addContactToTree, updateContactInTree, deleteContactFromTree,
  addSubGroupToTree, updateSubGroupInTree, deleteSubGroupFromTree,
  moveContactInTree,
} from '../utils/crrParticipantTree';

const c = (id, name) => ({ id, name, email: `${name}@x.fr`, cpr: false });

const makeGroups = () => [
  { id: 'g1', name: 'MOE', subLabel: '', contacts: [c('a', 'Alice')], subGroups: [] },
  {
    id: 'g2', name: 'Entreprises', subLabel: '', contacts: [],
    subGroups: [
      { id: 's1', name: 'Lot 1', subLabel: '', contacts: [c('b', 'Bob')] },
      { id: 's2', name: 'Lot 2', subLabel: '', contacts: [c('d', 'Dan'), c('e', 'Eve')] },
    ],
  },
];

describe('crrParticipantTree — flatten', () => {
  it('flattenGroupContacts : directs + sous-groupes', () => {
    const g = makeGroups()[1];
    expect(flattenGroupContacts(g).map((x) => x.id)).toEqual(['b', 'd', 'e']);
    expect(countGroupContacts(g)).toBe(3);
    expect(countGroupContacts(makeGroups()[0])).toBe(1);
  });

  it('flattenAllContacts : contexte groupe/sous-groupe', () => {
    const all = flattenAllContacts(makeGroups());
    expect(all).toHaveLength(4);
    expect(all.find((x) => x.id === 'a')).toMatchObject({ groupId: 'g1', subGroupId: null });
    expect(all.find((x) => x.id === 'b')).toMatchObject({ groupId: 'g2', subGroupId: 's1', subGroupName: 'Lot 1' });
  });

  it('tolère un groupe sans subGroups / contacts', () => {
    expect(flattenGroupContacts({ id: 'x', name: 'X' })).toEqual([]);
    expect(flattenAllContacts([{ id: 'x', name: 'X' }])).toEqual([]);
  });
});

describe('crrParticipantTree — contacts', () => {
  it('addContactToTree : dans un groupe (subGroupId null)', () => {
    const out = addContactToTree(makeGroups(), 'g1', null, c('z', 'Zoe'));
    expect(out[0].contacts.map((x) => x.id)).toEqual(['a', 'z']);
  });

  it('addContactToTree : dans un sous-groupe', () => {
    const out = addContactToTree(makeGroups(), 'g2', 's1', c('z', 'Zoe'));
    expect(out[1].subGroups[0].contacts.map((x) => x.id)).toEqual(['b', 'z']);
    expect(out[1].contacts).toEqual([]); // pas ajouté aux contacts directs
  });

  it('updateContactInTree : trouve le contact où qu\'il soit', () => {
    const out1 = updateContactInTree(makeGroups(), 'a', { fonction: 'Chef' });
    expect(out1[0].contacts[0].fonction).toBe('Chef');
    const out2 = updateContactInTree(makeGroups(), 'e', { fonction: 'Paysagiste' });
    expect(out2[1].subGroups[1].contacts[1].fonction).toBe('Paysagiste');
  });

  it('deleteContactFromTree : retire le contact où qu\'il soit', () => {
    const out = deleteContactFromTree(makeGroups(), 'd');
    expect(out[1].subGroups[1].contacts.map((x) => x.id)).toEqual(['e']);
    const out2 = deleteContactFromTree(makeGroups(), 'a');
    expect(out2[0].contacts).toEqual([]);
  });
});

describe('crrParticipantTree — sous-groupes', () => {
  it('addSubGroupToTree', () => {
    const out = addSubGroupToTree(makeGroups(), 'g1', { id: 's9', name: 'Nouveau', subLabel: '', contacts: [] });
    expect(out[0].subGroups.map((s) => s.id)).toEqual(['s9']);
  });

  it('updateSubGroupInTree : renomme', () => {
    const out = updateSubGroupInTree(makeGroups(), 'g2', 's1', { name: 'Lot 1 VRD' });
    expect(out[1].subGroups[0].name).toBe('Lot 1 VRD');
  });

  it('deleteSubGroupFromTree : retire le sous-groupe et ses contacts', () => {
    const out = deleteSubGroupFromTree(makeGroups(), 'g2', 's1');
    expect(out[1].subGroups.map((s) => s.id)).toEqual(['s2']);
  });
});

describe('crrParticipantTree — déplacement', () => {
  it('déplace un contact d\'un sous-groupe vers un autre', () => {
    const out = moveContactInTree(makeGroups(), 'b', { groupId: 'g2', subGroupId: 's2' }, 0);
    expect(out[1].subGroups[0].contacts).toEqual([]); // Lot 1 vidé
    expect(out[1].subGroups[1].contacts.map((x) => x.id)).toEqual(['b', 'd', 'e']); // Bob en tête de Lot 2
  });

  it('déplace un contact d\'un groupe vers un sous-groupe', () => {
    const out = moveContactInTree(makeGroups(), 'a', { groupId: 'g2', subGroupId: 's1' }, 1);
    expect(out[0].contacts).toEqual([]);
    expect(out[1].subGroups[0].contacts.map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('no-op si le contact est introuvable', () => {
    const groups = makeGroups();
    expect(moveContactInTree(groups, 'zzz', { groupId: 'g1', subGroupId: null }, 0)).toBe(groups);
  });

  it('no-op si le groupe cible est introuvable', () => {
    const groups = makeGroups();
    const out = moveContactInTree(groups, 'a', { groupId: 'gX', subGroupId: null }, 0);
    expect(out).toBe(groups); // inchangé (Alice pas perdue)
  });

  it('no-op si le SOUS-groupe cible est introuvable (contact pas perdu)', () => {
    const groups = makeGroups();
    const out = moveContactInTree(groups, 'a', { groupId: 'g2', subGroupId: 'ghost' }, 0);
    expect(out).toBe(groups); // Alice reste dans g1, pas supprimée sans réinsertion
  });
});

describe('crrParticipantTree — insertion à l\'index (drop biblio)', () => {
  it('addContactToTree insère à l\'index donné dans un groupe', () => {
    const groups = [{ id: 'g1', name: 'G', contacts: [c('a', 'A'), c('b', 'B')], subGroups: [] }];
    const out = addContactToTree(groups, 'g1', null, c('x', 'X'), 1);
    expect(out[0].contacts.map((k) => k.id)).toEqual(['a', 'x', 'b']);
  });

  it('addContactToTree insère à l\'index donné dans un sous-groupe', () => {
    const out = addContactToTree(makeGroups(), 'g2', 's2', c('x', 'X'), 1);
    expect(out[1].subGroups[1].contacts.map((k) => k.id)).toEqual(['d', 'x', 'e']);
  });

  it('addContactToTree sans index ajoute en fin (comportement historique)', () => {
    const out = addContactToTree(makeGroups(), 'g2', 's1', c('x', 'X'));
    expect(out[1].subGroups[0].contacts.map((k) => k.id)).toEqual(['b', 'x']);
  });
});
