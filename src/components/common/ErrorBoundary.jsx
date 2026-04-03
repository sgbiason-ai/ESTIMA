// src/components/common/ErrorBoundary.jsx
//
// Error Boundary global — intercepte les erreurs React non gérées
// et affiche un écran de récupération plutôt qu'un écran blanc.
//
// Usage dans main.jsx :
//   <ErrorBoundary>
//     <App />
//   </ErrorBoundary>
//
// Les Error Boundaries doivent être des class components (contrainte React).

import React from 'react';
import { Sentry } from '../../sentry';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError:  false,
      error:     null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    Sentry.captureException(error, { extra: errorInfo });
    console.error('[ErrorBoundary] Erreur interceptée :', error, errorInfo);
  }

  handleReload() {
    window.location.reload();
  }

  handleReset() {
    this.setState({ hasError: false, error: null, errorInfo: null });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error, errorInfo } = this.state;
    const isDev = import.meta.env.DEV;

    return (
      <div className="flex h-screen bg-[#040a0e] text-slate-300 items-center justify-center p-6">
        <div className="max-w-lg w-full">

          {/* Icône */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
          </div>

          {/* Message principal */}
          <h1 className="text-xl font-black text-white text-center mb-2">
            Une erreur inattendue s'est produite
          </h1>
          <p className="text-slate-400 text-sm text-center mb-8 leading-relaxed">
            EstimaVRD a rencontré un problème. Vos données sont sauvegardées —
            rechargez la page pour reprendre.
          </p>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={this.handleReload}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors text-sm"
            >
              Recharger la page
            </button>
            <button
              onClick={() => this.handleReset()}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-colors text-sm"
            >
              Réessayer sans recharger
            </button>
          </div>

          {/* Détails techniques (dev uniquement) */}
          {isDev && error && (
            <details className="mt-6">
              <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400 mb-2">
                Détails techniques (mode développement)
              </summary>
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-2">
                <p className="text-red-400 text-xs font-mono font-bold">
                  {error.toString()}
                </p>
                {errorInfo?.componentStack && (
                  <pre className="text-slate-500 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {errorInfo.componentStack.trim()}
                  </pre>
                )}
              </div>
            </details>
          )}

        </div>
      </div>
    );
  }
}