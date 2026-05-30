// src/components/feedback/SupportLiveBanner.jsx
// Côté SUPER-ADMIN — bandeau des demandes d'assistance écran en cours.
// Affiché en haut du panneau Feedback. Clic "Rejoindre" → ouvre la visionneuse.

import React from 'react';
import { Radio, MonitorPlay } from 'lucide-react';
import { useSupportRequests } from '../../hooks/useSupportSession';

const SupportLiveBanner = ({ enabled, onJoin }) => {
  const sessions = useSupportRequests(enabled);
  if (!sessions.length) return null;

  return (
    <div className="rounded-2xl border border-red-200/70 bg-red-50 p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold text-red-700">
        <Radio size={14} className="animate-pulse" />
        {sessions.length} demande{sessions.length !== 1 ? 's' : ''} d'assistance en direct
      </div>
      {sessions.map((s) => (
        <div key={s.id} className="flex items-center gap-3 bg-white border border-red-200/60 rounded-xl px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{s.userEmail || 'Utilisateur'}</p>
            <p className="text-[11px] text-gray-400 truncate">
              {s.moduleLabel || 'Hub'} · v{s.version || '?'} ·{' '}
              {s.status === 'active' ? 'session en cours' : 'en attente'}
            </p>
          </div>
          <button
            onClick={() => onJoin(s)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-xs font-medium transition-colors shrink-0"
          >
            <MonitorPlay size={14} /> {s.status === 'active' ? 'Reprendre' : 'Rejoindre'}
          </button>
        </div>
      ))}
    </div>
  );
};

export default SupportLiveBanner;
