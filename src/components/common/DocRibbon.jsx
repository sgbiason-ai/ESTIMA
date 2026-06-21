// src/components/common/DocRibbon.jsx
// Ruban partagé des modules documentaires (CCTP / RC / CCAP).
// Organisation : Aperçu · Importer (Word/PDF/Modèle) · Document (Champs) ·
// Exporter (Word/JSON) — puis, à droite : indicateur d'enregistrement PROJET
// (auto, continu) nettement séparé du bouton GABARIT (action rare, partagée,
// protégée par une confirmation « tapez GABARIT »).
import React, { useRef, useState } from 'react';
import {
  Eye, Download, UploadCloud, FileText, FileSignature,
  Cloud, RefreshCw, CheckSquare, AlertTriangle,
} from 'lucide-react';
import { RibbonGroup, RibbonBtnLarge, RibbonContainer, RibbonSpacer } from './RibbonParts';
import TypedConfirmModal from './TypedConfirmModal';

// Indicateur d'enregistrement du PROJET : automatique et continu — distinct du
// Gabarit. Quatre états : enregistrement… / enregistré / hors-ligne / à jour.
const ProjectSaveIndicator = ({ status }) => {
  const map = {
    saving: { icon: RefreshCw,    spin: true,  color: 'text-amber-500',   text: 'text-amber-600',   label: <>Enregis-<br />trement…</> },
    error:  { icon: AlertTriangle, spin: false, color: 'text-red-500',     text: 'text-red-600',     label: <>Hors-ligne<br />brouillon gardé</> },
    saved:  { icon: CheckSquare,  spin: false, color: 'text-emerald-500', text: 'text-emerald-600', label: <>Projet<br />enregistré</> },
    idle:   { icon: CheckSquare,  spin: false, color: 'text-slate-300',   text: 'text-slate-400',   label: 'À jour' },
  };
  const s = map[status] || map.idle;
  const Icon = s.icon;
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-1 min-w-[64px]">
      <Icon size={18} className={`${s.color} ${s.spin ? 'animate-spin' : ''}`} />
      <span className={`text-[9px] font-bold uppercase leading-tight text-center ${s.text}`}>{s.label}</span>
    </div>
  );
};

const DocRibbon = ({
  docType,                // 'CCTP' | 'RC' | 'CCAP' (libellés)
  selectedCount = 0,
  missingVars = 0,
  onEditVariables,        // Champs
  onImportWord,           // import .docx (onChange input fichier)
  onImportPdf,            // import .pdf  (optionnel)
  onLoadTemplate,         // charger le modèle type (optionnel : RC)
  onExportWord,           // export Word (.docx)
  onExportMaster,         // sauvegarde JSON de la structure
  saveStatus = 'idle',    // statut d'enregistrement projet
  onSaveTemplate,         // enregistrer comme gabarit maître (après confirmation)
}) => {
  const wordInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const [tplModalOpen, setTplModalOpen] = useState(false);

  return (
    <>
      <RibbonContainer>
        {/* ═══ Aperçu ═══ */}
        <RibbonGroup label="Aperçu">
          <div className="flex flex-col items-center gap-0.5 px-1">
            <Eye size={20} className="text-slate-400" />
            <span className="text-[10px] font-bold text-slate-500">{selectedCount} chap.</span>
            {missingVars > 0 && (
              <span className="text-[9px] text-red-400 font-bold" title={`${missingVars} variable(s) non renseignée(s)`}>
                {missingVars} var. ⚠
              </span>
            )}
          </div>
        </RibbonGroup>

        {/* ═══ Importer ═══ */}
        <RibbonGroup label="Importer">
          <RibbonBtnLarge
            icon={UploadCloud}
            label="Word"
            onClick={() => wordInputRef.current?.click()}
            title="Importer un document Word (.docx) — remplace la structure actuelle"
            accent="text-slate-600"
          />
          {onImportPdf && (
            <RibbonBtnLarge
              icon={FileText}
              label="PDF"
              onClick={() => pdfInputRef.current?.click()}
              title="Importer un document PDF (structure et texte reconstruits par chapitre)"
              accent="text-red-500"
            />
          )}
          {onLoadTemplate && (
            <RibbonBtnLarge
              icon={FileText}
              label="Modèle"
              onClick={onLoadTemplate}
              title="Charger le modèle type (remplace la structure actuelle)"
              accent="text-cyan-600"
            />
          )}
          <input ref={wordInputRef} type="file" accept=".docx" className="hidden" onChange={onImportWord} />
          {onImportPdf && (
            <input ref={pdfInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={onImportPdf} />
          )}
        </RibbonGroup>

        {/* ═══ Document ═══ */}
        <RibbonGroup label="Document">
          <RibbonBtnLarge
            icon={FileSignature}
            label="Champs"
            onClick={onEditVariables}
            title="Saisir les champs du document (communs, RC, CCAP) — accès à la fiche projet complète depuis la fenêtre"
            accent="text-blue-600"
          />
        </RibbonGroup>

        {/* ═══ Exporter ═══ */}
        <RibbonGroup label="Exporter">
          <RibbonBtnLarge
            icon={Download}
            label="Word"
            onClick={onExportWord}
            title="Générer et télécharger le document Word (.docx)"
            accent="text-indigo-600"
          />
          <RibbonBtnLarge
            icon={Download}
            label="JSON"
            onClick={onExportMaster}
            title="Télécharger une sauvegarde JSON de la structure du document"
            accent="text-amber-600"
          />
        </RibbonGroup>

        <RibbonSpacer />

        {/* ═══ Projet : enregistrement auto (séparé du Gabarit) ═══ */}
        <RibbonGroup label="Projet">
          <ProjectSaveIndicator status={saveStatus} />
        </RibbonGroup>

        {/* ═══ Gabarit : action rare, partagée, protégée ═══ */}
        <RibbonGroup label="Gabarit" noBorder>
          <RibbonBtnLarge
            icon={Cloud}
            label="Gabarit"
            onClick={() => setTplModalOpen(true)}
            title="Enregistrer le contenu actuel comme GABARIT maître partagé (modèle des futurs projets). Le contenu de CE projet est sauvegardé automatiquement."
          />
        </RibbonGroup>
      </RibbonContainer>

      <TypedConfirmModal
        isOpen={tplModalOpen}
        onClose={() => setTplModalOpen(false)}
        onConfirm={() => { onSaveTemplate?.(); setTplModalOpen(false); }}
        word="GABARIT"
        title={`Remplacer le gabarit maître${docType ? ' ' + docType : ''} ?`}
        message={`Ce modèle deviendra la base de TOUS les futurs projets${docType ? ' ' + docType : ''}. Le contenu de ce projet n'est pas affecté (il reste sauvegardé automatiquement).`}
        confirmLabel="Remplacer le gabarit"
      />
    </>
  );
};

export default DocRibbon;
