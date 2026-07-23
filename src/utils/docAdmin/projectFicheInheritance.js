const clone = (value) => JSON.parse(JSON.stringify(value || {}));

const clean = (value) => String(value ?? '').trim();

const getAtPath = (value, path) =>
  path.split('.').reduce((current, key) => current?.[key], value);

const setAtPath = (value, path, nextValue) => {
  const keys = path.split('.');
  let current = value;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      current[key] = nextValue;
      return;
    }
    current[key] = current[key] && typeof current[key] === 'object'
      ? current[key]
      : {};
    current = current[key];
  });
};

const sameValue = (left, right) => JSON.stringify(left ?? '') === JSON.stringify(right ?? '');

const formatNumber = (value) => {
  if (!Number.isFinite(value)) return '';
  return Number(value.toFixed(2)).toString();
};

/**
 * Convertit les durées de la Fiche affaire ("1 mois", "4 semaines")
 * vers l'unité en mois utilisée par la fiche marché.
 */
export const durationToMonths = (value) => {
  if (typeof value === 'number') return formatNumber(value);
  const raw = clean(value).replace(',', '.');
  if (!raw) return '';

  const match = raw.match(/^(-?\d+(?:\.\d+)?)\s*(.*)$/);
  if (!match) return '';

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount < 0) return '';

  const unit = match[2].toLowerCase();
  if (unit.startsWith('sem')) return formatNumber(amount / 4.345);
  if (!unit || unit.startsWith('mois') || unit.startsWith('month')) return formatNumber(amount);
  return '';
};

/**
 * Sépare si possible une adresse MOE libre en adresse, code postal et ville.
 * En l'absence de structure reconnue, l'adresse reste entière.
 */
export const splitMoeAddress = (value) => {
  const raw = clean(value);
  if (!raw) return { adresse: '', codePostal: '', ville: '' };

  const normalized = raw.replace(/\r\n/g, '\n');
  const match = normalized.match(/^(.*?)(?:\s*,\s*|\n+)\s*(\d{5})\s+(.+)$/s);
  if (!match) return { adresse: raw, codePostal: '', ville: '' };

  return {
    adresse: clean(match[1]),
    codePostal: clean(match[2]),
    ville: clean(match[3]),
  };
};

const buildObjetMarche = (project) => {
  const parts = [
    project?.name,
    project?.subtitle1,
    project?.subtitle2,
    project?.projectDescription,
  ].map(clean).filter(Boolean);

  return [...new Set(parts)].join('\n');
};

const previewValue = (value) => {
  if (Array.isArray(value)) {
    return value.map((lot, index) => {
      const numero = clean(lot?.numero) || String(index + 1);
      const designation = clean(lot?.designation);
      return designation ? `Lot ${numero} — ${designation}` : `Lot ${numero}`;
    }).join(', ');
  }
  return clean(value);
};

/**
 * Prépare une fiche marché à partir des champs compatibles d'une affaire EstimaVRD.
 * Les champs vides de l'affaire ne suppriment jamais une saisie administrative.
 */
export const inheritFicheFromEstimaProject = (fiche, project, syncedAt = new Date().toISOString()) => {
  const next = clone(fiche);
  const changes = [];
  const moeAddress = splitMoeAddress(project?.moeAddress);

  const mappings = [
    { path: 'nom', label: 'Nom de la fiche', value: clean(project?.name) },
    { path: 'sectionA.designation', label: 'MOA — Désignation', value: clean(project?.client) },
    { path: 'sectionA.adresse', label: 'MOA — Adresse', value: clean(project?.clientAddress) },
    { path: 'sectionA.codePostal', label: 'MOA — Code postal', value: clean(project?.clientZip) },
    { path: 'sectionA.ville', label: 'MOA — Ville', value: clean(project?.clientCity) },
    { path: 'sectionC.nomCommercial', label: 'MOE — Nom', value: clean(project?.moe) },
    { path: 'sectionC.adresse', label: 'MOE — Adresse', value: moeAddress.adresse },
    { path: 'sectionC.codePostal', label: 'MOE — Code postal', value: moeAddress.codePostal },
    { path: 'sectionC.ville', label: 'MOE — Ville', value: moeAddress.ville },
    { path: 'sectionD.objet', label: 'Objet du marché', value: buildObjetMarche(project) },
    { path: 'sectionD.referenceMarche', label: 'Référence du marché', value: clean(project?.code) },
    {
      path: 'sectionD.dureePeriodePreparation',
      label: 'Période de préparation',
      value: durationToMonths(project?.prepPeriod),
    },
    {
      path: 'sectionD.dureeExecution',
      label: 'Durée des travaux',
      value: durationToMonths(project?.duration),
    },
    { path: 'sectionD.adresseExecution', label: "Adresse d'exécution", value: clean(project?.location) },
  ];

  const lotName = clean(project?.lotName);
  const currentLots = Array.isArray(next?.sectionD?.lots) ? next.sectionD.lots : [];
  if (lotName && currentLots.length <= 1) {
    const currentLot = currentLots[0] || {};
    mappings.push({
      path: 'sectionD.lots',
      label: 'Intitulé du lot',
      value: [{
        numero: clean(currentLot.numero) || '1',
        designation: lotName,
        montantHT: currentLot.montantHT || '',
      }],
    });
  }

  mappings.forEach(({ path, label, value }) => {
    if (value === '' || (Array.isArray(value) && value.length === 0)) return;
    const previous = getAtPath(next, path);
    if (sameValue(previous, value)) return;

    setAtPath(next, path, value);
    changes.push({
      path,
      label,
      before: previewValue(previous),
      after: previewValue(value),
    });
  });

  const previousSource = fiche?.sourceEstima || {};
  const sameProject = previousSource.projectId === project?.id;
  next.sourceEstima = {
    projectId: project?.id || '',
    projectName: clean(project?.name),
    projectCode: clean(project?.code),
    projectLastSaved: project?.lastSaved || null,
    linkedAt: sameProject && previousSource.linkedAt ? previousSource.linkedAt : syncedAt,
    syncedAt,
  };

  return { fiche: next, changes };
};
