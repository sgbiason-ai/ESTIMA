// src/views/estimRapide/TemplatePickerModal.jsx
// Choix d'un template (intégré ou modèle utilisateur) à la création.
import React, { useState } from 'react';
import { X, Check, Layers, Trash2, Bookmark } from 'lucide-react';
import { TEMPLATES } from '../../data/estimRapideTemplates';

export default function TemplatePickerModal({ templates = [], onCreate, onCreateCustom, onDeleteTemplate, onClose }) {
  const [name, setName] = useState('');
  const [sel, setSel] = useState({ kind: 'builtin', id: 'lotissement' });

  const handleCreate = () => {
    const finalName = name.trim() || 'Nouvelle estimation';
    if (sel.kind === 'custom') {
      const tpl = templates.find(t => t.id === sel.id);
      if (tpl) onCreateCustom(tpl, finalName);
    } else {
      onCreate(sel.id, finalName);
    }
  };

  const Option = ({ active, onClick, title, desc, count, onDelete }) => (
    <button onClick={onClick}
      className={`group/opt w-full text-left flex items-start gap-3 p-3.5 rounded-xl border transition-all ${active ? 'border-emerald-400 bg-emerald-50/60 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
      <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${active ? 'bg-emerald-600 text-white' : 'border-2 border-slate-300'}`}>
        {active && <Check size={12} strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-sm text-slate-900">{title}</span>
        {desc && <span className="block text-[12px] text-slate-500 mt-0.5">{desc}</span>}
        <span className="text-[10px] text-slate-400 mt-1 flex items-center gap-1"><Layers size={10} /> {count} lots</span>
      </span>
      {onDelete && (
        <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover/opt:opacity-100 p-1 text-slate-400 hover:text-red-500 rounded transition" title="Supprimer ce modèle">
          <Trash2 size={14} />
        </span>
      )}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Nouvelle estimation</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 overflow-y-auto space-y-5">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Nom</label>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              placeholder="Ex : Lotissement Les Jardins — APS"
              className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition" />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Modèle de départ</label>
            <div className="space-y-2">
              {TEMPLATES.map(t => (
                <Option key={t.id} active={sel.kind === 'builtin' && sel.id === t.id}
                  onClick={() => setSel({ kind: 'builtin', id: t.id })}
                  title={t.name} desc={t.description} count={t.lotKeys.length} />
              ))}
            </div>
          </div>

          {templates.length > 0 && (
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5"><Bookmark size={12} /> Mes modèles</label>
              <div className="space-y-2">
                {templates.map(t => (
                  <Option key={t.id} active={sel.kind === 'custom' && sel.id === t.id}
                    onClick={() => setSel({ kind: 'custom', id: t.id })}
                    title={t.name} count={(t.lots || []).length}
                    onDelete={onDeleteTemplate ? () => onDeleteTemplate(t.id) : null} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition">Annuler</button>
          <button onClick={handleCreate}
            className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm hover:shadow-md transition">Créer</button>
        </div>
      </div>
    </div>
  );
}
