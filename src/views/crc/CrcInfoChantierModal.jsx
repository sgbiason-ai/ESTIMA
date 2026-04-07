// src/views/crc/CrcInfoChantierModal.jsx
// Modal d'informations du chantier CRC
import React, { useRef } from 'react';
import { X, MapPin, Calendar, Clock, Building2, Download, FolderOpen, HardDrive, FileSignature, ImagePlus, Trash2 } from 'lucide-react';

const ChantierField = ({ label, icon: Icon, field, type = 'text', placeholder, chantierInfo, updateChantierInfo }) => (
  <div>
    <label className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mb-1.5">
      {Icon && <Icon size={11} />}
      {label}
    </label>
    <input
      type={type}
      value={chantierInfo[field] || ''}
      onChange={(e) => updateChantierInfo({ [field]: e.target.value })}
      placeholder={placeholder}
      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all text-slate-800"
    />
  </div>
);

export default function CrcInfoChantierModal({ isOpen, onClose, chantierInfo, updateChantierInfo, exportDirKey }) {
  const logoInputRef = useRef(null);

  if (!isOpen) return null;

  const handleLogoUpload = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => updateChantierInfo({ communeLogo: e.target.result });
    reader.readAsDataURL(file);
  };

  const handlePickFolder = async () => {
    try {
      if (!('showDirectoryPicker' in window)) {
        alert('Cette fonctionnalite necessite Chrome ou Edge.');
        return;
      }
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      const { saveDirHandle } = await import('../../utils/exportHelpers');
      await saveDirHandle(exportDirKey, handle);
      updateChantierInfo({ exportPath: handle.name });
    } catch { /* utilisateur a annule */ }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-h-[90vh] overflow-y-auto" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50">
              <Building2 size={18} className="text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Fiche Info Chantier</h3>
              <p className="text-[10px] text-gray-400">Informations générales du chantier</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl transition-all">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <ChantierField label="Nom du chantier" icon={Building2} field="nom" placeholder="Ex: AMENAGEMENT TRAVERSE ST ALBY" chantierInfo={chantierInfo} updateChantierInfo={updateChantierInfo} />
          <ChantierField label="Lieu" icon={MapPin} field="lieu" placeholder="Ex: Commune d'Aiguefonde (81)" chantierInfo={chantierInfo} updateChantierInfo={updateChantierInfo} />

          {/* Logo commune */}
          <div>
            <label className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium mb-1.5">
              <ImagePlus size={11} />
              Logo de la commune
            </label>
            {chantierInfo.communeLogo ? (
              <div className="flex items-center gap-3 p-3 border border-gray-200/60 rounded-xl bg-gray-50">
                <img
                  src={chantierInfo.communeLogo}
                  alt="Logo commune"
                  className="max-h-12 max-w-[100px] object-contain rounded"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">Logo chargé</p>
                  <button
                    onClick={() => updateChantierInfo({ communeLogo: null })}
                    className="text-xs text-red-400 hover:text-red-600 mt-0.5 transition-colors"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => logoInputRef.current?.click()}
                onDrop={(e) => { e.preventDefault(); handleLogoUpload(e.dataTransfer.files?.[0]); }}
                onDragOver={(e) => e.preventDefault()}
                className="w-full flex flex-col items-center justify-center gap-1.5 px-3 py-5 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/50 transition-all cursor-pointer"
              >
                <ImagePlus size={20} />
                <span className="text-xs font-medium">Glisser-déposer ou cliquer</span>
                <span className="text-[10px] text-gray-300">PNG, JPG, SVG</span>
              </div>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleLogoUpload(e.target.files?.[0])}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <ChantierField label="Duree de preparation" icon={Clock} field="dureePreparation" placeholder="Ex: 1 mois" chantierInfo={chantierInfo} updateChantierInfo={updateChantierInfo} />
            <ChantierField label="Duree du chantier" icon={Clock} field="dureeChantier" placeholder="Ex: 8 mois" chantierInfo={chantierInfo} updateChantierInfo={updateChantierInfo} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ChantierField label="Date de debut" icon={Calendar} field="dateDebut" type="date" chantierInfo={chantierInfo} updateChantierInfo={updateChantierInfo} />
            <ChantierField label="Date de fin" icon={Calendar} field="dateFin" type="date" chantierInfo={chantierInfo} updateChantierInfo={updateChantierInfo} />
          </div>

          {/* Section Exports */}
          <div className="pt-3 mt-2 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-600 mb-3 flex items-center gap-1.5">
              <Download size={12} />
              Configuration des exports
            </p>

            {/* Dossier export */}
            <div className="mb-3">
              <label className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mb-1.5">
                <HardDrive size={11} />
                Dossier d'export
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chantierInfo.exportPath || ''}
                  onChange={(e) => updateChantierInfo({ exportPath: e.target.value })}
                  placeholder="Aucun dossier selectionne"
                  readOnly
                  className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-600 cursor-default"
                />
                <button
                  onClick={handlePickFolder}
                  className="px-3 py-2 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-xl hover:bg-emerald-100 transition-all border border-emerald-200 flex items-center gap-1.5 whitespace-nowrap"
                >
                  <FolderOpen size={13} />
                  Parcourir
                </button>
              </div>
            </div>

            {/* Pattern nom de fichier */}
            <div>
              <label className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mb-1.5">
                <FileSignature size={11} />
                Nom des fichiers exports
              </label>
              <input
                type="text"
                value={chantierInfo.exportPattern || ''}
                onChange={(e) => updateChantierInfo({ exportPattern: e.target.value })}
                placeholder="CR{N}_{NOM}_{DATE}"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all text-slate-800 font-mono"
              />
              <p className="text-[9px] text-slate-400 mt-1">
                Variables : <span className="font-mono text-slate-500">{'{N}'}</span> numero CR &nbsp;|&nbsp; <span className="font-mono text-slate-500">{'{NOM}'}</span> nom chantier &nbsp;|&nbsp; <span className="font-mono text-slate-500">{'{DATE}'}</span> date reunion
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200/60 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all active:scale-[0.97]">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
