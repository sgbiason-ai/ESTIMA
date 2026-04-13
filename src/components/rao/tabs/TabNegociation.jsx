// src/components/rao/tabs/TabNegociation.jsx
import React, { useState, useEffect } from 'react';
import {
  MessageSquare, CheckCircle2, FileOutput, Copy,
  Calendar, User, MapPin, Edit3, X, Save, Settings, Maximize, Minimize,
  Wand2, SlidersHorizontal, Info
} from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

import { Textarea } from '../RaoUI';
import { COMPANY_UI_COLORS } from '../RaoConstants';
import CompanySidebar from '../CompanySidebar';
import { toast } from '../../../utils/globalUI';

// ── 1. MODÈLE GLOBAL PAR DÉFAUT (AVEC TOUTES LES VARIABLES) ──────────────────

const DEFAULT_TEMPLATE = `
<div style="font-family: Helvetica, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #000000;">
  <p style="text-align: right; margin-bottom: 40px;">{{VILLE}}, le {{DATE_EMISSION}}</p>

  <p style="margin-bottom: 30px;">
    <strong>DESTINATAIRE :</strong><br/>
    {{NOM_ENTREPRISE}}
  </p>

  <p style="margin-bottom: 20px;">
    <strong>AFFAIRE :</strong> {{CODE_AFFAIRE}} - {{OBJET_MARCHE}}<br/>
    <strong>MAÎTRISE D'OUVRAGE :</strong> {{CLIENT}}<br/>
    <strong>OBJET :</strong> {{LOT}} - Négociation avec les candidats
  </p>

  <p style="margin-bottom: 15px;">Monsieur,</p>

  <p style="margin-bottom: 15px; text-align: justify;">
    Dans le cadre de la consultation (Phase {{PHASE}}) relative au marché de travaux situé à {{LIEU}}, votre entreprise a présenté une offre pour le {{LOT}}, laquelle a fait l'objet d'une analyse sous la supervision de la Maîtrise d'Œuvre ({{MOE}}).
  </p>

  <p style="margin-bottom: 15px; text-align: justify;">
    Afin de permettre au pouvoir adjudicateur de vérifier la cohérence économique de votre offre, et sans préjuger de la conformité de votre proposition, nous vous remercions de bien vouloir nous transmettre l'ensemble des sous-détails de prix détaillés.
  </p>

  <p style="margin-bottom: 15px; text-align: justify;">
    Ces sous-détails de prix devront permettre d'identifier une décomposition complète et explicite, comprenant notamment :
  </p>

  <ul style="margin-bottom: 15px; text-align: justify;">
    <li>L'ensemble des fournitures demandées (matériaux, produits, équipements) ;</li>
    <li>La main-d'œuvre mobilisée (catégories, temps unitaires et coûts) ;</li>
    <li>Les moyens matériels et engins utilisés ;</li>
    <li>Les autres composantes du prix (frais généraux et marge).</li>
  </ul>

  {{QUESTIONS}}

  <p style="margin-bottom: 15px; margin-top: 15px; text-align: justify;">
    Par ailleurs, le pouvoir adjudicateur a décidé d'engager une phase de négociation portant sur les aspects financiers de votre offre. Dans ce cadre, nous vous invitons à bien vouloir réexaminer le montant de votre proposition et à nous faire parvenir une offre financière révisée, intégrant une remise sur le prix initial.
  </p>

  <p style="margin-bottom: 20px; text-align: justify;">
    <strong>Les éléments demandés devront être transmis sur la plateforme au plus tard le {{DATE_LIMITE}}.</strong>
  </p>

  <p style="margin-bottom: 40px;">
    Nous vous prions d'agréer, Monsieur, l'expression de nos salutations distinguées.
  </p>

  <p style="text-align: right;">
    <strong>{{SIGNATAIRE}}</strong>
  </p>
</div>
`;

// ── 2. FONCTION D'INJECTION DES VARIABLES ────────────────────────────────────

