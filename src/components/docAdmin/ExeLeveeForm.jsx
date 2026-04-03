// src/components/docAdmin/ExeLeveeForm.jsx
// Formulaire unifié EXE8 / EXE9 — Levée des Réserves
// Mode clair, largeur A4, reproduisant la mise en page du formulaire officiel DAJ
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  ArrowLeft, FileText, FileDown, Loader, Save,
  Calendar, UserCheck, Pen
} from 'lucide-react';
import { RibbonGroup, RibbonBtnLarge, RibbonContainer, RibbonHeader, RibbonSpacer } from '../common/RibbonParts';
import {
  createEmptyReceptionData, getDateFinRevisee,
  PdfDocumentHeader, PdfSectionHeader, ReadOnlySectionsAD,
  Field, ChoiceGroup, PdfCheckItem
} from './ExeReceptionForm';

// ═══════════════════════════════════════════════════════════════════════════
// Sous-composant — Maintien des réserves (5 checkboxes)
// ═══════════════════════════════════════════════════════════════════════════
const MaintienSubItems = ({ prefix, data, update, formatDateFR }) => (
  <div className="space-y-3 p-3 rounded-md bg-amber-50 border border-amber-200 ml-4">
    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Il est proposé de maintenir les réserves suivantes :</p>
    <PdfCheckItem checked={data[`${prefix}MaintienEpreuves`]} onChange={() => update(`${prefix}MaintienEpreuves`, !data[`${prefix}MaintienEpreuves`])} label="4.1 l'exécution des épreuves (annexe ci-jointe)" indent={1} />
    {data[`${prefix}MaintienEpreuves`] && (
      <div className="pl-6 -mt-1 mb-1"><Field label="N° annexe" value={data[`${prefix}MaintienEpreuvesAnnexe`]} onChange={(v) => update(`${prefix}MaintienEpreuvesAnnexe`, v)} placeholder="N° annexe..." /></div>
    )}
    <PdfCheckItem checked={data[`${prefix}MaintienTravaux`]} onChange={() => update(`${prefix}MaintienTravaux`, !data[`${prefix}MaintienTravaux`])} label="4.2 l'exécution des travaux et prestations (annexe ci-jointe)" indent={1} />
    {data[`${prefix}MaintienTravaux`] && (
      <div className="pl-6 -mt-1 mb-1"><Field label="N° annexe" value={data[`${prefix}MaintienTravauxAnnexe`]} onChange={(v) => update(`${prefix}MaintienTravauxAnnexe`, v)} placeholder="N° annexe..." /></div>
    )}
    <PdfCheckItem checked={data[`${prefix}MaintienImperfections`]} onChange={() => update(`${prefix}MaintienImperfections`, !data[`${prefix}MaintienImperfections`])} label="4.3 la correction des imperfections et malfaçons (annexe ci-jointe)" indent={1} />
    {data[`${prefix}MaintienImperfections`] && (
      <div className="pl-6 -mt-1 mb-1"><Field label="N° annexe" value={data[`${prefix}MaintienImperfectionsAnnexe`]} onChange={(v) => update(`${prefix}MaintienImperfectionsAnnexe`, v)} placeholder="N° annexe..." /></div>
    )}
    <PdfCheckItem checked={data[`${prefix}MaintienInstallations`]} onChange={() => update(`${prefix}MaintienInstallations`, !data[`${prefix}MaintienInstallations`])} label="4.4 les installations de chantier doivent être repliées et les terrains remis en état" indent={1} />
    {data[`${prefix}MaintienInstallations`] && (
      <div className="pl-6 -mt-1 mb-1"><Field label="Avant le" value={data[`${prefix}MaintienInstallationsDate`]} onChange={(v) => update(`${prefix}MaintienInstallationsDate`, v)} type="date" /></div>
    )}
    <PdfCheckItem checked={data[`${prefix}MaintienPose`]} onChange={() => update(`${prefix}MaintienPose`, !data[`${prefix}MaintienPose`])} label="4.5 les conditions de pose des équipements doivent être mises en conformité" indent={1} />
    {data[`${prefix}MaintienPose`] && (
      <div className="pl-6 -mt-1 mb-1"><Field label="Avant le" value={data[`${prefix}MaintienPoseDate`]} onChange={(v) => update(`${prefix}MaintienPoseDate`, v)} type="date" /></div>
    )}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// TabEXE8 — PV de levée des réserves (sections E-F + signatures)
// ═══════════════════════════════════════════════════════════════════════════
const TabEXE8 = ({ fiche, data, update }) => {
  const C = fiche?.sectionC || {};
  const D = fiche?.sectionD || {};
  const moeName = C.nomCommercial || C.denominationSociale || '………………………………';

  return (
    <div className="space-y-1">
      <PdfDocumentHeader subtitle="PROCÈS-VERBAL DE LEVÉE DES RÉSERVES" exeCode="EXE8" />
      <ReadOnlySectionsAD fiche={fiche} sectionATitle="Identification du pouvoir adjudicateur ou de l'entité adjudicatrice" />

      {/* Section E */}
      <PdfSectionHeader letter="E" title="Objet du procès-verbal de levée des réserves" />
      <div className="pl-1 space-y-3">
        <p className="text-[12px] text-gray-700">La levée des réserves porte sur :</p>
        <PdfCheckItem checked={data.porteeReception === 'globale'} label="la réception de l'ouvrage comportant les prestations suivantes :" onChange={() => update('porteeReception', 'globale')} />
        {data.porteeReception === 'globale' && (
          <div className="pl-8">
            <div className="px-3.5 py-2.5 rounded-md bg-gray-50 border border-gray-200 text-sm text-gray-600">
              {D.objet || <span className="italic text-gray-400">Non renseigné</span>}
            </div>
          </div>
        )}
        <PdfCheckItem checked={data.porteeReception === 'partielle'} label="la réception partielle de l'ouvrage relative aux prestations désignées ci-dessous :" onChange={() => update('porteeReception', 'partielle')} />
        {data.porteeReception === 'partielle' && (
          <div className="pl-8">
            <Field label="Désignation des prestations" value={data.designationPartielle} onChange={(v) => update('designationPartielle', v)} rows={2} placeholder="Prestations concernées..." />
          </div>
        )}
      </div>

      {/* Section F */}
      <PdfSectionHeader letter="F" title="Procès-verbal de levée des réserves" />
      <div className="pl-1 space-y-5">
        <p className="text-[12px] text-gray-700 leading-relaxed">
          Je soussigné, <strong className="text-gray-900">{moeName}</strong>, maître d'œuvre,
        </p>

        {/* Présences */}
        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-1.5"><UserCheck size={12} /> Présences</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ChoiceGroup
              label="Représentant du pouvoir adjudicateur" value={data.exe8_presencePA} onChange={(v) => update('exe8_presencePA', v)}
              options={[{ value: 'present', label: 'Présent' }, { value: 'absent_avise', label: 'Absent dûment avisé' }]}
            />
            <div className="space-y-2">
              <ChoiceGroup
                label="Titulaire du marché" value={data.exe8_presenceTitulaire} onChange={(v) => update('exe8_presenceTitulaire', v)}
                options={[{ value: 'present', label: 'Présent' }, { value: 'absent_convoque', label: 'Absent dûment convoqué' }]}
              />
              {data.exe8_presenceTitulaire === 'absent_convoque' && (
                <Field label="Date de convocation par courrier" value={data.exe8_dateConvocationTitulaire} onChange={(v) => update('exe8_dateConvocationTitulaire', v)} type="date" />
              )}
            </div>
          </div>
        </div>

        <p className="text-[12px] text-gray-700 italic">après avoir procédé aux examens et vérifications nécessaires, constate que :</p>

        {/* 6 Constatations */}
        <div className="space-y-5 p-4 rounded-lg bg-gray-50 border border-gray-200">
          <div className="space-y-2">
            <p className="text-[12px] font-bold text-gray-800">1. les épreuves, prévues au marché public :</p>
            <ChoiceGroup value={data.exe8_epreuves} onChange={(v) => update('exe8_epreuves', v)} options={[
              { value: 'non_effectuees', label: "N'ont pas été effectuées" },
              { value: 'effectuees', label: 'Effectuées (avec exceptions)' },
            ]} />
            {data.exe8_epreuves === 'effectuees' && (
              <div className="pl-4 space-y-2">
                <Field label="N° annexe exceptions" value={data.exe8_epreuvesExceptions} onChange={(v) => update('exe8_epreuvesExceptions', v)} placeholder="N° annexe..." />
                <ChoiceGroup label="Et sont :" value={data.exe8_epreuvesConcluantes} onChange={(v) => update('exe8_epreuvesConcluantes', v)} options={[
                  { value: 'concluantes', label: 'Concluantes' },
                  { value: 'exceptions', label: 'Concluantes avec exceptions' },
                ]} />
                {data.exe8_epreuvesConcluantes === 'exceptions' && (
                  <Field label="N° annexe exceptions concluantes" value={data.exe8_epreuvesConcluantesExceptions} onChange={(v) => update('exe8_epreuvesConcluantesExceptions', v)} placeholder="N° annexe..." />
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-[12px] font-bold text-gray-800">2. les travaux et prestations, ayant fait l'objet de réserves :</p>
            <ChoiceGroup value={data.exe8_travauxExecutes} onChange={(v) => update('exe8_travauxExecutes', v)} options={[
              { value: 'oui', label: 'Ont été exécutés' }, { value: 'exceptions', label: 'Exécutés avec exceptions' },
            ]} />
            {data.exe8_travauxExecutes === 'exceptions' && <Field label="N° annexe" value={data.exe8_travauxExceptions} onChange={(v) => update('exe8_travauxExceptions', v)} placeholder="N° annexe..." />}
          </div>

          <div className="space-y-2">
            <p className="text-[12px] font-bold text-gray-800">3. les ouvrages :</p>
            <ChoiceGroup value={data.exe8_ouvragesConformes} onChange={(v) => update('exe8_ouvragesConformes', v)} options={[
              { value: 'oui', label: 'Conformes (corrigées)' }, { value: 'exceptions', label: 'Exceptions (non corrigées)' },
            ]} />
            {data.exe8_ouvragesConformes === 'exceptions' && <Field label="N° annexe" value={data.exe8_ouvragesExceptions} onChange={(v) => update('exe8_ouvragesExceptions', v)} placeholder="N° annexe..." />}
          </div>

          <div className="space-y-2">
            <p className="text-[12px] font-bold text-gray-800">4. les conditions de pose des équipements :</p>
            <ChoiceGroup value={data.exe8_poseEquipements} onChange={(v) => update('exe8_poseEquipements', v)} options={[
              { value: 'conforme', label: 'Conformes' }, { value: 'non_conforme', label: 'Non conformes' },
            ]} />
          </div>

          <div className="space-y-2">
            <p className="text-[12px] font-bold text-gray-800">5. les installations de chantier :</p>
            <ChoiceGroup value={data.exe8_repliInstallations} onChange={(v) => update('exe8_repliInstallations', v)} options={[
              { value: 'oui', label: 'Ont été repliées' }, { value: 'non', label: "N'ont pas été repliées" },
            ]} />
          </div>

          <div className="space-y-2">
            <p className="text-[12px] font-bold text-gray-800">6. les terrains et les lieux :</p>
            <ChoiceGroup value={data.exe8_remiseEnEtatTerrains} onChange={(v) => update('exe8_remiseEnEtatTerrains', v)} options={[
              { value: 'oui', label: 'Ont été remis en état' }, { value: 'non', label: "N'ont pas été remis en état" },
            ]} />
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-200">
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Dressé par le Maître d'œuvre</p>
            <Field label="Dressé le" value={data.exe8_dateSignatureMoe} onChange={(v) => update('exe8_dateSignatureMoe', v)} type="date" />
          </div>
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Accepté par le Titulaire</p>
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${data.exe8_refusSignatureTitulaire ? 'bg-red-500 border-red-500' : 'bg-white border-gray-300 group-hover:border-gray-400'}`}>
                {data.exe8_refusSignatureTitulaire && <span className="text-white text-xs font-black">✓</span>}
              </div>
              <input type="checkbox" className="hidden" checked={data.exe8_refusSignatureTitulaire} onChange={(e) => update('exe8_refusSignatureTitulaire', e.target.checked)} />
              <span className="text-[11px] text-gray-600">Le titulaire a refusé de signer le PV</span>
            </label>
            {!data.exe8_refusSignatureTitulaire && (
              <Field label="Accepté le" value={data.exe8_dateSignatureTitulaire} onChange={(v) => update('exe8_dateSignatureTitulaire', v)} type="date" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// TabEXE9 — Propositions MOE + Décision MO (sections E-I)
// ═══════════════════════════════════════════════════════════════════════════
const TabEXE9 = ({ fiche, data, update }) => {
  const D = fiche?.sectionD || {};
  const formatDateFR = (s) => { if (!s) return '………………'; try { return new Date(s).toLocaleDateString('fr-FR'); } catch { return s; } };

  return (
    <div className="space-y-1">
      <PdfDocumentHeader subtitle="PROPOSITIONS DU MAÎTRE D'ŒUVRE ET DÉCISION DU MAÎTRE DE L'OUVRAGE RELATIVES À LA LEVÉE DES RÉSERVES" exeCode="EXE9" />
      <ReadOnlySectionsAD fiche={fiche} sectionATitle="Identification du maître de l'ouvrage" />

      {/* Section E */}
      <PdfSectionHeader letter="E" title="Objet de la levée des réserves" />
      <div className="pl-1 space-y-3">
        <p className="text-[12px] text-gray-700">La levée des réserves porte sur :</p>
        <PdfCheckItem checked={data.porteeReception === 'globale'} label="la réception de l'ouvrage comportant les prestations suivantes :" />
        {data.porteeReception === 'globale' && (
          <div className="pl-8">
            <div className="px-3.5 py-2.5 rounded-md bg-gray-50 border border-gray-200 text-sm text-gray-600">{D.objet || <span className="italic text-gray-400">Non renseigné</span>}</div>
          </div>
        )}
        <PdfCheckItem checked={data.porteeReception === 'partielle'} label="la réception partielle de l'ouvrage relative aux prestations désignées ci-dessous :" />
        {data.porteeReception === 'partielle' && (
          <div className="pl-8">
            <div className="px-3.5 py-2.5 rounded-md bg-gray-50 border border-gray-200 text-sm text-gray-600">{data.designationPartielle || <span className="italic text-gray-400">Non renseigné</span>}</div>
          </div>
        )}
      </div>

      {/* Section F — Propositions MOE */}
      <PdfSectionHeader letter="F" title="Propositions du maître d'œuvre relatives au procès-verbal de levée des réserves" />
      <div className="pl-1 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Date du PV de levée des réserves (EXE8)" value={data.exe9_datePVLevee} onChange={(v) => update('exe9_datePVLevee', v)} type="date" icon={Calendar} />
          <Field label="Date de la décision de réception" value={data.exe9_dateDecisionReception} onChange={(v) => update('exe9_dateDecisionReception', v)} type="date" icon={Calendar} />
        </div>

        <p className="text-[12px] text-gray-700">Au vu du procès-verbal de levée des réserves, en date du <strong>{formatDateFR(data.exe9_datePVLevee)}</strong>, je soussigné, maître d'œuvre, propose :</p>

        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-4">
          <ChoiceGroup
            label="Proposition du Maître d'Œuvre" value={data.exe9_propositionMoe} onChange={(v) => update('exe9_propositionMoe', v)}
            options={[
              { value: 'rapporter', label: '1. Rapporter la réception' },
              { value: 'lever_toutes', label: '2. Lever toutes les réserves' },
              { value: 'maintenir_toutes', label: '3. Maintenir toutes les réserves' },
              { value: 'lever_partielles', label: '4. Lever partiellement' },
            ]}
          />
          {data.exe9_propositionMoe === 'lever_partielles' && (
            <div className="space-y-3">
              <Field label="N° annexe des réserves levées" value={data.exe9_annexeLevee} onChange={(v) => update('exe9_annexeLevee', v)} placeholder="N° annexe..." />
              <MaintienSubItems prefix="exe9_" data={data} update={update} formatDateFR={formatDateFR} />
            </div>
          )}
        </div>
      </div>

      {/* Section G — Signature MOE */}
      <PdfSectionHeader letter="G" title="Signature du maître d'œuvre" />
      <div className="pl-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="À ..." value={data.exe9_lieuSignatureMoe} onChange={(v) => update('exe9_lieuSignatureMoe', v)} placeholder="Ville" icon={Pen} />
          <Field label="Le ..." value={data.exe9_dateSignatureMoe} onChange={(v) => update('exe9_dateSignatureMoe', v)} type="date" />
        </div>
      </div>

      {/* Section H — Décision MO */}
      <PdfSectionHeader letter="H" title="Décision du maître de l'ouvrage" />
      <div className="pl-1 space-y-5">
        <Field label="Date des propositions du maître d'œuvre" value={data.exe9_datePropositionsMoe} onChange={(v) => update('exe9_datePropositionsMoe', v)} type="date" icon={Calendar} />
        <p className="text-[12px] text-gray-700">
          Au vu du procès-verbal de levée des réserves, en date du <strong>{formatDateFR(data.exe9_datePVLevee)}</strong>, et des propositions complémentaires présentées le <strong>{formatDateFR(data.exe9_datePropositionsMoe)}</strong> par le maître d'œuvre ; le maître de l'ouvrage décide :
        </p>

        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-4">
          <ChoiceGroup
            label="Décision du Maître de l'ouvrage" value={data.exe9_decisionMO} onChange={(v) => update('exe9_decisionMO', v)}
            options={[
              { value: 'accepter', label: '1. Accepter les propositions' },
              { value: 'ne_pas_retenir', label: '2. Ne pas retenir' },
            ]}
          />
          {data.exe9_decisionMO === 'ne_pas_retenir' && (
            <div className="space-y-4 pl-3 border-l-3 border-red-400 ml-2">
              <Field label="Date de la décision de réception" value={data.exe9_decisionDateReception} onChange={(v) => update('exe9_decisionDateReception', v)} type="date" icon={Calendar} />
              <ChoiceGroup
                label="Sous-décision" value={data.exe9_decisionSub} onChange={(v) => update('exe9_decisionSub', v)}
                options={[
                  { value: 'rapporter', label: '2.1 Rapporter' },
                  { value: 'lever_toutes', label: '2.2 Lever toutes' },
                  { value: 'maintenir_toutes', label: '2.3 Maintenir toutes' },
                  { value: 'lever_partielles', label: '2.4 Lever partiellement' },
                ]}
              />
              {data.exe9_decisionSub === 'lever_partielles' && (
                <div className="space-y-3">
                  <Field label="N° annexe des réserves levées" value={data.exe9_decisionAnnexeLevee} onChange={(v) => update('exe9_decisionAnnexeLevee', v)} placeholder="N° annexe..." />
                  <MaintienSubItems prefix="exe9_decision" data={data} update={update} formatDateFR={formatDateFR} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Section I — Signature MO */}
      <PdfSectionHeader letter="I" title="Signature du maître de l'ouvrage" />
      <div className="pl-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="À ..." value={data.exe9_lieuSignatureMO} onChange={(v) => update('exe9_lieuSignatureMO', v)} placeholder="Ville" icon={Pen} />
          <Field label="Le ..." value={data.exe9_dateSignatureMO} onChange={(v) => update('exe9_dateSignatureMO', v)} type="date" />
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Composant principal — ExeLeveeForm
// ═══════════════════════════════════════════════════════════════════════════
export default function ExeLeveeForm({ fiche, onBack, onGenerate, onSave, isSaving }) {
  const [data, setData] = useState(() => ({ ...createEmptyReceptionData(), ...(fiche?.reception || {}) }));
  const [activeTab, setActiveTab] = useState('exe8');
  const [isGenerating, setIsGenerating] = useState(null);
  const scrollRef = useRef(null);

  const update = useCallback((field, value) => setData((p) => ({ ...p, [field]: value })), []);

  // Auto-save (same pattern as ExeReceptionForm)
  const saveTimeoutRef = useRef(null);
  const lastSavedDataRef = useRef(JSON.stringify(data));
  useEffect(() => {
    const currentDataString = JSON.stringify(data);
    if (currentDataString === lastSavedDataRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      if (onSave) {
        await onSave({ ...fiche, reception: data });
        lastSavedDataRef.current = currentDataString;
      }
    }, 1500);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [data, fiche, onSave]);

  // Scroll to top on tab change
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [activeTab]);

  // Generate & save
  const handleGenerate = async (format) => {
    const exeType = activeTab;
    const key = `${exeType}-${format}`;
    setIsGenerating(key);
    try { await onGenerate(exeType, data, format); } finally { setIsGenerating(null); }
  };
  const handleSave = async () => {
    if (onSave) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      await onSave({ ...fiche, reception: data });
      lastSavedDataRef.current = JSON.stringify(data);
    }
  };

  const tabLabels = { exe8: 'EXE8 — PV Levée Réserves', exe9: 'EXE9 — Décision Levée' };
  const tabAccent = { exe8: 'text-amber-500', exe9: 'text-purple-500' };

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      <div className="font-[system-ui,'Segoe_UI',sans-serif] select-none shrink-0 z-10">
        <RibbonHeader
          title={fiche?.nom || 'Sans nom'}
          tabs={[
            { id: 'exe8', label: 'EXE8 — PV Levée Réserves' },
            { id: 'exe9', label: 'EXE9 — Décision Levée' },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          rightContent={isSaving ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-purple-600">
              <Loader size={10} className="animate-spin" /> Sauvegarde...
            </span>
          ) : null}
        />
        <RibbonContainer>
          <RibbonGroup label="Navigation">
            <RibbonBtnLarge icon={ArrowLeft} label="Retour" onClick={onBack} title="Retour à la fiche marché" />
          </RibbonGroup>
          <RibbonGroup label="Enregistrer">
            <RibbonBtnLarge icon={Save} label={isSaving ? 'Enreg...' : 'Enregistrer'} onClick={handleSave} disabled={isSaving} accent="text-purple-500" title="Enregistrer" />
          </RibbonGroup>
          <RibbonSpacer />
          <RibbonGroup label={tabLabels[activeTab]} noBorder>
            <RibbonBtnLarge icon={FileText} label={isGenerating === `${activeTab}-docx` ? 'Word...' : 'Word'} onClick={() => handleGenerate('docx')} disabled={!!isGenerating} accent={tabAccent[activeTab]} title={`Générer ${activeTab.toUpperCase()} en .docx`} />
            <RibbonBtnLarge icon={FileDown} label={isGenerating === `${activeTab}-pdf` ? 'PDF...' : 'PDF'} onClick={() => handleGenerate('pdf')} disabled={!!isGenerating} accent="text-red-500" title={`Générer ${activeTab.toUpperCase()} en .pdf`} />
          </RibbonGroup>
        </RibbonContainer>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-gray-200 py-8 px-4">
        <div className="mx-auto bg-white shadow-lg rounded-sm px-[20mm] py-[15mm]" style={{ maxWidth: '210mm', minHeight: '297mm' }}>
          {activeTab === 'exe8' && <TabEXE8 fiche={fiche} data={data} update={update} />}
          {activeTab === 'exe9' && <TabEXE9 fiche={fiche} data={data} update={update} />}
        </div>
      </div>
    </div>
  );
}
