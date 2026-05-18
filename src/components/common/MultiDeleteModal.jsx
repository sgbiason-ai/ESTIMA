import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { cleanText, formatPrice } from '../../utils/helpers';

const MultiDeleteModal = ({ show, items = [], onClose, onConfirm }) => {
  if (!show) return null;

  const count = items.length;
  const totalValue = items.reduce((sum, it) => sum + (Number(it.qty || 0) * Number(it.price || 0)), 0);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-5 border-b border-slate-100 bg-red-50 flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-xl">
            <AlertTriangle className="text-red-600" size={22} />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 uppercase tracking-wide">
              Supprimer {count} article{count > 1 ? 's' : ''} ?
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Cette action est irréversible.</p>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-3">
          <ul className="space-y-1.5">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-slate-800 uppercase truncate">
                    {cleanText(item.designation) || '(sans désignation)'}
                  </p>
                  {item.bpuNum && (
                    <span className="text-[9px] font-mono font-bold text-blue-600">
                      Réf : {item.bpuNum}
                    </span>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-mono font-bold text-slate-600">
                    {Number(item.qty || 0)} × {formatPrice(Number(item.price || 0))}
                  </p>
                  <p className="text-[10px] font-mono font-black text-slate-900">
                    {formatPrice(Number(item.qty || 0) * Number(item.price || 0))}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-[11px] text-slate-600">
            Total à supprimer :{' '}
            <span className="font-black text-slate-900 font-mono">{formatPrice(totalValue)}</span>
          </p>
        </div>

        <div className="p-4 flex gap-3 bg-white border-t border-slate-100">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 border border-slate-200 rounded-xl font-bold text-xs uppercase tracking-wide text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 px-4 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-wide hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 size={14} />
            Supprimer {count}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiDeleteModal;
