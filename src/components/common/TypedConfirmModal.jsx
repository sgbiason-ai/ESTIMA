// src/components/common/TypedConfirmModal.jsx
// Modale de confirmation à friction : l'utilisateur doit RECOPIER un mot
// (ex. « GABARIT ») pour activer le bouton d'action. Réservée aux opérations
// rares, partagées ou difficilement réversibles.
import React, { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

const TypedConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  word = 'CONFIRMER',
  title = 'Confirmer l’action ?',
  message = '',
  confirmLabel = 'Confirmer',
}) => {
  const [value, setValue] = useState('');

  // Réinitialise la saisie à chaque ouverture/fermeture.
  useEffect(() => { if (!isOpen) setValue(''); }, [isOpen]);

  if (!isOpen) return null;

  const matches = value.trim().toUpperCase() === word.toUpperCase();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-amber-600" />
          </div>
          <h3 className="flex-1 text-lg font-bold text-gray-900 leading-tight pt-1">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400" title="Fermer">
            <X size={18} />
          </button>
        </div>

        {message && <p className="text-sm text-gray-500 leading-relaxed mb-4">{message}</p>}

        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
          Tapez <span className="font-mono font-bold text-gray-900">{word}</span> pour confirmer
        </label>
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && matches) onConfirm?.(); }}
          placeholder={word}
          className="w-full bg-gray-100 border border-gray-200/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 mb-5"
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={() => matches && onConfirm?.()}
            disabled={!matches}
            className={`px-4 py-2 rounded-xl text-sm font-bold text-white transition-colors ${
              matches ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TypedConfirmModal;
