// src/components/docAdmin/Exe10Form.jsx
// Formulaire EXE10 — Avenant au marché public
// Mode clair, largeur A4, reproduisant la mise en page du formulaire officiel DAJ
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ArrowLeft, FileText, FileDown, Loader, Save, Pen } from 'lucide-react';
import { RibbonGroup, RibbonBtnLarge, RibbonContainer, RibbonHeader, RibbonSpacer } from '../common/RibbonParts';
import { PdfDocumentHeader, PdfSectionHeader, ReadOnlyEntreprise, Field, ChoiceGroup, PdfCheckItem } from './ExeReceptionForm';

// ─── Modèle de données ─────────────────────────────────────────────────────
export const createEmptyExe10Data = () => ({
  numeroAvenant: '1',
  // Section C extra fields (not in fiche)
  dateNotificationMarche: '',
  montantInitialTVA: '',
  montantInitialHT: '',
  montantInitialTTC: '',
  // Section D — Avenant details
  modifications: '',
  incidenceFinanciere: 'non',
  montantAvenantTVA: '',
  montantAvenantHT: '',
  montantAvenantTTC: '',
  ecartPourcent: '',
  nouveauMontantTVA: '',
  nouveauMontantHT: '',
  nouveauMontantTTC: '',
});

// ═══════════════════════════════════════════════════════════════════════════
// Composant principal — EXE10 Avenant
// ═══════════════════════════════════════════════════════════════════════════
export default function Exe10Form({ fiche, onBack, onGenerate, onSave, isSaving }) {
  const [data, setData] = useState(() => ({ ...createEmptyExe10Data(), ...(fiche?.exe10 || {}) }));
  const [isGenerating, setIsGenerating] = useState(null);
  const scrollRef = useRef(null);
  const update = useCallback((field, value) => setData((p) => ({ ...p, [field]: value })), []);

  // ── Auto-save (1500ms debounce) ──────────────────────────────────────
  const saveTimeoutRef = useRef(null);
  const lastSavedDataRef = useRef(JSON.stringify(data));
  useEffect(() => {
    const currentDataString = JSON.stringify(data);
    if (currentDataString === lastSavedDataRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      if (onSave) {
        await onSave({ ...fiche, exe10: data });
        lastSavedDataRef.current = currentDataString;
      }
    }, 1500);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [data, fiche, onSave]);

  const handleGenerate = async (format) => {
    setIsGenerating(format);
    try { await onGenerate('exe10', data, format); } finally { setIsGenerating(null); }
  };

  const handleSave = async () => {
    if (onSave) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      await onSave({ ...fiche, exe10: data });
      lastSavedDataRef.current = JSON.stringify(data);
    }
  };

  // ── Read fiche data ──────────────────────────────────────────────────
  const A = fiche?.sectionA || {};
  const B = fiche?.sectionB || {};
  const D = fiche?.sectionD || {};
  const isGroupement = B.type === 'groupement';
  const cotraitants = (B.cotraitants || []).filter(c => c?.nomCommercial || c?.denominationSociale);

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* ═══ Ribbon — NO tabs, single EXE10 ═══ */}
      <div className="font-[system-ui,'Segoe_UI',sans-serif] select-none shrink-0 z-10">
        <RibbonHeader title={fiche?.nom || 'Sans nom'} />
        <RibbonContainer>
          <RibbonGroup label="Navigation">
            <RibbonBtnLarge icon={ArrowLeft} label="Retour" onClick={onBack} title="Retour à la fiche marché" />
          </RibbonGroup>
          <RibbonGroup label="Enregistrer">
            <RibbonBtnLarge icon={Save} label={isSaving ? 'Enreg...' : 'Enregistrer'} onClick={handleSave} disabled={isSaving} accent="text-purple-500" title="Enregistrer" />
          </RibbonGroup>
          <RibbonSpacer />
          <RibbonGroup label="EXE10 — Avenant" noBorder>
            <RibbonBtnLarge icon={FileText} label={isGenerating === 'docx' ? 'Word...' : 'Word'} onClick={() => handleGenerate('docx')} disabled={!!isGenerating} accent="text-orange-500" title="Générer EXE10 en .docx" />
            <RibbonBtnLarge icon={FileDown} label={isGenerating === 'pdf' ? 'PDF...' : 'PDF'} onClick={() => handleGenerate('pdf')} disabled={!!isGenerating} accent="text-red-500" title="Générer EXE10 en .pdf" />
          </RibbonGroup>
        </RibbonContainer>
      </div>

      {/* ═══ A4 Content ═══ */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-gray-200 py-8 px-4">
        <div className="mx-auto bg-white shadow-lg rounded-sm px-[20mm] py-[15mm]" style={{ maxWidth: '210mm', minHeight: '297mm' }}>

          {/* Header */}
          <PdfDocumentHeader subtitle={`AVENANT N° ${data.numeroAvenant || '………'}`} exeCode="EXE10" />

          {/* N° de l'avenant */}
          <div className="mb-4">
            <Field label="N° de l'avenant" value={data.numeroAvenant} onChange={(v) => update('numeroAvenant', v)} placeholder="1, 2, 3..." className="max-w-[200px]" />
          </div>

          {/* ═══ Section A — PA (read-only from fiche) ═══ */}
          <PdfSectionHeader letter="A" title="Identification du pouvoir adjudicateur ou de l'entité adjudicatrice" />
          <div className="pl-1 space-y-1">
            <div className="px-3.5 py-2.5 rounded-md bg-gray-50 border border-gray-200 text-sm text-gray-600 space-y-0.5">
              {A.designation && <p className="font-medium text-gray-800">{A.designation}</p>}
              {A.adresse && <p>{A.adresse}</p>}
              {(A.codePostal || A.ville) && <p>{[A.codePostal, A.ville].filter(Boolean).join('  ')}</p>}
              {A.representant && <p>Représentant : {A.representant}{A.qualite ? ` (${A.qualite})` : ''}</p>}
              {!A.designation && <p className="italic text-gray-400">Non renseigné</p>}
            </div>
          </div>

          {/* ═══ Section B — Titulaire (read-only from fiche) ═══ */}
          <PdfSectionHeader letter="B" title="Identification du titulaire du marché public" />
          <div className="pl-1">
            {isGroupement && cotraitants.length > 0 ? (
              <div className="space-y-2">
                <ReadOnlyEntreprise ent={B.mandataire} label="Mandataire" />
                {cotraitants.map((cot, i) => <ReadOnlyEntreprise key={i} ent={cot} label={`Co-traitant ${i + 1}`} />)}
              </div>
            ) : (
              <ReadOnlyEntreprise ent={B.mandataire} />
            )}
          </div>

          {/* ═══ Section C — Objet du marché (mixed: fiche read-only + editable fields) ═══ */}
          <PdfSectionHeader letter="C" title="Objet du marché public" />
          <div className="pl-1 space-y-4">
            {/* Objet — from fiche (read-only) */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">◼ Objet du marché public</span>
              <div className="px-3.5 py-2.5 rounded-md bg-gray-50 border border-gray-200 text-sm text-gray-600">
                {D.objet || <span className="italic text-gray-400">Non renseigné</span>}
              </div>
            </div>

            {/* Date notification */}
            <Field label="◼ Date de la notification du marché public" value={data.dateNotificationMarche || D.dateNotification || ''} onChange={(v) => update('dateNotificationMarche', v)} type="date" className="max-w-[300px]" />

            {/* Durée — from fiche (read-only) */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">◼ Durée d'exécution du marché public</span>
              <div className="px-3.5 py-2.5 rounded-md bg-gray-50 border border-gray-200 text-sm text-gray-600">
                {D.dureeExecution ? `${D.dureeExecution} ${D.uniteDuree || 'mois'}` : <span className="italic text-gray-400">Non renseigné</span>}
              </div>
            </div>

            {/* Montant initial — editable */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">◼ Montant initial du marché public</span>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Taux TVA" value={data.montantInitialTVA} onChange={(v) => update('montantInitialTVA', v)} placeholder="20" suffix="%" />
                <Field label="Montant HT" value={data.montantInitialHT} onChange={(v) => update('montantInitialHT', v)} placeholder="0.00" suffix="€" />
                <Field label="Montant TTC" value={data.montantInitialTTC} onChange={(v) => update('montantInitialTTC', v)} placeholder="0.00" suffix="€" />
              </div>
            </div>
          </div>

          {/* ═══ Section D — Objet de l'avenant (fully editable) ═══ */}
          <PdfSectionHeader letter="D" title="Objet de l'avenant" />
          <div className="pl-1 space-y-5">
            <Field label="◼ Modifications introduites par le présent avenant" value={data.modifications} onChange={(v) => update('modifications', v)} rows={5} placeholder="Décrire les modifications introduites par l'avenant..." />

            <div className="space-y-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">◼ Incidence financière de l'avenant</span>
              <p className="text-[12px] text-gray-700">L'avenant a une incidence financière sur le montant du marché public :</p>
              <ChoiceGroup value={data.incidenceFinanciere} onChange={(v) => update('incidenceFinanciere', v)} options={[
                { value: 'non', label: 'Non' },
                { value: 'oui', label: 'Oui' },
              ]} />

              {data.incidenceFinanciere === 'oui' && (
                <div className="space-y-5 p-4 rounded-lg bg-gray-50 border border-gray-200">
                  {/* Montant de l'avenant */}
                  <div className="space-y-2">
                    <p className="text-[12px] font-bold text-gray-800">Montant de l'avenant :</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Field label="Taux TVA" value={data.montantAvenantTVA} onChange={(v) => update('montantAvenantTVA', v)} placeholder="20" suffix="%" />
                      <Field label="Montant HT" value={data.montantAvenantHT} onChange={(v) => update('montantAvenantHT', v)} placeholder="0.00" suffix="€" />
                      <Field label="Montant TTC" value={data.montantAvenantTTC} onChange={(v) => update('montantAvenantTTC', v)} placeholder="0.00" suffix="€" />
                      <Field label="% d'écart" value={data.ecartPourcent} onChange={(v) => update('ecartPourcent', v)} placeholder="0" suffix="%" />
                    </div>
                  </div>

                  {/* Nouveau montant */}
                  <div className="space-y-2">
                    <p className="text-[12px] font-bold text-gray-800">Nouveau montant du marché public :</p>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Taux TVA" value={data.nouveauMontantTVA} onChange={(v) => update('nouveauMontantTVA', v)} placeholder="20" suffix="%" />
                      <Field label="Montant HT" value={data.nouveauMontantHT} onChange={(v) => update('nouveauMontantHT', v)} placeholder="0.00" suffix="€" />
                      <Field label="Montant TTC" value={data.nouveauMontantTTC} onChange={(v) => update('nouveauMontantTTC', v)} placeholder="0.00" suffix="€" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═══ SECTIONS E, F, G — Imprimées sans modification ═══ */}
          <div className="mt-8 pt-6 border-t-2 border-dashed border-gray-300">
            <p className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-6">
              Sections imprimées uniquement (E, F, G) — Visibles dans l'export PDF / Word
            </p>

            {/* Section E — Signature du titulaire (read-only preview) */}
            <PdfSectionHeader letter="E" title="Signature du titulaire du marché public" />
            <div className="pl-1 mb-6">
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr>
                    <th className="border border-gray-300 bg-[#B0E0F2] px-3 py-2 text-left font-bold text-gray-800 w-[40%]">Nom, prénom et qualité du signataire (*)</th>
                    <th className="border border-gray-300 bg-[#B0E0F2] px-3 py-2 text-left font-bold text-gray-800 w-[35%]">Lieu et date de signature</th>
                    <th className="border border-gray-300 bg-[#B0E0F2] px-3 py-2 text-left font-bold text-gray-800 w-[25%]">Signature</th>
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2].map((i) => (
                    <tr key={i}>
                      <td className={`border border-gray-300 px-3 py-4 ${i % 2 === 1 ? 'bg-cyan-50' : 'bg-white'}`}>&nbsp;</td>
                      <td className={`border border-gray-300 px-3 py-4 ${i % 2 === 1 ? 'bg-cyan-50' : 'bg-white'}`}>&nbsp;</td>
                      <td className={`border border-gray-300 px-3 py-4 ${i % 2 === 1 ? 'bg-cyan-50' : 'bg-white'}`}>&nbsp;</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-gray-500 italic mt-1">(*) Le signataire doit avoir le pouvoir d'engager la personne qu'il représente.</p>
            </div>

            {/* Section F — Signature du PA (read-only preview) */}
            <PdfSectionHeader letter="F" title="Signature du pouvoir adjudicateur ou de l'entité adjudicatrice" />
            <div className="pl-1 mb-6 space-y-3">
              <div>
                <p className="text-[12px] font-bold text-gray-800">Pour l'État et ses établissements :</p>
                <p className="text-[11px] text-gray-500 italic">(Visa ou avis de l'autorité chargée du contrôle financier.)</p>
              </div>
              <div className="min-h-[80px]" />
              <div className="text-right space-y-1">
                <p className="text-[11px] text-gray-600">A : ……………………, le …………………</p>
                <p className="text-[11px] text-gray-600 font-bold">Signature</p>
                <p className="text-[10px] text-gray-500 italic">(représentant du pouvoir adjudicateur ou de l'entité adjudicatrice)</p>
              </div>
            </div>

            {/* Section G — Notification (read-only preview) */}
            <PdfSectionHeader letter="G" title="Notification de l'avenant au titulaire du marché public" />
            <div className="pl-1 space-y-6">
              {/* Remise contre récépissé */}
              <div className="p-4 rounded-md border border-gray-200 bg-gray-50 space-y-3">
                <p className="text-[12px] font-bold text-gray-800">◼ En cas de remise contre récépissé :</p>
                <p className="text-[11px] text-gray-600">Le titulaire signera la formule ci-dessous :</p>
                <p className="text-[11px] text-gray-600 italic text-center">« Reçue à titre de notification copie du présent avenant »</p>
                <div className="text-center space-y-1">
                  <p className="text-[11px] text-gray-600">A ……………………………, le ……………………</p>
                  <p className="text-[11px] text-gray-600">Signature du titulaire,</p>
                </div>
              </div>

              {/* Envoi recommandé */}
              <div className="p-4 rounded-md border border-gray-200 bg-gray-50 space-y-3">
                <p className="text-[12px] font-bold text-gray-800">◼ En cas d'envoi en lettre recommandé avec accusé de réception :</p>
                <p className="text-[11px] text-gray-500 italic">(Coller dans ce cadre l'avis de réception postal, daté et signé par le titulaire du marché public ou de l'accord-cadre.)</p>
                <div className="min-h-[80px]" />
              </div>

              {/* Notification électronique */}
              <div className="p-4 rounded-md border border-gray-200 bg-gray-50 space-y-3">
                <p className="text-[12px] font-bold text-gray-800">◼ En cas de notification par voie électronique :</p>
                <p className="text-[11px] text-gray-500 italic">(Indiquer la date et l'heure d'accusé de réception de la présente notification par le titulaire du marché public ou de l'accord-cadre.)</p>
                <div className="min-h-[60px]" />
              </div>
            </div>

            {/* Footer */}
            <p className="text-[9px] text-gray-400 mt-6">Date de mise à jour : 01/04/2019.</p>
          </div>

        </div>
      </div>
    </div>
  );
}
