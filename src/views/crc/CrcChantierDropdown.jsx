// src/views/crc/CrcChantierDropdown.jsx — EstimaStyle
import React, { useState } from 'react';
import { Plus, Trash2, FolderOpen, ChevronDown } from 'lucide-react';
import { confirm } from '../../utils/globalUI';

export default function CrcChantierDropdown({ chantiers, activeId, onSelect, onCreate, onDelete }) {
  const [open, setOpen] = useState(false);
  const active = chantiers.find((c) => c.id === activeId);
  const nom = active?.crrConfig?.chantierInfo?.nom || 'Sélectionner...';

  const handleDelete = async (e, chantier) => {
    e.stopPropagation();
    const ok = await confirm(`Supprimer le chantier "${chantier.crrConfig?.chantierInfo?.nom || 'Sans nom'}" et tous ses comptes rendus ?`, { danger: true });
    if (ok) { onDelete(chantier.id); setOpen(false); }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-xl bg-gray-50 border border-gray-200/60 hover:border-blue-400 text-sm transition-all min-w-[180px] max-w-[260px]"
      >
        <FolderOpen size={14} className="text-blue-500 shrink-0" />
        <span className="text-gray-800 font-medium truncate flex-1 text-left">{nom}</span>
        <ChevronDown size={12} className="text-gray-400 shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200/60 rounded-2xl shadow-xl z-50 max-h-72 overflow-y-auto">
            <button
              onClick={() => { onCreate(); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 transition-colors border-b border-gray-100 flex items-center gap-2 font-medium"
            >
              <Plus size={14} /> Nouveau chantier
            </button>
            {chantiers.length === 0 && (
              <div className="px-4 py-3 text-xs text-gray-400">Aucun chantier.</div>
            )}
            {chantiers.map((c) => {
              const cnom = c.crrConfig?.chantierInfo?.nom || 'Sans nom';
              const lieu = c.crrConfig?.chantierInfo?.lieu || '';
              return (
                <button
                  key={c.id}
                  onClick={() => { onSelect(c); setOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 group flex items-center justify-between ${
                    c.id === activeId ? 'bg-blue-50 text-blue-700' : 'text-gray-600'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{cnom}</div>
                    {lieu && <div className="text-[10px] text-gray-400 truncate">{lieu}</div>}
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, c)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-500 transition-all shrink-0 ml-2"
                  >
                    <Trash2 size={12} />
                  </button>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
