/* eslint-disable react-refresh/only-export-components -- fichier mêlant volontairement composants et helpers/constantes (règle DX Fast-Refresh, sans impact fonctionnel) */
// src/components/docAdmin/ExeReceptionForm.jsx
// Formulaire unifié EXE4 / EXE5 / EXE6 — Réception des travaux
// Mode clair, largeur A4, reproduisant la mise en page du formulaire officiel DAJ
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  ArrowLeft, FileText, Plus, Trash2,
  Pen, FileDown, Loader, Save,
  Calendar, UserCheck, ImagePlus, X, MapPin
} from 'lucide-react';
import { RibbonGroup, RibbonBtnLarge, RibbonContainer, RibbonHeader, RibbonSpacer } from '../common/RibbonParts';
import { getDateFinRevisee, createEmptyReceptionData } from './exeReceptionHelpers';
import { useMobileSiteVisits } from '../../hooks/useMobileSiteVisits';
import { useToast } from '../../contexts/ToastContext';
import { getReserveImages, getReserveImageSrc, siteVisitToReserves } from '../../utils/docAdmin/siteVisitReserves';
import SiteVisitReserveImportModal from './SiteVisitReserveImportModal';
import {
  PdfDocumentHeader, PdfSectionHeader, ReadOnlyField, ReadOnlyEntreprise,
  ReadOnlySectionsAD, Field, ChoiceGroup, PdfCheckItem,
} from './exeSharedUI';

// Re-exports pour backward compat (ExeLeveeForm, Exe10Form importent depuis ici)
export { getDateFinRevisee, createEmptyReceptionData } from './exeReceptionHelpers';
export {
  PdfDocumentHeader, PdfSectionHeader, ReadOnlyField, ReadOnlyEntreprise,
  ReadOnlySectionsAD, Field, ChoiceGroup, PdfCheckItem,
} from './exeSharedUI';

// ─── Modèle de données (re-export for backward compat, used locally below) ──

const VisitImportButton = ({ onClick, source }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
  >
    <MapPin size={12} /> {source ? 'Remplacer la visite' : 'Depuis une visite de site'}
  </button>
);

