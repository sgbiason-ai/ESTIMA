// src/hooks/useSpeechToText.js
//
// Hook de reconnaissance vocale → texte français.
// Utilise l'API Web Speech (native Chrome / Safari mobile).
// Pas de dépendance externe.

import { useState, useRef, useCallback, useEffect } from 'react';

const SpeechRecognition = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

/**
 * @param {Object} options
 * @param {string} options.lang - Langue (défaut: 'fr-FR')
 * @param {boolean} options.continuous - Mode continu (défaut: true)
 * @param {boolean} options.interimResults - Résultats intermédiaires (défaut: true)
 * @returns {{ isListening, transcript, interimTranscript, isSupported, start, stop, reset }}
 */
export const useSpeechToText = ({ lang = 'fr-FR', continuous = true, interimResults = true } = {}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef(null);
  const isSupported = !!SpeechRecognition;

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
    if (!SpeechRecognition) return;

    // Arrêter l'instance précédente si elle existe
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let final = '';
      let interim = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) setTranscript(final);
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      // 'no-speech' et 'aborted' sont bénins (timeout ou arrêt volontaire)
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('[SpeechToText] Erreur:', event.error);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setTranscript('');
    setInterimTranscript('');

    try {
      recognition.start();
    } catch (e) {
      console.warn('[SpeechToText] Impossible de démarrer:', e);
      setIsListening(false);
    }
  }, [lang, continuous, interimResults]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return { isListening, transcript, interimTranscript, isSupported, start, stop, reset };
};
