// src/components/mobile/PdfFavoriteEditModal.jsx
// Modale ajout / renommage d'un favori PDF (nom + URL).

import React, { useState, useEffect } from 'react';
import Icon from './Icon';

export default function PdfFavoriteEditModal({ initial, onSave, onClose }) {
  const isEdit = !!initial?.id;
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const lockUrl = isEdit;

  useEffect(() => {
    setName(initial?.name || '');
    setUrl(initial?.url || '');
  }, [initial]);

  const handleSave = () => {
    const n = name.trim();
    const u = url.trim();
    if (!u) return;
    if (isEdit) {
      onSave?.({ name: n || u });
    } else {
      onSave?.({ name: n, url: u });
    }
    onClose?.();
  };

  const canSave = lockUrl ? name.trim().length > 0 : url.trim().length > 0;

  return (
    <div className="fixed inset-0 z-modal-stack flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex flex-col items-center pt-3 pb-2 px-4 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <h3 className="text-base font-bold text-gray-900">
            {isEdit ? 'Renommer le favori' : 'Ajouter un favori'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <Icon name="close" size={18} color="#94a3b8" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">Nom</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Plans DCE 2026"
              className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">URL SharePoint</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              disabled={lockUrl}
              className={`w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${lockUrl ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
            {lockUrl && (
              <span className="text-[11px] text-gray-500">L'URL d'un favori existant ne peut pas être modifiée.</span>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold active:scale-[0.98] transition"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className={`flex-1 py-3 rounded-xl text-sm font-bold text-white transition active:scale-[0.98] ${canSave ? 'bg-blue-600' : 'bg-gray-300 cursor-not-allowed'}`}
            >
              {isEdit ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
