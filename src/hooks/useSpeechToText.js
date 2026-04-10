// src/hooks/useSpeechToText.js
//
// Hook de reconnaissance vocale → texte français.
// Utilise l'API Web Speech (native Chrome Android / Safari).

import { useState, useRef, useCallback, useEffect } from 'react';

const SpeechRecognitionClass = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

// Détection iOS standalone (PWA home screen)
const isIOSStandalone = typeof window !== 'undefined'
  && ('standalone' in window.navigator)
  && window.navigator.standalone === true;

/**
 * Vérifie l'état de la permission micro via Permissions API.
 * Retourne 'granted', 'denied', ou 'prompt'.
 */
const checkMicPermission = async () => {
  try {
    if (navigator.permissions?.query) {
      const result = await navigator.permissions.query({ name: 'microphone' });
      return result.state; // 'granted' | 'denied' | 'prompt'
    }
  } catch {}
  return 'prompt'; // Par défaut, on suppose que c'est possible
};

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

  const start = useCallback(async () => {
    if (!SpeechRecognitionClass) {
      setError('Reconnaissance vocale non supportée par ce navigateur.');
      return;
    }
    if (isIOSStandalone) {
      setError('Dictée vocale non disponible en mode app. Ouvrez dans Safari.');
      return;
    }

    // Vérifier la permission micro AVANT de lancer
    const permState = await checkMicPermission();
    if (permState === 'denied') {
      setError('Micro bloqué. Appuyez sur le cadenas 🔒 dans la barre d\'adresse → Autorisations → Micro → Autoriser, puis réessayez.');
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
        'not-allowed':           'Micro bloqué. Appuyez sur le cadenas 🔒 → Autorisations → Micro → Autoriser.',
        'service-not-allowed':   'Micro bloqué. Appuyez sur le cadenas 🔒 → Autorisations → Micro → Autoriser.',
        'audio-capture':         'Impossible de capturer l\'audio. Fermez les autres apps qui utilisent le micro.',
        'network':               'Erreur réseau — la dictée vocale nécessite internet.',
        'no-speech':             null,
        'aborted':               null,
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
