import React, { useState, useRef } from 'react';
import { confirm } from '../utils/globalUI';
import * as XLSX from 'xlsx';
import {
  Settings, Ruler, Trash2, Upload, FileSpreadsheet,
  AlertTriangle, Edit2, X, Check, ListOrdered, Hash,
  HelpCircle, Info, AlertCircle, FileJson, ArrowRight, Save,
  MousePointer2
} from 'lucide-react';
import HelpPanel from '../components/help/HelpPanel';
import { APP_VERSION } from '../data/changelog';

const SettingsView = ({
  units,
  saveUnit,
  deleteUnit,
  importFromExcel,
  clearBpu,
  bpuConfig,
  setBpuConfig,
  importWarnings = [],
  setImportWarnings,
}) => {
  // --- ÉTATS LOCAUX ---
  const [symb, setSymb] = useState("");
  const [lab, setLab] = useState("");
  const [originalSymb, setOriginalSymb] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  
  // --- ÉTATS POUR LA CONVERSION JSON & MAPPING ---
  const [pendingJsonData, setPendingJsonData] = useState(null); 
  const [showUnitMapModal, setShowUnitMapModal] = useState(false); 
  const [missingUnits, setMissingUnits] = useState([]); 
  const [unitMap, setUnitMap] = useState({}); 

  const fileInputRef = useRef(null);
  const jsonInputRef = useRef(null);

  // --- ACTIONS ---
  const handleSubmit = (e) => {
    e.preventDefault();
    if (symb && lab) {
      if (isEditing && originalSymb && originalSymb !== symb) {
        deleteUnit(originalSymb);
      }
      saveUnit(symb, lab);
      resetForm();
    }
  };

  const startEdit = (unit) => {
    setSymb(unit.symbol);
    setLab(unit.label);
    setOriginalSymb(unit.symbol);
    setIsEditing(true);
    document.querySelector('form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const resetForm = () => {
    setSymb(""); 
    setLab(""); 
    setIsEditing(false);
    setOriginalSymb(null);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      importFromExcel(file);
      e.target.value = null; 
    }
  };

  // --- 1. LECTURE ET ANALYSE DU FICHIER ---
  const handleConvertXlsxToJson = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      
      const rawData = data.slice(1).map(row => {
        if (!row[0]) return null;
        return {
          id: row[0],
          bpuNum: row[0], 
          designation: row[1] || "",
          description: row[2] || "",
          unit: (row[3] || "u").trim(),
          price: row[4] || 0
        };
      }).filter(item => item !== null);

      const knownSymbols = units.map(u => u.symbol);
      const unknownSet = new Set();

      rawData.forEach(item => {
        if (!knownSymbols.includes(item.unit)) {
          unknownSet.add(item.unit);
        }
      });

      if (unknownSet.size > 0) {
        setMissingUnits(Array.from(unknownSet));
        setPendingJsonData(rawData); 
        const initialMap = {};
        unknownSet.forEach(u => initialMap[u] = ""); 
        setUnitMap(initialMap);
        setShowUnitMapModal(true);
      } else {
        downloadJson(rawData);
      }
      e.target.value = null;
    };
    reader.readAsBinaryString(file);
  };

  // --- 2. FONCTION DE TÉLÉCHARGEMENT ---
  const downloadJson = (data) => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `bpu_converted_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- 3. APPLICATION DU MAPPING ET VALIDATION ---
  const handleConfirmMapping = () => {
    if (!pendingJsonData) return;
    const correctedData = pendingJsonData.map(item => {
      if (unitMap[item.unit]) {
        return { ...item, unit: unitMap[item.unit] };
      }
      return item;
    });
    downloadJson(correctedData);
    setShowUnitMapModal(false);
    setPendingJsonData(null);
    setMissingUnits([]);
  };

  const toggleNumberingMode = (mode) => {
    setBpuConfig(prev => ({ ...prev, numberingMode: mode }));
  };

  // ─── RENDU STANDARD DES PARAMÈTRES ──────────
  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden relative">
      
      {/* --- MODALE DE MAPPING DES UNITÉS --- */}
      {showUnitMapModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-modal flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 bg-amber-50">
              <div className="flex items-center gap-3 text-amber-800">
                <AlertCircle size={24} />
                <h3 className="font-black uppercase text-sm tracking-wide">Conversion des Unités</h3>
              </div>
              <p className="text-[11px] text-amber-700 mt-2">
                Le fichier contient des unités absentes de votre bibliothèque. Veuillez les faire correspondre pour garantir la compatibilité.
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {missingUnits.map((unknownUnit, index) => (
                <div key={index} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex-1 text-right">
                    <span className="text-xs font-bold text-red-600 line-through decoration-red-300" title="Unité trouvée dans le fichier Excel">{unknownUnit}</span>
                  </div>
                  <ArrowRight size={16} className="text-slate-400" />
                  <div className="flex-1">
                    <select 
                      className="w-full text-xs font-bold bg-white border border-slate-300 rounded px-2 py-1.5 outline-none focus:border-emerald-500"
                      value={unitMap[unknownUnit] || ""}
                      onChange={(e) => setUnitMap(prev => ({ ...prev, [unknownUnit]: e.target.value }))}
                      title="Sélectionnez l'unité correspondante dans votre bibliothèque"
                    >
                      <option value="" disabled>Choisir...</option>
                      {units.map(u => (
                        <option key={u.symbol} value={u.symbol}>{u.symbol} - {u.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => setShowUnitMapModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                title="Annuler la conversion"
              >
                Annuler
              </button>
              <button 
                onClick={handleConfirmMapping}
                disabled={Object.values(unitMap).some(v => v === "")} 
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wide rounded-lg shadow-md flex items-center gap-2 transition-all"
                title="Valider les correspondances et télécharger le fichier JSON"
              >
                <Save size={14} /> Valider & Télécharger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="flex-none bg-white p-6 border-b border-slate-200 shadow-sm z-10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-black p-2 rounded"><Settings className="text-white" size={20} /></div>
            <div>
              <h2 className="text-xl font-black uppercase text-slate-800 leading-none">Paramètres</h2>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-1.5">Configuration & Base de données</p>
            </div>
          </div>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200"
            title="Version installée d'EstimaVRD"
          >
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Version</span>
            <span className="text-xs font-black text-slate-700 tracking-tight">{APP_VERSION}</span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl w-full mx-auto space-y-8 pb-24">
          
          {/* SECTION 1 : CONFIGURATION NUMÉROTATION */}
          <section className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm relative group/section">
            <div className="absolute top-4 right-4 opacity-0 group-hover/section:opacity-100 transition-opacity">
                <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100">Modifie l'affichage des réf. dans les devis</span>
            </div>
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
              <ListOrdered size={20} className="text-blue-600" />
              <h3 className="font-black uppercase text-xs tracking-widest text-slate-700">Mode de Numérotation BPU</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div 
                onClick={() => toggleNumberingMode('auto')}
                title="Cliquez pour activer le mode Automatique"
                className={`cursor-pointer p-4 rounded-lg border-2 transition-all flex items-start gap-3 ${bpuConfig?.numberingMode !== 'manual' ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-slate-300'}`}
              >
                <div className={`mt-1 p-1 rounded-full ${bpuConfig?.numberingMode !== 'manual' ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                    <Check size={12} />
                </div>
                <div>
                    <h4 className={`font-bold text-sm uppercase ${bpuConfig?.numberingMode !== 'manual' ? 'text-blue-800' : 'text-slate-600'}`}>Automatique</h4>
                    <p className="text-[10px] text-slate-500 mt-1">Le logiciel numérote les prix séquentiellement (P.1, P.2, P.3...) lors de l'export.</p>
                </div>
              </div>

              <div 
                onClick={() => toggleNumberingMode('manual')}
                title="Cliquez pour activer le mode Manuel (utilise la colonne A de votre Excel)"
                className={`cursor-pointer p-4 rounded-lg border-2 transition-all flex items-start gap-3 ${bpuConfig?.numberingMode === 'manual' ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-slate-300'}`}
              >
                <div className={`mt-1 p-1 rounded-full ${bpuConfig?.numberingMode === 'manual' ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                    <Hash size={12} />
                </div>
                <div>
                    <h4 className={`font-bold text-sm uppercase ${bpuConfig?.numberingMode === 'manual' ? 'text-blue-800' : 'text-slate-600'}`}>Manuelle / Personnalisée</h4>
                    <p className="text-[10px] text-slate-500 mt-1">Utilise les numéros définis dans votre fichier Excel ou lors de la création.</p>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2 : IMPORTATION EXCEL */}
          <section className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm border-t-4 border-t-emerald-500 relative">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 p-2 rounded-lg">
                  <FileSpreadsheet size={24} className="text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-black uppercase text-sm tracking-widest text-slate-700">Importation & Conversion</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Gérer la bibliothèque (.xlsx)</p>
                </div>
              </div>
              
              <button 
                onClick={() => setShowHelp(!showHelp)}
                title="Afficher/Masquer le guide complet sur le format Excel attendu"
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${showHelp ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                <HelpCircle size={14} /> {showHelp ? 'Masquer l\'aide' : 'Format Excel ?'}
              </button>
            </div>

            <HelpPanel isOpen={showHelp} onClose={() => setShowHelp(false)} moduleId="settings" />
            
            <div className="bg-slate-50 p-6 rounded-xl border border-dashed border-slate-200 flex flex-col items-center text-center space-y-4">
              <div className="flex gap-2 items-center text-[10px] font-bold text-slate-500 uppercase">
                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">1. Numero</span>
                <span className="bg-slate-200 px-2 py-0.5 rounded">2. Designation</span>
                <span className="bg-slate-200 px-2 py-0.5 rounded">3. Description</span>
                <span className="bg-slate-200 px-2 py-0.5 rounded">4. Unite</span>
                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">5. Prix</span>
              </div>
              
              {/* INPUTS CACHÉS */}
              <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              <input type="file" accept=".xlsx, .xls" ref={jsonInputRef} onChange={handleConvertXlsxToJson} className="hidden" />

              <div className="flex flex-col md:flex-row gap-4 w-full justify-center">
                {/* BOUTON IMPORT PRINCIPAL */}
                <div className="flex flex-col items-center gap-2">
                    <button 
                    onClick={() => fileInputRef.current.click()}
                    title="Charge le fichier Excel directement dans la base de données actuelle (navigateur)"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg shadow-lg text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 active:scale-95"
                    >
                    <Upload size={18} /> Import vers Bibliothèque
                    </button>
                    <span className="text-[9px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">Usage Direct</span>
                </div>

                {/* BOUTON CONVERSION JSON */}
                <div className="flex flex-col items-center gap-2">
                    <button 
                    onClick={() => jsonInputRef.current.click()}
                    title="Convertit un fichier Excel en JSON propre et télécharge le résultat (sans modifier la base)"
                    className="bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 px-6 py-3 rounded-lg shadow text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 active:scale-95"
                    >
                    <FileJson size={18} /> Convertir XLS en JSON
                    </button>
                    <span className="text-[9px] text-blue-700 font-bold bg-blue-100 px-2 py-0.5 rounded">Outil de Conversion</span>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3 : UNITÉS */}
          <section className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                 <Ruler size={20} className="text-emerald-600" />
                 <h3 className="font-black uppercase text-xs tracking-widest text-slate-700">Dictionnaire des Unités</h3>
              </div>
              <div className="text-[10px] text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-100 flex items-center gap-2">
                 <MousePointer2 size={12} />
                 Utilisées dans les menus déroulants lors de la création d'articles
              </div>
            </div>

            <form onSubmit={handleSubmit} className={`grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 p-6 rounded-lg border transition-colors ${isEditing ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="relative group">
                <input 
                  type="text" 
                  value={symb} 
                  onChange={(e) => setSymb(e.target.value)} 
                  className="w-full bg-white border border-slate-200 rounded px-4 py-2 text-sm font-bold focus:border-emerald-500 outline-none" 
                  placeholder="Symbole (ex: m²)"
                  title="Ce symbole sera affiché dans les devis (ex: ml, m², u)"
                  required 
                />
                <span className="hidden group-hover:block absolute -bottom-5 left-0 text-[9px] text-slate-500 bg-white border px-1 rounded shadow-sm z-10">Court (ex: m²)</span>
                {isEditing && <span className="absolute -top-2 left-2 text-[8px] bg-amber-200 text-amber-800 px-1 rounded font-bold">ÉDITION</span>}
              </div>
              
              <div className="relative group">
                <input 
                  type="text" 
                  value={lab} 
                  onChange={(e) => setLab(e.target.value)} 
                  className="bg-white border border-slate-200 rounded px-4 py-2 text-sm font-medium focus:border-emerald-500 outline-none" 
                  placeholder="Libellé complet"
                  title="Description complète pour votre information (ex: Mètre Carré)"
                  required 
                />
                <span className="hidden group-hover:block absolute -bottom-5 left-0 text-[9px] text-slate-500 bg-white border px-1 rounded shadow-sm z-10">Long (ex: Mètre Carré)</span>
              </div>
              
              <div className="flex gap-2">
                {isEditing && (
                  <button type="button" onClick={resetForm} className="bg-white text-slate-500 border border-slate-200 py-2 px-3 rounded hover:bg-slate-100 transition-colors" title="Annuler l'édition">
                    <X size={16} />
                  </button>
                )}
                <button 
                  type="submit" 
                  title={isEditing ? "Enregistrer les modifications" : "Ajouter cette nouvelle unité"}
                  className={`flex-1 text-white py-2 rounded font-black text-[10px] uppercase tracking-widest shadow-md flex items-center justify-center gap-2 transition-colors ${isEditing ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                >
                   {isEditing ? <><Check size={14}/> Mettre à jour</> : 'Enregistrer'}
                </button>
              </div>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {units.map((u) => (
                <div key={u.symbol} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded group hover:border-emerald-200 shadow-sm transition-all">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-black text-emerald-600 min-w-[40px]">{u.symbol}</span>
                    <span className="text-xs font-bold text-slate-600">{u.label}</span>
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      type="button"
                      onClick={() => startEdit(u)} 
                      className="p-1.5 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded transition-colors"
                      title="Modifier cette unité"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      type="button"
                      onClick={async () => { const ok = await confirm("Supprimer cette unité ?", { danger: true }); if (ok) deleteUnit(u.symbol); }} 
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Supprimer définitivement"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ZONE DE DANGER */}
          <section className="bg-white p-8 rounded-xl border border-red-200 shadow-sm border-t-4 border-t-red-500">
            <div className="flex items-center gap-3 mb-6">
              <AlertTriangle size={24} className="text-red-600" />
              <div>
                <h3 className="font-black uppercase text-sm tracking-widest text-red-600">Zone de Danger</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Actions irréversibles</p>
              </div>
            </div>
            
            <div className="p-6 bg-red-50 rounded-lg border border-red-100 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <p className="text-xs font-black text-red-900 uppercase mb-1">Vider la bibliothèque</p>
                <p className="text-[11px] text-red-700 font-medium italic">Supprime tous les articles importés ou créés dans votre base de données locale.</p>
              </div>
              <button 
                onClick={clearBpu}
                title="Attention : Cette action effacera toutes les données locales !"
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded font-black text-[10px] uppercase tracking-[0.2em] shadow-lg flex items-center gap-2 active:scale-95 transition-all"
              >
                <Trash2 size={16} /> Effacer la base
              </button>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

export default SettingsView;