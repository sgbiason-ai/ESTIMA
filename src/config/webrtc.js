// src/config/webrtc.js
// Configuration des serveurs ICE pour l'assistance écran en direct (WebRTC).
//
// STUN public Google par défaut (gratuit, suffisant pour la majorité des cas).
// TURN optionnel via variables d'environnement — à activer UNIQUEMENT si des
// connexions échouent derrière des pare-feux d'entreprise stricts.
//   VITE_TURN_URL=turn:turn.exemple.fr:3478
//   VITE_TURN_USERNAME=xxx
//   VITE_TURN_CREDENTIAL=xxx

const iceServers = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

const turnUrl = import.meta.env.VITE_TURN_URL;
if (turnUrl) {
  iceServers.push({
    urls: turnUrl,
    username: import.meta.env.VITE_TURN_USERNAME,
    credential: import.meta.env.VITE_TURN_CREDENTIAL,
  });
}

export const RTC_CONFIG = { iceServers };

// Vrai si le navigateur peut partager son écran (desktop, contexte sécurisé).
export const canShareScreen = () =>
  typeof navigator !== 'undefined'
  && !!navigator.mediaDevices
  && typeof navigator.mediaDevices.getDisplayMedia === 'function';
