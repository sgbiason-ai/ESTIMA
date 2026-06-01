// src/utils/expenseMailer.js
//
// Sujet, corps par defaut (texte editable) et conversion texte -> HTML pour
// l'envoi d'une note de frais kilometrique. Le PDF est joint cote serveur
// (Cloud Function sendCrcEmail).

const htmlEsc = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const formatEur = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0);

const formatKm = (n) => `${(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;

/**
 * Sujet du mail.
 * @param {string} monthLabel ex: "Mai 2026"
 * @param {string} [userName]
 */
export const buildExpenseMailSubject = (monthLabel, userName) => {
  const who = userName ? ` — ${userName}` : '';
  return `Note de frais kilometriques — ${monthLabel}${who}`;
};

/**
 * Message par defaut (texte brut), pre-rempli dans la modale et entierement
 * editable par l'utilisateur. Inclut le recapitulatif sous forme de texte.
 * @param {object} p
 * @param {string} p.monthLabel
 * @param {string} [p.userName]
 * @param {number} p.totalKm
 * @param {number} p.totalAmount
 * @param {number} p.tripCount
 * @param {string} [p.vehicleLabel]
 * @param {string} [p.trancheLabel]
 * @returns {string}
 */
export const buildExpenseDefaultMessage = ({
  monthLabel, userName, totalKm, totalAmount, tripCount, vehicleLabel, trancheLabel,
}) => {
  const lines = [
    'Bonjour,',
    '',
    `Veuillez trouver ci-joint ma note de frais kilometriques pour ${monthLabel} (PDF en piece jointe).`,
    '',
    'Recapitulatif :',
    `- Periode : ${monthLabel}`,
    userName ? `- Beneficiaire : ${userName}` : null,
    vehicleLabel ? `- Vehicule : ${vehicleLabel}` : null,
    `- Trajets : ${tripCount}`,
    `- Total kilometres : ${formatKm(totalKm)}`,
    trancheLabel ? `- Bareme applique : ${trancheLabel}` : null,
    `- Montant deductible : ${formatEur(totalAmount)}`,
    '',
    'Cordialement,',
    userName || '',
  ].filter((l) => l !== null);

  return lines.join('\n');
};

/**
 * Convertit le message texte (edite par l'utilisateur) en HTML pour l'envoi :
 * paragraphes separes par lignes vides, sauts de ligne simples -> <br>.
 * @param {string} text
 * @returns {string}
 */
export const messageToHtml = (text) => {
  const paragraphs = String(text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 12px;">${htmlEsc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#374151;line-height:1.5;font-size:14px;">${paragraphs}</div>`;
};