const applyTemplate = (templateHtml, companyName, questions, letterConfig, consultation) => {
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const city = letterConfig.city || '[Ville]';
  const deadline = letterConfig.deadline
    ? new Date(letterConfig.deadline).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '[Date limite]';
  const signatory = letterConfig.signatoryName || '[Nom du signataire]';

  const formattedQuestions = questions
    ? `<br/><p><strong>De plus, nous souhaiterions obtenir des précisions sur les points suivants :</strong></p><p>${questions.replace(/\n/g, '<br/>')}</p>`
    : '';

  return templateHtml
    .replace(/{{VILLE}}/g, city)
    .replace(/{{DATE_EMISSION}}/g, today)
    .replace(/{{NOM_ENTREPRISE}}/g, companyName)
    .replace(/{{OBJET_MARCHE}}/g, consultation?.objet || '[Objet du marché]')
    .replace(/{{LOT}}/g, consultation?.lot || '[Lot concerné]')
    .replace(/{{CLIENT}}/g, consultation?.client || '[Nom du Client]')
    .replace(/{{MOE}}/g, consultation?.moe || '[Maître d\'Œuvre]')
    .replace(/{{CODE_AFFAIRE}}/g, consultation?.code || '[Code Affaire]')
    .replace(/{{LIEU}}/g, consultation?.lieu || '[Lieu]')
    .replace(/{{PHASE}}/g, consultation?.phase || '[Phase]')
    .replace(/{{QUESTIONS}}/g, formattedQuestions)
    .replace(/{{DATE_LIMITE}}/g, deadline)
    .replace(/{{SIGNATAIRE}}/g, signatory);
};

// ── 3. MODALE D'ÉDITION WYSIWYG (PLEIN ÉCRAN & VARIABLES) ─────────────────────

