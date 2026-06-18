// docs/manuel/build-manual.mjs
// Génère le manuel d'utilisation complet (HTML) à partir de la source unique
// d'aide in-app : src/data/helpContent.js + src/views/ged/gedHelp.js.
// Style « Apple light » validé sur le pilote. Icônes Lucide rendues via react-dom/server.
// Usage : node docs/manuel/build-manual.mjs  → écrit manuel-complet.html

import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import * as Lucide from 'lucide-react';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { helpContent } from '../../src/data/helpContent.js';
import { gedHelp } from '../../src/views/ged/gedHelp.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Palette (identique à HelpSections.jsx / charte light) ──────────────────
const COLORS = {
  blue:    { bg:'#eff6ff', bd:'#bfdbfe', tx:'#2563eb', dot:'#3b82f6' },
  emerald: { bg:'#ecfdf5', bd:'#a7f3d0', tx:'#059669', dot:'#10b981' },
  amber:   { bg:'#fffbeb', bd:'#fde68a', tx:'#d97706', dot:'#f59e0b' },
  purple:  { bg:'#faf5ff', bd:'#e9d5ff', tx:'#9333ea', dot:'#a855f7' },
  rose:    { bg:'#fff1f2', bd:'#fecdd3', tx:'#e11d48', dot:'#f43f5e' },
  red:     { bg:'#fef2f2', bd:'#fecaca', tx:'#dc2626', dot:'#ef4444' },
  slate:   { bg:'#f8fafc', bd:'#e2e8f0', tx:'#475569', dot:'#64748b' },
  indigo:  { bg:'#eef2ff', bd:'#c7d2fe', tx:'#4f46e5', dot:'#6366f1' },
  teal:    { bg:'#f0fdfa', bd:'#99f6e4', tx:'#0d9488', dot:'#14b8a6' },
  violet:  { bg:'#f5f3ff', bd:'#ddd6fe', tx:'#7c3aed', dot:'#8b5cf6' },
};
const C = (n) => COLORS[n] || COLORS.blue;
const PALETTE = ['blue','emerald','amber','indigo','teal','violet','rose','slate'];

