// src/components/rao/tabs/nego/negoTemplates.js
//
// Constantes et trames par défaut du courrier de négociation RAO.
// Isolé du composant pour rester lisible et réutilisable (tests, PDF).

// ── Trame globale par défaut (variables {{...}} injectées par applyTemplate) ──
export const DEFAULT_TEMPLATE = `
<div style="font-family: 'Aptos Light', 'Segoe UI', Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #000;">
<p style="text-align:right; margin:0 0 14px 0;">{{VILLE}}, le {{DATE_EMISSION}}</p>
<div style="display:flex; gap:8px; margin-bottom:6px;">
<div style="flex:55; border:1px solid #000;">
<div style="border-bottom:1px solid #000; text-align:center; padding:4px 6px; font-size:10pt;">DESTINATAIRE :</div>
<div style="padding:8px 6px; font-size:10pt; min-height:60px;"><strong>{{NOM_ENTREPRISE}}</strong><br/>{{ADRESSE_ENTREPRISE}}</div>
</div>
<div style="flex:45; border:1px solid #000;">
<div style="border-bottom:1px solid #000; text-align:center; padding:4px 6px; font-size:10pt;">EXPÉDITEUR :</div>
<div style="padding:8px 6px; font-size:10pt; min-height:60px;"><strong>{{CLIENT}}</strong><br/>{{ADRESSE_EXPEDITEUR}}</div>
</div>
</div>
<p style="margin:6px 0 2px 0;"><strong>OBJET :</strong>  <strong>{{OBJET_MARCHE}}</strong></p>
<p style="margin:0 0 6px 0;"><strong>Négociation avec les candidats</strong></p>
<div style="border:1px solid #000; padding:10px 12px;">
<p style="margin:0 0 10px 0;">Monsieur,</p>
<p style="margin:0 0 10px 0; text-align:justify;">Dans le cadre de la consultation relative au marché de travaux {{OBJET_MARCHE}} à {{LIEU}}, votre entreprise a présenté une offre, laquelle a fait l’objet d’une analyse conformément aux critères et modalités définis au règlement de consultation.</p>
<p style="margin:0 0 10px 0; text-align:justify;">Afin de permettre au pouvoir adjudicateur de vérifier la cohérence économique de votre offre au regard des prestations prévues au marché, et sans préjuger de la conformité ni du caractère de votre proposition, nous vous remercions de bien vouloir nous confirmer les prix des prestations suivantes :</p>
{{QUESTIONS}}
<p style="margin:12px 0 10px 0; text-align:justify;">Par ailleurs, conformément aux règles applicables aux marchés passés selon une <strong>procédure adaptée</strong>, le pouvoir adjudicateur a décidé d’engager une <strong>phase de négociation portant sur les aspects financiers</strong> de votre offre.</p>
<p style="margin:0 0 10px 0; text-align:justify;">Dans ce cadre, nous vous invitons à bien vouloir <strong>réexaminer le montant de votre proposition financière</strong> et à nous faire parvenir, le cas échéant, une <strong>offre financière révisée</strong>, intégrant une <strong>remise sur le prix initialement proposé</strong>, tout en maintenant le niveau de prestations et les dispositions techniques décrites dans votre mémoire technique.</p>
<p style="margin:0 0 10px 0; text-align:justify;">Cette phase de négociation a pour objet de permettre l’optimisation de l’économie générale du marché, sans modification des caractéristiques essentielles du lot ni des exigences du dossier de consultation.</p>
<p style="margin:0 0 10px 0; text-align:justify;">Les éléments demandés devront être transmis <strong>sur la plateforme</strong> au plus tard le <strong><span style="background:#FF0;padding:1px 4px;">{{DATE_LIMITE}}</span></strong>, et seront intégrés à l’analyse des offres avant toute décision d’attribution.</p>
<p style="margin:0 0 10px 0; text-align:justify;">Nous vous prions d’agréer, Monsieur, l’expression de nos salutations distinguées.</p>
<p style="margin:20px 0 16px 0; padding-left:55%;">{{SIGNATAIRE}}</p>
</div>
<p style="margin:8px 0 0 0; font-size:9pt;">NOMBRE DE PAGES (y compris celle-ci) : 1</p>
</div>
`;

// ── Variables disponibles dans l'éditeur de trame ──
export const AVAILABLE_VARIABLES = [
  { label: 'Nom Entreprise', tag: '{{NOM_ENTREPRISE}}' },
  { label: 'Adresse Entreprise', tag: '{{ADRESSE_ENTREPRISE}}' },
  { label: 'Objet du projet', tag: '{{OBJET_MARCHE}}' },
  { label: 'Code Affaire', tag: '{{CODE_AFFAIRE}}' },
  { label: 'Client / MOA', tag: '{{CLIENT}}' },
  { label: 'Adresse Expéditeur', tag: '{{ADRESSE_EXPEDITEUR}}' },
  { label: 'Maître d\'Œuvre', tag: '{{MOE}}' },
  { label: 'Lieu d\'exécution', tag: '{{LIEU}}' },
  { label: 'Phase', tag: '{{PHASE}}' },
  { label: 'Lot concerné', tag: '{{LOT}}' },
  { label: 'Questions (Auto)', tag: '{{QUESTIONS}}' },
  { label: 'Date d\'émission', tag: '{{DATE_EMISSION}}' },
  { label: 'Date Limite', tag: '{{DATE_LIMITE}}' },
  { label: 'Ville (Entête)', tag: '{{VILLE}}' },
  { label: 'Signataire', tag: '{{SIGNATAIRE}}' },
];

// ── Textes par défaut "Prix atypiques" (format HTML Quill) ──
export const DEFAULT_LOW_TEMPLATE =
  "<p><strong>➡️ PRIX ANORMALEMENT BAS (art. L.2152-6 et R.2152-3 du Code de la commande publique)</strong></p>" +
  "<p>L'analyse de votre proposition révèle que les prix listés ci-dessous se situent très en deçà de l'estimation du maître d'œuvre. Ce niveau de prix interroge sur la bonne appréhension des contraintes techniques du chantier et des exigences quantitatives du cahier des charges.</p>" +
  "<p>Dans le cadre de la présente négociation, et afin de nous assurer de la faisabilité technique de votre proposition, nous vous demandons de :</p>" +
  "<ul>" +
    "<li>Vérifier qu'il ne s'agit pas d'une erreur matérielle ou d'une omission dans votre chiffrage ;</li>" +
    "<li>Le cas échéant, réviser ces prix à la hausse pour garantir la bonne exécution des prestations dans les règles de l'art.</li>" +
  "</ul>" +
  "<p>Si vous confirmez ces montants en l'état, nous vous demandons de nous fournir les sous-détails de prix correspondants ainsi que le mode opératoire envisagé, afin de nous démontrer que ces tarifs permettent techniquement la réalisation complète des travaux exigés.</p>";

export const DEFAULT_HIGH_TEMPLATE =
  "<p><strong>➡️ PRIX PARAISSANT EXCESSIFS (art. R.2152-3 du Code de la commande publique)</strong></p>" +
  "<p>L'analyse comparative de votre proposition indique que les prix listés ci-dessous se situent au-dessus de notre estimation prévisionnelle. Cet écart pèse sur le classement global de votre offre.</p>" +
  "<p>Dans l'optique d'optimiser votre proposition et d'améliorer sa compétitivité dans le cadre de cette négociation, nous vous invitons à :</p>" +
  "<ul>" +
    "<li>Vérifier qu'il ne s'agit pas d'une erreur d'interprétation du cahier des charges ou d'une erreur d'unité lors de votre chiffrage ;</li>" +
    "<li>Étudier la possibilité d'un effort commercial sur ces postes spécifiques pour vous rapprocher des standards du marché.</li>" +
  "</ul>" +
  "<p>Dans l'hypothèse où vous souhaiteriez maintenir ces tarifs initiaux, nous vous serions reconnaissants de nous transmettre les éléments de décomposition (sous-détails de prix) nous permettant de mieux comprendre l'approche technique et les contraintes qui justifient cette valorisation.</p>";