const ReservePhotosEditor = ({ reserve, reserveIndex, updateReserve }) => {
  const images = getReserveImages(reserve);

  const removeImage = (imageIndex) => {
    if (Array.isArray(reserve.images) && reserve.images.length > 0) {
      updateReserve(reserveIndex, 'images', reserve.images.filter((_, index) => index !== imageIndex));
    } else {
      updateReserve(reserveIndex, 'image', null);
    }
  };

  const addImages = async (files) => {
    const selectedFiles = Array.from(files || []);
    if (selectedFiles.length === 0) return;
    const dataUrls = await Promise.all(selectedFiles.map((file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    })));
    updateReserve(reserveIndex, 'images', [...images, ...dataUrls.filter(Boolean)]);
  };

  return (
    <div className="px-2.5 pb-2.5 flex flex-wrap items-center gap-2">
      {images.map((image, imageIndex) => (
        <div key={`${reserve.id || reserveIndex}-${imageIndex}`} className="relative group">
          <img
            src={getReserveImageSrc(image)}
            alt={`Réserve ${reserve.numero} — photo ${imageIndex + 1}`}
            className="h-16 w-20 rounded-lg border border-gray-200 object-cover"
            loading="lazy"
          />
          <button
            type="button"
            onClick={() => removeImage(imageIndex)}
            className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          >
            <X size={10} />
          </button>
        </div>
      ))}
      <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold text-gray-600 bg-gray-50 border border-dashed border-gray-300 hover:border-blue-300 hover:text-blue-600 cursor-pointer transition-colors">
        <ImagePlus size={12} /><span>Ajouter des photos</span>
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            addImages(event.target.files);
            event.target.value = '';
          }}
        />
      </label>
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════════════════
// ONGLET EXE4 — Procès-verbal des opérations préalables à la réception
// ═══════════════════════════════════════════════════════════════════════════
const TabEXE4 = ({ fiche, data, update, updateReserve, addReserve, removeReserve, onOpenVisitImport, dateFinRevisee, dateProposeeError }) => {
  const C = fiche?.sectionC || {};
  const moeName = C.nomCommercial || C.denominationSociale || '………………………………';

  return (
    <div className="space-y-1">
      <PdfDocumentHeader subtitle="PROCÈS-VERBAL DES OPÉRATIONS PRÉALABLES À LA RÉCEPTION" exeCode="EXE4" />
      <ReadOnlySectionsAD fiche={fiche} sectionATitle="Identification du pouvoir adjudicateur ou de l'entité adjudicatrice" />

      {/* ── Section E — Objet des OPR ── */}
      <PdfSectionHeader letter="E" title="Objet des opérations préalables à la réception des ouvrages" />
      <div className="pl-1 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
              <Calendar size={10} className="text-gray-400" /> Fin révisée (calculée)
            </label>
            <div className="px-3.5 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-500 h-10 flex items-center">
              {dateFinRevisee ? dateFinRevisee.toLocaleDateString('fr-FR') : 'Non calculable'}
            </div>
          </div>
          <Field label="Date d'achèvement proposée (titulaire)" value={data.dateAchevementProposee} onChange={(v) => update('dateAchevementProposee', v)} type="date" icon={Calendar} error={dateProposeeError} />
          <Field label="Date des OPR" value={data.dateOPR} onChange={(v) => update('dateOPR', v)} type="date" icon={Calendar} />
        </div>
        <p className="text-[12px] text-gray-700 mt-2">Les opérations préalables à la réception des ouvrages portent sur :</p>
        <ChoiceGroup
          label="Portée de la réception" value={data.porteeReception} onChange={(v) => update('porteeReception', v)}
          options={[{ value: 'globale', label: 'Réception globale de l\'ouvrage' }, { value: 'partielle', label: 'Réception partielle' }]}
        />
        {data.porteeReception === 'partielle' && (
          <Field label="Désignation des prestations (réception partielle)" value={data.designationPartielle} onChange={(v) => update('designationPartielle', v)} rows={2} placeholder="Prestations concernées..." />
        )}
      </div>

      {/* ── Section F — PV des OPR ── */}
      <PdfSectionHeader letter="F" title="Procès-verbal des opérations préalables à la réception des ouvrages" />
      <div className="pl-1 space-y-5">
        <p className="text-[12px] text-gray-700 leading-relaxed">
          Je soussigné, <strong className="text-gray-900">{moeName}</strong>, maître d'œuvre,
        </p>

        {/* Présences */}
        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-1.5"><UserCheck size={12} /> Présences lors des OPR</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ChoiceGroup
              label="Représentant du pouvoir adjudicateur" value={data.presencePA} onChange={(v) => update('presencePA', v)}
              options={[{ value: 'present', label: 'Présent' }, { value: 'absent_avise', label: 'Absent dûment avisé' }]}
            />
            <div className="space-y-2">
              <ChoiceGroup
                label="Titulaire du marché" value={data.presenceTitulaire} onChange={(v) => update('presenceTitulaire', v)}
                options={[{ value: 'present', label: 'Présent' }, { value: 'absent_convoque', label: 'Absent dûment convoqué' }]}
              />
              {data.presenceTitulaire === 'absent_convoque' && (
                <Field label="Date de convocation par courrier" value={data.dateConvocationTitulaire} onChange={(v) => update('dateConvocationTitulaire', v)} type="date" />
              )}
            </div>
          </div>
        </div>

        <p className="text-[12px] text-gray-700 italic">après avoir procédé aux examens et vérifications nécessaires, constate que :</p>

        {/* Constatations — Les 6 points */}
        <div className="space-y-5 p-4 rounded-lg bg-gray-50 border border-gray-200">
          <div className="space-y-2">
            <p className="text-[12px] font-bold text-gray-800">1. les épreuves, prévues au marché public :</p>
            <ChoiceGroup value={data.epreuves} onChange={(v) => update('epreuves', v)} options={[
              { value: 'non_effectuees', label: 'Non effectuées' },
              { value: 'concluantes', label: 'Effectuées et concluantes' },
              { value: 'exceptions', label: 'Concluantes avec exceptions' },
            ]} />
            {data.epreuves === 'exceptions' && <Field label="N° annexe / Détail" value={data.epreuvesExceptions} onChange={(v) => update('epreuvesExceptions', v)} placeholder="N° annexe..." />}
          </div>

          <div className="space-y-2">
            <p className="text-[12px] font-bold text-gray-800">2. les travaux et prestations, prévus au marché public :</p>
            <ChoiceGroup value={data.travauxExputes} onChange={(v) => update('travauxExputes', v)} options={[
              { value: 'oui', label: 'Ont été exécutés' }, { value: 'exceptions', label: 'Exécutés avec exceptions' },
            ]} />
            {data.travauxExputes === 'exceptions' && <Field label="N° annexe / Détail" value={data.travauxExceptions} onChange={(v) => update('travauxExceptions', v)} placeholder="N° annexe..." />}
          </div>

          <div className="space-y-2">
            <p className="text-[12px] font-bold text-gray-800">3. les ouvrages :</p>
            <ChoiceGroup value={data.ouvragesConformes} onChange={(v) => update('ouvragesConformes', v)} options={[
              { value: 'oui', label: 'Conformes aux spécifications' }, { value: 'exceptions', label: 'Imperfections / Malfaçons' },
            ]} />
            {data.ouvragesConformes === 'exceptions' && <Field label="N° annexe / Détail" value={data.ouvragesExceptions} onChange={(v) => update('ouvragesExceptions', v)} placeholder="N° annexe..." />}
          </div>

          <div className="space-y-2">
            <p className="text-[12px] font-bold text-gray-800">4. les conditions de pose des équipements :</p>
            <ChoiceGroup value={data.poseEquipements} onChange={(v) => update('poseEquipements', v)} options={[
              { value: 'conforme', label: 'Conformes aux spécifications fournisseurs' }, { value: 'non_conforme', label: 'Non conformes' },
            ]} />
          </div>

          <div className="space-y-2">
            <p className="text-[12px] font-bold text-gray-800">5. les installations de chantier :</p>
            <ChoiceGroup value={data.repliInstallations} onChange={(v) => update('repliInstallations', v)} options={[
              { value: 'oui', label: 'Ont été repliées' }, { value: 'non', label: 'N\'ont pas été repliées' },
            ]} />
          </div>

          <div className="space-y-2">
            <p className="text-[12px] font-bold text-gray-800">6. les terrains et les lieux :</p>
            <ChoiceGroup value={data.remiseEnEtatTerrains} onChange={(v) => update('remiseEnEtatTerrains', v)} options={[
              { value: 'oui', label: 'Ont été remis en état' }, { value: 'non', label: 'N\'ont pas été remis en état' },
            ]} />
          </div>
        </div>

        {/* ── Réserves (annexe au PV — synchronisées avec EXE5/EXE6) ── */}
        <div className="space-y-3 mt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-600 flex items-center gap-1.5">
                <FileText size={12} /> Annexe — Réserves ({(data.reserves || []).filter(r => r.designation).length})
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <VisitImportButton onClick={onOpenVisitImport} source={data.reserveSourceVisit} />
                <button onClick={addReserve} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors">
                  <Plus size={12} /> Réserve manuelle
                </button>
              </div>
            </div>
            <p className="text-[11px] text-gray-500 italic">Ces réserves sont partagées avec les onglets EXE5 et EXE6.</p>
            {data.reserveSourceVisit && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800">
                <MapPin size={14} className="shrink-0" />
                <span className="font-semibold">{data.reserveSourceVisit.nom}</span>
                <span className="text-blue-600">{data.reserveSourceVisit.observationCount} observation{data.reserveSourceVisit.observationCount > 1 ? 's' : ''} · {data.reserveSourceVisit.photoCount} photo{data.reserveSourceVisit.photoCount > 1 ? 's' : ''} · trace avec repères numérotés</span>
              </div>
            )}
            <div className="grid grid-cols-[40px_1fr_130px_36px] gap-2 px-2.5 py-1.5 rounded-md bg-gray-200 border border-gray-300">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-600 text-center">N°</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-600">Désignation</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-600 text-center">Date limite</span>
              <span />
            </div>
            {(data.reserves || []).map((r, idx) => (
              <div key={idx} className="rounded-lg bg-white border border-gray-200 hover:border-gray-300 transition-all overflow-hidden shadow-sm">
                <div className="grid grid-cols-[40px_1fr_130px_36px] gap-2 items-center p-2.5">
                  <input type="text" value={r.numero} onChange={(e) => updateReserve(idx, 'numero', e.target.value)} className="px-2 py-2 rounded-md bg-gray-50 border border-gray-300 text-xs text-gray-800 text-center focus:border-blue-500 focus:outline-none w-full" />
                  <input type="text" value={r.designation} onChange={(e) => updateReserve(idx, 'designation', e.target.value)} placeholder="Description..." className="px-3 py-2 rounded-md bg-gray-50 border border-gray-300 text-xs text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:outline-none w-full" />
                  <input type="date" value={r.delaiLevee} onChange={(e) => updateReserve(idx, 'delaiLevee', e.target.value)} className="px-2 py-2 rounded-md bg-gray-50 border border-gray-300 text-xs text-gray-800 focus:border-blue-500 focus:outline-none w-full text-center" />
                  <button onClick={() => removeReserve(idx)} className="p-2 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 transition-all flex items-center justify-center"><Trash2 size={14} /></button>
                </div>
                <ReservePhotosEditor reserve={r} reserveIndex={idx} updateReserve={updateReserve} />
              </div>
            ))}
            <Field label="Observations générales sur les réserves" value={data.observationsReserves} onChange={(v) => update('observationsReserves', v)} rows={2} />
          </div>

        {/* Signatures EXE4 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-200">
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Dressé par le Maître d'œuvre</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Dressé le" value={data.dateSignatureMoe} onChange={(v) => update('dateSignatureMoe', v)} type="date" />
              <Field label="Lieu" value={data.lieuSignatureMoe} onChange={(v) => update('lieuSignatureMoe', v)} placeholder="Ville" icon={Pen} />
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Accepté par le Titulaire</p>
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${data.refusSignatureTitulaire ? 'bg-red-500 border-red-500' : 'bg-white border-gray-300 group-hover:border-gray-400'}`}>
                {data.refusSignatureTitulaire && <span className="text-white text-xs font-black">✓</span>}
              </div>
              <input type="checkbox" className="hidden" checked={data.refusSignatureTitulaire} onChange={(e) => update('refusSignatureTitulaire', e.target.checked)} />
              <span className="text-[11px] text-gray-600">Le titulaire a refusé de signer le PV</span>
            </label>
            {!data.refusSignatureTitulaire && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Accepté le" value={data.dateSignatureTitulaire} onChange={(v) => update('dateSignatureTitulaire', v)} type="date" />
                  <Field label="Lieu" value={data.lieuSignatureTitulaire} onChange={(v) => update('lieuSignatureTitulaire', v)} placeholder="Ville" icon={Pen} />
                </div>
                <Field label="Observations du titulaire" value={data.observationsTitulaire} onChange={(v) => update('observationsTitulaire', v)} placeholder="Observations éventuelles..." rows={2} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════════════════
// ONGLET EXE5 — Propositions du Maître d'Œuvre
// ═══════════════════════════════════════════════════════════════════════════
const TabEXE5 = ({ fiche, data, update, updateReserve, addReserve, removeReserve, onOpenVisitImport }) => {
  const formatDateFR = (s) => { if (!s) return '………………'; try { return new Date(s).toLocaleDateString('fr-FR'); } catch { return s; } };

  return (
    <div className="space-y-1">
      <PdfDocumentHeader subtitle="PROPOSITIONS DU MAÎTRE D'ŒUVRE" exeCode="EXE5" />
      <ReadOnlySectionsAD fiche={fiche} sectionATitle="Identification du pouvoir adjudicateur ou de l'entité adjudicatrice" />

      {/* ── Section E — Propositions ── */}
      <PdfSectionHeader letter="E" title="Propositions du maître d'œuvre relatives au procès-verbal des opérations préalables à la réception des ouvrages" />
      <div className="pl-1 space-y-5">
        <p className="text-[12px] text-gray-700 leading-relaxed">
          Au vu du procès-verbal des opérations préalables à la réception des ouvrages, en date du{' '}
          <strong className="text-gray-900">{formatDateFR(data.dateOPR)}</strong>, je, soussigné, maître d'œuvre, propose :
        </p>

        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-4">
          <ChoiceGroup
            label="Proposition du Maître d'Œuvre" value={data.propositionMoe} onChange={(v) => update('propositionMoe', v)}
            options={[{ value: 'prononcer', label: '1. Prononcer la réception' }, { value: 'ne_pas_prononcer', label: '2. Ne pas prononcer la réception' }]}
          />

          {data.propositionMoe === 'prononcer' && (
            <div className="space-y-4 pl-3 border-l-3 border-emerald-400 ml-2">
              <Field label="Date retenue pour l'achèvement des travaux" value={data.dateAchevementRetenue} onChange={(v) => update('dateAchevementRetenue', v)} type="date" icon={Calendar} />
              <p className="text-[12px] text-gray-700">Cette réception serait prononcée :</p>
              <ChoiceGroup
                label="Modalité" value={data.typeReception} onChange={(v) => update('typeReception', v)}
                options={[
                  { value: 'sans_reserve', label: '1.1 Sans réserve' },
                  { value: 'sous_reserve', label: '1.2 Sous réserve' },
                  { value: 'avec_reserve', label: '1.3 Avec réserve' },
                ]}
              />
              <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-200">
                <div className="flex-1 min-w-[220px] text-[11px] text-blue-800">
                  Utiliser toutes les observations, les photos et la trace numérotée d’une visite comme annexe de réserves.
                </div>
                <VisitImportButton onClick={onOpenVisitImport} source={data.reserveSourceVisit} />
              </div>

              {data.typeReception === 'sous_reserve' && (
                <div className="space-y-3 p-3 rounded-md bg-amber-50 border border-amber-200">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-1">Sous réserve de : <span className="font-normal normal-case text-amber-600">(cocher une ou les deux)</span></p>
                  <PdfCheckItem
                    checked={data.epreuves === 'exceptions'}
                    onChange={() => update('epreuves', data.epreuves === 'exceptions' ? 'concluantes' : 'exceptions')}
                    label="de l'exécution concluante des épreuves énumérées à l'annexe ci-jointe"
                    indent={1}
                  />
                  {data.epreuves === 'exceptions' && (
                    <div className="pl-6 -mt-1 mb-1">
                      <Field label="N° annexe épreuves" value={data.epreuvesExceptions} onChange={(v) => update('epreuvesExceptions', v)} placeholder="N° annexe..." />
                    </div>
                  )}
                  <PdfCheckItem
                    checked={data.travauxExputes === 'exceptions'}
                    onChange={() => update('travauxExputes', data.travauxExputes === 'exceptions' ? 'oui' : 'exceptions')}
                    label="de l'exécution des travaux et prestations énumérés à l'annexe ci-jointe"
                    indent={1}
                  />
                  {data.travauxExputes === 'exceptions' && (
                    <div className="pl-6 -mt-1 mb-1">
                      <Field label="N° annexe travaux" value={data.travauxExceptions} onChange={(v) => update('travauxExceptions', v)} placeholder="N° annexe..." />
                    </div>
                  )}
                </div>
              )}

              {data.typeReception === 'avec_reserve' && (
                <div className="space-y-4">
                  {/* Imperfections / malfaçons — cochable */}
                  <div className="space-y-3 p-3 rounded-md bg-red-50 border border-red-200">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-red-700 mb-1">Avec réserve : <span className="font-normal normal-case text-red-600">(cocher une ou plusieurs options)</span></p>
                    <PdfCheckItem
                      checked={data.ouvragesConformes === 'exceptions'}
                      onChange={() => update('ouvragesConformes', data.ouvragesConformes === 'exceptions' ? 'oui' : 'exceptions')}
                      label="Le titulaire doit remédier aux imperfections et malfaçons indiquées à l'annexe ci-jointe"
                      indent={1}
                    />
                    {data.ouvragesConformes === 'exceptions' && (
                      <div className="pl-6 -mt-1 mb-1">
                        <Field label="N° annexe imperfections" value={data.ouvragesExceptions} onChange={(v) => update('ouvragesExceptions', v)} placeholder="N° annexe..." />
                      </div>
                    )}
                    <PdfCheckItem
                      checked={data.repliInstallations === 'non'}
                      onChange={() => update('repliInstallations', data.repliInstallations === 'non' ? 'oui' : 'non')}
                      label="Les installations de chantier doivent être repliées et les terrains remis en état"
                      indent={1}
                    />
                    {data.repliInstallations === 'non' && (
                      <div className="pl-6 -mt-1 mb-1">
                        <Field label="Avant le" value={data.delaiRepliInstallations} onChange={(v) => update('delaiRepliInstallations', v)} type="date" />
                      </div>
                    )}
                    <PdfCheckItem
                      checked={data.poseEquipements === 'non_conforme'}
                      onChange={() => update('poseEquipements', data.poseEquipements === 'non_conforme' ? 'conforme' : 'non_conforme')}
                      label="Les conditions de pose doivent être mises en conformité avec les spécifications fournisseurs"
                      indent={1}
                    />
                    {data.poseEquipements === 'non_conforme' && (
                      <div className="pl-6 -mt-1 mb-1">
                        <Field label="Avant le" value={data.delaiMiseConformiteEquipements} onChange={(v) => update('delaiMiseConformiteEquipements', v)} type="date" />
                      </div>
                    )}
                  </div>

                  {/* Réserves (tableau) */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-red-600">Réserves ({(data.reserves || []).filter(r => r.designation).length})</span>
                      <div className="flex flex-wrap items-center gap-2">
                        <VisitImportButton onClick={onOpenVisitImport} source={data.reserveSourceVisit} />
                        <button onClick={addReserve} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors">
                          <Plus size={12} /> Réserve manuelle
                        </button>
                      </div>
                    </div>
                    {data.reserveSourceVisit && (
                      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800">
                        <MapPin size={14} className="shrink-0" />
                        <span className="font-semibold">{data.reserveSourceVisit.nom}</span>
                        <span className="text-blue-600">{data.reserveSourceVisit.observationCount} observation{data.reserveSourceVisit.observationCount > 1 ? 's' : ''} · {data.reserveSourceVisit.photoCount} photo{data.reserveSourceVisit.photoCount > 1 ? 's' : ''} · trace avec repères numérotés</span>
                      </div>
                    )}
                    <div className="grid grid-cols-[40px_1fr_130px_36px] gap-2 px-2.5 py-1.5 rounded-md bg-gray-200 border border-gray-300">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-gray-600 text-center">N°</span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-gray-600">Désignation</span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-gray-600 text-center">Date limite</span>
                      <span />
                    </div>
                    {(data.reserves || []).map((r, idx) => (
                      <div key={idx} className="rounded-lg bg-white border border-gray-200 hover:border-gray-300 transition-all overflow-hidden shadow-sm">
                        <div className="grid grid-cols-[40px_1fr_130px_36px] gap-2 items-center p-2.5">
                          <input type="text" value={r.numero} onChange={(e) => updateReserve(idx, 'numero', e.target.value)} className="px-2 py-2 rounded-md bg-gray-50 border border-gray-300 text-xs text-gray-800 text-center focus:border-blue-500 focus:outline-none w-full" />
                          <input type="text" value={r.designation} onChange={(e) => updateReserve(idx, 'designation', e.target.value)} placeholder="Description..." className="px-3 py-2 rounded-md bg-gray-50 border border-gray-300 text-xs text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:outline-none w-full" />
                          <input type="date" value={r.delaiLevee} onChange={(e) => updateReserve(idx, 'delaiLevee', e.target.value)} className="px-2 py-2 rounded-md bg-gray-50 border border-gray-300 text-xs text-gray-800 focus:border-blue-500 focus:outline-none w-full text-center" />
                          <button onClick={() => removeReserve(idx)} className="p-2 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 transition-all flex items-center justify-center"><Trash2 size={14} /></button>
                        </div>
                        <ReservePhotosEditor reserve={r} reserveIndex={idx} updateReserve={updateReserve} />
                      </div>
                    ))}
                    <Field label="Observations générales sur les réserves" value={data.observationsReserves} onChange={(v) => update('observationsReserves', v)} rows={2} />
                  </div>

                  {/* Réfaction */}
                  <div className="p-3 rounded-md bg-amber-50 border border-amber-200 space-y-3">
                    <PdfCheckItem checked={!!data.refactionMontant} label="Proposition de réfaction (si le titulaire accepte)" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-6">
                      <Field label="Montant de la réfaction" value={data.refactionMontant} onChange={(v) => update('refactionMontant', v)} placeholder="Ex: 1500" suffix="€" />
                      <Field label="Date lettre d'acceptation" value={data.dateLettreRefaction} onChange={(v) => update('dateLettreRefaction', v)} type="date" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Section F — Signature MOE ── */}
      <PdfSectionHeader letter="F" title="Signature du maître d'œuvre" />
      <div className="pl-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="À ..." value={data.lieuSignatureMoe} onChange={(v) => update('lieuSignatureMoe', v)} placeholder="Ville" icon={Pen} />
          <Field label="Le ..." value={data.dateSignatureMoe} onChange={(v) => update('dateSignatureMoe', v)} type="date" />
        </div>
      </div>
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════════════════
// ONGLET EXE6 — Décision de Réception
// ═══════════════════════════════════════════════════════════════════════════
const TabEXE6 = ({ fiche, data, update }) => {
  const D = fiche?.sectionD || {};
  const formatDateFR = (s) => { if (!s) return '………………'; try { return new Date(s).toLocaleDateString('fr-FR'); } catch { return s; } };
  const reserves = (data.reserves || []).filter(r => r.designation);

  return (
    <div className="space-y-1">
      <PdfDocumentHeader subtitle="DÉCISION DE RÉCEPTION" exeCode="EXE6" />
      <ReadOnlySectionsAD fiche={fiche} sectionATitle="Identification du maître de l'ouvrage" />

      {/* ── Section E — Objet de la décision ── */}
      <PdfSectionHeader letter="E" title="Objet de la décision de réception" />
      <div className="pl-1">
        <p className="text-[12px] text-gray-700 mb-2">La présente décision a pour objet la réception des prestations désignées ci-dessous :</p>
        <div className="px-3.5 py-2.5 rounded-md bg-gray-50 border border-gray-200 text-sm text-gray-600">
          {data.porteeReception === 'partielle' && data.designationPartielle
            ? data.designationPartielle
            : D.objet || <span className="italic text-gray-400">Non renseigné</span>}
        </div>
      </div>

      {/* ── Section F — Décision du maître de l'ouvrage ── */}
      <PdfSectionHeader letter="F" title="Décision du maître de l'ouvrage" />
      <div className="pl-1 space-y-5">
        <p className="text-[12px] text-gray-700">Au vu :</p>
        <div className="space-y-1 pl-2">
          <PdfCheckItem checked={true} label={`du procès-verbal des opérations préalables à la réception, en date du ${formatDateFR(data.dateOPR)}, et des propositions présentées le ${formatDateFR(data.dateSignatureMoe)} par le maître d'œuvre ;`} />
          <PdfCheckItem checked={!!data.refactionMontant} label={`de la lettre, en date du ${data.dateLettreRefaction ? formatDateFR(data.dateLettreRefaction) : '………………'}, par laquelle le titulaire du marché public accepte la réfaction proposée ;`} />
        </div>

        <p className="text-[12px] text-gray-700">le maître de l'ouvrage décide :</p>

        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-4">
          <ChoiceGroup
            label="Décision du Pouvoir Adjudicateur" value={data.decisionPA} onChange={(v) => update('decisionPA', v)}
            options={[{ value: 'prononcer', label: 'Prononcer la réception' }, { value: 'ne_pas_prononcer', label: 'Ne pas prononcer' }]}
          />

          {data.decisionPA === 'prononcer' && (
            <div className="space-y-4 pl-3 border-l-3 border-green-400 ml-2">
              <div>
                <p className="text-[12px] font-bold text-gray-800 mb-2">1. Date retenue pour l'achèvement des travaux :</p>
                <Field value={data.dateAchevementRetenue} onChange={(v) => update('dateAchevementRetenue', v)} type="date" icon={Calendar} />
              </div>

              <div className="space-y-3">
                <p className="text-[12px] font-bold text-gray-800">2. La réception est prononcée :</p>
                <ChoiceGroup
                  value={data.typeReception} onChange={(v) => update('typeReception', v)}
                  options={[
                    { value: 'sans_reserve', label: '2.1 Sans réserve' },
                    { value: 'sous_reserve', label: '2.2 Sous réserve' },
                    { value: 'avec_reserve', label: '2.3 Avec réserve' },
                  ]}
                />

                {data.typeReception === 'sous_reserve' && (
                  <div className="space-y-3 p-3 rounded-md bg-amber-50 border border-amber-200">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-1">Sous réserve de : <span className="font-normal normal-case text-amber-600">(cocher une ou les deux)</span></p>
                    <PdfCheckItem
                      checked={data.epreuves === 'exceptions'}
                      onChange={() => update('epreuves', data.epreuves === 'exceptions' ? 'concluantes' : 'exceptions')}
                      label="de l'exécution concluante des épreuves énumérées à l'annexe ci-jointe"
                      indent={1}
                    />
                    {data.epreuves === 'exceptions' && (
                      <div className="pl-6 -mt-1 mb-1">
                        <Field label="N° annexe épreuves" value={data.epreuvesExceptions} onChange={(v) => update('epreuvesExceptions', v)} placeholder="N° annexe..." />
                      </div>
                    )}
                    <PdfCheckItem
                      checked={data.travauxExputes === 'exceptions'}
                      onChange={() => update('travauxExputes', data.travauxExputes === 'exceptions' ? 'oui' : 'exceptions')}
                      label="de l'exécution des travaux et prestations énumérés à l'annexe ci-jointe"
                      indent={1}
                    />
                    {data.travauxExputes === 'exceptions' && (
                      <div className="pl-6 -mt-1 mb-1">
                        <Field label="N° annexe travaux" value={data.travauxExceptions} onChange={(v) => update('travauxExceptions', v)} placeholder="N° annexe..." />
                      </div>
                    )}
                  </div>
                )}

                {data.typeReception === 'avec_reserve' && (
                  <div className="space-y-3">
                    {/* Options cochables */}
                    <div className="space-y-3 p-3 rounded-md bg-red-50 border border-red-200">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-red-700 mb-1">Avec réserve : <span className="font-normal normal-case text-red-600">(cocher une ou plusieurs options)</span></p>
                      <PdfCheckItem
                        checked={data.ouvragesConformes === 'exceptions'}
                        onChange={() => update('ouvragesConformes', data.ouvragesConformes === 'exceptions' ? 'oui' : 'exceptions')}
                        label="Le titulaire doit remédier aux imperfections et malfaçons indiquées à l'annexe ci-jointe"
                        indent={1}
                      />
                      {data.ouvragesConformes === 'exceptions' && (
                        <div className="pl-6 -mt-1 mb-1">
                          <Field label="N° annexe imperfections" value={data.ouvragesExceptions} onChange={(v) => update('ouvragesExceptions', v)} placeholder="N° annexe..." />
                        </div>
                      )}
                      <PdfCheckItem
                        checked={data.repliInstallations === 'non'}
                        onChange={() => update('repliInstallations', data.repliInstallations === 'non' ? 'oui' : 'non')}
                        label={`Repli des installations et remise en état${data.repliInstallations === 'non' && data.delaiRepliInstallations ? ` avant le ${formatDateFR(data.delaiRepliInstallations)}` : ''}`}
                        indent={1}
                      />
                      {data.repliInstallations === 'non' && (
                        <div className="pl-6 -mt-1 mb-1">
                          <Field label="Avant le" value={data.delaiRepliInstallations} onChange={(v) => update('delaiRepliInstallations', v)} type="date" />
                        </div>
                      )}
                      <PdfCheckItem
                        checked={data.poseEquipements === 'non_conforme'}
                        onChange={() => update('poseEquipements', data.poseEquipements === 'non_conforme' ? 'conforme' : 'non_conforme')}
                        label={`Mise en conformité de pose des équipements${data.poseEquipements === 'non_conforme' && data.delaiMiseConformiteEquipements ? ` avant le ${formatDateFR(data.delaiMiseConformiteEquipements)}` : ''}`}
                        indent={1}
                      />
                      {data.poseEquipements === 'non_conforme' && (
                        <div className="pl-6 -mt-1 mb-1">
                          <Field label="Avant le" value={data.delaiMiseConformiteEquipements} onChange={(v) => update('delaiMiseConformiteEquipements', v)} type="date" />
                        </div>
                      )}
                    </div>

                    {/* Récapitulatif des réserves (définies dans EXE5) */}
                    {reserves.length > 0 && (
                      <div className="p-3 rounded-md bg-gray-50 border border-gray-200 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">Réserves (définies dans EXE5)</p>
                        {reserves.map((r, i) => (
                          <div key={i} className="flex items-center gap-3 text-[11px] text-gray-600">
                            <span className="font-bold text-gray-800 w-6 text-center">{r.numero}</span>
                            <span className="flex-1">{r.designation}</span>
                            {r.delaiLevee && <span className="text-[10px] text-amber-600 font-medium">avant le {formatDateFR(r.delaiLevee)}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {data.refactionMontant && <PdfCheckItem checked={true} label={`Réfaction acceptée : ${data.refactionMontant} €`} indent={1} />}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Section G — Signature MOA ── */}
      <PdfSectionHeader letter="G" title="Signature du maître de l'ouvrage" />
      <div className="pl-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="À ..." value={data.lieuSignaturePA} onChange={(v) => update('lieuSignaturePA', v)} placeholder="Ville" icon={Pen} />
          <Field label="Le ..." value={data.dateSignaturePA} onChange={(v) => update('dateSignaturePA', v)} type="date" />
        </div>
      </div>
    </div>
  );
};




// ═══════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export default function ExeReceptionForm({ fiche, user, companyId, dateFinRevisee: externalDateFinRevisee, onBack, onGenerate, onSave, isSaving }) {
  const toast = useToast();
  const {
    visits: siteVisits,
    isLoading: isLoadingSiteVisits,
    loadVisit,
  } = useMobileSiteVisits(user, companyId);
  const [data, setData] = useState(() => ({ ...createEmptyReceptionData(), ...(fiche?.reception || {}) }));
  const [activeTab, setActiveTab] = useState('exe4');
  const [isGenerating, setIsGenerating] = useState(null);
  const [showVisitImport, setShowVisitImport] = useState(false);
  const scrollRef = useRef(null);

  const update = useCallback((field, value) => setData((p) => ({ ...p, [field]: value })), []);

  // ── Réserves ──
  const updateReserve = useCallback((i, field, value) => {
    setData((p) => { const l = [...(p.reserves || [])]; l[i] = { ...l[i], [field]: value }; return { ...p, reserves: l }; });
  }, []);
  const addReserve = useCallback(() => {
    setData((p) => {
      const list = p.reserves || [];
      return { ...p, reserves: [...list, { numero: String(list.length + 1), designation: '', delaiLevee: '', images: [] }] };
    });
  }, []);
  const removeReserve = useCallback((i) => {
    setData((p) => { const l = [...(p.reserves || [])]; l.splice(i, 1); if (!l.length) l.push({ numero: '1', designation: '', delaiLevee: '', images: [] }); return { ...p, reserves: l }; });
  }, []);

  const handleImportSiteVisit = useCallback(async (visit) => {
    const { reserves, source } = siteVisitToReserves(visit);
    if (reserves.length === 0) throw new Error('Cette visite ne contient aucune observation à importer.');

    setData((previous) => ({
      ...previous,
      reserves,
      reserveSourceVisit: source,
      propositionMoe: 'prononcer',
      typeReception: 'avec_reserve',
      ouvragesConformes: 'exceptions',
      ouvragesExceptions: previous.ouvragesExceptions || '1',
      dateOPR: previous.dateOPR || visit.date || '',
    }));
    toast.success(`${reserves.length} réserve${reserves.length > 1 ? 's' : ''} importée${reserves.length > 1 ? 's' : ''} depuis la visite.`);
  }, [toast]);

  // ── Auto-save ──
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

  // ── Scroll to top on tab change ──
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [activeTab]);

  // ── Dates ──
  // useMemo toujours appelé (jamais derrière un `||` qui le rendrait conditionnel).
  const computedDateFinRevisee = useMemo(() => getDateFinRevisee(fiche), [fiche]);
  const dateFinRevisee = externalDateFinRevisee || computedDateFinRevisee;

  const dateProposeeError = useMemo(() => {
    if (!data.dateAchevementProposee || !dateFinRevisee) return null;
    const proposed = new Date(data.dateAchevementProposee); proposed.setHours(0, 0, 0, 0);
    const revised = new Date(dateFinRevisee); revised.setHours(0, 0, 0, 0);
    if (proposed > revised) return `Dépasse la fin révisée (${revised.toLocaleDateString('fr-FR')})`;
    return null;
  }, [data.dateAchevementProposee, dateFinRevisee]);

  // ── Générer & sauvegarder ──
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

  const tabLabels = { exe4: 'EXE4 — PV des OPR', exe5: 'EXE5 — Propositions MOE', exe6: 'EXE6 — Décision PA' };
  const tabAccent = { exe4: 'text-blue-500', exe5: 'text-cyan-500', exe6: 'text-green-500' };

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">

      {/* ── Ribbon ── */}
      <div className="font-[system-ui,'Segoe_UI',sans-serif] select-none shrink-0 z-10">
        <RibbonHeader
          title={fiche?.nom || 'Sans nom'}
          tabs={[
            { id: 'exe4', label: 'EXE4 — PV des OPR' },
            { id: 'exe5', label: 'EXE5 — Propositions MOE' },
            { id: 'exe6', label: 'EXE6 — Décision' },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          rightContent={isSaving ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-purple-600">
              <Loader size={10} className="animate-spin" /> Sauvegarde...
            </span>
          ) : dateProposeeError ? (
            <span className="text-[10px] font-bold text-red-600">{dateProposeeError}</span>
          ) : null}
        />
        <RibbonContainer compact>
          <RibbonGroup label="Navigation">
            <RibbonBtnLarge icon={ArrowLeft} label="Retour" onClick={onBack} title="Retour à la fiche marché" />
          </RibbonGroup>
          <RibbonGroup label="Enregistrer">
            <RibbonBtnLarge icon={Save} label={isSaving ? 'Enreg...' : 'Enregistrer'} onClick={handleSave} disabled={isSaving} accent="text-purple-500" title="Enregistrer" />
          </RibbonGroup>
          <RibbonSpacer />
          {(activeTab === 'exe4' || activeTab === 'exe5') && (
            <RibbonGroup label="Annexe PDF">
              <div className="flex items-center rounded-xl bg-slate-200/80 p-0.5 border border-slate-300/70">
                {[
                  { value: 'detailed', label: 'Détaillé' },
                  { value: 'compact', label: 'Compact' },
                ].map((option) => {
                  const isActive = (data.reservePdfMode || 'detailed') === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => update('reservePdfMode', option.value)}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                        isActive
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                      }`}
                      title={`Annexe PDF ${option.label.toLowerCase()}`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </RibbonGroup>
          )}
          <RibbonGroup label={tabLabels[activeTab]} noBorder>
            <RibbonBtnLarge icon={FileText} label={isGenerating === `${activeTab}-docx` ? 'Word...' : 'Word'} onClick={() => handleGenerate('docx')} disabled={!!isGenerating} accent={tabAccent[activeTab]} title={`Générer ${activeTab.toUpperCase()} en .docx`} />
            <RibbonBtnLarge icon={FileDown} label={isGenerating === `${activeTab}-pdf` ? 'PDF...' : 'PDF'} onClick={() => handleGenerate('pdf')} disabled={!!isGenerating} accent="text-red-500" title={`Générer ${activeTab.toUpperCase()} en .pdf${activeTab === 'exe4' || activeTab === 'exe5' ? ` - annexe ${(data.reservePdfMode || 'detailed') === 'compact' ? 'compacte' : 'détaillée'}` : ''}`} />
          </RibbonGroup>
        </RibbonContainer>
      </div>

      {/* ── Zone de contenu : fond gris clair avec « feuille A4 » blanche centrée ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-gray-200 py-4 px-4">
        <div className="mx-auto bg-white shadow-lg rounded-sm px-[20mm] py-[15mm]" style={{ maxWidth: '210mm', minHeight: '297mm' }}>
          {activeTab === 'exe4' && (
            <TabEXE4 fiche={fiche} data={data} update={update} updateReserve={updateReserve} addReserve={addReserve} removeReserve={removeReserve} onOpenVisitImport={() => setShowVisitImport(true)} dateFinRevisee={dateFinRevisee} dateProposeeError={dateProposeeError} />
          )}
          {activeTab === 'exe5' && (
            <TabEXE5 fiche={fiche} data={data} update={update} updateReserve={updateReserve} addReserve={addReserve} removeReserve={removeReserve} onOpenVisitImport={() => setShowVisitImport(true)} />
          )}
          {activeTab === 'exe6' && (
            <TabEXE6 fiche={fiche} data={data} update={update} />
          )}
        </div>
      </div>

      <SiteVisitReserveImportModal
        isOpen={showVisitImport}
        onClose={() => setShowVisitImport(false)}
        visits={siteVisits}
        isLoading={isLoadingSiteVisits}
        loadVisit={loadVisit}
        onImport={handleImportSiteVisit}
        existingReserveCount={(data.reserves || []).filter((reserve) => reserve.designation).length}
      />
    </div>
  );
}