// ─── Parcours type (workflow de bout en bout) par module ────────────────────
const WORKFLOW_LIST = [
  {"key":"moduleHub","steps":["Sur l'écran d'accueil, repérez les cartes regroupées en 3 rangées « Bento » thématiques.","Cliquez sur la carte du module voulu ; une carte grisée à cadenas est verrouillée selon votre profil.","Démarrez par « Gestion de Projets » (Rangée 1) pour créer ou charger un projet avant les modules qui l'exigent.","Enchaînez sur « Estimation » puis « RAO & Analyse » pour le chiffrage et le dépouillement des offres.","Au besoin, ouvrez les outils de la Rangée 2 (Devis MOE, CRC, Documents Admin, Visites de site).","Revenez ici à tout moment via le bouton « ← Hub » présent en haut à gauche de chaque module.","Consultez le journal via « Nouveautés » en pied de page, ou « Vider le cache » si une version ancienne s'affiche."]},
  {"key":"projectManager","steps":["Ouvrez l'onglet « Cloud » à droite et cliquez un projet pour l'ouvrir, ou « Nouveau » en haut à droite.","Construisez votre devis, puis cliquez le bouton vert « CLOUD SAVE » pour tout sauvegarder sur Firebase.","Avant une grosse modification, faites un « EXPORT JSON » pour télécharger un filet de sécurité hors-ligne.","Classez vos affaires : créez des dossiers dans le panneau de gauche et glissez-y les projets.","Pour une variante, cliquez « Dupliquer » sur la carte projet puis refaites un Cloud Save du clone.","Sur un nouvel ordinateur, ouvrez l'onglet « Cloud » et cliquez votre projet — tout est restauré automatiquement.","Pour archiver un ancien projet, faites un Export JSON puis supprimez-le via l'icône corbeille."]},
  {"key":"estimation","steps":["En mode Étude, ajoutez un « Chapitre » (bouton à droite du ruban), puis ses sous-chapitres.","Cliquez une ligne pour la sélectionner (surbrillance verte) : c'est la cible des ajouts.","Ouvrez le volet « BPU » et cliquez un article ou un bloc pour l'insérer dans l'élément sélectionné.","Saisissez les quantités dans la colonne Qté, ou tapez une formule ƒ(x) référençant d'autres articles.","Si besoin, gérez les tranches (TF, TC1…) sous le ruban et saisissez les quantités tranche par tranche.","Sauvegardez avec « Sauver Cloud », et contrôlez la cohérence via « Audit bordereau » et « Vérif. n° prix ».","Basculez en mode Rendu pour appliquer le % client, puis exportez en « PDF DQE », « PDF Estimation » ou Excel."]},
  {"key":"bpu","steps":["Ouvrez l'aperçu BPU : la mise en page professionnelle du bordereau se génère automatiquement.","Naviguez entre les pages avec le zoom et les flèches ; les chapitres ne sont jamais coupés.","Vérifiez le tri par catégorie et par numéro, ajustez l'ordre dans les options si nécessaire.","Personnalisez l'aperçu via les « Overrides » : retouchez titres, numéros et désignations (sans impacter la base).","Contrôlez que les couleurs de chapitres et la page de titre reprennent bien votre charte graphique.","Exportez en « Export Word (.docx) » pour des ajustements manuels, ou en « Export PDF » pour la diffusion officielle.","Au besoin, utilisez « Export Excel » pour récupérer les données dans un tableur."]},
  {"key":"database","steps":["Travaillez sur votre base officielle en mode Cloud (synchronisée et visible par l'équipe).","Pour démarrer un catalogue collectivité, faites « Charger une base externe… » (JSON), ou « Importer Excel » (5 colonnes).","Créez vos catégories, puis cliquez « + Nouvel article » pour saisir désignation, description CCTP, unité et prix.","Sélectionnez un article pour l'éditer dans le panneau de droite, ou retrouvez-le via la barre de recherche.","Basculez sur l'onglet « Blocs » et cliquez « Nouveau bloc » pour regrouper des articles réutilisables (Formule ou Agrégat).","Pour un bloc Formule, choisissez l'unité pilote et renseignez la géométrie (épaisseur, densité, largeur, perte).","Sauvegardez l'ensemble via « Exporter JSON » pour archivage ou transfert."]},
  {"key":"formulaBar","steps":["Sélectionnez l'article à calculer dans le tableau (il se surligne en vert).","Cliquez l'icône ƒ(x) ou directement la barre de formule pour passer en mode édition.","Tapez = pour commencer l'expression (toute formule débute par ce signe).","Cliquez un autre article du tableau : sa désignation s'insère automatiquement entre crochets.","Ajoutez les opérateurs + - * / ( ) et d'autres références selon votre calcul.","Validez avec Entrée (ou Échap pour annuler sans sauvegarder).","Sur un projet multi-tranches, la formule saisie se propage automatiquement à toutes les tranches."]},
  {"key":"estimRapide","steps":["Sur l'écran d'accueil, cliquez « Nouvelle » et choisissez un modèle de départ (système ou personnel), puis « Créer ».","Renseignez l'en-tête : nom de l'estimation, client / maître d'ouvrage et lieu / commune.","Cliquez « Ajouter un grand lot » pour poser les lots VRD (terrassement, voirie, réseaux…).","Dans chaque lot, cliquez « Ajouter un poste » et saisissez désignation, unité, quantité et prix unitaire.","Pour une quantité calculée, tapez = puis cliquez un autre poste pour insérer sa référence (Entrée valide).","Réglez le pourcentage d'aléas dans la carte « Total » et lisez le Total HT puis TTC (TVA 20 % figée).","Une fois l'enveloppe validée, cliquez « Convertir en ESTIMA » pour créer le projet détaillé à côté."]},
  {"key":"ged","steps":["À la création de l'affaire (ou via « Gérer les phases »), définissez et ordonnez vos phases selon le marché.","Juste avant chaque envoi client, cliquez « Figer » en haut à droite et choisissez la phase concernée.","Renseignez l'objet, le destinataire, le statut (« Émis au client » ou « Brouillon interne ») et une note éventuelle.","Pour clore une étape, utilisez « Clôturer X → Y » : la version est figée puis l'affaire passe à la phase suivante.","Consultez une version figée via le bouton œil (lecture seule), ou filtrez la liste par phase quand elles s'accumulent.","Pour justifier un avenant, lancez l'audit comparatif (bouton graphique) et choisissez la version à comparer.","Ré-imprimez une version à l'identique : ouvrez-la, menu « Exporter », puis PDF DQE/Estimation ou Excel."]},
  {"key":"cctp","steps":["Naviguez dans l'arborescence (parties, chapitres, articles) du panneau de gauche.","Dépliez les sections et cochez les cases des clauses à inclure dans l'export.","Utilisez la barre de recherche pour trouver une clause par mot-clé, ou filtrez par type.","Cliquez une clause pour l'ouvrir dans l'éditeur enrichi et modifier son texte.","Mettez en forme avec la barre d'outils (gras, italique, listes, tableaux, titres).","Insérez des variables dynamiques (nom du projet, date…) remplacées automatiquement à l'export.","Marquez vos clauses récurrentes en favoris pour les réutiliser, puis générez le document final."]},
  {"key":"rc","steps":["Parcourez l'arborescence du RC (parties et articles) dans le panneau de gauche.","Cochez / décochez chaque élément à inclure dans l'export.","Repérez un article précis grâce à la barre de recherche par mot-clé.","Cliquez un article pour l'éditer avec l'éditeur enrichi (gras, italique, listes, tableaux).","Marquez vos articles récurrents d'une étoile pour les retrouver dans les favoris.","Choisissez les options d'export (sommaire, numérotation automatique).","Cliquez « Exporter PDF » : seuls les articles cochés sont inclus, avec page de garde et branding."]},
  {"key":"raoAnalysis","steps":["Sur la landing, cliquez « Nouveau RAO » et importez le fichier Excel d'estimation MOE (.xlsx).","Dans la modale de validation, vérifiez la hiérarchie chapitres → sous-chapitres → articles avant création.","Onglet Consultation : définissez le critère Prix (auto) et les critères techniques avec sous-critères (pondérations = 100).","Renseignez la modale « Dépouillement » (entreprises consultées, variantes, date d'ouverture) pour générer le PV.","Importez les offres de chaque entreprise (Excel ou PDF, OCR si scanné), variantes via le bouton dédié.","Saisissez l'analyse dans les onglets Admin (pièces, groupement, conformité) et Technique (notes, commentaires).","Onglet Récap : cliquez « Générer le PDF final » ; pensez à « Sauvegarder » régulièrement."]},
  {"key":"priceAnalysis","steps":["Pré-déclarez les entreprises et leur montant AE via le bouton « Dépouillement » de la toolbar du RAO.","Cliquez « Importer » pour charger chaque offre depuis Excel ou PDF (OCR automatique si scanné).","Ajoutez les variantes d'une entreprise via « + Variante », ou saisissez des prix directement dans le tableau.","Vérifiez la conformité signalée automatiquement (écart AE, quantités modifiées) et statuez dans l'onglet Admin.","Activez le mode « Heatmap » pour repérer les écarts, et le mode « OAB » pour détecter les offres anormalement basses.","Au besoin, cliquez « Pousser moyennes vers BPU » pour mettre à jour l'estimation MOE de référence.","Exportez le comparatif en PDF ou en Excel (toutes colonnes)."]},
  {"key":"rao","steps":["Créez le RAO via « Nouveau RAO » en important votre estimation MOE Excel (.xlsx).","Validez la structure chapitres → sous-chapitres → articles dans la modale post-import.","Onglet « Consultation » : définissez le critère Prix (pondération, formule f1-f9) et les critères techniques (total 100).","Bouton « Dépouillement » : déclarez les entreprises consultées, montants AE et régime des variantes.","Importez les offres de chaque entreprise (Excel ou PDF), variantes via le bouton dédié.","Onglet « Administratif » : cochez les pièces, gérez groupements et statuez la conformité de chaque offre.","Onglet « Technique » : notez chaque critère, rédigez les commentaires et justifiez les variantes.","Onglet « Récapitulatif » : cliquez « Générer le PDF final » et sauvegardez via le bouton du ruban."]},
  {"key":"devisMoe","steps":["Ouvrez « Devis MOE » et renseignez nom du projet, client et objet de la mission.","Saisissez le montant prévisionnel des travaux HT, base du calcul des honoraires.","Définissez le taux d'honoraires global (ex. 8 % du montant travaux).","Sélectionnez les phases de mission loi MOP (ESQ, APS, APD, PRO, ACT, DET…).","Répartissez le montant total entre les phases (les pourcentages totalisent 100 %).","Vérifiez la cohérence du devis dans l'onglet « Récapitulatif ».","Cliquez « Exporter » pour générer le devis PDF avec page de garde et votre branding."]},
  {"key":"expenseNotes","steps":["Déclarez votre véhicule via « Véhicules » : libellé et puissance fiscale, étoile pour le véhicule par défaut.","Mémorisez vos lieux fréquents via « Adresses », en marquant votre « Domicile » comme départ par défaut.","Dans la vue annuelle, cliquez un mois pour ouvrir le détail de ses trajets.","Bouton « Trajet » (ou touche N) : saisissez date, motif, départ et arrivée ; la distance se calcule seule.","Cochez « A/R » pour doubler le trajet, ou « Répéter ce trajet » pour générer une série récurrente.","Suivez le total km, le montant déductible et la tranche fiscale active recalculés en direct.","Cliquez « PDF » pour générer la note du mois, ou « Email » pour l'envoyer avec le PDF en pièce jointe."]},
  {"key":"crc","steps":["Créez ou sélectionnez un chantier via le menu déroulant « Chantier » du ruban.","Cliquez « Nouveau CR » pour créer une réunion vierge ; le numéro est attribué automatiquement.","Ouvrez le panneau « Participants » : ajoutez les contacts (ou import Excel) et réglez la présence (P/E/A).","Dans chaque catégorie, cliquez « + Ajouter » pour saisir l'émetteur, le texte et le responsable d'une observation.","Cliquez le statut pour le faire cycler (Ouvert → En cours → Fait) et joignez des photos via « Photo ».","Configurez le dossier d'export et le nom de fichier dans « Info Chantier ».","Basculez en mode « Aperçu » pour vérifier le rendu, puis exportez en PDF/Word ou envoyez par email."]},
  {"key":"docAdmin","steps":["Ouvrez « Documents Admin » et remplissez la fiche récapitulative (MOA, MOE, entreprise, montants, délais).","Définissez les lots du marché avec leurs montants respectifs.","Ajoutez les intervenants du marché : MOA, MOE, SPS, bureau de contrôle, etc.","Cliquez « Nouvel OS » pour rédiger un ordre de service (objet, destinataire, date d'effet, type).","Générez les documents EXE de suivi (EXE 4 Planning, EXE 5 Décomptes, EXE 10 Réception…).","Sélectionnez le type de document puis cliquez « Générer » : le PDF se télécharge avec votre branding.","Utilisez « Export lot » pour exporter tous les documents d'un lot en une seule opération."]},
  {"key":"siteVisits","steps":["Ouvrez « Visites de site » : les visites effectuées depuis le mobile sont classées par date.","Cliquez sur une visite pour ouvrir son détail.","Consultez les observations terrain : texte, photos et position GPS de chacune.","Repérez le statut de chaque observation (À traiter, En cours, Résolu).","Vérifiez la position GPS et les conditions météo enregistrées pour la visite.","Ouvrez l'onglet « Carte GPS » et cliquez un marqueur pour localiser une observation.","Visualisez le tracé GPS du parcours si le suivi était actif pendant la visite."]},
  {"key":"branding","steps":["Ouvrez « Branding » et importez votre logo au format PNG ou JPG (onglet « Identité »).","Renseignez vos coordonnées : nom de société, adresse, téléphone, email, site web.","Ajoutez un texte de signature affiché en bas de vos documents.","Onglet « Couleurs » : définissez les couleurs principale, secondaire et de fond (sélecteur ou code hexadécimal).","Onglet « Typographie » : choisissez la police des titres et celle du corps de texte.","Vérifiez l'application automatique sur les pages de garde, en-têtes PDF et aperçu BPU.","Rafraîchissez les exports en cours (Ctrl+Shift+R) pour voir les changements."]},
  {"key":"settings","steps":["Ouvrez « Paramètres » sur l'onglet « Compte ».","Modifiez votre nom d'affichage et votre email de contact dans la section « Profil ».","Cliquez « Modifier le mot de passe » et saisissez l'ancien mot de passe pour confirmer.","Ouvrez l'onglet « Format Excel » pour vérifier le format d'import du fichier BPU.","Respectez l'ordre des colonnes : A Numéro, B Désignation, C Description, D Unité, E Prix unitaire.","Activez le « Mode Manuel » pour que la colonne A serve de numéro d'affichage.","Cliquez « Se déconnecter » pour quitter la session ; vos données sont sauvegardées automatiquement."]},
  {"key":"smtp","steps":["Ouvrez la configuration Email et choisissez votre fournisseur dans le menu déroulant (Gmail, Outlook, OVH…).","Laissez le preset auto-remplir le serveur, le port et le chiffrement.","Saisissez votre identifiant (votre email dans la plupart des cas).","Saisissez votre mot de passe, le cas échéant un mot de passe d'application (voir onglet « Fournisseurs »).","Renseignez l'adresse expéditeur (From), généralement identique à l'identifiant.","Cliquez « Tester la connexion » pour valider sans envoyer de mail.","Cliquez « Enregistrer » une fois le test OK, puis utilisez « Envoyer (web) » depuis le CRC."]},
  {"key":"admin","steps":["Créez le compte du client dans Firebase Console → Authentication → « Ajouter un utilisateur » (email + mot de passe temporaire).","Dans Authentication, copiez la valeur de la colonne « User UID » de cet utilisateur.","Tapez le nom de l'entreprise dans le champ en haut de la page puis cliquez « Créer ».","Collez l'UID copié, choisissez l'entreprise et cliquez « Assigner ».","Transmettez au client l'URL de l'application, son email et le mot de passe temporaire.","Au besoin, supprimez une entreprise via l'icône corbeille rouge en confirmant son nom."]},
  {"key":"rgpd","steps":["Ouvrez l'écran « Mon Compte & Données », qui regroupe la configuration Email et vos droits RGPD.","Pour la portabilité (art. 20), allez dans l'onglet « Exporter mes données ».","Cliquez « Exporter mes données » : un fichier estimavrd-donnees-AAAA-MM-JJ.json est téléchargé.","Conservez ce fichier JSON structuré ou ré-importez-le ailleurs.","Pour l'effacement (art. 17), ouvrez l'onglet « Supprimer mon compte ».","Cliquez « Supprimer mon compte » et validez les deux confirmations successives.","Ré-authentifiez-vous avec votre mot de passe ; vous êtes déconnecté une fois le compte supprimé."]},
];
const WORKFLOWS = Object.fromEntries(WORKFLOW_LIST.map((o) => [o.key, o.steps]));

