// src/utils/crrParticipantTree.js
//
// Manipulation pure (sans React) de l'arborescence des participants CRC.
import { abbreviateGroup, normalizeGroupBadgeName } from '../data/crrData';
//
// Modele : participantGroups[] ; chaque groupe = { id, name, subLabel,
//   contacts: [], subGroups?: [] }. Un sous-groupe = { id, name, subLabel,
//   contacts: [] } (1 seul niveau — les sous-groupes ne s'imbriquent pas).
// Regle : un groupe porte SOIT des contacts directs, SOIT des sous-groupes.
// Les helpers restent tolerants si les deux coexistent (aucune perte).

// Tous les contacts d'un groupe (directs + ceux des sous-groupes), à plat.
export const flattenGroupContacts = (group) => [
  ...(group?.contacts || []),
  ...(group?.subGroups || []).flatMap((sg) => sg.contacts || []),
];

// Nombre total de contacts d'un groupe (directs + sous-groupes).
export const countGroupContacts = (group) => flattenGroupContacts(group).length;

// Options de pastilles pour les observations (emetteur / PAR) : liste ordonnee
// des groupes, de leurs sous-groupes ET des labels portes par les contacts.
// Chaque sous-groupe / label contact HERITE de l'index couleur de son groupe
// parent (pastille de la meme couleur).
// → [{ name, colorIndex, isSub, parentName, key }]
export const groupBadgeOptions = (groups) => {
  const out = [];
  const seen = new Set();
  const pushOption = (option) => {
    const name = (option.name || '').trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    out.push({ ...option, name });
  };

  (groups || []).forEach((g, gi) => {
    pushOption({ name: g.name, badgeName: g.badgeName, colorIndex: gi, isSub: false, parentName: null, key: g.id || `g${gi}` });
    (g.subGroups || []).forEach((sg, si) => {
      pushOption({ name: sg.name, badgeName: sg.badgeName, colorIndex: gi, isSub: true, parentName: g.name, key: sg.id || `g${gi}s${si}` });
    });
    flattenGroupContacts(g).forEach((contact, ci) => {
      pushOption({
        name: contact.subLabel,
        badgeName: contact.badgeName,
        colorIndex: gi,
        isSub: true,
        parentName: g.name,
        key: contact.id ? `label-${contact.id}` : `g${gi}l${ci}`,
      });
    });
  });
  return out;
};

// Map nom (groupe ou sous-groupe) → index couleur. En cas de collision de nom,
// la 1re occurrence (groupe avant ses sous-groupes) gagne.
export const groupColorIndexMap = (groups) => {
  const map = {};
  for (const o of groupBadgeOptions(groups)) {
    if (!(o.name in map)) map[o.name] = o.colorIndex;
  }
  return map;
};

export const groupBadgeNameMap = (groups) => {
  const map = {};
  for (const o of groupBadgeOptions(groups)) {
    if (!(o.name in map)) map[o.name] = o.badgeName;
  }
  return map;
};

const effectiveBadgeName = (fallbackName, badgeName) =>
  normalizeGroupBadgeName(badgeName) || abbreviateGroup(fallbackName);

// Renomme un code pastille partout dans l'arborescence participants, sans
// toucher aux noms metier (groupe.name / sous-groupe.name / contact.subLabel).
export const renameBadgeNameInTree = (groups, oldName, newName) => {
  if (!oldName || oldName === newName) return groups;
  const oldBadge = normalizeGroupBadgeName(oldName);
  const newBadge = normalizeGroupBadgeName(newName);
  const patchBadge = (fallbackName, badgeName) =>
    effectiveBadgeName(fallbackName, badgeName) === oldBadge ? newBadge : badgeName;
  return (groups || []).map((g) => ({
    ...g,
    badgeName: patchBadge(g.name, g.badgeName),
    contacts: (g.contacts || []).map((c) => ({ ...c, badgeName: patchBadge(c.subLabel || g.name, c.badgeName) })),
    subGroups: (g.subGroups || []).map((sg) => ({
      ...sg,
      badgeName: patchBadge(sg.name, sg.badgeName),
      contacts: (sg.contacts || []).map((c) => ({ ...c, badgeName: patchBadge(c.subLabel || sg.name, c.badgeName) })),
    })),
  }));
};

// Liste plate de tous les contacts de tous les groupes, avec le contexte
// (groupId/groupName, et subGroupId/subGroupName si le contact est dans un
// sous-groupe, sinon null).
export const flattenAllContacts = (groups) => {
  const out = [];
  for (const g of groups || []) {
    for (const c of g.contacts || []) {
      out.push({ ...c, groupId: g.id, groupName: g.name, subGroupId: null, subGroupName: null });
    }
    for (const sg of g.subGroups || []) {
      for (const c of sg.contacts || []) {
        out.push({ ...c, groupId: g.id, groupName: g.name, subGroupId: sg.id, subGroupName: sg.name });
      }
    }
  }
  return out;
};

