// src/views/crc/CrcChantierDropdown.jsx — EstimaStyle (fixed dropdown)
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, FolderOpen, ChevronDown } from 'lucide-react';
import { confirm } from '../../utils/globalUI';

export default function CrcChantierDropdown({ chantiers, activeId, onSelect, onDelete }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const active = chantiers.find((c) => c.id === activeId);
  const nom = active?.crrConfig?.chantierInfo?.nom || 'Sélectionner...';

  useEffect(() => {
    if (open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
  }, [open]);

  const handleDelete = async (e, chantier) => {
    e.stopPropagation();
    const ok = await confirm(`Supprimer le chantier "${chantier.crrConfig?.chantierInfo?.nom || 'Sans nom'}" et tous ses comptes rendus ?`, { danger: true });
    if (ok) { onDelete(chantier.id); setOpen(false); }
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-xl bg-gray-50 border border-gray-200/60 hover:border-blue-400 text-sm transition-all min-w-[160px] max-w-[240px]"
      >
        <FolderOpen size={14} className="text-blue-500 shrink-0" />
        <span className="text-gray-800 font-medium truncate flex-1 text-left text-xs">{nom}</span>
        <ChevronDown size={12} className="text-gray-400 shrink-0" />
      </button>

      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <div
            className="fixed w-80 rounded-2xl shadow-2xl z-[9999] max-h-72 overflow-y-auto border border-gray-200"
            style={{ top: pos.top, left: pos.left, backgroundColor: '#fff' }}
          >
            {chantiers.length === 0 && (
              <div className="px-4 py-3 text-xs text-gray-400" style={{ backgroundColor: '#fff' }}>Aucun chantier.</div>
            )}
            {chantiers.map((c) => {
              const cnom = c.crrConfig?.chantierInfo?.nom || 'Sans nom';
              const lieu = c.crrConfig?.chantierInfo?.lieu || '';
              return (
                <button
                  key={c.id}
                  onClick={() => { onSelect(c); setOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 transition-colors border-b border-gray-100 last:border-0 group flex items-center justify-between ${
                    c.id === activeId ? 'text-blue-700 font-semibold' : 'text-gray-700'
                  }`}
                  style={{ backgroundColor: c.id === activeId ? '#eff6ff' : '#fff' }}
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
        </>,
        document.body
      )}
    </div>
  );
}