function buildWorkflow(key) {
  const steps = WORKFLOWS[key];
  if (!steps || !steps.length) return '';
  return `<div class="workflow">
    <div class="wf-head"><span class="wf-ic">${icon('Route')}</span> Parcours type</div>
    <ol class="wf-steps">${steps.map((s) => `<li><span>${esc(s)}</span></li>`).join('')}</ol>
  </div>`;
}

// ─── Icônes Lucide → SVG (cache) ────────────────────────────────────────────
const iconCache = {};
function icon(name) {
  const key = name || 'HelpCircle';
  if (iconCache[key]) return iconCache[key];
  const Ic = Lucide[key] || Lucide.HelpCircle;
  const svg = renderToStaticMarkup(createElement(Ic, { width: 24, height: 24, strokeWidth: 1.8 }));
  iconCache[key] = svg;
  return svg;
}

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ─── Rendu des sections (mêmes types que HelpSections.jsx) ──────────────────
function rSteps(items = []) {
  return `<div class="steps">${items.map((it) => `
    <div class="step" style="--dot:${C(it.color).dot}">
      <div class="num">•</div>
      <div><div class="st-t">${esc(it.title)}</div><div class="st-d">${esc(it.description)}</div></div>
    </div>`).join('')}</div>`;
}

function rCard(s) {
  const c = C(s.color);
  const sub = (s.steps || []).map((st) =>
    `<div class="substep"><span class="ar">${icon('ArrowRight')}</span><span>${esc(st)}</span></div>`).join('');
  const tip = s.tip ? `<div class="inner tip"><span>${icon('Lightbulb')}</span><div><b>Astuce :</b> ${esc(s.tip)}</div></div>` : '';
  const warn = s.warning ? `<div class="inner warn"><span>${icon('AlertTriangle')}</span><div>${esc(s.warning)}</div></div>` : '';
  const link = s.link ? `<div class="cardlink" style="--tx:${c.tx}"><span>${icon('ExternalLink')}</span>${esc(s.link)}</div>` : '';
  const badge = s.badge ? `<span class="cbadge" style="--bg:${c.bg};--tx:${c.tx}">${esc(s.badge)}</span>` : '';
  const desc = s.description ? `<div class="c-desc">${esc(s.description)}</div>` : '';
  return `<div class="card" style="--bg:${c.bg};--bd:${c.bd};--tx:${c.tx}">
    <div class="c-head">
      <div class="c-chip">${icon(s.icon)}</div>
      <div><div class="c-title">${esc(s.title)}${badge}</div>${desc}</div>
    </div>${sub ? `<div class="substeps">${sub}</div>` : ''}${link}${tip}${warn}</div>`;
}

