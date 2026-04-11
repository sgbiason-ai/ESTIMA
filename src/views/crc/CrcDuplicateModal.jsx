// src/views/crc/CrcDuplicateModal.jsx
// Modal de duplication d'un compte rendu
import React, { useState, useEffect } from 'react';
import { Copy } from 'lucide-react';

export default function CrcDuplicateModal({ isOpen, onClose, onConfirm, defaultDate }) {
  const [date, setDate] = useState(defaultDate || '');

  useEffect(() => { if (isOpen) setDate(defaultDate || ''); }, [isOpen, defaultDate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[400px] overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-teal-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100">
              <Copy size={18} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Dupliquer le compte rendu</h3>
              <p className="text-[10px] text-slate-500">Observations, presences et diffusion seront reportees</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <label className="block text-xs font-medium text-slate-600 mb-2">Date de la nouvelle reunion</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all text-slate-800"
            autoFocus
          />
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
            Annuler
          </button>
          <button
            onClick={() => { onConfirm(date); onClose(); }}
            disabled={!date}
            className="px-5 py-2 bg-emerald-500 text-white text-sm font-medium rounded-xl hover:bg-emerald-600 disabled:opacity-40 transition-all shadow-sm"
          >
            Dupliquer
          </button>
        </div>
      </div>
    </div>
  );
}
