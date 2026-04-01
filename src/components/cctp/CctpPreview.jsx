// src/components/cctp/CctpPreview.jsx
import React from 'react';
import { Eye, Palette, Download, Edit3, FileText } from 'lucide-react';
import { generateWordCCTP } from '../../utils/cctpExport';
import { sanitizeHtml } from '../../utils/helpers';

const CctpPreview = ({
  cctpData,
  selectedIds,
  variables,
  branding,
  setBrandingModalOpen,
  handlePreviewScroll,
  openEditor
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

      {/* Barre d'outils */}
      <div className="p-4 border-b border-slate-200 bg-white h-16 flex justify-between items-center shadow-sm z-10 sticky top-0">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-slate-100 rounded-lg text-slate-500"><Eye size={20} /></div>
          <div>
            <h3 className="font-black text-slate-700 uppercase text-sm tracking-widest">Aperçu du document</h3>
            <p className="text-[10px] text-slate-400 font-bold">
              {selectedIds.size} chapitre{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
              {missingVars > 0 && (
                <span className="ml-2 text-red-400" title={`${missingVars} variable(s) non renseignée(s) dans la fiche projet`}>
                  · {missingVars} var. manquante{missingVars > 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => setBrandingModalOpen(true)} 
            className="px-4 py-2 hover:bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100 shadow-sm flex items-center gap-2 text-xs font-black uppercase tracking-wider transition-all"
            title="Modifier la charte graphique (couleurs, polices, logo) depuis les Paramètres"
          >
            <Palette size={16} /> Style
          </button>
          <button 
            onClick={() => generateWordCCTP(selectedIds, variables, cctpData, branding)} 
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-200 flex items-center gap-2 transition-all active:scale-95 text-xs font-black uppercase tracking-wider hover:-translate-y-0.5"
            title="Générer et télécharger le document Word (.docx) avec les chapitres sélectionnés et les variables du projet"
          >
            <Download size={16} /> Générer le Word (.docx)
          </button>
        </div>
      </div>
      
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