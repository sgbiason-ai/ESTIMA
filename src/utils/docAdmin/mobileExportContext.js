const emptyExeData = () => ({ exe1: [], reception: {}, exe10: {} });

const entrepriseName = (entreprise = {}) =>
  entreprise.nomCommercial
  || entreprise.denominationSociale
  || 'Entreprise non renseignée';

const lotLabel = (lot, index) =>
  `Lot ${lot?.numero || index + 1}${lot?.designation ? ` — ${lot.designation}` : ''}`;

export const getMobileDocAdminExportTargets = (fiche = {}) => {
  const lots = fiche.sectionD?.lots || [];
  const groups = fiche.sectionB?.groupesAttributaires || [];
  const isAlloti = lots.length > 0 && groups.length > 0;

  if (!isAlloti) {
    const data = {
      exe1: fiche.exe1 || [],
      reception: fiche.reception || {},
      exe10: fiche.exe10 || {},
    };
    const hasData = data.exe1.length > 0
      || Object.keys(data.reception).length > 0
      || Object.keys(data.exe10).length > 0;
    return hasData ? [{
      groupeId: '_root',
      name: entrepriseName(fiche.sectionB?.mandataire),
      lotLabels: lots.map(lotLabel),
      data,
    }] : [];
  }

  return groups.map((group, groupIndex) => {
    const groupeId = group.groupeId || `_legacy_${groupIndex}`;
    const assignedLots = (group.lotIndices || [])
      .map((lotIndex) => ({ lot: lots[lotIndex], lotIndex }))
      .filter(({ lot }) => !!lot);

    return {
      groupeId,
      name: entrepriseName(group.entreprise),
      lotLabels: assignedLots.map(({ lot, lotIndex }) => lotLabel(lot, lotIndex)),
      data: fiche.exeParEntreprise?.[group.groupeId] || emptyExeData(),
    };
  });
};

export const buildMobileDocAdminExportContext = (fiche = {}, groupeId) => {
  if (groupeId === '_root') {
    return {
      fiche,
      data: {
        exe1: fiche.exe1 || [],
        reception: fiche.reception || {},
        exe10: fiche.exe10 || {},
      },
    };
  }

  const groups = fiche.sectionB?.groupesAttributaires || [];
  const lots = fiche.sectionD?.lots || [];
  const group = groups.find((entry, index) =>
    (entry.groupeId || `_legacy_${index}`) === groupeId);

  if (!group) {
    throw new Error('Attributaire introuvable pour cet export.');
  }

  const data = fiche.exeParEntreprise?.[group.groupeId] || emptyExeData();
  const assignedLots = (group.lotIndices || [])
    .map((lotIndex) => lots[lotIndex])
    .filter(Boolean);

  return {
    data,
    fiche: {
      ...fiche,
      exe1: data.exe1 || [],
      reception: data.reception || {},
      exe10: data.exe10 || {},
      sectionB: {
        type: 'seul',
        typeGroupement: 'solidaire',
        mandataire: group.entreprise || {},
        cotraitants: [],
      },
      sectionD: {
        ...fiche.sectionD,
        lots: assignedLots,
      },
    },
  };
};
