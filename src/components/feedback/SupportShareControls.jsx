// src/components/feedback/SupportShareControls.jsx
// Côté UTILISATEUR — UI de l'assistance écran en direct.
//   mode="modal"   → bloc "Demander une assistance" affiché dans la modale feedback
//   mode="overlay" → bandeau persistant "écran partagé" + overlay du pointeur admin
//                    (rendu en permanence tant qu'une session est active)

import React from 'react';
import { MonitorUp, Loader2, Radio, X } from 'lucide-react';
import { canShareScreen } from '../../config/webrtc';

const SupportShareControls = ({ mode, share }) => {
  const { status, pointer, error, requestAssistance, endSession } = share;
  const sharing = status === 'waiting' || status === 'active' || status === 'requesting';

  // ── Bloc dans la modale feedback ─────────────────────────────────────────
  if (mode === 'modal') {
    // Partage d'écran indisponible (mobile/tablette : getDisplayMedia non supporté)
    if (!canShareScreen()) {
      return (
        <div className="rounded-xl border border-gray-200/60 bg-gray-50 px-3 py-3">
          <p className="flex items-start gap-2 text-[11px] text-gray-400 leading-snug">
            <MonitorUp size={14} className="text-gray-300 shrink-0 mt-0.5" />
            L'assistance écran en direct n'est disponible que sur ordinateur (Chrome, Edge, Firefox). Les navigateurs mobiles ne permettent pas le partage d'écran.
          </p>
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-gray-200/60 bg-gray-50 px-3 py-3">
        {!sharing ? (
          <>
            <button
              onClick={requestAssistance}
              className="flex items-center gap-2 text-xs font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              <MonitorUp size={15} strokeWidth={1.75} className="text-blue-500" />
              Demander une assistance en direct
            </button>
            <p className="text-[11px] text-gray-400 mt-1.5 leading-snug">
              Partagez votre écran avec l'administrateur pour qu'il vous guide. Vous gardez le contrôle et pouvez arrêter à tout moment.
            </p>
            {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
          </>
        ) : (
          <div className="flex items-center gap-2 text-xs text-gray-700">
            {status === 'active'
              ? <><Radio size={14} className="text-red-500 animate-pulse" /> L'administrateur voit votre écran</>
              : <><Loader2 size={14} className="animate-spin text-blue-500" /> En attente d'un administrateur…</>}
            <button onClick={endSession} className="ml-auto text-red-500 hover:text-red-600 font-medium">
              Arrêter
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Overlay persistant (hors modale) ─────────────────────────────────────
  if (!sharing) return null;

  return (
    <>
      {/* Bandeau d'état (toujours visible pendant le partage) */}
      <div
        style={{ position: 'fixed', top: '0.75rem', left: '50%', transform: 'translateX(-50%)', zIndex: 10002 }}
        className="flex items-center gap-2 px-3 py-2 rounded-full bg-gray-900 text-white text-xs font-medium shadow-lg"
      >
        {status === 'active'
          ? <Radio size={13} className="text-red-400 animate-pulse" />
          : <Loader2 size={13} className="animate-spin text-blue-300" />}
        {status === 'active' ? 'Votre écran est partagé' : "En attente d'un administrateur…"}
        <button
          onClick={endSession}
          className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 hover:bg-white/25 transition-colors"
        >
          <X size={11} /> Arrêter
        </button>
      </div>

      {/* Pointeur de l'administrateur */}
      {pointer.visible && (
        <div
          style={{
            position: 'fixed',
            left: `${pointer.x * 100}%`,
            top: `${pointer.y * 100}%`,
            transform: 'translate(-50%, -50%)',
            zIndex: 10002,
            pointerEvents: 'none',
          }}
        >
          <span className="block w-6 h-6 rounded-full bg-blue-500/30 ring-2 ring-blue-500 animate-ping" />
          <span className="block w-3 h-3 rounded-full bg-blue-600 ring-2 ring-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
      )}
    </>
  );
};

export default SupportShareControls;
