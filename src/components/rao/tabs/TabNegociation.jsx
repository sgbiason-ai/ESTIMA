// src/components/rao/tabs/TabNegociation.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, CheckCircle2, FileOutput, Copy,
  Calendar, User, MapPin, Edit3, X, Save, Settings, Maximize, Minimize,
  Wand2, SlidersHorizontal, Info, ChevronDown, ChevronUp, RotateCcw, FileText
} from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

import { Textarea } from '../RaoUI';
import { COMPANY_UI_COLORS } from '../RaoConstants';
import CompanySidebar from '../CompanySidebar';
import { toast } from '../../../utils/globalUI';
import { useNegoTemplate } from '../../../hooks/useNegoTemplate';

// ── 1. MODÈLE GLOBAL PAR DÉFAUT ──────────────────────────────────────────────

const DEFAULT_TEMPLATE = `
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

// ── 2. BUILDERS HTML (sections prix atypiques wrappées data-anomaly) ─────────

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

// Detecte si une chaine contient du HTML (issu de ReactQuill) ou du texte brut (ancien format)
const looksLikeHtml = (s) => /<\/?(p|div|ul|ol|li|strong|em|u|br|h\d)\b/i.test(s || '');

// Convertit HTML Quill (bold, underline, italic, lists) en texte brut compatible
// avec parseQuestionsBlocks du PDF de negociation. Preserve les puces "- " et sauts de ligne.
const htmlToPlainText = (html) => {
  if (!looksLikeHtml(html)) return html || '';
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, '');
  const container = document.createElement('div');
  container.innerHTML = html;
  const walk = (node) => {
    let out = '';
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) { out += child.textContent; continue; }
      if (child.nodeType !== 1) continue;
      const tag = child.tagName.toLowerCase();
      if (tag === 'br') out += '\n';
      else if (tag === 'li') out += '- ' + walk(child).trim() + '\n';
      else if (tag === 'ul' || tag === 'ol') out += walk(child);
      else if (tag === 'p' || tag === 'div' || /^h\d$/.test(tag)) out += walk(child).trim() + '\n';
      else out += walk(child);
    }
    return out;
  };
  return walk(container).replace(/\n{3,}/g, '\n\n').trim();
};

const buildAnomalySectionHtml = (type, templateText, items) => {
  let html;

  if (looksLikeHtml(templateText)) {
    // Editeur riche (ReactQuill) → on prend le HTML tel quel, en injectant les
    // styles d'alignement / marges au passage pour rester coherent avec la trame.
    html = (templateText || '')
      // Quill genere <p> sans style → ajouter le style justify + marges
      .replace(/<p(\s[^>]*)?>/gi, (m, attrs) => {
        const a = attrs || '';
        if (/style=/.test(a)) return m; // deja style
        return `<p style="margin:6px 0; text-align:justify;"${a}>`;
      })
      .replace(/<ul>/gi, '<ul style="margin:4px 0; padding-left:24px; text-align:justify;">')
      .replace(/<ol>/gi, '<ol style="margin:4px 0; padding-left:24px; text-align:justify;">')
      .replace(/<li>/gi, '<li style="margin-bottom:3px;">');
  } else {
    // Ancien format texte brut : premiere ligne = titre, "- " = bullet, autre = paragraphe
    const rawLines = (templateText || '').split('\n').map(l => l.trim()).filter(Boolean);
    html = '';
    let inList = false;
    rawLines.forEach((line, idx) => {
      if (idx === 0) {
        const title = line.replace(/^➡️\s*/, '');
        html += `<p style="margin:10px 0 4px 0; text-align:justify;"><strong>${escapeHtml(title)}</strong></p>`;
        return;
      }
      if (line.startsWith('- ')) {
        if (!inList) { html += '<ul style="margin:4px 0; padding-left:24px; text-align:justify;">'; inList = true; }
        html += `<li style="margin-bottom:3px;">${escapeHtml(line.substring(2))}</li>`;
        return;
      }
      if (inList) { html += '</ul>'; inList = false; }
      html += `<p style="margin:0 0 4px 0; text-align:justify;">${escapeHtml(line)}</p>`;
    });
    if (inList) html += '</ul>';
  }

  if (items && items.length > 0) {
    // Items peuvent etre des chaines (ancien format) OU des objets {ref,label,pu,unit}
    const structured = items.map(it => {
      if (typeof it === 'object' && it !== null) return it;
      // Parse chaine "Prix n°XXX — Label : PU proposé de YY € HT[/UNIT]."
      const m = String(it).match(/^Prix\s*n[°o]?\s*([^\s—-]+)\s*[—-]\s*(.+?)\s*:\s*PU\s*(?:proposé\s+)?de\s*([\d\s.,]+)\s*€\s*HT(?:\s*\/\s*([^\s.]+))?\s*\.?\s*$/i);
      return m ? { ref: m[1], label: m[2], pu: m[3].trim(), unit: m[4] || '' } : { ref: '—', label: String(it), pu: '', unit: '' };
    });
    const hasAnyUnit = structured.some(it => (it.unit || '').trim());
    const headBg   = type === 'low' ? '#dc2626' : '#d97706'; // red-600 / amber-600 (match PDF)
    const headText = '#ffffff';
    html += `<p style="margin:6px 0 4px 0; text-align:justify;"><strong>Articles concernés :</strong></p>`;
    html += `<table style="width:100%; border-collapse:collapse; margin:4px 0 8px 0; font-size:10pt;">`;
    html += `<thead><tr>`;
    html += `<th style="background:${headBg}; color:${headText}; padding:4px 6px; border:1px solid ${headBg}; text-align:left; font-weight:bold;">Réf.</th>`;
    html += `<th style="background:${headBg}; color:${headText}; padding:4px 6px; border:1px solid ${headBg}; text-align:left; font-weight:bold;">Désignation</th>`;
    if (hasAnyUnit) html += `<th style="background:${headBg}; color:${headText}; padding:4px 6px; border:1px solid ${headBg}; text-align:center; font-weight:bold;">Unité</th>`;
    html += `<th style="background:${headBg}; color:${headText}; padding:4px 6px; border:1px solid ${headBg}; text-align:right; font-weight:bold;">PU proposé (HT)</th>`;
    html += `</tr></thead><tbody>`;
    structured.forEach(it => {
      html += `<tr>`;
      html += `<td style="padding:3px 6px; border:1px solid #d1d5db;">${escapeHtml(it.ref || '—')}</td>`;
      html += `<td style="padding:3px 6px; border:1px solid #d1d5db;">${escapeHtml(it.label || '')}</td>`;
      if (hasAnyUnit) html += `<td style="padding:3px 6px; border:1px solid #d1d5db; text-align:center;">${escapeHtml(it.unit || '—')}</td>`;
      html += `<td style="padding:3px 6px; border:1px solid #d1d5db; text-align:right;">${it.pu ? escapeHtml(it.pu) + ' €' : '—'}</td>`;
      html += `</tr>`;
    });
    html += `</tbody></table>`;
  }
  return `<div data-anomaly="${type}">${html}</div>`;
};

// ── 3. FONCTION D'INJECTION DES VARIABLES DANS LA TRAME ──────────────────────

const applyTemplate = (templateHtml, companyName, questionsHtml, letterConfig, consultation, project = null) => {
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  // Sources : project (fiche projet) prioritaire, fallback consultation rao
  const get = (projectField, consultationField, fallback) =>
    project?.[projectField] || consultation?.[consultationField] || fallback;
  const city = letterConfig.city || project?.clientCity || '[Ville]';
  const deadline = letterConfig.deadline
    ? new Date(letterConfig.deadline).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '[Date limite]';
  const signatory = letterConfig.signatoryName || '[Nom du signataire]';
  const adresseEntreprise = letterConfig.adresseEntreprise || '';
  const adresseExpediteur = letterConfig.adresseExpediteur || '';

  return templateHtml
    .replace(/{{VILLE}}/g, city)
    .replace(/{{DATE_EMISSION}}/g, today)
    .replace(/{{NOM_ENTREPRISE}}/g, companyName)
    .replace(/{{OBJET_MARCHE}}/g, get('name', 'objet', '[Objet du marché]'))
    .replace(/{{LOT}}/g, consultation?.lot || '[Lot concerné]')
    .replace(/{{CLIENT}}/g, get('client', 'client', '[Nom du Client]'))
    .replace(/{{MOE}}/g, get('moe', 'moe', '[Maître d\'Œuvre]'))
    .replace(/{{CODE_AFFAIRE}}/g, get('code', 'code', '[Code Affaire]'))
    .replace(/{{LIEU}}/g, get('location', 'lieu', '[Lieu]'))
    // Phase forcee a ACT dans le RAO (Assistance aux Contrats de Travaux)
    .replace(/{{PHASE}}/g, 'ACT')
    // Si questionsHtml vide, on laisse un marker invisible pour l'ancrage
    // des sections "Prix atypiques" injectees apres coup.
    .replace(/{{QUESTIONS}}/g, questionsHtml || '<div data-questions-marker style="display:none"></div>')
    .replace(/{{DATE_LIMITE}}/g, deadline)
    .replace(/{{SIGNATAIRE}}/g, signatory)
    .replace(/{{ADRESSE_ENTREPRISE}}/g, adresseEntreprise.replace(/\n/g, '<br/>'))
    .replace(/{{ADRESSE_EXPEDITEUR}}/g, adresseExpediteur.replace(/\n/g, '<br/>'));
};

// ── 4. MODALE D'ÉDITION TRAME GLOBALE (variables + WYSIWYG) ──────────────────

const AVAILABLE_VARIABLES = [
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

const TemplateEditorModal = ({ isOpen, onClose, initialHtml, onSaveTemplate, variableValues = {} }) => {
  const [editorHtml, setEditorHtml] = useState(initialHtml);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedVar, setCopiedVar] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setEditorHtml(initialHtml);
      setIsFullscreen(false);
    }
  }, [isOpen, initialHtml]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveTemplate(editorHtml);
    onClose();
  };

  const copyVariable = (tag) => {
    navigator.clipboard.writeText(tag);
    setCopiedVar(tag);
    setTimeout(() => setCopiedVar(null), 2000);
  };

  const containerClasses = isFullscreen
    ? "fixed inset-0 z-modal bg-slate-100 flex flex-col animate-in fade-in duration-200"
    : "fixed inset-0 z-modal flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4";

  const modalClasses = isFullscreen
    ? "bg-white w-full h-full flex flex-col shadow-2xl"
    : "bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200";

  return (
    <div className={containerClasses}>
      <div className={modalClasses}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
              <Settings size={18} />
            </div>
            <div>
              <h3 className="font-black text-slate-900">Éditer le Modèle Global</h3>
              <p className="text-sm font-medium text-slate-600">
                Modifiez la trame et intégrez les variables du projet.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold"
              title={isFullscreen ? "Réduire" : "Plein écran"}
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
            <div className="w-px h-6 bg-slate-200 mx-1"></div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden bg-slate-50">
          <div className="flex-1 flex flex-col bg-white [&_.ql-editor]:text-black [&_.ql-editor]:text-[15px] [&_.ql-editor]:leading-relaxed overflow-hidden">
            <ReactQuill
              theme="snow"
              value={editorHtml}
              onChange={setEditorHtml}
              className="flex-1 flex flex-col h-full text-black"
              modules={{
                toolbar: [
                  [{ 'header': [1, 2, 3, false] }],
                  ['bold', 'italic', 'underline', 'strike'],
                  [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                  [{ 'align': [] }],
                  ['clean']
                ],
              }}
            />
          </div>

          <div className="w-72 bg-slate-50 border-l border-slate-200 p-5 overflow-y-auto shrink-0 shadow-inner">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-1">Insérer une variable</h4>
            <p className="text-[10px] text-slate-500 mb-6 leading-tight">
              Cliquez sur une étiquette pour la copier, puis collez-la (Ctrl+V) dans votre texte.
            </p>
            <div className="flex flex-col gap-2">
              {AVAILABLE_VARIABLES.map(v => {
                const value = variableValues[v.tag];
                const hasValue = value != null && String(value).trim() !== '';
                return (
                  <button
                    key={v.tag}
                    onClick={() => copyVariable(v.tag)}
                    className={`flex flex-col text-left px-3 py-2 bg-white border rounded-xl hover:border-amber-400 hover:shadow-sm focus:bg-amber-50 focus:border-amber-500 transition-all group ${
                      hasValue ? 'border-slate-200' : 'border-slate-200 opacity-70'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-amber-600 transition-colors">
                      {v.label}
                    </span>
                    {/* Valeur actuelle resolue (ou tiret si non renseigne) */}
                    <span className={`text-[12px] font-bold mt-0.5 leading-snug whitespace-pre-line ${
                      hasValue ? 'text-slate-900' : 'text-slate-300 italic'
                    }`}>
                      {hasValue ? String(value) : '— non renseigné —'}
                    </span>
                    {/* Tag mono en dessous */}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] font-mono text-slate-400">{v.tag}</span>
                      {copiedVar === v.tag ? (
                        <CheckCircle2 size={12} className="text-emerald-500" />
                      ) : (
                        <Copy size={12} className="text-slate-300 opacity-0 group-hover:opacity-100" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <p className="text-sm text-slate-600 font-medium">
            Ce modèle sera sauvegardé et utilisé pour générer tous les futurs courriers.
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-200 transition-colors">
              Annuler
            </button>
            <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md transition-all active:scale-95">
              <Save size={16} />
              Enregistrer la trame
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── 5. VUE PRINCIPALE DU TAB ──────────────────────────────────────────────────

const TabNegociation = ({
  companyNames,
  companiesData,
  updateNegotiation,
  consultation = {},
  selectedCompany,
  onSelectCompany,
  analysisCompanies = [],
  chaptersData = [],
  analysisStats = null,
  bpuRefMap = new Map(),
  branding = null,
  project = null,
  raoLetterConfig = null,
  updateRaoLetterConfig = () => {},
}) => {
  // Trame globale persistée au niveau utilisateur (users/{uid}/preferences/negotiation_template)
  const { template: masterTemplate, saveTemplate } = useNegoTemplate(DEFAULT_TEMPLATE);
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  // Sidebar config courrier : collapsable pour gagner de la place sur l'apercu
  const [configCollapsed, setConfigCollapsed] = useState(false);

  // Config courrier reconstituée à partir de :
  //  - signatoryName + city + deadline : niveau projet (rao.letterConfig) — partage entre toutes les entreprises
  //  - adresseEntreprise : niveau entreprise (nego.adresseEntreprise)
  const negoCurrent = companiesData[selectedCompany]?.negotiation || {};
  const letterConfig = {
    signatoryName: raoLetterConfig?.signatoryName ?? consultation.client ?? '',
    city: raoLetterConfig?.city ?? consultation.lieu ?? '',
    deadline: raoLetterConfig?.deadline ?? negoCurrent.deadline ?? '', // fallback nego pour migration ancienne data
    adresseEntreprise: negoCurrent.adresseEntreprise || '',
    adresseExpediteur: '',
  };
  const [anomalyThresholds, setAnomalyThresholds] = useState({ ecart: 15, impact: 1 });
  const [showThresholdSettings, setShowThresholdSettings] = useState(false);

  // ── Templates de texte "Prix atypiques" ──
  // Format : HTML (Quill). Si l'utilisateur a un ancien format texte brut sauvegarde,
  // il reste compatible cote rendu (buildAnomalySectionHtml detecte les deux formats).
  const ANOMALY_TPL_KEY = 'estima_rao_anomaly_templates';
  const DEFAULT_LOW_TEMPLATE =
    "<p><strong>➡️ PRIX ANORMALEMENT BAS (art. L.2152-6 et R.2152-3 du Code de la commande publique)</strong></p>" +
    "<p>L'analyse de votre proposition révèle que les prix listés ci-dessous se situent très en deçà de l'estimation du maître d'œuvre. Ce niveau de prix interroge sur la bonne appréhension des contraintes techniques du chantier et des exigences quantitatives du cahier des charges.</p>" +
    "<p>Dans le cadre de la présente négociation, et afin de nous assurer de la faisabilité technique de votre proposition, nous vous demandons de :</p>" +
    "<ul>" +
      "<li>Vérifier qu'il ne s'agit pas d'une erreur matérielle ou d'une omission dans votre chiffrage ;</li>" +
      "<li>Le cas échéant, réviser ces prix à la hausse pour garantir la bonne exécution des prestations dans les règles de l'art.</li>" +
    "</ul>" +
    "<p>Si vous confirmez ces montants en l'état, nous vous demandons de nous fournir les sous-détails de prix correspondants ainsi que le mode opératoire envisagé, afin de nous démontrer que ces tarifs permettent techniquement la réalisation complète des travaux exigés.</p>";
  const DEFAULT_HIGH_TEMPLATE =
    "<p><strong>➡️ PRIX PARAISSANT EXCESSIFS (art. R.2152-3 du Code de la commande publique)</strong></p>" +
    "<p>L'analyse comparative de votre proposition indique que les prix listés ci-dessous se situent au-dessus de notre estimation prévisionnelle. Cet écart pèse sur le classement global de votre offre.</p>" +
    "<p>Dans l'optique d'optimiser votre proposition et d'améliorer sa compétitivité dans le cadre de cette négociation, nous vous invitons à :</p>" +
    "<ul>" +
      "<li>Vérifier qu'il ne s'agit pas d'une erreur d'interprétation du cahier des charges ou d'une erreur d'unité lors de votre chiffrage ;</li>" +
      "<li>Étudier la possibilité d'un effort commercial sur ces postes spécifiques pour vous rapprocher des standards du marché.</li>" +
    "</ul>" +
    "<p>Dans l'hypothèse où vous souhaiteriez maintenir ces tarifs initiaux, nous vous serions reconnaissants de nous transmettre les éléments de décomposition (sous-détails de prix) nous permettant de mieux comprendre l'approche technique et les contraintes qui justifient cette valorisation.</p>";

  // Anciens defauts — utilises pour migrer automatiquement les utilisateurs qui
  // avaient sauvegarde les anciens textes sans les modifier (sinon ils ne verraient
  // jamais les nouveaux defauts).
  const OLD_LOW_TEMPLATE =
    "➡️ SUSPICION DE PRIX ANORMALEMENT BAS (art. L.2152-6 et R.2152-3 du Code de la commande publique) :\n" +
    "Conformément aux articles L.2152-6 et R.2152-3 du Code de la commande publique, l'acheteur a l'obligation de détecter les offres qui paraissent anormalement basses et d'exiger des justifications avant tout rejet éventuel.\n" +
    "Les prix unitaires suivants paraissent anormalement bas au regard de l'estimation du maître d'œuvre et ont une incidence significative sur le montant global de votre proposition. Nous vous demandons de bien vouloir fournir, pour chacun de ces prix, les justifications prévues à l'article R.2152-3, notamment :\n" +
    "- Le mode opératoire et les procédés de construction retenus ;\n" +
    "- Les conditions exceptionnellement favorables dont vous disposez (approvisionnement, moyens propres, etc.) ;\n" +
    "- Les sous-détails de prix complets (fournitures, main-d'œuvre, matériel, frais généraux et marge).\n" +
    "À défaut de justifications satisfaisantes, l'acheteur pourra rejeter votre offre comme anormalement basse en application de l'article L.2152-6.";
  const OLD_HIGH_TEMPLATE =
    "➡️ PRIX PARAISSANT EXCESSIFS (art. R.2152-3 du Code de la commande publique) :\n" +
    "Les prix unitaires suivants se situent nettement au-dessus de l'estimation du maître d'œuvre et pèsent significativement sur le montant global de votre proposition. Conformément à l'article R.2152-3, nous vous invitons à :\n" +
    "- Vérifier qu'il ne s'agit pas d'une erreur matérielle de chiffrage ;\n" +
    "- Fournir les sous-détails de prix justifiant ces montants ;\n" +
    "- Le cas échéant, dans le cadre de la négociation, reconsidérer ces prix afin d'améliorer la compétitivité de votre offre.";

  const [anomalyTemplates, setAnomalyTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem(ANOMALY_TPL_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Migration : si l'utilisateur a juste les anciens defauts, basculer vers les nouveaux
        return {
          low:  (!parsed.low  || parsed.low  === OLD_LOW_TEMPLATE)  ? DEFAULT_LOW_TEMPLATE  : parsed.low,
          high: (!parsed.high || parsed.high === OLD_HIGH_TEMPLATE) ? DEFAULT_HIGH_TEMPLATE : parsed.high,
        };
      }
    } catch { /* ignore */ }
    return { low: DEFAULT_LOW_TEMPLATE, high: DEFAULT_HIGH_TEMPLATE };
  });
  const saveAnomalyTemplates = (next) => {
    setAnomalyTemplates(next);
    try { localStorage.setItem(ANOMALY_TPL_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);

  // Dispatche la mise à jour vers la bonne source :
  //  - signatoryName / city / deadline → niveau projet (rao.letterConfig) — partage entre entreprises
  //  - adresseEntreprise → niveau entreprise (nego.*)
  const updateConfig = (key, value) => {
    if (key === 'signatoryName' || key === 'city' || key === 'deadline') {
      updateRaoLetterConfig(key, value);
    } else if (key === 'adresseEntreprise') {
      if (selectedCompany) updateNegotiation(selectedCompany, key, value);
    }
  };

  // ── État aperçu courrier (volatile, jamais persisté) ────────────────────
  // L'aperçu Quill est regénéré depuis la trame quand :
  //  - l'entreprise sélectionnée change → reset complet (sections oubliées)
  //  - la trame globale (masterTemplate) est rechargée/modifiée
  //  - une variable de letterConfig change (signataire, ville, deadline, adresse entreprise)
  // Les sections Prix atypiques injectées (data-anomaly="low|high") sont conservées
  // dans un ref pour survivre aux régénérations dues à un changement de variable.
  const [letterHtml, setLetterHtml] = useState('');
  const anomalySectionsRef = useRef({ low: null, high: null });

  // Injecte les sections data-anomaly dans un HTML de trame fraîche
  const injectSectionsIntoHtml = (html, lowSection, highSection) => {
    if (!lowSection && !highSection) return html;
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div id="__estima_root">${html}</div>`, 'text/html');
    const root = doc.getElementById('__estima_root');
    if (!root) return html;
    // Ancre prioritaire : marker laisse par {{QUESTIONS}} (robuste a toute personnalisation
    // de trame). Fallback : recherche d'un texte connu (pour compatibilite).
    const findAnchor = () => {
      const marker = root.querySelector('[data-questions-marker]');
      if (marker) return marker;
      for (const p of root.querySelectorAll('p')) {
        if (p.textContent && p.textContent.includes('vous remercions de bien vouloir nous confirmer')) {
          return p;
        }
      }
      return null;
    };
    const anchor = findAnchor();
    if (!anchor) return html;
    if (lowSection) {
      const tmp = document.createElement('div');
      tmp.innerHTML = lowSection;
      const node = tmp.firstElementChild;
      if (node) anchor.after(node);
    }
    if (highSection) {
      const tmp = document.createElement('div');
      tmp.innerHTML = highSection;
      const node = tmp.firstElementChild;
      if (node) {
        const lowEl = root.querySelector('[data-anomaly="low"]');
        if (lowEl) lowEl.after(node);
        else anchor.after(node);
      }
    }
    return root.innerHTML;
  };

  // Restauration des sections persistees quand on change d'entreprise
  // (les sections HTML sont stockees dans nego.anomalySections par entreprise)
  useEffect(() => {
    const persisted = companiesData[selectedCompany]?.negotiation?.anomalySections || null;
    anomalySectionsRef.current = {
      low:  persisted?.low  || null,
      high: persisted?.high || null,
    };
  }, [selectedCompany, companiesData]);

  // Regénération de la trame + réinjection des sections préservées
  useEffect(() => {
    if (!selectedCompany) {
      setLetterHtml('');
      return;
    }
    const generated = applyTemplate(masterTemplate, selectedCompany, '', letterConfig, consultation, project);
    const { low, high } = anomalySectionsRef.current;
    setLetterHtml((low || high) ? injectSectionsIntoHtml(generated, low, high) : generated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany, masterTemplate, letterConfig.signatoryName, letterConfig.city, letterConfig.deadline, letterConfig.adresseEntreprise, companiesData]);

  // ── Logique complétion pour sidebar ──
  const getNegoCompletion = (companyName) => {
    const nego = companiesData[companyName]?.negotiation || {};
    const hasContent = !!nego.questions;
    const hasResponses = !!nego.responses;
    if (hasContent && hasResponses) return 'complete';
    if (hasContent || hasResponses) return 'partial';
    return 'empty';
  };

  // ── DÉTECTION DES PRIX ATYPIQUES (HAUTS ET BAS) ────────────────────────
  const detectAnomalies = (companyName) => {
    const company = analysisCompanies.find(c => c.name === companyName);
    if (!company) {
      toast.warning(`Entreprise "${companyName}" introuvable dans les données d'analyse. Vérifiez que l'import est bien effectué.`);
      return null;
    }
    if (!chaptersData?.length || !analysisStats) {
      toast.warning("Les données d'analyse financière ne sont pas disponibles. Veuillez d'abord importer les offres dans l'onglet Analyse.");
      return null;
    }

    const lowItems = [];
    const highItems = [];
    const companyGrandTotal = analysisStats.companiesTotals?.[company.id] || 0;
    if (companyGrandTotal === 0) {
      toast.warning(`Aucune offre chiffrée trouvée pour "${companyName}". Vérifiez que l'import Excel est complet.`);
      return null;
    }

    chaptersData.forEach(chapter => {
      chapter.items.forEach(item => {
        const cd = item.companyData?.[company.id];
        if (!cd) return;
        const companyPU = cd.pu || 0;
        const activeQty = item.activeQty || 0;
        const lineTotal = cd.lineTotal || (companyPU * activeQty);
        if (companyPU === 0) return;
        const allPUs = analysisCompanies
          .map(co => Number(co.offers?.[item.id] ?? 0))
          .filter(p => p !== 0);
        if (allPUs.length < 2) return;
        const averagePU = allPUs.reduce((a, b) => a + b, 0) / allPUs.length;
        const diffRatio = (companyPU - averagePU) / averagePU;
        const impactRatio = lineTotal / companyGrandTotal;
        if (Math.abs(diffRatio) > (anomalyThresholds.ecart / 100) && impactRatio > (anomalyThresholds.impact / 100)) {
          const puFormatted = companyPU.toLocaleString('fr-FR', { minimumFractionDigits: 2 }).replace(/[\u202F\u00A0\u2009]/g, ' ');
          const refLabel = bpuRefMap?.get?.(item.id) || item.bpuNum || item.ref || '—';
          const label = item.designation || item.name || '';
          const unit = item.unit || item.unite || '';
          // Item structure : utilise par buildAnomalySectionHtml (table) + plain-text (PDF)
          const structuredItem = { ref: refLabel, label, pu: puFormatted, unit };
          if (diffRatio > 0) highItems.push(structuredItem);
          else lowItems.push(structuredItem);
        }
      });
    });

    return { lowItems, highItems };
  };

  // ── INJECTION DES SECTIONS PRIX ATYPIQUES DANS L'APERÇU ────────────────
  // Toujours partir d'une trame fraîche pour garantir l'ordre :
  // intro → low → high → suite de la lettre. Les sections sont stockées dans
  // anomalySectionsRef pour survivre aux régénérations dues aux changements de variables.
  const injectAnomalies = () => {
    if (!selectedCompany) return;
    const result = detectAnomalies(selectedCompany);
    if (!result) return; // toast déjà émis

    const { lowItems, highItems } = result;
    if (lowItems.length === 0 && highItems.length === 0) {
      toast.info(`Aucun prix atypique détecté (seuils : écart > ${anomalyThresholds.ecart}% de la moyenne ET impact > ${anomalyThresholds.impact}% de l'offre totale).`);
      return;
    }

    const lowSection = lowItems.length > 0
      ? buildAnomalySectionHtml('low', anomalyTemplates.low, lowItems)
      : null;
    const highSection = highItems.length > 0
      ? buildAnomalySectionHtml('high', anomalyTemplates.high, highItems)
      : null;

    // Stocker dans le ref pour persister à travers les régénérations
    anomalySectionsRef.current = { low: lowSection, high: highSection };
    // Persistance Firestore (par entreprise) : sections HTML completes survivront
    // au rechargement de page / reouverture du projet
    updateNegotiation(selectedCompany, 'anomalySections', { low: lowSection, high: highSection });

    // Regénérer depuis la trame propre + injecter les sections (ordre garanti)
    const generated = applyTemplate(masterTemplate, selectedCompany, '', letterConfig, consultation, project);
    setLetterHtml(injectSectionsIntoHtml(generated, lowSection, highSection));

    // Synchronise nego.questions (string brut) pour rester compatible avec le générateur PDF.
    // Items structures → reconstruit la chaine au format attendu par parseQuestionsBlocks.
    const itemToString = (it) => {
      const unitSuffix = it.unit ? `/${it.unit}` : '';
      return `- Prix n°${it.ref} — ${it.label} : PU proposé de ${it.pu} € HT${unitSuffix}.`;
    };
    const lowPlain = htmlToPlainText(anomalyTemplates.low);
    const highPlain = htmlToPlainText(anomalyTemplates.high);
    const questionsString = [
      lowItems.length > 0 ? lowPlain + '\n\nArticles concernés :\n' + lowItems.map(itemToString).join('\n') : null,
      highItems.length > 0 ? highPlain + '\n\nArticles concernés :\n' + highItems.map(itemToString).join('\n') : null,
    ].filter(Boolean).join('\n\n');
    updateNegotiation(selectedCompany, 'questions', questionsString);

    const total = lowItems.length + highItems.length;
    toast.success(`${total} prix atypique${total > 1 ? 's' : ''} injecté${total > 1 ? 's' : ''} dans l'aperçu.`);
  };

  // ── RÉINITIALISATION DEPUIS LA TRAME ───────────────────────────────────
  const resetFromTemplate = () => {
    if (!selectedCompany) return;
    if (!window.confirm("Effacer toutes vos modifications et repartir de la trame de base ?\n\nLes prix atypiques injectés et les éditions manuelles seront perdus.")) return;
    anomalySectionsRef.current = { low: null, high: null };
    const generated = applyTemplate(masterTemplate, selectedCompany, '', letterConfig, consultation, project);
    setLetterHtml(generated);
    updateNegotiation(selectedCompany, 'questions', '');
    updateNegotiation(selectedCompany, 'anomalySections', null);
    toast.success("Aperçu réinitialisé depuis la trame.");
  };

  // ── TÉLÉCHARGEMENT PDF ─────────────────────────────────────────────────
  const handleDownloadPDF = async () => {
    if (!selectedCompany) return;
    const { generateNegoLetterPDF } = await import('../../../utils/pdf/pdfNegoLetterGenerator');
    await generateNegoLetterPDF({
      companyName: selectedCompany,
      questions: companiesData[selectedCompany]?.negotiation?.questions || '',
      letterConfig,
      consultation,
      branding,
      project,
      analysisCompanies,
      masterTemplate,
      chaptersData,
      bpuRefMap,
    });
  };

  if (!selectedCompany || !companyNames.includes(selectedCompany)) return null;

  const ci = companyNames.indexOf(selectedCompany);
  const name = selectedCompany;
  const uiColor = COMPANY_UI_COLORS[ci % COMPANY_UI_COLORS.length];
  const nego = companiesData[name]?.negotiation || {};

  return (
    <div className="flex h-full">
      {/* ── Sidebar entreprises ── */}
      <CompanySidebar
        companyNames={companyNames}
        selectedCompany={selectedCompany}
        onSelectCompany={onSelectCompany}
        getCompletionStatus={getNegoCompletion}
      />

      {/* ── Contenu entreprise sélectionnée ── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[1400px] mx-auto pb-24">

          <TemplateEditorModal
            isOpen={templateEditorOpen}
            onClose={() => setTemplateEditorOpen(false)}
            initialHtml={masterTemplate}
            variableValues={{
              // Donnees venant de la fiche projet (ProjectDetailsModal) en priorite,
              // fallback consultation rao si l'utilisateur a edite manuellement
              '{{NOM_ENTREPRISE}}':     selectedCompany || '',
              '{{ADRESSE_ENTREPRISE}}': letterConfig.adresseEntreprise || '',
              '{{OBJET_MARCHE}}':       project?.name || consultation?.objet || '',
              '{{CODE_AFFAIRE}}':       project?.code || consultation?.code || '',
              '{{CLIENT}}':             project?.client || consultation?.client || '',
              '{{ADRESSE_EXPEDITEUR}}': [project?.client, project?.clientAddress, [project?.clientZip, project?.clientCity].filter(Boolean).join(' ')].filter(Boolean).join('\n'),
              '{{MOE}}':                project?.moe || consultation?.moe || '',
              '{{LIEU}}':               project?.location || consultation?.lieu || '',
              '{{PHASE}}':              'ACT', // forcee dans le RAO
              '{{LOT}}':                consultation?.lot || '',
              '{{QUESTIONS}}':          '(injectées automatiquement)',
              '{{DATE_EMISSION}}':      new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
              '{{DATE_LIMITE}}':        letterConfig.deadline ? new Date(letterConfig.deadline).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
              '{{VILLE}}':              letterConfig.city || project?.clientCity || '',
              '{{SIGNATAIRE}}':         letterConfig.signatoryName || '',
            }}
            onSaveTemplate={(newHtml) => {
              saveTemplate(newHtml);
              toast.success("Trame de courrier sauvegardée.");
            }}
          />

          <div className="flex gap-5">

            {/* ── Colonne principale : courrier + accordeon ── */}
            <div className="flex-1 min-w-0 space-y-6">

              {/* ── Header entreprise ── */}
          <div className={`flex items-center gap-5 px-6 py-4 bg-white rounded-2xl border ${uiColor.border} border-l-[5px] shadow-sm`}>
            <div className={`w-12 h-12 rounded-2xl ${uiColor.bg} ${uiColor.text} flex items-center justify-center font-black text-xl shadow-inner`}>
              {name.substring(0, 2).toUpperCase()}
            </div>
            <h2 className="font-extrabold text-slate-900 text-xl tracking-tight">{name}</h2>
            {(nego.questions || nego.responses) && (
              <span className="text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 px-4 py-1.5 rounded-full ml-auto shadow-sm">
                Échanges en cours
              </span>
            )}
          </div>

          {/* ── Toolbar Aperçu ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-base font-black uppercase tracking-widest text-slate-900 flex items-center gap-2 mr-3">
                <FileText size={18} className="text-blue-600" /> Aperçu du courrier
              </h4>
              <div className="flex items-center gap-1.5 relative">
                <button
                  onClick={injectAnomalies}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95"
                  title="Détecter et injecter les prix atypiques (hauts et bas) dans l'aperçu"
                >
                  <Wand2 size={14} />
                  Prix atypiques
                </button>
                <button
                  onClick={() => setShowThresholdSettings(v => !v)}
                  className={`p-1.5 rounded-lg border transition-all ${showThresholdSettings ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200'}`}
                  title="Réglages des seuils de détection et modèles de texte"
                >
                  <SlidersHorizontal size={14} />
                </button>

                {/* Popover réglages anomalies */}
                {showThresholdSettings && (
                  <div className={`absolute top-full left-0 mt-2 ${showTemplateEditor ? 'w-[720px]' : 'w-80'} bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-5 space-y-4 transition-all ${showTemplateEditor ? 'max-h-[85vh] overflow-y-auto' : ''}`}>
                    <div className="flex items-center justify-between">
                      <h5 className="text-sm font-black text-slate-800 flex items-center gap-2">
                        <SlidersHorizontal size={16} className="text-indigo-500" />
                        Paramètres « Prix atypiques »
                      </h5>
                      <button onClick={() => setShowThresholdSettings(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                        <X size={14} />
                      </button>
                    </div>

                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                      <div className="flex items-start gap-2">
                        <Info size={14} className="text-indigo-500 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-indigo-700 leading-relaxed">
                          Un prix est signalé comme <strong>atypique</strong> si les <strong>2 conditions</strong> sont remplies simultanément :
                          le PU s'écarte de plus de <strong>{anomalyThresholds.ecart}%</strong> de la moyenne des offres,
                          ET le montant de la ligne représente plus de <strong>{anomalyThresholds.impact}%</strong> du total HT de l'entreprise.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-slate-700">Écart par rapport à la moyenne</label>
                          <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{anomalyThresholds.ecart}%</span>
                        </div>
                        <input
                          type="range" min={5} max={50} step={1}
                          value={anomalyThresholds.ecart}
                          onChange={e => setAnomalyThresholds(prev => ({ ...prev, ecart: Number(e.target.value) }))}
                          className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-500"
                        />
                        <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                          <span>5% (sensible)</span>
                          <span>50% (tolérant)</span>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-slate-700">Impact sur l'offre totale</label>
                          <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{anomalyThresholds.impact}%</span>
                        </div>
                        <input
                          type="range" min={0.25} max={5} step={0.25}
                          value={anomalyThresholds.impact}
                          onChange={e => setAnomalyThresholds(prev => ({ ...prev, impact: Number(e.target.value) }))}
                          className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-500"
                        />
                        <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                          <span>0.25% (sensible)</span>
                          <span>5% (tolérant)</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => { setAnomalyThresholds({ ecart: 15, impact: 1 }); }}
                      className="w-full text-[11px] font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 py-1.5 rounded-lg transition-colors"
                    >
                      Réinitialiser seuils (15% / 1%)
                    </button>

                    <div className="border-t border-slate-100 pt-3">
                      <button
                        onClick={() => setShowTemplateEditor(v => !v)}
                        className="w-full flex items-center justify-between text-xs font-bold text-slate-700 hover:text-indigo-600 py-1.5 rounded-lg transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <Edit3 size={13} className="text-indigo-500" />
                          Modèles de texte injectés
                        </span>
                        <span className="text-[10px] font-normal text-slate-400">{showTemplateEditor ? 'Masquer' : 'Éditer'}</span>
                      </button>

                      {showTemplateEditor && (
                        <div className="mt-2 space-y-3 [&_.ql-editor]:min-h-[240px] [&_.ql-editor]:max-h-[360px] [&_.ql-editor]:overflow-y-auto [&_.ql-editor]:text-[12px] [&_.ql-editor]:leading-relaxed [&_.ql-editor]:p-3 [&_.ql-container]:bg-slate-50 [&_.ql-toolbar]:bg-slate-50 [&_.ql-toolbar]:rounded-t-lg [&_.ql-container]:rounded-b-lg [&_.ql-toolbar]:border-slate-200 [&_.ql-container]:border-slate-200">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] font-bold text-slate-700">Texte « Prix anormalement bas »</label>
                              <button
                                onClick={() => saveAnomalyTemplates({ ...anomalyTemplates, low: DEFAULT_LOW_TEMPLATE })}
                                className="text-[10px] font-bold text-slate-400 hover:text-indigo-600"
                                title="Restaurer le texte par défaut"
                              >
                                Réinitialiser
                              </button>
                            </div>
                            <ReactQuill
                              theme="snow"
                              value={anomalyTemplates.low}
                              onChange={(html) => saveAnomalyTemplates({ ...anomalyTemplates, low: html })}
                              modules={{ toolbar: [['bold', 'italic', 'underline'], [{ list: 'bullet' }, { list: 'ordered' }], ['clean']] }}
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] font-bold text-slate-700">Texte « Prix excessifs »</label>
                              <button
                                onClick={() => saveAnomalyTemplates({ ...anomalyTemplates, high: DEFAULT_HIGH_TEMPLATE })}
                                className="text-[10px] font-bold text-slate-400 hover:text-indigo-600"
                                title="Restaurer le texte par défaut"
                              >
                                Réinitialiser
                              </button>
                            </div>
                            <ReactQuill
                              theme="snow"
                              value={anomalyTemplates.high}
                              onChange={(html) => saveAnomalyTemplates({ ...anomalyTemplates, high: html })}
                              modules={{ toolbar: [['bold', 'italic', 'underline'], [{ list: 'bullet' }, { list: 'ordered' }], ['clean']] }}
                            />
                          </div>
                          <div className="flex items-start gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                            <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-emerald-700 leading-relaxed">
                              Sauvegarde automatique dans le navigateur. La liste des articles concernés est ajoutée à la fin de chaque texte lors de l'injection.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setTemplateEditorOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95"
                title="Modifier la trame globale partagée par toutes les entreprises"
              >
                <Settings size={14} />
                Trame
              </button>
              <button
                onClick={resetFromTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95"
                title="Effacer toutes les modifications et repartir de la trame de base"
              >
                <RotateCcw size={14} />
                Réinitialiser
              </button>
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
                title="Télécharger le courrier au format PDF"
              >
                <FileOutput size={14} />
                Télécharger PDF
              </button>
            </div>
          </div>

          {/* ── Apercu A4 read-only (fidele au PDF) ── */}
          {(() => {
            const primaryColor = branding?.colors?.primary || '#286e55'; // vert papyrus par defaut
            // Extraction des elements structurels depuis letterHtml :
            // on les rend nous-meme pour garantir la mise en page (dest/exp cote a cote, etc.)
            // Le reste (corps de lettre) est rendu via dangerouslySetInnerHTML.
            const stripStructuralFromHtml = (html) => {
              if (!html || typeof DOMParser === 'undefined') return html || '';
              const doc = new DOMParser().parseFromString(`<div id="__root">${html}</div>`, 'text/html');
              const root = doc.getElementById('__root');
              if (!root) return html;

              // Strategie : extraire le body en commencant au paragraphe "Monsieur,"
              // (ou "Madame," / "Dans le cadre de la consultation"). Tout ce qui precede
              // est structurel (date, dest/exp, OBJET, Negociation) — rendu separement.
              // S'il existe un cadre <div style="border..."> englobant le corps, on prend
              // son contenu. Sinon on flatten tous les <p>/<ul>/<table>/<div> a partir de
              // "Monsieur,".
              const bodyBox = Array.from(root.querySelectorAll('div')).find(d => {
                const s = d.getAttribute('style') || '';
                return /border\s*:\s*\d+px\s+solid/i.test(s)
                  && !/display\s*:\s*flex/i.test(s)
                  && /Monsieur|Madame|Dans le cadre/i.test(d.textContent || '');
              });
              if (bodyBox) {
                // Retire le footer "NOMBRE DE PAGES" s'il est dans le bodyBox
                Array.from(bodyBox.querySelectorAll('p'))
                  .filter(p => /NOMBRE\s+DE\s+PAGES/i.test(p.textContent || ''))
                  .forEach(p => p.remove());
                return bodyBox.innerHTML;
              }

              // Pas de bodyBox detecte (Quill a tout aplati) : on cherche le 1er paragraphe
              // commencant par Monsieur/Madame/"Dans le cadre" et on prend tout depuis lui
              const allBlocks = Array.from(root.children);
              let startIdx = -1;
              const isBodyStart = (el) => {
                const t = (el.textContent || '').trim();
                return /^(monsieur|madame)[\s,.]|^Dans\s+le\s+cadre\s+de\s+la\s+consultation/i.test(t);
              };
              for (let i = 0; i < allBlocks.length; i++) {
                if (isBodyStart(allBlocks[i])) { startIdx = i; break; }
                // Cherche aussi dans les enfants directs (cas div imbriques)
                const inner = Array.from(allBlocks[i].children || []).find(isBodyStart);
                if (inner) { startIdx = i; break; }
              }
              if (startIdx < 0) {
                // Fallback : on retire juste les markers connus
                root.querySelector('p[style*="text-align:right"]')?.remove();
                const flexDiv = Array.from(root.querySelectorAll('div')).find(d => /display\s*:\s*flex/i.test(d.getAttribute('style') || ''));
                if (flexDiv) flexDiv.remove();
                Array.from(root.querySelectorAll('p'))
                  .filter(p => /NOMBRE\s+DE\s+PAGES/i.test(p.textContent || ''))
                  .forEach(p => p.remove());
                return root.innerHTML;
              }
              const bodyOnly = allBlocks.slice(startIdx)
                .map(el => el.outerHTML)
                .join('');
              // Retire le NOMBRE DE PAGES s'il a ete inclus
              const bodyDoc = new DOMParser().parseFromString(`<div id="__b">${bodyOnly}</div>`, 'text/html');
              const bRoot = bodyDoc.getElementById('__b');
              Array.from(bRoot.querySelectorAll('p'))
                .filter(p => /NOMBRE\s+DE\s+PAGES/i.test(p.textContent || ''))
                .forEach(p => p.remove());
              return bRoot.innerHTML;
            };
            const bodyHtml = stripStructuralFromHtml(letterHtml);
            const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
            const ville = letterConfig.city || consultation?.lieu || '[Ville]';
            const objet = consultation?.objet || '[Objet du marché]';
            const adresseEnt = letterConfig.adresseEntreprise || '';
            const adresseExp = letterConfig.adresseExpediteur || '';
            return (
              <div className="rounded-3xl border border-slate-300 shadow-sm overflow-hidden nego-paper-preview-wrapper">
                <div className="nego-paper-preview-page">
                  {/* Bande verticale primary (gauche) — couleur dynamique branding */}
                  <div className="nego-paper-preview-band" style={{ background: primaryColor }} />
                  {/* Logo en haut a gauche — prioritairement MOA (client), fallback MOE */}
                  <img
                    src={project?.clientLogo || branding?.logo || '/logo.jpg'}
                    alt="Logo MOA / MOE"
                    className="nego-paper-preview-logo"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  {/* Date alignee a droite */}
                  <p style={{ textAlign: 'right', margin: '0 0 12px 0', fontSize: '10pt' }}>
                    {ville}, le {today}
                  </p>
                  {/* Destinataire (gauche) + Expediteur (droite) */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ flex: 55, border: '1px solid #000', fontSize: '10pt' }}>
                      <div style={{ borderBottom: '1px solid #000', textAlign: 'center', padding: '4px 6px' }}>DESTINATAIRE :</div>
                      <div style={{ padding: '8px 6px', minHeight: '60px', whiteSpace: 'pre-line' }}>
                        <strong>{selectedCompany || '[Entreprise]'}</strong>{adresseEnt && (<>{'\n'}{adresseEnt}</>)}
                      </div>
                    </div>
                    <div style={{ flex: 45, border: '1px solid #000', fontSize: '10pt' }}>
                      <div style={{ borderBottom: '1px solid #000', textAlign: 'center', padding: '4px 6px' }}>EXPÉDITEUR :</div>
                      <div style={{ padding: '8px 6px', minHeight: '60px', whiteSpace: 'pre-line' }}>
                        <strong>{consultation?.client || '[Client / MOA]'}</strong>{adresseExp && (<>{'\n'}{adresseExp}</>)}
                      </div>
                    </div>
                  </div>
                  {/* Objet */}
                  <p style={{ margin: '6px 0 2px 0', fontSize: '10pt' }}>
                    <strong>OBJET :</strong>  <strong>{objet}</strong>
                  </p>
                  <p style={{ margin: '0 0 6px 0', fontSize: '10pt' }}>
                    <strong>Négociation avec les candidats</strong>
                  </p>
                  {/* Cadre corps de lettre */}
                  <div style={{ border: '1px solid #000', padding: '10px 12px' }}>
                    <div
                      className="nego-paper-preview-body"
                      dangerouslySetInnerHTML={{ __html: bodyHtml || '<p style="color:#94a3b8; font-style:italic;">Sélectionnez une entreprise puis cliquez sur « Prix atypiques » pour générer le courrier.</p>' }}
                    />
                  </div>
                  {/* Footer fidele au PDF */}
                  <div className="nego-paper-preview-footer">
                    <span>{consultation?.client || 'Maître d\'œuvre'}</span>
                    <span>Document confidentiel — usage strictement professionnel</span>
                    <span>Page 1 / 1</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Accordéon Réponses & Engagements ── */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <button
              onClick={() => updateNegotiation(name, '__responsesOpen', !nego.__responsesOpen)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 size={20} className="text-emerald-600" />
                <div>
                  <h4 className="text-base font-black uppercase tracking-widest text-slate-900">Réponses & Engagements</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {nego.responses ? `${nego.responses.length} caractère${nego.responses.length > 1 ? 's' : ''} saisi${nego.responses.length > 1 ? 's' : ''}` : 'Consignez ici les retours après envoi du courrier'}
                  </p>
                </div>
              </div>
              {nego.__responsesOpen ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
            </button>
            {nego.__responsesOpen && (
              <div className="px-6 pb-6 border-t border-slate-100 pt-4">
                <Textarea
                  value={nego.responses}
                  onChange={v => updateNegotiation(name, 'responses', v)}
                  placeholder="Consignez ici les retours de l'entreprise après l'envoi du courrier."
                  rows={6}
                  className="bg-white border-slate-300 shadow-sm rounded-2xl text-slate-900 font-medium text-[15px] leading-relaxed placeholder:text-slate-400 focus:ring-emerald-500/20 min-h-[140px]"
                />
              </div>
            )}
          </div>

            </div> {/* /flex-1 main column */}

            {/* ── Sidebar config laterale (sticky) ── */}
            <aside className={`shrink-0 transition-all duration-200 ${configCollapsed ? 'w-12' : 'w-80'}`}>
              <div className="sticky top-2">
                {configCollapsed ? (
                  <button
                    onClick={() => setConfigCollapsed(false)}
                    className="w-12 h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl flex items-center justify-center shadow-md transition"
                    title="Afficher le panneau de configuration"
                  >
                    <FileOutput size={18} />
                  </button>
                ) : (
                  <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 text-white shadow-md relative overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 bg-white/10 rounded-lg border border-white/10 shrink-0">
                          <FileOutput size={14} className="text-emerald-400" />
                        </div>
                        <h3 className="text-[12px] font-black tracking-tight text-white truncate">Paramètres courrier</h3>
                      </div>
                      <button
                        onClick={() => setConfigCollapsed(true)}
                        className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition shrink-0"
                        title="Masquer le panneau"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-300">
                          <Calendar size={11} /> Date & Heure limite
                        </label>
                        <input
                          type="datetime-local" value={letterConfig.deadline} onChange={e => updateConfig('deadline', e.target.value)}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-2.5 py-2 text-[12px] text-white font-semibold focus:outline-none focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/80 transition-all [color-scheme:dark]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-300">
                          <User size={11} /> Signataire
                        </label>
                        <input
                          type="text" value={letterConfig.signatoryName} onChange={e => updateConfig('signatoryName', e.target.value)} placeholder="Ex: Fabrice Marcuzzo, Maire"
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-2.5 py-2 text-[12px] text-white font-semibold placeholder:text-slate-500 focus:outline-none focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/80 transition-all"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-300">
                          <MapPin size={11} /> Expéditeur (auto)
                        </label>
                        <div className="px-2.5 py-2 bg-slate-800/30 border border-white/10 rounded-lg text-[11px] text-slate-300 leading-relaxed">
                          <div className="font-bold text-white truncate">{project?.client || '—'}</div>
                          {project?.clientAddress && <div className="truncate">{project.clientAddress}</div>}
                          {(project?.clientZip || project?.clientCity) && (
                            <div className="truncate">{[project?.clientZip, project?.clientCity].filter(Boolean).join(' ')}</div>
                          )}
                          <div className="mt-1 text-[9px] text-slate-400 italic leading-tight">
                            📝 Modifiable via la fiche affaire.
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-300">
                          <MapPin size={11} /> Adresse entreprise
                        </label>
                        <textarea
                          value={letterConfig.adresseEntreprise} onChange={e => updateConfig('adresseEntreprise', e.target.value)}
                          placeholder={"Auto si vide"}
                          rows={3}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-2.5 py-2 text-[12px] text-white font-semibold placeholder:text-slate-500 focus:outline-none focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/80 transition-all resize-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </aside>

          </div> {/* /flex */}

        </div>
      </div>
    </div>
  );
};

export default TabNegociation;
