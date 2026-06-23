// src/components/rao/tabs/TabNegociation.jsx
//
// Onglet « Négociation » du RAO. Orchestrateur fin : reconstitue la config
// courrier, câble le hook métier useNegoLetter et compose les sous-vues
// (modale trame, contrôles prix atypiques, aperçu A4, sidebar config).
//
// Logique extraite dans :
//   - hooks/useNegoLetter.js          (état + détection/injection anomalies)
//   - rao/tabs/nego/negoLetterUtils.js (fonctions pures HTML/trame, testées)
//   - rao/tabs/nego/negoTemplates.js   (trames & constantes)
//   - rao/tabs/nego/*.jsx              (sous-composants UI)

import React, { useState } from 'react';
import {
  CheckCircle2, FileOutput, Settings, ChevronDown, ChevronUp, RotateCcw, FileText,
} from 'lucide-react';

import { Textarea } from '../RaoUI';
import { COMPANY_UI_COLORS } from '../RaoConstants';
import CompanySidebar from '../CompanySidebar';
import { toast } from '../../../utils/globalUI';
import { useNegoTemplate } from '../../../hooks/useNegoTemplate';
import { useNegoLetter } from '../../../hooks/useNegoLetter';

import { DEFAULT_TEMPLATE } from './nego/negoTemplates';
import TemplateEditorModal from './nego/TemplateEditorModal';
import AnomalyControls from './nego/AnomalyControls';
import NegoLetterPreview from './nego/NegoLetterPreview';
import NegoConfigSidebar from './nego/NegoConfigSidebar';

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
  // Sidebar config courrier : repliable pour gagner de la place sur l'aperçu
  const [configCollapsed, setConfigCollapsed] = useState(false);

  // Config courrier reconstituée à partir de :
  //  - signatoryName + city + deadline : niveau projet (rao.letterConfig) — partagé entre entreprises
  //  - adresseEntreprise : niveau entreprise (nego.adresseEntreprise)
  const negoCurrent = companiesData[selectedCompany]?.negotiation || {};
  const letterConfig = {
    signatoryName: raoLetterConfig?.signatoryName ?? consultation.client ?? '',
    city: raoLetterConfig?.city ?? consultation.lieu ?? '',
    deadline: raoLetterConfig?.deadline ?? negoCurrent.deadline ?? '', // fallback nego pour migration ancienne data
    adresseEntreprise: negoCurrent.adresseEntreprise || '',
    adresseExpediteur: '',
  };

  // Dispatche la mise à jour vers la bonne source :
  //  - signatoryName / city / deadline → niveau projet (rao.letterConfig) — partagé entre entreprises
  //  - adresseEntreprise → niveau entreprise (nego.*)
  const updateConfig = (key, value) => {
    if (key === 'signatoryName' || key === 'city' || key === 'deadline') {
      updateRaoLetterConfig(key, value);
    } else if (key === 'adresseEntreprise') {
      if (selectedCompany) updateNegotiation(selectedCompany, key, value);
    }
  };

  // ── Logique métier (aperçu, détection / injection / reset des prix atypiques) ──
  const {
    letterHtml,
    anomalyMode,
    setAnomalyMode,
    anomalyTemplates,
    saveAnomalyTemplates,
    anomalyThresholds,
    setAnomalyThresholds,
    injectAnomalies,
    resetFromTemplate,
  } = useNegoLetter({
    selectedCompany, masterTemplate, letterConfig, consultation, project,
    analysisCompanies, chaptersData, analysisStats, bpuRefMap, companiesData, updateNegotiation,
  });

  // ── Complétion pour la sidebar entreprises ──
  const getNegoCompletion = (companyName) => {
    const nego = companiesData[companyName]?.negotiation || {};
    const hasContent = !!nego.questions;
    const hasResponses = !!nego.responses;
    if (hasContent && hasResponses) return 'complete';
    if (hasContent || hasResponses) return 'partial';
    return 'empty';
  };

  // ── Téléchargement PDF ──
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
              // Données venant de la fiche projet (ProjectDetailsModal) en priorité,
              // fallback consultation rao si l'utilisateur a édité manuellement
              '{{NOM_ENTREPRISE}}':     selectedCompany || '',
              '{{ADRESSE_ENTREPRISE}}': letterConfig.adresseEntreprise || '',
              '{{OBJET_MARCHE}}':       project?.name || consultation?.objet || '',
              '{{CODE_AFFAIRE}}':       project?.code || consultation?.code || '',
              '{{CLIENT}}':             project?.client || consultation?.client || '',
              '{{ADRESSE_EXPEDITEUR}}': [project?.client, project?.clientAddress, [project?.clientZip, project?.clientCity].filter(Boolean).join(' ')].filter(Boolean).join('\n'),
              '{{MOE}}':                project?.moe || consultation?.moe || '',
              '{{LIEU}}':               project?.location || consultation?.lieu || '',
              '{{PHASE}}':              'ACT', // forcée dans le RAO
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

            {/* ── Colonne principale : courrier + accordéon ── */}
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
                  <AnomalyControls
                    onInject={injectAnomalies}
                    thresholds={anomalyThresholds}
                    setThresholds={setAnomalyThresholds}
                    mode={anomalyMode}
                    setMode={setAnomalyMode}
                    templates={anomalyTemplates}
                    onSaveTemplates={saveAnomalyTemplates}
                  />
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

              {/* ── Aperçu A4 read-only (fidèle au PDF) ── */}
              <NegoLetterPreview
                letterHtml={letterHtml}
                branding={branding}
                project={project}
                selectedCompany={selectedCompany}
                consultation={consultation}
                letterConfig={letterConfig}
              />

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

            {/* ── Sidebar config latérale (sticky) ── */}
            <NegoConfigSidebar
              letterConfig={letterConfig}
              project={project}
              collapsed={configCollapsed}
              setCollapsed={setConfigCollapsed}
              updateConfig={updateConfig}
            />

          </div> {/* /flex */}

        </div>
      </div>
    </div>
  );
};

export default TabNegociation;
