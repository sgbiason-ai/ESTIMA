// src/components/docAdmin/exeReceptionHelpers.js
// Utilitaires date + modele de donnees pour les fiches EXE (reception des travaux).
// Extraits de ExeReceptionForm.jsx pour etre partagés avec ExeLeveeForm, Exe10Form, et les generateurs PDF.

// ─── Utilitaires date ───────────────────────────────────────────────────────

export const getOSDate = (os) => {
  const d = os?.dateDemarragePrestations || os?.dateReception;
  if (!d) return null;
  const date = new Date(d);
  return isNaN(date.getTime()) ? null : date;
};

export const calculateArretDays = (osList) => {
  const events = osList
    .filter(os => os.typeOS === 'arret' || os.typeOS === 'reprise')
    .map(os => ({ type: os.typeOS, date: getOSDate(os) }))
    .filter(e => e.date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  let totalArretDays = 0, currentArret = null;
  for (const event of events) {
    if (event.type === 'arret' && !currentArret) currentArret = event.date;
    else if (event.type === 'reprise' && currentArret) {
      const jours = Math.round((event.date.getTime() - currentArret.getTime()) / (1000 * 60 * 60 * 24));
      if (jours > 0) totalArretDays += jours;
      currentArret = null;
    }
  }
  if (currentArret) {
    const jours = Math.round((new Date().getTime() - currentArret.getTime()) / (1000 * 60 * 60 * 24));
    if (jours > 0) totalArretDays += jours;
  }
  return totalArretDays;
};

export const calculateEndDate = (startDateStr, duration, unit) => {
  if (!startDateStr || !duration) return null;
  const date = new Date(startDateStr);
  if (isNaN(date.getTime())) return null;
  const amount = parseInt(duration, 10);
  if (isNaN(amount)) return null;
  if ((unit || '').toLowerCase().includes('mois')) date.setMonth(date.getMonth() + amount);
  else if ((unit || '').toLowerCase().includes('jour')) date.setDate(date.getDate() + amount);
  else if ((unit || '').toLowerCase().includes('semaine')) date.setDate(date.getDate() + amount * 7);
  return date;
};

export const getDateFinRevisee = (fiche) => {
  if (!fiche) return null;
  const D = fiche.sectionD || {};
  const osList = Array.isArray(fiche.exe1) ? fiche.exe1 : (fiche.exe1 ? [fiche.exe1] : []);
  const osDemarrage = osList.find(os => String(os.numeroOrdreService) === '1') || osList[0];
  const dateDemarrage = osDemarrage?.dateDemarragePrestations || osDemarrage?.dateReception || null;
  const dateFinTheorique = calculateEndDate(dateDemarrage, D.dureeExecution, D.uniteDuree);
  if (!dateFinTheorique) return null;
  const totalJours = (parseInt(D.joursIntemperies, 10) || 0) + calculateArretDays(osList);
  const dateFinRevisee = new Date(dateFinTheorique);
  dateFinRevisee.setDate(dateFinRevisee.getDate() + totalJours);
  return dateFinRevisee;
};

// ─── Modele de donnees ─────────────────────────────────────────────────────

export const createEmptyReceptionData = () => ({
  dateAchevementProposee: '', porteeReception: 'globale', designationPartielle: '', dateOPR: '',
  presencePA: 'present', presenceTitulaire: 'present', dateConvocationTitulaire: '',
  epreuves: 'non_effectuees', epreuvesExceptions: '',
  travauxExputes: 'oui', travauxExceptions: '',
  ouvragesConformes: 'oui', ouvragesExceptions: '',
  poseEquipements: 'conforme', repliInstallations: 'oui', remiseEnEtatTerrains: 'oui',
  propositionMoe: 'prononcer', decisionPA: 'prononcer',
  dateAchevementRetenue: '', typeReception: 'sans_reserve',
  reserves: [{ numero: '1', designation: '', delaiLevee: '', images: [] }],
  reserveSourceVisit: null,
  observationsReserves: '',
  refactionMontant: '', dateLettreRefaction: '',
  delaiRepliInstallations: '', delaiMiseConformiteEquipements: '',
  lieuSignatureMoe: '', dateSignatureMoe: '',
  lieuSignatureTitulaire: '', dateSignatureTitulaire: '',
  observationsTitulaire: '', refusSignatureTitulaire: false,
  lieuSignaturePA: '', dateSignaturePA: '',
  // EXE8 — PV levee des reserves
  exe8_presencePA: 'present',
  exe8_presenceTitulaire: 'present',
  exe8_dateConvocationTitulaire: '',
  exe8_epreuves: 'non_effectuees',
  exe8_epreuvesExceptions: '',
  exe8_epreuvesConcluantes: 'concluantes',
  exe8_epreuvesConcluantesExceptions: '',
  exe8_travauxExecutes: 'oui',
  exe8_travauxExceptions: '',
  exe8_ouvragesConformes: 'oui',
  exe8_ouvragesExceptions: '',
  exe8_poseEquipements: 'conforme',
  exe8_repliInstallations: 'oui',
  exe8_remiseEnEtatTerrains: 'oui',
  exe8_dateSignatureMoe: '',
  exe8_dateSignatureTitulaire: '',
  exe8_refusSignatureTitulaire: false,
  // EXE9 — Propositions et decision levee reserves
  exe9_datePVLevee: '',
  exe9_propositionMoe: 'lever_toutes',
  exe9_dateDecisionReception: '',
  exe9_annexeLevee: '',
  exe9_maintienEpreuves: false,
  exe9_maintienEpreuvesAnnexe: '',
  exe9_maintienTravaux: false,
  exe9_maintienTravauxAnnexe: '',
  exe9_maintienImperfections: false,
  exe9_maintienImperfectionsAnnexe: '',
  exe9_maintienInstallations: false,
  exe9_maintienInstallationsDate: '',
  exe9_maintienPose: false,
  exe9_maintienPoseDate: '',
  exe9_lieuSignatureMoe: '',
  exe9_dateSignatureMoe: '',
  exe9_datePropositionsMoe: '',
  exe9_decisionMO: 'accepter',
  exe9_decisionSub: 'lever_toutes',
  exe9_decisionDateReception: '',
  exe9_decisionAnnexeLevee: '',
  exe9_decisionMaintienEpreuves: false,
  exe9_decisionMaintienEpreuvesAnnexe: '',
  exe9_decisionMaintienTravaux: false,
  exe9_decisionMaintienTravauxAnnexe: '',
  exe9_decisionMaintienImperfections: false,
  exe9_decisionMaintienImperfectionsAnnexe: '',
  exe9_decisionMaintienInstallations: false,
  exe9_decisionMaintienInstallationsDate: '',
  exe9_decisionMaintienPose: false,
  exe9_decisionMaintienPoseDate: '',
  exe9_lieuSignatureMO: '',
  exe9_dateSignatureMO: '',
});
