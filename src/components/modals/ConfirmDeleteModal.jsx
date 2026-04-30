// src/components/modals/ConfirmDeleteModal.jsx
import React from 'react';
import { AlertTriangle } from 'lucide-react';

const ConfirmDeleteModal = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-modal-stack flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-red-50 p-4 flex items-center gap-3 border-b border-red-100">
          <div className="p-2 bg-red-100 rounded-full text-red-600">
            <AlertTriangle size={20} />
          </div>
          <h2 className="font-bold text-red-900">Confirmer la suppression</h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-slate-600 leading-relaxed">
            Voulez-vous vraiment supprimer cet élément ? Cette action est irréversible.
          </p>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded-lg">
            Annuler
          </button>
          <button onClick={onConfirm} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wide rounded-lg flex items-center gap-2">
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteModal;