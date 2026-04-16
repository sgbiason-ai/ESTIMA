// src/contexts/ToastContext.jsx
import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { registerToast } from '../utils/globalUI';

// ─── CONTEXTE ────────────────────────────────────────────────────────────────

const ToastContext = createContext(null);

// ─── TYPES & CONFIG ───────────────────────────────────────────────────────────

const TOAST_CONFIG = {
  success: {
    icon: CheckCircle2,
    bar: 'bg-emerald-500',
    icon_color: 'text-emerald-500',
    bg: 'bg-white',
    border: 'border-emerald-100',
  },
  error: {
    icon: XCircle,
    bar: 'bg-red-500',
    icon_color: 'text-red-500',
    bg: 'bg-white',
    border: 'border-red-100',
  },
  warning: {
    icon: AlertTriangle,
    bar: 'bg-amber-400',
    icon_color: 'text-amber-500',
    bg: 'bg-white',
    border: 'border-amber-100',
  },
  info: {
    icon: Info,
    bar: 'bg-blue-500',
    icon_color: 'text-blue-500',
    bg: 'bg-white',
    border: 'border-blue-100',
  },
};

// ─── PROVIDER ────────────────────────────────────────────────────────────────

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t));
    // Suppression après l'animation de sortie
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 350);
  }, []);

  const toast = useCallback((message, type = 'info', { duration = 4000, title } = {}) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type, title, leaving: false }]);
    if (duration > 0) setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  // Raccourcis
  const success = useCallback((msg, opts) => toast(msg, 'success', opts), [toast]);
  const error   = useCallback((msg, opts) => toast(msg, 'error',   { duration: 6000, ...opts }), [toast]);
  const warning = useCallback((msg, opts) => toast(msg, 'warning', opts), [toast]);
  const info    = useCallback((msg, opts) => toast(msg, 'info',    opts), [toast]);

  // Enregistrer dans le singleton global pour accès hors React
  useEffect(() => { registerToast({ success, error, warning, info, toast, dismiss }); }, [success, error, warning, info, toast, dismiss]);

  const value = useMemo(() => ({ toast, success, error, warning, info, dismiss }), [toast, success, error, warning, info, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
};

// ─── HOOK ─────────────────────────────────────────────────────────────────────

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast doit être utilisé dans un <ToastProvider>');
  return ctx;
};

// ─── CONTAINER ───────────────────────────────────────────────────────────────

const ToastContainer = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[99999] flex flex-col gap-3 items-end pointer-events-none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

// ─── TOAST ITEM ───────────────────────────────────────────────────────────────

const ToastItem = ({ toast, onDismiss }) => {
  const config = TOAST_CONFIG[toast.type] || TOAST_CONFIG.info;
  const Icon = config.icon;

  return (
    <div
      className={`
        pointer-events-auto
        relative flex items-start gap-3
        w-80 rounded-xl shadow-2xl border overflow-hidden
        ${config.bg} ${config.border}
        ${toast.leaving
          ? 'animate-out slide-out-to-right-full fade-out duration-300'
          : 'animate-in slide-in-from-right-full fade-in duration-300'
        }
      `}
    >
      {/* Barre colorée à gauche */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${config.bar}`} />

      {/* Icône */}
      <div className="pl-4 pt-3.5 shrink-0">
        <Icon size={18} className={config.icon_color} />
      </div>

      {/* Contenu */}
      <div className="flex-1 py-3 pr-2 min-w-0">
        {toast.title && (
          <p className="text-xs font-black text-slate-800 uppercase tracking-wide mb-0.5">
            {toast.title}
          </p>
        )}
        <p className="text-xs text-slate-600 leading-relaxed">{toast.message}</p>
      </div>

      {/* Bouton fermer */}
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 p-2 mt-1 text-slate-300 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100"
      >
        <X size={14} />
      </button>
    </div>
  );
};