// Insere une valeur a l'index donne (fin de liste si index null/undefined).
const insertAt = (list, item, index) => {
  const next = [...list];
  next.splice(index == null ? next.length : index, 0, item);
  return next;
};

// Ajoute un contact dans un groupe (subGroupId null) ou dans un sous-groupe,
// a l'index donne (fin de liste par defaut).
export const addContactToTree = (groups, groupId, subGroupId, contact, index = null) =>
  groups.map((g) => {
    if (g.id !== groupId) return g;
    if (!subGroupId) return { ...g, contacts: insertAt(g.contacts || [], contact, index) };
    return {
      ...g,
      subGroups: (g.subGroups || []).map((sg) =>
        sg.id === subGroupId ? { ...sg, contacts: insertAt(sg.contacts || [], contact, index) } : sg
      ),
    };
  });

// Met à jour un contact identifié par son id, où qu'il se trouve.
export const updateContactInTree = (groups, contactId, patch) =>
  groups.map((g) => ({
    ...g,
    contacts: (g.contacts || []).map((c) => (c.id === contactId ? { ...c, ...patch } : c)),
    subGroups: (g.subGroups || []).map((sg) => ({
      ...sg,
      contacts: (sg.contacts || []).map((c) => (c.id === contactId ? { ...c, ...patch } : c)),
    })),
  }));

// Supprime un contact identifié par son id, où qu'il se trouve.
export const deleteContactFromTree = (groups, contactId) =>
  groups.map((g) => ({
    ...g,
    contacts: (g.contacts || []).filter((c) => c.id !== contactId),
    subGroups: (g.subGroups || []).map((sg) => ({
      ...sg,
      contacts: (sg.contacts || []).filter((c) => c.id !== contactId),
    })),
  }));

// ── Sous-groupes ──────────────────────────────────────────────────────────

export const addSubGroupToTree = (groups, groupId, subGroup) =>
  groups.map((g) => (g.id === groupId ? { ...g, subGroups: [...(g.subGroups || []), subGroup] } : g));

export const updateSubGroupInTree = (groups, groupId, subGroupId, patch) =>
  groups.map((g) =>
    g.id !== groupId
      ? g
      : { ...g, subGroups: (g.subGroups || []).map((sg) => (sg.id === subGroupId ? { ...sg, ...patch } : sg)) }
  );

// Supprime un sous-groupe (et tous ses contacts).
export const deleteSubGroupFromTree = (groups, groupId, subGroupId) =>
  groups.map((g) =>
    g.id !== groupId ? g : { ...g, subGroups: (g.subGroups || []).filter((sg) => sg.id !== subGroupId) }
  );

// ── Déplacement (drag & drop) ───────────────────────────────────────────────

// Retire un contact (par id) n'importe où. Renvoie { groups, contact }.
const removeContact = (groups, contactId) => {
  let removed = null;
  const next = groups.map((g) => ({
    ...g,
    contacts: (g.contacts || []).filter((c) => (c.id === contactId ? ((removed = c), false) : true)),
    subGroups: (g.subGroups || []).map((sg) => ({
      ...sg,
      contacts: (sg.contacts || []).filter((c) => (c.id === contactId ? ((removed = c), false) : true)),
    })),
  }));
  return { groups: next, contact: removed };
};

// Insère un contact à un emplacement (groupId, subGroupId|null, index).
const insertContact = (groups, groupId, subGroupId, contact, index) =>
  groups.map((g) => {
    if (g.id !== groupId) return g;
    if (!subGroupId) {
      const contacts = [...(g.contacts || [])];
      contacts.splice(index == null ? contacts.length : index, 0, contact);
      return { ...g, contacts };
    }
    return {
      ...g,
      subGroups: (g.subGroups || []).map((sg) => {
        if (sg.id !== subGroupId) return sg;
        const contacts = [...(sg.contacts || [])];
        contacts.splice(index == null ? contacts.length : index, 0, contact);
        return { ...sg, contacts };
      }),
    };
  });

// Déplace un contact (par id) vers dest = { groupId, subGroupId|null } à l'index
// donné. No-op si le contact, le groupe cible OU le sous-groupe cible est
// introuvable (sinon le contact retiré ne serait jamais réinséré → perte).
export const moveContactInTree = (groups, contactId, dest, index) => {
  const { groups: without, contact } = removeContact(groups, contactId);
  if (!contact) return groups;
  const destGroup = without.find((g) => g.id === dest.groupId);
  if (!destGroup) return groups;
  if (dest.subGroupId && !(destGroup.subGroups || []).some((sg) => sg.id === dest.subGroupId)) return groups;
  return insertContact(without, dest.groupId, dest.subGroupId || null, contact, index);
};
