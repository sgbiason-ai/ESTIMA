import React, { useEffect, useState } from 'react';
import { X, Database, Search, Save, AlertCircle, AlertTriangle } from 'lucide-react';

const VariableManagerModal = ({ isOpen, onClose, currentVariables, onUpdate, detectedKeys = [] }) => {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (isOpen) setFormData(currentVariables || {});
  }, [currentVariables, isOpen]);

  if (!isOpen) return null;

  const handleChange = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

  // --- MOTEUR DE VALIDATION ---
  const getErrors = (data) => {
    const errs = {};
    
    if (!data.name || data.name.trim().length < 3) errs.name = "Minimum 3 caractères.";
    if (!data.client || data.client.trim().length < 3) errs.client = "Minimum 3 caractères.";
    
    if (!data.code || !/^\d{2}-\d{3,4}$/.test(data.code.trim())) {
      errs.code = "Format requis : AA-XXXX (ex: 26-0001).";
    }

    if (data.clientZip && !/^\d{5}$/.test(data.clientZip.trim())) {
      errs.clientZip = "Doit contenir 5 chiffres.";
    }

    const specialCharRegex = /[<>{}[\]$|\\^~]/;
    ['clientCity', 'location', 'clientAddress', 'moe'].forEach(field => {
      if (data[field] && specialCharRegex.test(data[field])) {
        errs[field] = "Caractères < > { } [ ] $ interdits.";
      }
    });

    // Les variables dynamiques "inconnues" doivent obligatoirement être remplies
    dynamicKeys.forEach(key => {
      if (!data[key] || data[key].trim() === '') {
        errs[key] = "Ce champ est obligatoire pour le document.";
      }
    });

    return errs;
  };

  const standardFields = [
    { key: 'name', label: 'Nom de l\'opération', placeholder: 'Ex: AMÉNAGEMENT DU CENTRE...', colSpan: 2 },
    { key: 'client', label: 'Maître d\'Ouvrage (Client)', placeholder: 'Ex: MAIRIE DE...', colSpan: 2 },
    { key: 'clientAddress', label: 'Adresse (Rue)', placeholder: 'Ex: 10 rue de la Mairie', colSpan: 2 },
    { key: 'clientZip', label: 'Code Postal', placeholder: 'Ex: 81550', colSpan: 1 },
    { key: 'clientCity', label: 'Ville', placeholder: 'Ex: BOUT DU PONT...', colSpan: 1 },
    { key: 'location', label: 'Lieu de réalisation', placeholder: 'Ex: Rue de l\'étoile', colSpan: 1 },
    { key: 'code', label: 'Code Affaire', placeholder: 'Ex: 26-0001', colSpan: 1 },
    { key: 'moe', label: 'Maître d\'Oeuvre', placeholder: 'Ex: PAPYRUS', colSpan: 1 },
    { key: 'phase', label: 'Phase', placeholder: 'Ex: AVP', colSpan: 1 },
  ];

  const dynamicKeys = detectedKeys.filter(k => !standardFields.some(s => s.key === k));
  const errors = getErrors(formData);
  const hasErrors = Object.keys(errors).length > 0;

  const handleSave = () => {
    if (!hasErrors) {
      onUpdate(formData);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Database size={20} /></div>
            <div>
                <h3 className="font-bold text-slate-800 text-lg">Variables du Projet</h3>
                <p className="text-xs text-slate-500">Vérifiez les valeurs qui remplaceront les balises <code>{`{{...}}`}</code></p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"><X size={20}/></button>
        </div>

        <div className="overflow-y-auto p-6 space-y-8 flex-1">
            <section>
                <div className="flex justify-between items-end mb-4 border-b border-slate-100 pb-2">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Fiche Projet</h4>
                    <span className="text-[10px] text-slate-400 italic">Synchronisé automatiquement</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    {standardFields.map((field) => {
                        const isError = !!errors[field.key];
                        return (
                          <div key={field.key} className={field.colSpan === 2 ? 'col-span-2' : 'col-span-1'}>
                              <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 flex justify-between ${isError ? 'text-red-600' : 'text-slate-500'}`}>
                                  <span>{field.label}</span>
                                  <code className={`text-[9px] px-1 rounded font-normal lowercase ${isError ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-400'}`}>
                                    {`{{${field.key}}}`}
                                  </code>
                              </label>
                              <input 
                                  type="text" value={formData[field.key] || ''} onChange={(e) => handleChange(field.key, e.target.value)} 
                                  className={`w-full p-2.5 rounded-lg outline-none text-sm font-semibold transition-colors
                                    ${isError 
                                      ? 'bg-red-50/50 border border-red-300 text-red-900 focus:border-red-500 focus:ring-2 focus:ring-red-100' 
                                      : 'bg-slate-50 border border-slate-200 text-slate-700 focus:border-indigo-500 focus:bg-white hover:border-slate-300'
                                    }`} 
                                  placeholder={field.placeholder} 
                              />
                              {isError && <span className="text-[10px] text-red-500 mt-1 ml-1 font-semibold flex items-center gap-1"><AlertTriangle size={10} /> {errors[field.key]}</span>}
                          </div>
                        );
                    })}
                </div>
            </section>

            <section>
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                    <h4 className="text-xs font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2"><Search size={12} /> Variables détectées</h4>
                    <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full">{dynamicKeys.length} trouvée(s)</span>
                </div>
                
                {dynamicKeys.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                        <p className="text-sm text-slate-400 italic">Aucune variable spéciale détectée dans vos documents.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        {dynamicKeys.map((key) => {
                          const isError = !!errors[key];
                          return (
                            <div key={key} className="group col-span-2 sm:col-span-1">
                                <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 flex justify-between items-center ${isError ? 'text-red-600' : 'text-indigo-600'}`}>
                                    <span>{key.replace(/_/g, ' ')}</span>
                                    <code className={`text-[9px] px-1.5 py-0.5 rounded font-normal lowercase border ${isError ? 'bg-red-50 text-red-500 border-red-100' : 'bg-indigo-50 text-indigo-400 border-indigo-100'}`}>
                                        {`{{${key}}}`}
                                    </code>
                                </label>
                                <input 
                                    type="text" value={formData[key] || ''} onChange={(e) => handleChange(key, e.target.value)} 
                                    className={`w-full p-2.5 rounded-lg outline-none text-sm font-medium shadow-sm transition-colors
                                      ${isError 
                                        ? 'bg-red-50/50 border border-red-300 text-red-900 focus:border-red-500 focus:ring-2 focus:ring-red-100' 
                                        : 'bg-white border border-indigo-200 text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
                                      }`}
                                    placeholder="Saisir une valeur..." 
                                />
                                {isError && <span className="text-[10px] text-red-500 mt-1 ml-1 font-semibold flex items-center gap-1"><AlertTriangle size={10} /> {errors[key]}</span>}
                            </div>
                          );
                        })}
                    </div>
                )}
            </section>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2 text-xs">
                {hasErrors ? (
                  <span className="text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 font-semibold flex items-center gap-1">
                    <AlertTriangle size={14} /> Veuillez corriger les erreurs.
                  </span>
                ) : (
                  <span className="text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100 flex items-center gap-1">
                    <AlertCircle size={14} /> Mise à jour immédiate.
                  </span>
                )}
            </div>
            <button 
                onClick={handleSave} 
                disabled={hasErrors}
                className={`px-6 py-2.5 rounded-xl shadow-lg text-sm font-bold flex items-center gap-2 transition-all 
                  ${hasErrors 
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' 
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 active:scale-95'
                  }`}
            >
                <Save size={16} /> Appliquer les variables
            </button>
        </div>
      </div>
    </div>
  );
};

export default VariableManagerModal;