function rTable(s) {
  const head = (s.headers && s.headers.length)
    ? `<div class="t-head" style="grid-template-columns:repeat(${s.headers.length},1fr)">${s.headers.map((h) => `<div>${esc(h)}</div>`).join('')}</div>`
    : '';
  const rows = (s.rows || []).map((r) => `
    <div class="t-row">
      <span class="t-check">${icon('CheckCircle2')}</span>
      <div class="t-body"><div class="t-l">${esc(r.label)}</div>${r.desc ? `<div class="t-d">${esc(r.desc)}</div>` : ''}</div>
      ${r.extra ? `<span class="t-x">${esc(r.extra)}</span>` : ''}
    </div>`).join('');
  return `<div class="table">${s.title ? `<div class="t-title">${esc(s.title)}</div>` : ''}${head}<div class="t-rows">${rows}</div></div>`;
}

function rGrid(s) {
  return `<div class="grid2">${(s.items || []).map((it) => {
    const c = C(it.color || 'slate');
    return `<div class="gi" style="--bg:${c.bg};--bd:${c.bd}"><div class="gi-t">${esc(it.title)}</div><div class="gi-d">${esc(it.text)}</div></div>`;
  }).join('')}</div>`;
}

function rShortcuts(s) {
  return `<div class="shortcuts">${(s.items || []).map((it) =>
    `<div class="sc-row"><kbd>${esc(it.key)}</kbd><span>${esc(it.desc)}</span></div>`).join('')}</div>`;
}

