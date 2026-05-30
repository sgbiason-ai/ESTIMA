// src/components/feedback/SupportViewer.jsx
// Côté SUPER-ADMIN — fenêtre de visionnage de l'écran partagé en direct.
// Vue seule + pointeur : déplacer la souris sur la vidéo envoie un repère
// que l'utilisateur voit s'afficher sur son écran ("regardez ici").

import React, { useEffect, useRef } from 'react';
import { X, Loader2, MousePointer2 } from 'lucide-react';
import { useSupportViewer } from '../../hooks/useSupportSession';

const SupportViewer = ({ session, onClose }) => {
  const { stream, status, join, leave, sendPointer } = useSupportViewer();
  const videoRef = useRef(null);

  // Rejoindre la session à l'ouverture
  useEffect(() => {
    if (session?.id) join(session.id);
    return () => { leave(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  // Brancher le flux sur la balise vidéo
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  const handleMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) sendPointer(x, y, true);
  };

  const handleClose = async () => { await leave(true); onClose(); };

  return (
    <div className="fixed inset-0 z-[10001] bg-black/80 backdrop-blur-sm flex flex-col p-4 sm:p-6">
      {/* Barre */}
      <div className="flex items-center gap-3 mb-3 text-white shrink-0">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Assistance · {session?.userEmail || 'utilisateur'}
        </span>
        <span className="text-white/50 text-xs">{session?.moduleLabel || ''} · v{session?.version || '?'}</span>
        <span className="ml-auto flex items-center gap-1.5 text-white/50 text-[11px]">
          <MousePointer2 size={13} /> Déplacez la souris sur l'écran pour pointer
        </span>
        <button
          onClick={handleClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
        >
          <X size={14} /> Terminer
        </button>
      </div>

      {/* Vidéo */}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        {status !== 'active' && (
          <div className="absolute flex items-center gap-2 text-white/70 text-sm">
            <Loader2 size={18} className="animate-spin" /> Connexion à l'écran de l'utilisateur…
          </div>
        )}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onMouseMove={handleMove}
          onMouseLeave={() => sendPointer(0, 0, false)}
          className="max-w-full max-h-full rounded-xl shadow-2xl bg-black cursor-crosshair"
        />
      </div>
    </div>
  );
};

export default SupportViewer;