// ── Texte par défaut "Prix atypiques — BLOC UNIFIÉ" (format HTML Quill) ──
// Un seul bloc neutre couvrant à la fois les prix bas ET hauts : tous les prix
// atypiques sont listés dans un tableau unique (mode 'unified').
export const DEFAULT_UNIFIED_TEMPLATE =
  "<p><strong>➡️ PRIX ATYPIQUES (art. L.2152-6 et R.2152-3 du Code de la commande publique)</strong></p>" +
  "<p>L'analyse de votre proposition fait apparaître plusieurs prix unitaires qui s'écartent sensiblement de l'estimation du maître d'œuvre — certains nettement en deçà, d'autres au-dessus — et qui pèsent sur l'appréciation économique globale de votre offre.</p>" +
  "<p>Afin de nous assurer de la cohérence et de la faisabilité technique de votre proposition, et dans le cadre de la présente négociation, nous vous demandons, pour chacun des prix listés ci-dessous, de bien vouloir :</p>" +
  "<ul>" +
    "<li>Vérifier qu'il ne s'agit pas d'une erreur matérielle, d'une omission ou d'une erreur d'unité dans votre chiffrage ;</li>" +
    "<li>Nous transmettre les sous-détails de prix correspondants (fournitures, main-d'œuvre, matériel, frais généraux et marge) ;</li>" +
    "<li>Le cas échéant, réviser ces prix afin de garantir la bonne exécution des prestations dans les règles de l'art et d'améliorer la compétitivité de votre offre.</li>" +
  "</ul>" +
  "<p>À défaut de justifications satisfaisantes concernant les prix paraissant anormalement bas, le pouvoir adjudicateur se réserve la possibilité de les écarter en application de l'article L.2152-6 du Code de la commande publique.</p>";

// ── Anciens défauts (texte brut) — sert à migrer auto les users qui avaient
// sauvegardé les anciens textes sans les modifier (sinon ils ne verraient
// jamais les nouveaux défauts). ──
export const OLD_LOW_TEMPLATE =
  "➡️ SUSPICION DE PRIX ANORMALEMENT BAS (art. L.2152-6 et R.2152-3 du Code de la commande publique) :\n" +
  "Conformément aux articles L.2152-6 et R.2152-3 du Code de la commande publique, l'acheteur a l'obligation de détecter les offres qui paraissent anormalement basses et d'exiger des justifications avant tout rejet éventuel.\n" +
  "Les prix unitaires suivants paraissent anormalement bas au regard de l'estimation du maître d'œuvre et ont une incidence significative sur le montant global de votre proposition. Nous vous demandons de bien vouloir fournir, pour chacun de ces prix, les justifications prévues à l'article R.2152-3, notamment :\n" +
  "- Le mode opératoire et les procédés de construction retenus ;\n" +
  "- Les conditions exceptionnellement favorables dont vous disposez (approvisionnement, moyens propres, etc.) ;\n" +
  "- Les sous-détails de prix complets (fournitures, main-d'œuvre, matériel, frais généraux et marge).\n" +
  "À défaut de justifications satisfaisantes, l'acheteur pourra rejeter votre offre comme anormalement basse en application de l'article L.2152-6.";

export const OLD_HIGH_TEMPLATE =
  "➡️ PRIX PARAISSANT EXCESSIFS (art. R.2152-3 du Code de la commande publique) :\n" +
  "Les prix unitaires suivants se situent nettement au-dessus de l'estimation du maître d'œuvre et pèsent significativement sur le montant global de votre proposition. Conformément à l'article R.2152-3, nous vous invitons à :\n" +
  "- Vérifier qu'il ne s'agit pas d'une erreur matérielle de chiffrage ;\n" +
  "- Fournir les sous-détails de prix justifiant ces montants ;\n" +
  "- Le cas échéant, dans le cadre de la négociation, reconsidérer ces prix afin d'améliorer la compétitivité de votre offre.";

// Clé localStorage des templates "Prix atypiques"
export const ANOMALY_TPL_KEY = 'estima_rao_anomaly_templates';

// Clé localStorage du mode d'injection : 'split' = 2 blocs (bas/haut) | 'unified' = 1 bloc
export const ANOMALY_MODE_KEY = 'estima_rao_anomaly_mode';
