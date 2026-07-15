export const COVER_TEMPLATE_ESTIMA = 'estima';
export const COVER_TEMPLATE_PAPYRUS_STANDARD = 'papyrus_standard';

export const COVER_TEMPLATE_OPTIONS = [
  { value: COVER_TEMPLATE_ESTIMA, label: 'ESTIMA STANDARD' },
  { value: COVER_TEMPLATE_PAPYRUS_STANDARD, label: 'CARTOUCHE PAPYRUS STANDART' },
];

export const resolveCoverTemplate = (branding) =>
  branding?.coverTemplate === COVER_TEMPLATE_PAPYRUS_STANDARD
    ? COVER_TEMPLATE_PAPYRUS_STANDARD
    : COVER_TEMPLATE_ESTIMA;

export const usesPapyrusCover = (branding) =>
  resolveCoverTemplate(branding) === COVER_TEMPLATE_PAPYRUS_STANDARD;