function rPrompt(s) {
  const c = C(s.color || 'indigo');
  return `<div class="prompt" style="--bg:${c.bg};--bd:${c.bd};--tx:${c.tx}">
    <div class="p-head"><span>${icon('MessageSquare')}</span> ${esc(s.title || 'Prompt IA')}</div>
    ${s.intro ? `<div class="p-intro">${esc(s.intro)}</div>` : ''}
    <pre class="p-text">${esc(s.text)}</pre></div>`;
}

function rIntro(s) { return `<p class="lead">${esc(s.text)}</p>`; }
function rTip(s) {
  return `<div class="callout tip"><span>${icon('Lightbulb')}</span><div>${s.title ? `<b>${esc(s.title)} — </b>` : '<b>Astuce : </b>'}${esc(s.text)}</div></div>`;
}
function rWarn(s) {
  return `<div class="callout warn"><span>${icon('AlertTriangle')}</span><div>${esc(s.text)}</div></div>`;
}

function renderSection(s) {
  switch (s.type) {
    case 'intro':     return rIntro(s);
    case 'steps':     return rSteps(s.items);
    case 'card':      return rCard(s);
    case 'table':     return rTable(s);
    case 'grid':      return rGrid(s);
    case 'shortcuts': return rShortcuts(s);
    case 'prompt':    return rPrompt(s);
    case 'tip':       return rTip(s);
    case 'warning':   return rWarn(s);
    default:          return '';
  }
}

