import React from 'react';
import { AlertTriangle } from 'lucide-react';

const DeleteModal = ({ show, onClose, onConfirm }) => {
  if (!show) return null;
  
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full border border-slate-200">
        <div className="flex flex-col items-center text-center">
          <AlertTriangle className="text-red-500 mb-4" size={40} />
          <h3 className="text-lg font-bold">Supprimer cet élément ?</h3>
          <p className="text-slate-500 text-sm mt-2">Cette action est irréversible.</p>
          <div className="flex gap-3 mt-6 w-full">
            <button onClick={onClose} className="flex-1 py-2 border rounded-lg hover:bg-slate-50">Annuler</button>
            <button onClick={onConfirm} className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Supprimer</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteModal;