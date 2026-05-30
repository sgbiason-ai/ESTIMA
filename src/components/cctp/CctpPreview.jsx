// src/components/cctp/CctpPreview.jsx
import React from 'react';
import { Eye, Palette, Download, Edit3, FileText, FileSignature, Cloud, RefreshCw, CheckSquare } from 'lucide-react';
import { generateWordCCTP } from '../../utils/cctpExport';
import { sanitizeHtml } from '../../utils/helpers';
import { RibbonGroup, RibbonBtnLarge, RibbonBtnSmall, RibbonContainer, RibbonSpacer } from '../common/RibbonParts';

const CctpPreview = ({
  cctpData,
  selectedIds,
  variables,
  branding,
  setBrandingModalOpen,
  handlePreviewScroll,
  openEditor,
  handleExportPdf,
  saveToCloud,
  saveStatus,
  onEditProject,
}) => {
  
  const previewContent = [];
  
  const traverse = (nodes, parentPrefix = "") => {
    let counter = 0;
    nodes.forEach((node) => {
      if (!selectedIds.has(node.id)) return;
      counter++;
      const currentNumber = parentPrefix ? `${parentPrefix}.${counter}` : `${counter}`;
      let text = node.content || "";
      
      // Remplacement des variables par les valeurs de la fiche projet
      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        const replacement = value
          ? value
          : `<span class="bg-red-100 text-red-600 font-mono px-1 rounded text-xs" title="Variable non renseignée dans la fiche projet">{{${key}}}</span>`;
        text = text.replace(regex, replacement);
      });
      
      const titleStyle = { fontFamily: branding?.fonts?.headings || 'Arial', fontWeight: 'bold' };
      if (node.level === 1) { 
        titleStyle.color = branding?.colors?.primary || '#1e3a5f'; 
        titleStyle.fontSize = '1.6rem'; 
        titleStyle.textTransform = 'uppercase'; 
      } else if (node.level === 2) { 
        titleStyle.color = branding?.colors?.secondary || '#2563eb'; 
        titleStyle.fontSize = '1.3rem'; 
      } else if (node.level === 3) { 
        titleStyle.color = '#444'; 
        titleStyle.fontSize = '1.2rem'; 
        titleStyle.fontStyle = 'italic'; 
      } else if (node.level === 4) { 
        titleStyle.color = '#000'; 
        titleStyle.fontSize = '1.1rem'; 
      } else { 
        titleStyle.color = '#000'; 
        titleStyle.fontSize = '1rem'; 
        titleStyle.textDecoration = 'underline'; 
      }

      previewContent.push(
        <div 
          key={node.id} 
          id={`preview-node-${node.id}`} 
          className="mb-8 group relative hover:bg-blue-50/30 p-4 -mx-4 rounded transition-colors scroll-mt-24"
        >
          <div className="flex items-baseline border-b border-slate-100 pb-2 mb-3">
            <span style={{...titleStyle, marginRight: '16px', flexShrink: 0}}>{currentNumber}.</span>
            <h3 style={titleStyle}>{node.title}</h3>
          </div>
          <div 
            className="text-sm leading-relaxed text-justify cctp-content" 
            style={{ fontFamily: branding?.fonts?.main || 'Arial', color: branding?.colors?.text || '#374151' }} 
            dangerouslySetInnerHTML={{__html: sanitizeHtml(text)}} 
          />
          <button 
            onClick={() => openEditor(node)} 
            className="absolute top-2 right-2 p-2 bg-white border border-slate-200 shadow-sm rounded-lg text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all"
            title="Éditer le contenu de ce chapitre"
          >
            <Edit3 size={16} />
          </button>
        </div>
      );
      if (node.children) traverse(node.children, currentNumber);
    });
  };
  
  traverse(cctpData);

  // Compte les variables non renseignées
  const missingVars = Object.entries(variables).filter(([, v]) => !v).length;

  return (
    <div className="w-2/3 flex flex-col bg-slate-100/50 relative">

      {/* ═══ RIBBON OFFICE ═══ */}
      <RibbonContainer>
        <RibbonGroup label="Aperçu">
          <div className="flex flex-col items-center gap-0.5 px-1">
            <Eye size={20} className="text-slate-400" />
            <span className="text-[10px] font-bold text-slate-500">
              {selectedIds.size} chap.
            </span>
            {missingVars > 0 && (
              <span className="text-[9px] text-red-400 font-bold" title={`${missingVars} variable(s) non renseignée(s)`}>
                {missingVars} var. ⚠
              </span>
            )}
          </div>
        </RibbonGroup>

        <RibbonGroup label="Document">
          <RibbonBtnLarge icon={Palette} label="Style" onClick={() => setBrandingModalOpen(true)} title="Modifier la charte graphique (couleurs, polices, logo)" accent="text-indigo-600" />
          <RibbonBtnLarge icon={FileSignature} label="Projet" onClick={onEditProject} title="Modifier la fiche projet" accent="text-blue-600" />
        </RibbonGroup>

        <RibbonGroup label="Exporter">
          <RibbonBtnLarge icon={Download} label={<>Word<br/><span className="text-[8px] opacity-60">.docx</span></>} onClick={() => generateWordCCTP(selectedIds, variables, cctpData, branding)} title="Générer et télécharger le document Word (.docx)" accent="text-indigo-600" />
          <div className="flex flex-col gap-0.5">
            <RibbonBtnSmall icon={FileText} label="Export PDF" onClick={handleExportPdf} title="Exporter le CCTP en PDF" accent="text-red-600" />
          </div>
        </RibbonGroup>

        <RibbonSpacer />

        <RibbonGroup label="Cloud" noBorder>
          <div className="flex flex-col items-center gap-1">
            <RibbonBtnLarge icon={Cloud} label="Sauver" onClick={saveToCloud} title="Sauvegarder en Cloud" />
            {saveStatus === 'saving' && (
              <span className="text-[9px] font-bold text-amber-500 uppercase flex items-center gap-1">
                <RefreshCw size={10} className="animate-spin" /> Sync...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-[9px] font-bold text-emerald-500 uppercase flex items-center gap-1">
                <CheckSquare size={10} /> À jour
              </span>
            )}
          </div>
        </RibbonGroup>
      </RibbonContainer>
      
      {/* Aperçu A4 */}
      <div 
        className="flex-1 overflow-y-auto p-8 bg-slate-100/50 scroll-smooth"
        onScroll={handlePreviewScroll}
      >
        <div className="max-w-[21cm] mx-auto min-h-[29.7cm] bg-white shadow-2xl p-[2.5cm] border border-slate-200 transition-all text-slate-800">
          
          {/* En-tête document */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-2 mb-10 text-sm font-sans h-20">
            <div className="w-1/3 text-left">
              <div className="font-bold text-lg" style={{ color: branding?.colors?.primary || '#1e3a5f' }}>
                {variables.name || <span className="text-slate-300 italic">Nom du projet</span>}
              </div>
              <div className="text-slate-500 mt-1">
                {variables.client || <span className="text-slate-300 italic">Maître d'Ouvrage</span>}
              </div>
            </div>
            <div className="w-1/3 flex items-center justify-center h-full">
              <div className="font-black text-2xl italic tracking-widest" style={{ color: branding?.colors?.subtle || '#94a3b8' }}>
                C.C.T.P.
              </div>
            </div>
            <div className="w-1/3 flex justify-end items-start">
              {branding?.logo 
                ? <img src={branding.logo} alt="Logo" className="max-h-14 max-w-[120px] object-contain" /> 
                : <div className="text-xs text-slate-300 italic">Logo ici</div>
              }
            </div>
          </div>

          {/* Contenu */}
          {previewContent.length > 0 ? previewContent : (
            <div className="flex flex-col items-center justify-center h-96 text-slate-300">
              <FileText size={40} className="mb-2 opacity-20" />
              <p className="text-sm">Sélectionnez des chapitres à gauche</p>
              <p className="text-xs mt-1 opacity-60">ou cliquez sur "Auto" pour une sélection automatique</p>
            </div>
          )}

          {/* Pied de page */}
          <div className="mt-20 pt-4 border-t border-slate-200 flex justify-between text-[10px] text-slate-400 font-mono">
            <span className="w-1/3">{variables.code || 'REF'}</span>
            <span className="w-1/3 text-center">Page 1 / X</span>
            <span className="w-1/3 text-right">{new Date().toLocaleDateString("fr-FR")}</span>
          </div>
        </div>
        <div className="h-20"></div>
      </div>
    </div>
  );
};

export default CctpPreview;