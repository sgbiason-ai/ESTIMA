// src/utils/crcChantierStatus.js
//
// Statut « chantier terminé » d'une affaire CRC.
//
// Modele : un champ `archivedAt` (ISO) sur le document companies/{id}/crr/{crcId}.
// Absence du champ = affaire en cours → aucune migration, les anciens docs sont
// actifs par defaut. Meme schema que la corbeille du Gestionnaire de projets
// (`deletedAt`), volontairement : deux champs distincts, deux etats independants.
//
// Archiver ne supprime rien : c'est un filtre d'affichage + un verrou d'ecriture.

/** Une affaire est-elle terminee (archivee) ? */
export const isChantierArchived = (chantier) => !!chantier?.archivedAt;

/**
 * Observations encore ouvertes sur le DERNIER compte rendu de l'affaire.
 * Sert de garde-fou avant archivage : terminer un chantier qui traine 12 actions
 * non soldees doit se voir. Meme critere que le report automatique a la creation
 * d'un CR (useCrrManager.createMeeting) : tout ce qui n'est pas 'done'.
 */
export const countOpenObservations = (chantier) => {
  const meetings = chantier?.crrMeetings || [];
  if (meetings.length === 0) return 0;
  const last = meetings[meetings.length - 1];
  return (last.observations || []).filter((o) => o.status !== 'done').length;
};

/** "12 mars 2026" — date d'archivage lisible, chaine vide si absente/invalide. */
export const formatArchivedAt = (isoDate) => {
  if (!isoDate) return '';
  try {
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return ''; }
};

/** Partition { active, archived } d'une liste d'affaires. */
export const partitionChantiers = (chantiers = []) => {
  const active = [];
  const archived = [];
  for (const c of chantiers) (isChantierArchived(c) ? archived : active).push(c);
  // Les plus recemment terminees en tete
  archived.sort((a, b) => String(b.archivedAt).localeCompare(String(a.archivedAt)));
  return { active, archived };
};