const AVAILABLE_VARIABLES = [
  { label: 'Nom Entreprise', tag: '{{NOM_ENTREPRISE}}' },
  { label: 'Objet du projet', tag: '{{OBJET_MARCHE}}' },
  { label: 'Code Affaire', tag: '{{CODE_AFFAIRE}}' },
  { label: 'Client / MOA', tag: '{{CLIENT}}' },
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

const LetterEditorModal = ({ isOpen, onClose, mode, initialHtml, companyName, onSaveTemplate }) => {
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

  const isTemplateMode = mode === 'template';

  const handleDownloadPDF = async () => {
    const { default: html2pdf } = await import('html2pdf.js');
    const element = document.createElement('div');
    element.innerHTML = `<div style="padding: 20mm 15mm; background-color: white;">${editorHtml}</div>`;

    const opt = {
      margin:       0,
      filename:     `Courrier_Negociation_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
    onClose();
  };

  const handleSaveGlobalTemplate = () => {
    onSaveTemplate(editorHtml);
    onClose();
  };

  const copyVariable = (tag) => {
    navigator.clipboard.writeText(tag);
    setCopiedVar(tag);
    setTimeout(() => setCopiedVar(null), 2000);
  };

  const containerClasses = isFullscreen
    ? "fixed inset-0 z-[9999] bg-slate-100 flex flex-col animate-in fade-in duration-200"
    : "fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4";

  const modalClasses = isFullscreen
    ? "bg-white w-full h-full flex flex-col shadow-2xl"
    : "bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200";

  return (
    <div className={containerClasses}>
      <div className={modalClasses}>

        {/* Header Modale */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isTemplateMode ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
              {isTemplateMode ? <Settings size={18} /> : <Edit3 size={18} />}
            </div>
            <div>
              <h3 className="font-black text-slate-900">
                {isTemplateMode ? "Éditer le Modèle Global" : "Aperçu & Édition du courrier final"}
              </h3>
              <p className="text-sm font-medium text-slate-600">
                {isTemplateMode
                  ? "Modifiez la trame et intégrez les variables du projet."
                  : `Destinataire : ${companyName}`}
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

        {/* Body */}
        <div className="flex-1 flex overflow-hidden bg-slate-50">

          {/* Zone Quill */}
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

          {/* Panneau Latéral Variables */}
          {isTemplateMode && (
            <div className="w-72 bg-slate-50 border-l border-slate-200 p-5 overflow-y-auto shrink-0 shadow-inner">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-1">Insérer une variable</h4>
              <p className="text-[10px] text-slate-500 mb-6 leading-tight">
                Cliquez sur une étiquette pour la copier, puis collez-la (Ctrl+V) dans votre texte.
              </p>

              <div className="flex flex-col gap-2">
                {AVAILABLE_VARIABLES.map(v => (
                  <button
                    key={v.tag}
                    onClick={() => copyVariable(v.tag)}
                    className="flex flex-col text-left px-3 py-2 bg-white border border-slate-200 rounded-xl hover:border-amber-400 hover:shadow-sm focus:bg-amber-50 focus:border-amber-500 transition-all group"
                  >
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-amber-600 transition-colors">
                      {v.label}
                    </span>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs font-mono font-bold text-slate-700">{v.tag}</span>
                      {copiedVar === v.tag ? (
                        <CheckCircle2 size={14} className="text-emerald-500" />
                      ) : (
                        <Copy size={14} className="text-slate-300 opacity-0 group-hover:opacity-100" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Modale */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <p className="text-sm text-slate-600 font-medium">
            {isTemplateMode
              ? "Ce modèle sera sauvegardé et utilisé pour générer tous les futurs courriers."
              : "Vos modifications de dernière minute seront appliquées sur le PDF de cette entreprise."}
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-200 transition-colors">
              Annuler
            </button>
            {isTemplateMode ? (
              <button onClick={handleSaveGlobalTemplate} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md transition-all active:scale-95">
                <Save size={16} />
                Enregistrer la trame
              </button>
            ) : (
              <button onClick={handleDownloadPDF} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-md transition-all active:scale-95">
                <FileOutput size={16} />
                Télécharger le PDF final
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

// ── 4. VUE PRINCIPALE DU TAB ──────────────────────────────────────────────────

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
  bpuRefMap = new Map()
}) => {
  const [masterTemplate, setMasterTemplate] = useState(DEFAULT_TEMPLATE);
  const [editorData, setEditorData] = useState({ isOpen: false, mode: 'company', html: '', companyName: '' });

  const [letterConfig, setLetterConfig] = useState({
    deadline: '',
    signatoryName: consultation.client || '',
    city: consultation.lieu || '',
  });
  const [anomalyThresholds, setAnomalyThresholds] = useState({ ecart: 15, impact: 1 });
  const [showThresholdSettings, setShowThresholdSettings] = useState(false);

  const updateConfig = (key, value) => setLetterConfig(prev => ({ ...prev, [key]: value }));

  const openTemplateEditor = () => {
    setEditorData({ isOpen: true, mode: 'template', html: masterTemplate, companyName: 'Modèle Global' });
  };

  const openCompanyEditor = (companyName, questions) => {
    const injectedHtml = applyTemplate(masterTemplate, companyName, questions, letterConfig, consultation);
    setEditorData({ isOpen: true, mode: 'company', html: injectedHtml, companyName });
  };

  // ── Logique complétion pour sidebar ──
  const getNegoCompletion = (companyName) => {
    const nego = companiesData[companyName]?.negotiation || {};
    const hasQuestions = !!nego.questions;
    const hasResponses = !!nego.responses;
    if (hasQuestions && hasResponses) return 'complete';
    if (hasQuestions || hasResponses) return 'partial';
    return 'empty';
  };

  // ── DÉTECTION DES PRIX ATYPIQUES (HAUTS ET BAS) ────────────────────────
  const generateAnomaliesText = (companyName) => {
    const company = analysisCompanies.find(c => c.name === companyName);

    if (!company) {
      toast.warning(`Entreprise "${companyName}" introuvable dans les données d'analyse. Vérifiez que l'import est bien effectué.`);
      return;
    }
    if (!chaptersData?.length || !analysisStats) {
      toast.warning("Les données d'analyse financière ne sont pas disponibles. Veuillez d'abord importer les offres dans l'onglet Analyse.");
      return;
    }

    let lowPrices = [];
    let highPrices = [];
    const companyGrandTotal = analysisStats.companiesTotals?.[company.id] || 0;
    if (companyGrandTotal === 0) {
      toast.warning(`Aucune offre chiffrée trouvée pour "${companyName}". Vérifiez que l'import Excel est complet.`);
      return;
    }

    chaptersData.forEach(chapter => {
      chapter.items.forEach(item => {
        const cd = item.companyData?.[company.id];
        if (!cd) return;

        const companyPU   = cd.pu || 0;
        const activeQty   = item.activeQty || 0;
        const lineTotal   = cd.lineTotal || (companyPU * activeQty);
        if (companyPU === 0) return;

        const allPUs = analysisCompanies
          .map(co => Number(co.offers?.[item.id] ?? 0))
          .filter(p => p !== 0);
        if (allPUs.length < 2) return;
        const averagePU = allPUs.reduce((a, b) => a + b, 0) / allPUs.length;

        const diffRatio  = (companyPU - averagePU) / averagePU;
        const impactRatio = lineTotal / companyGrandTotal;

        if (Math.abs(diffRatio) > (anomalyThresholds.ecart / 100) && impactRatio > (anomalyThresholds.impact / 100)) {
          const diffPercent  = Math.abs(Math.round(diffRatio * 100));
          const puFormatted  = companyPU.toLocaleString('fr-FR', { minimumFractionDigits: 2 });
          const refLabel     = bpuRefMap?.get?.(item.id) || item.bpuNum || item.ref || '—';
          const label        = item.designation || item.name || '';
          const itemText = `- Prix n°${refLabel} — ${label} : PU proposé de ${puFormatted} €.`;

          if (diffRatio > 0) highPrices.push(itemText);
          else               lowPrices.push(itemText);
        }
      });
    });

    let finalAdditions = [];

    if (lowPrices.length > 0) {
      finalAdditions.push(
        "➡️ SUSPICION DE PRIX ANORMALEMENT BAS (art. L.2152-6 et R.2152-3 du Code de la commande publique) :\n" +
        "Conformément aux articles L.2152-6 et R.2152-3 du Code de la commande publique, l'acheteur a l'obligation de détecter les offres qui paraissent anormalement basses et d'exiger des justifications avant tout rejet éventuel.\n" +
        "Les prix unitaires suivants paraissent anormalement bas au regard de l'estimation du maître d'œuvre et ont une incidence significative sur le montant global de votre proposition. Nous vous demandons de bien vouloir fournir, pour chacun de ces prix, les justifications prévues à l'article R.2152-3, notamment :\n" +
        "- Le mode opératoire et les procédés de construction retenus ;\n" +
        "- Les conditions exceptionnellement favorables dont vous disposez (approvisionnement, moyens propres, etc.) ;\n" +
        "- Les sous-détails de prix complets (fournitures, main-d'œuvre, matériel, frais généraux et marge).\n\n" +
        "À défaut de justifications satisfaisantes, l'acheteur pourra rejeter votre offre comme anormalement basse en application de l'article L.2152-6.\n\n" +
        "Articles concernés :\n" +
        lowPrices.join('\n')
      );
    }

    if (highPrices.length > 0) {
      finalAdditions.push(
        "➡️ PRIX PARAISSANT EXCESSIFS (art. R.2152-3 du Code de la commande publique) :\n" +
        "Les prix unitaires suivants se situent nettement au-dessus de l'estimation du maître d'œuvre et pèsent significativement sur le montant global de votre proposition. Conformément à l'article R.2152-3, nous vous invitons à :\n" +
        "- Vérifier qu'il ne s'agit pas d'une erreur matérielle de chiffrage ;\n" +
        "- Fournir les sous-détails de prix justifiant ces montants ;\n" +
        "- Le cas échéant, dans le cadre de la négociation, reconsidérer ces prix afin d'améliorer la compétitivité de votre offre.\n\n" +
        "Articles concernés :\n" +
        highPrices.join('\n')
      );
    }

    if (finalAdditions.length > 0) {
      const currentQuestions = companiesData[companyName]?.negotiation?.questions || '';
      const spacer = currentQuestions ? '\n\n' : '';
      updateNegotiation(companyName, 'questions', currentQuestions + spacer + finalAdditions.join('\n\n'));
    } else {
      toast.info(`Aucun prix atypique détecté (seuils : écart > ${anomalyThresholds.ecart}% de la moyenne ET impact > ${anomalyThresholds.impact}% de l'offre totale).`);
    }
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
        <div className="max-w-7xl mx-auto space-y-6 pb-24">

          <LetterEditorModal
            isOpen={editorData.isOpen}
            mode={editorData.mode}
            onClose={() => setEditorData({ ...editorData, isOpen: false })}
            initialHtml={editorData.html}
            companyName={editorData.companyName}
            onSaveTemplate={(newHtml) => setMasterTemplate(newHtml)}
          />

          {/* ── Bloc config global ── */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
            <FileOutput size={160} className="absolute -right-10 -bottom-10 text-white opacity-5 rotate-12" />
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/10 rounded-xl border border-white/10">
                    <FileOutput size={20} className="text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-white">Générateur de Courriers & Négociation</h3>
                    <p className="text-sm text-slate-300 mt-0.5 font-medium">Paramétrez les variables globales et votre trame de courrier.</p>
                  </div>
                </div>
                <button
                  onClick={openTemplateEditor}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 backdrop-blur-sm"
                >
                  <Settings size={18} />
                  Personnaliser la trame (Modèle)
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-300">
                    <MapPin size={14} /> Ville d'émission
                  </label>
                  <input
                    type="text" value={letterConfig.city} onChange={e => updateConfig('city', e.target.value)} placeholder="Ex: Sieurac"
                    className="w-full bg-slate-800/50 border border-white/20 rounded-xl px-4 py-3 text-sm text-white font-semibold placeholder:text-slate-400 focus:outline-none focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/80 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-300">
                    <Calendar size={14} /> Date & Heure limite
                  </label>
                  <input
                    type="datetime-local" value={letterConfig.deadline} onChange={e => updateConfig('deadline', e.target.value)}
                    className="w-full bg-slate-800/50 border border-white/20 rounded-xl px-4 py-3 text-sm text-white font-semibold placeholder:text-slate-400 focus:outline-none focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/80 transition-all [color-scheme:dark]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-300">
                    <User size={14} /> Signataire
                  </label>
                  <input
                    type="text" value={letterConfig.signatoryName} onChange={e => updateConfig('signatoryName', e.target.value)} placeholder="Ex: Fabrice Marcuzzo, Maire"
                    className="w-full bg-slate-800/50 border border-white/20 rounded-xl px-4 py-3 text-sm text-white font-semibold placeholder:text-slate-400 focus:outline-none focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/80 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

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

          {/* ── Contenu : Questions + Réponses ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Colonne 1 : Saisie Questions & Génération */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
              <div className="p-6 flex flex-col">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <h4 className="text-base font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
                    <MessageSquare size={20} className="text-blue-600" /> Questions spécifiques
                  </h4>

                  <div className="flex items-center gap-1.5 relative">
                    <button
                      onClick={() => generateAnomaliesText(name)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95"
                      title="Détecter les prix atypiques (hauts et bas) qui influencent fortement l'offre"
                    >
                      <Wand2 size={14} />
                      Prix atypiques
                    </button>
                    <button
                      onClick={() => setShowThresholdSettings(!showThresholdSettings)}
                      className={`p-1.5 rounded-lg border transition-all ${showThresholdSettings ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200'}`}
                      title="Réglages des seuils de détection"
                    >
                      <SlidersHorizontal size={14} />
                    </button>

                    {/* Popover réglages */}
                    {showThresholdSettings && (
                      <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <h5 className="text-sm font-black text-slate-800 flex items-center gap-2">
                            <SlidersHorizontal size={16} className="text-indigo-500" />
                            Seuils de détection
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
                          Réinitialiser (15% / 1%)
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <Textarea
                  value={nego.questions}
                  onChange={v => updateNegotiation(name, 'questions', v)}
                  placeholder="Listez ici les questions spécifiques à cette entreprise.&#10;Ex:&#10;- Pouvez-vous justifier le PU du bordereau n°4 ?&#10;- Votre variante est irrecevable..."
                  rows={4}
                  className="bg-white border-slate-300 shadow-sm rounded-2xl text-slate-900 font-medium text-[15px] leading-relaxed placeholder:text-slate-400 focus:ring-blue-500/20 min-h-[120px]"
                />
              </div>

              <div className="bg-slate-100/50 border-t border-slate-200 px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-xs font-bold text-slate-600 max-w-[200px] leading-snug">
                  La trame officielle sera injectée avec vos questions spécifiques.
                </span>

                <button
                  onClick={() => openCompanyEditor(name, nego.questions)}
                  className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-black transition-all shadow-md active:scale-95 bg-slate-900 hover:bg-slate-800 text-white"
                >
                  <Edit3 size={18} />
                  Aperçu & Téléchargement
                </button>
              </div>
            </div>

            {/* Colonne 2 : Suivi des réponses */}
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
              <h4 className="text-base font-black uppercase tracking-widest text-slate-900 mb-4 flex items-center gap-2">
                <CheckCircle2 size={20} className="text-emerald-600" /> Réponses & Engagements
              </h4>
              <Textarea
                value={nego.responses}
                onChange={v => updateNegotiation(name, 'responses', v)}
                placeholder="Consignez ici les retours de l'entreprise après l'envoi du courrier."
                rows={4}
                className="bg-white border-slate-300 shadow-sm rounded-2xl text-slate-900 font-medium text-[15px] leading-relaxed placeholder:text-slate-400 focus:ring-emerald-500/20 min-h-[120px]"
              />
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

export default TabNegociation;
