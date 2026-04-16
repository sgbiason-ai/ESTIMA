// src/contexts/DialogContext.jsx
import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { AlertTriangle, Info, X, Check } from 'lucide-react';
import { registerDialog } from '../utils/globalUI';

// ─── CONTEXTE ────────────────────────────────────────────────────────────────

const DialogContext = createContext(null);

// ─── PROVIDER ────────────────────────────────────────────────────────────────

export const DialogProvider = ({ children }) => {
  const [dialogs, setDialogs] = useState([]);

  /**
   * Ouvre un dialog de confirmation.
   * @returns {Promise<boolean>} true si confirmé, false si annulé
   */
  const confirm = useCallback((message, { title = 'Confirmation', danger = false, confirmLabel = 'Confirmer', cancelLabel = 'Annuler' } = {}) => {
    return new Promise((resolve) => {
      const id = `dialog_${Date.now()}`;
      setDialogs(prev => [...prev, { id, type: 'confirm', message, title, danger, confirmLabel, cancelLabel, resolve }]);
    });
  }, []);

  /**
   * Ouvre un dialog de saisie texte.
   * @returns {Promise<string|null>} la valeur saisie, ou null si annulé
   */
  const prompt = useCallback((message, defaultValue = '', { title = 'Saisie', confirmLabel = 'Valider', cancelLabel = 'Annuler', placeholder = '' } = {}) => {
    return new Promise((resolve) => {
      const id = `dialog_${Date.now()}`;
      setDialogs(prev => [...prev, { id, type: 'prompt', message, title, defaultValue, confirmLabel, cancelLabel, placeholder, resolve }]);
    });
  }, []);

  const closeDialog = useCallback((id, result) => {
    setDialogs(prev => {
      const dialog = prev.find(d => d.id === id);
      if (dialog) dialog.resolve(result);
      return prev.filter(d => d.id !== id);
    });
  }, []);

  // Enregistrer dans le singleton global pour accès hors React
  useEffect(() => { registerDialog({ confirm, prompt }); }, [confirm, prompt]);

  const value = useMemo(() => ({ confirm, prompt }), [confirm, prompt]);

  return (
    <DialogContext.Provider value={value}>
      {children}
      {dialogs.map(dialog => (
        <DialogModal key={dialog.id} dialog={dialog} onClose={(result) => closeDialog(dialog.id, result)} />
      ))}
    </DialogContext.Provider>
  );
};

// ─── HOOK ─────────────────────────────────────────────────────────────────────

export const useDialog = () => {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog doit être utilisé dans un <DialogProvider>');
  return ctx;
};

// ─── MODAL INTERNE ───────────────────────────────────────────────────────────

const DialogModal = ({ dialog, onClose }) => {
  const { type, message, title, danger, confirmLabel, cancelLabel, defaultValue, placeholder } = dialog;
  const [inputValue, setInputValue] = useState(defaultValue || '');
  const inputRef = useRef(null);

  // Focus auto sur l'input (prompt) ou le bouton confirm
  React.useEffect(() => {
    if (type === 'prompt' && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [type]);

  const handleConfirm = () => {
    if (type === 'prompt') onClose(inputValue);
    else onClose(true);
  };

  const handleCancel = () => {
    if (type === 'prompt') onClose(null);
    else onClose(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') handleCancel();
  };

  const Icon = danger ? AlertTriangle : Info;
  const iconColor = danger ? 'text-red-500' : 'text-emerald-500';
  const iconBg = danger ? 'bg-red-500/10' : 'bg-emerald-500/10';
  const confirmBtnClass = danger
    ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20'
    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={handleCancel}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
              <Icon size={18} className={iconColor} />
            </div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">{title}</h3>
          </div>
          <button onClick={handleCancel} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-2">
          <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
          {type === 'prompt' && (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={placeholder}
              className="mt-4 w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-sm"
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-5">
          <button
            onClick={handleCancel}
            className="px-5 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            autoFocus={type === 'confirm'}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 ${confirmBtnClass}`}
          >
            <Check size={14} />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