// ─── Plan du manuel (ordre + regroupement, calé sur le hub) ─────────────────
const PLAN = [
  { part: 'Prise en main', items: [
    { key: 'moduleHub', name: 'Le hub & la navigation' },
  ] },
  { part: 'Projet & Estimation', items: [
    { key: 'projectManager', name: 'Gestion de Projets' },
    { key: 'estimation', name: 'Estimation — devis VRD' },
    { key: 'bpu', name: 'Aperçu BPU' },
    { key: 'database', name: 'Catalogue BPU & Blocs' },
    { key: 'formulaBar', name: 'Aide aux formules' },
    { key: 'estimRapide', name: 'Estimation Rapide' },
    { key: 'ged', name: 'Documents émis (versions figées)', source: gedHelp },
    { key: 'cctp', name: 'Générateur CCTP' },
    { key: 'rc', name: 'Générateur RC' },
  ] },
  { part: 'Analyse des offres', items: [
    { key: 'raoAnalysis', name: 'RAO & Analyse des prix' },
    { key: 'priceAnalysis', name: 'Analyse financière des offres' },
    { key: 'rao', name: 'Rapport RAO' },
  ] },
  { part: 'Outils & Terrain', items: [
    { key: 'devisMoe', name: 'Devis MOE' },
    { key: 'expenseNotes', name: 'Notes de Frais' },
    { key: 'crc', name: 'Compte Rendu de Chantier' },
    { key: 'docAdmin', name: 'Documents Administratifs' },
    { key: 'siteVisits', name: 'Visites de Site' },
  ] },
  { part: 'Paramètres & Compte', items: [
    { key: 'branding', name: 'Identité & Charte graphique' },
    { key: 'settings', name: 'Paramètres' },
    { key: 'smtp', name: 'Configuration Email (SMTP)' },
    { key: 'admin', name: 'Administration' },
    { key: 'rgpd', name: 'Mon Compte & Données (RGPD)' },
  ] },
];

// Numérotation séquentielle des chapitres
let n = 0;
const CHAPTERS = [];
for (const grp of PLAN) {
  for (const it of grp.items) {
    const entry = it.source || helpContent[it.key];
    if (!entry) { console.warn('⚠ entrée absente:', it.key); continue; }
    CHAPTERS.push({ ...it, entry, part: grp.part, num: ++n });
  }
}

// ─── Sommaire ───────────────────────────────────────────────────────────────
function buildToc() {
  let html = '<section class="toc"><h2>Sommaire</h2><div class="note">Manuel généré à partir de l\'aide intégrée de l\'application. Chaque module correspond à son guide in-app (panneau « Aide »).</div>';
  for (const grp of PLAN) {
    html += `<div class="part">${esc(grp.part)}</div><ul>`;
    for (const it of grp.items) {
      const ch = CHAPTERS.find((c) => c.key === it.key);
      if (!ch) continue;
      html += `<li><a class="tlink" href="#ch-${ch.num}"><span class="tn">${ch.num}</span><span class="tl">${esc(it.name)}</span></a></li>`;
    }
    html += '</ul>';
  }
  return html + '</section>';
}

// ─── Chapitre ────────────────────────────────────────────────────────────────
function buildChapter(ch) {
  const e = ch.entry;
  const tabs = e.tabs || [];
  let html = `<section class="chapter" id="ch-${ch.num}"><div class="chap-head"><div class="kick">Module ${String(ch.num).padStart(2, '0')} · ${esc(ch.part)}</div><h1>${esc(ch.name)}</h1>${e.subtitle ? `<div class="sub">${esc(e.subtitle)}</div>` : ''}</div>${buildWorkflow(ch.key)}`;
  tabs.forEach((tab, ti) => {
    const col = C(PALETTE[ti % PALETTE.length]);
    html += `<div class="section">
      <h2><span class="schip" style="--bg:${col.bg};--tx:${col.tx}">${icon(tab.icon)}</span><span class="sn">${ch.num}.${ti + 1}</span> ${esc(tab.label)}</h2>
      <div class="sbody">${(tab.sections || []).map(renderSection).join('')}</div>
    </div>`;
  });
  return html + '</section>';
}

// ─── CSS (charte light, validée sur le pilote) ──────────────────────────────
const CSS = `
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
  @page { size: A4; margin: 16mm 15mm 15mm 15mm; }
  html, body { margin: 0; padding: 0; }
  body { font-family: -apple-system, "Segoe UI", system-ui, Roboto, Helvetica, Arial, sans-serif; color: #374151; font-size: 10.5pt; line-height: 1.5; -webkit-font-smoothing: antialiased; }
  svg { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; display: block; }
  p { margin: 0 0 8px; }
  .pagefoot { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 7.5pt; color: #9ca3af; letter-spacing: .3px; }
  .pagefoot b { color: #6b7280; font-weight: 600; }

  /* Cover */
  .cover { break-after: page; padding-top: 30mm; }
  .cover .kicker { display: inline-block; font-size: 8.5pt; font-weight: 700; letter-spacing: 2px; color: #4f46e5; background: #eef2ff; border: 1px solid #c7d2fe; padding: 5px 14px; border-radius: 999px; text-transform: uppercase; }
  .cover h1 { font-size: 46pt; font-weight: 800; color: #111827; margin: 22px 0 0; letter-spacing: -1.5px; line-height: 1.02; }
  .cover h1 .vrd { color: #4f46e5; }
  .cover .sub { font-size: 16pt; color: #6b7280; font-weight: 500; margin-top: 10px; }
  .cover .bar { height: 6px; width: 120px; border-radius: 999px; margin: 26px 0; background: linear-gradient(90deg, #2563eb, #4f46e5, #7c3aed); }
  .cover .meta { font-size: 10.5pt; color: #6b7280; line-height: 1.9; }
  .cover .meta b { color: #374151; }

  /* TOC */
  .toc { break-after: page; }
  .toc h2 { font-size: 22pt; color: #111827; font-weight: 800; margin: 4px 0 2px; letter-spacing: -.5px; }
  .toc .note { color: #6b7280; font-size: 9.5pt; margin-bottom: 16px; }
  .toc .part { font-size: 8.5pt; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #9ca3af; margin: 16px 0 7px; }
  .toc ul { list-style: none; margin: 0; padding: 0; }
  .toc li { display: flex; align-items: center; gap: 10px; padding: 5px 0; border-bottom: 1px solid #f1f5f9; }
  .toc .tlink { display: flex; align-items: center; gap: 10px; text-decoration: none; color: inherit; width: 100%; }
  .toc .tn { width: 24px; height: 24px; flex: 0 0 24px; border-radius: 7px; background: #eef2ff; color: #4f46e5; font-weight: 700; font-size: 9pt; display: flex; align-items: center; justify-content: center; }
  .toc .tl { color: #374151; font-size: 10.5pt; font-weight: 500; }

  /* Chapter */
  .chapter { break-before: page; }
  .chap-head { border-bottom: 2px solid #eef2ff; padding-bottom: 14px; margin-bottom: 4px; }
  .chap-head .kick { font-size: 8pt; font-weight: 700; letter-spacing: 1.5px; color: #4f46e5; text-transform: uppercase; }
  .chap-head h1 { font-size: 27pt; font-weight: 800; color: #111827; margin: 6px 0 3px; letter-spacing: -1px; }
  .chap-head .sub { font-size: 11.5pt; color: #6b7280; font-weight: 500; }

  /* Parcours type (workflow) */
  .workflow { background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 14px; padding: 13px 16px 14px; margin: 15px 0 6px; break-inside: avoid; }
  .wf-head { display: flex; align-items: center; gap: 8px; font-size: 9pt; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #4f46e5; }
  .wf-ic { color: #4f46e5; display: flex; }
  .wf-ic svg { width: 15px; height: 15px; }
  .wf-steps { counter-reset: wf; list-style: none; margin: 9px 0 0; padding: 0; }
  .wf-steps li { counter-increment: wf; display: flex; gap: 10px; align-items: flex-start; margin-bottom: 6px; font-size: 9.9pt; color: #3730a3; break-inside: avoid; }
  .wf-steps li::before { content: counter(wf); flex: 0 0 19px; width: 19px; height: 19px; border-radius: 50%; background: #6366f1; color: #fff; font-weight: 700; font-size: 8.5pt; display: flex; align-items: center; justify-content: center; margin-top: 1px; }

  /* Section */
  .section { margin-top: 20px; }
  .section > h2 { display: flex; align-items: center; gap: 11px; font-size: 14pt; color: #111827; font-weight: 700; margin: 0 0 3px; letter-spacing: -.3px; break-after: avoid; }
  .schip { width: 31px; height: 31px; flex: 0 0 31px; border-radius: 9px; background: var(--bg); color: var(--tx); display: flex; align-items: center; justify-content: center; }
  .schip svg { width: 17px; height: 17px; }
  .section > h2 .sn { color: #9ca3af; font-weight: 700; font-size: 11pt; }
  .sbody { margin-left: 42px; }
  .lead { color: #475569; font-size: 10.2pt; margin: 2px 0 11px; }

  /* Steps */
  .steps { margin: 0 0 4px; }
  .step { display: flex; gap: 11px; break-inside: avoid; margin-bottom: 10px; }
  .step .num { width: 9px; height: 9px; flex: 0 0 9px; margin-top: 5px; border-radius: 50%; background: var(--dot); color: transparent; font-size: 0; }
  .step .st-t { font-weight: 700; color: #1f2937; font-size: 10.4pt; }
  .step .st-d { color: #6b7280; font-size: 9.8pt; }

  /* Card */
  .card { border: 1px solid var(--bd); border-radius: 14px; background: #fff; break-inside: avoid; margin: 10px 0; overflow: hidden; }
  .c-head { display: flex; gap: 12px; align-items: flex-start; padding: 13px 15px 9px; }
  .c-chip { width: 37px; height: 37px; flex: 0 0 37px; border-radius: 10px; background: var(--bg); color: var(--tx); display: flex; align-items: center; justify-content: center; }
  .c-chip svg { width: 19px; height: 19px; }
  .c-title { font-weight: 700; color: #1f2937; font-size: 10.8pt; }
  .cbadge { display: inline-block; margin-left: 8px; font-size: 7.5pt; font-weight: 700; padding: 2px 9px; border-radius: 999px; background: var(--bg); color: var(--tx); vertical-align: 2px; }
  .c-desc { color: #6b7280; font-size: 9.7pt; margin-top: 3px; }
  .substeps { margin: 0 15px 12px 64px; }
  .substep { display: flex; gap: 8px; align-items: flex-start; font-size: 9.5pt; color: #4b5563; margin-bottom: 4px; }
  .substep .ar { color: #9ca3af; flex: 0 0 13px; }
  .substep .ar svg { width: 13px; height: 13px; margin-top: 2px; }
  .cardlink { margin: 0 15px 12px 64px; font-size: 9pt; color: var(--tx); font-weight: 600; display: flex; gap: 6px; align-items: center; word-break: break-all; }
  .cardlink svg { width: 12px; height: 12px; }
  .inner { margin: 0 15px 12px 64px; border-radius: 10px; padding: 9px 12px; font-size: 9.3pt; display: flex; gap: 8px; align-items: flex-start; }
  .inner svg { width: 14px; height: 14px; flex: 0 0 14px; margin-top: 1px; }
  .inner.tip, .inner.warn { background: #fffbeb; border: 1px solid #fde68a; color: #b45309; }

  /* Callouts */
  .callout { border-radius: 12px; padding: 11px 14px; font-size: 9.8pt; break-inside: avoid; margin: 10px 0; display: flex; gap: 10px; align-items: flex-start; }
  .callout svg { width: 16px; height: 16px; flex: 0 0 16px; margin-top: 1px; }
  .callout.tip { background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; }
  .callout.warn { background: #fffbeb; border: 1px solid #fde68a; color: #b45309; }
  .callout b { font-weight: 700; }

  /* Table */
  .table { border: 1px solid #e5e7eb; border-radius: 13px; overflow: hidden; margin: 10px 0; break-inside: avoid; }
  .t-title { padding: 9px 14px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; font-size: 9.5pt; font-weight: 700; color: #374151; }
  .t-head { display: grid; background: #f9fafb; border-bottom: 1px solid #e5e7eb; }
  .t-head div { padding: 7px 12px; font-size: 8pt; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .5px; }
  .t-row { display: flex; align-items: center; gap: 11px; padding: 9px 14px; border-bottom: 1px solid #f3f4f6; }
  .t-row:last-child { border-bottom: 0; }
  .t-check { color: #10b981; flex: 0 0 15px; }
  .t-check svg { width: 15px; height: 15px; }
  .t-l { font-size: 9.6pt; font-weight: 600; color: #374151; }
  .t-d { font-size: 9.2pt; color: #9ca3af; margin-top: 1px; }
  .t-x { font-size: 8.5pt; color: #9ca3af; }

  /* Grid */
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; margin: 10px 0; break-inside: avoid; }
  .gi { border: 1px solid var(--bd); background: var(--bg); border-radius: 12px; padding: 12px 14px; }
  .gi-t { font-weight: 700; color: #1f2937; font-size: 10pt; margin-bottom: 2px; }
  .gi-d { color: #6b7280; font-size: 9.3pt; }

  /* Shortcuts */
  .shortcuts { border: 1px solid #e5e7eb; border-radius: 13px; overflow: hidden; margin: 10px 0; }
  .sc-row { display: flex; align-items: center; gap: 14px; padding: 8px 14px; border-bottom: 1px solid #f3f4f6; }
  .sc-row:last-child { border-bottom: 0; }
  kbd { flex: 0 0 auto; padding: 3px 9px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 6px; font-family: ui-monospace, monospace; font-size: 9pt; color: #374151; }
  .sc-row span { font-size: 9.6pt; color: #4b5563; }

  /* Prompt */
  .prompt { border: 1px solid var(--bd); border-radius: 13px; overflow: hidden; margin: 10px 0; break-inside: avoid; }
  .p-head { display: flex; align-items: center; gap: 7px; padding: 9px 14px; background: var(--bg); color: var(--tx); font-weight: 700; font-size: 9.3pt; border-bottom: 1px solid var(--bd); }
  .p-head svg { width: 13px; height: 13px; }
  .p-intro { padding: 9px 14px 0; font-size: 9.3pt; color: #6b7280; }
  .p-text { margin: 0; padding: 11px 14px; font-family: ui-monospace, monospace; font-size: 8.8pt; color: #374151; white-space: pre-wrap; }
`;

// ─── Assemblage ───────────────────────────────────────────────────────────────
const cover = `<section class="cover">
  <span class="kicker">Guide utilisateur</span>
  <h1>Estima<span class="vrd">VRD</span></h1>
  <div class="sub">Manuel d'utilisation — module par module</div>
  <div class="bar"></div>
  <div class="meta">
    <b>Version</b> 3.3.1 &nbsp;·&nbsp; Juin 2026<br>
    <b>Périmètre</b> Suite EstimaVRD — ${CHAPTERS.length} modules<br>
    <b>Public</b> Maîtres d'œuvre VRD, conducteurs de travaux, gestionnaires de projets
  </div>
</section>`;

const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>EstimaVRD — Manuel d'utilisation</title><style>${CSS}</style></head><body>
${cover}
${buildToc()}
${CHAPTERS.map(buildChapter).join('\n')}
</body></html>`;

const out = join(__dirname, 'manuel-complet.html');
writeFileSync(out, html, 'utf8');
console.log(`✓ ${CHAPTERS.length} chapitres générés → ${out}`);
console.log('Chapitres:', CHAPTERS.map((c) => `${c.num}.${c.name}`).join(' | '));
