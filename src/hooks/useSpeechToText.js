// src/hooks/useSpeechToText.js
//
// Hook de reconnaissance vocale → texte français.
// Utilise l'API Web Speech (native Chrome / Safari).
// SpeechRecognition gère ses propres permissions micro — pas besoin de getUserMedia.

import { useState, useRef, useCallback, useEffect } from 'react';

const SpeechRecognitionClass = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

// Détection iOS standalone (PWA home screen) — Web Speech API non supporté
const isIOSStandalone = typeof window !== 'undefined'
  && ('standalone' in window.navigator)
  && window.navigator.standalone === true;

/**
 * @param {Object} options
 * @param {string} options.lang - Langue (défaut: 'fr-FR')
 * @returns {{ isListening, transcript, interimTranscript, isSupported, error, start, stop }}
 */
export const useSpeechToText = ({ lang = 'fr-FR' } = {}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);

  // Support réel : l'API existe ET on n'est pas en iOS standalone (non supporté)
  const isSupported = !!SpeechRecognitionClass && !isIOSStandalone;

  // Nettoyage à la destruction
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
        recognitionRef.current = null;
      }
    };
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognitionClass) {
      setError('Reconnaissance vocale non supportée par ce navigateur');
      return;
    }
    if (isIOSStandalone) {
      setError('Dictée vocale non disponible en mode app. Ouvrez dans Safari.');
      return;
    }

    setError(null);

    // Arrêter l'instance précédente
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }

    const recognition = new SpeechRecognitionClass();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';

      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          finalText += r[0].transcript;
        } else {
          interimText += r[0].transcript;
        }
      }

      if (finalText) setTranscript(finalText);
      setInterimTranscript(interimText);
    };

    recognition.onerror = (event) => {
      const messages = {
        'not-allowed':           'Micro bloqué. Allez dans Réglages du site → Autoriser le micro.',
        'service-not-allowed':   'Micro bloqué. Allez dans Réglages du site → Autoriser le micro.',
        'audio-capture':         'Impossible de capturer l\'audio. Vérifiez qu\'aucune autre app utilise le micro.',
        'network':               'Erreur réseau — la reconnaissance vocale nécessite une connexion internet.',
        'no-speech':             null, // Bénin
        'aborted':               null, // Bénin
      };
      const msg = messages[event.error] ?? `Erreur : ${event.error}`;
      if (msg) {
        console.warn('[SpeechToText]', event.error);
        setError(msg);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setTranscript('');
    setInterimTranscript('');

    try {
      recognition.start();
    } catch (e) {
      console.warn('[SpeechToText] start() failed:', e);
      setError(`Impossible de démarrer : ${e.message}`);
      setIsListening(false);
    }
  }, [lang]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
  }, []);

  return { isListening, transcript, interimTranscript, isSupported, error, start, stop };
};
