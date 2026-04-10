// src/hooks/useSpeechToText.js
//
// Hook de reconnaissance vocale → texte français.
// Utilise l'API Web Speech (native Chrome Android / Safari).
//
// Logique de résultats :
// - event.results[] contient TOUS les segments depuis le début
// - Chaque segment passe de isFinal=false (interim) à isFinal=true (final)
// - On accumule uniquement les segments finalisés dans `transcript`
// - On affiche le segment en cours (non finalisé) dans `interimTranscript`

import { useState, useRef, useCallback, useEffect } from 'react';

const SpeechRecognitionClass = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

const isIOSStandalone = typeof window !== 'undefined'
  && ('standalone' in window.navigator)
  && window.navigator.standalone === true;

const checkMicPermission = async () => {
  try {
    if (navigator.permissions?.query) {
      const result = await navigator.permissions.query({ name: 'microphone' });
      return result.state;
    }
  } catch {}
  return 'prompt';
};

export const useSpeechToText = ({ lang = 'fr-FR' } = {}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  // Index du prochain segment non encore traité comme final
  const finalIndexRef = useRef(0);

  const isSupported = !!SpeechRecognitionClass && !isIOSStandalone;

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

    const permState = await checkMicPermission();
    if (permState === 'denied') {
      setError('Micro bloqué. Appuyez sur le cadenas 🔒 → Autorisations → Micro → Autoriser.');
      return;
    }

    setError(null);

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }

    const recognition = new SpeechRecognitionClass();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    // Texte final accumulé au fur et à mesure des segments finalisés
    let accumulated = '';
    finalIndexRef.current = 0;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event) => {
      // Parcourir les résultats : les finalisés s'accumulent, l'interim est le dernier non-final
      let newFinals = '';
      let interim = '';

      for (let i = finalIndexRef.current; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          // Ce segment est finalisé → l'ajouter au texte accumulé
          newFinals += r[0].transcript;
          finalIndexRef.current = i + 1;
        } else {
          // Segment en cours de dictée (interim) → juste l'afficher
          interim = r[0].transcript;
        }
      }

      if (newFinals) {
        accumulated += (accumulated ? ' ' : '') + newFinals.trim();
        setTranscript(accumulated);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      const messages = {
        'not-allowed':         'Micro bloqué. Appuyez sur le cadenas 🔒 → Autorisations → Micro → Autoriser.',
        'service-not-allowed': 'Micro bloqué. Appuyez sur le cadenas 🔒 → Autorisations → Micro → Autoriser.',
        'audio-capture':       'Impossible de capturer l\'audio. Fermez les autres apps qui utilisent le micro.',
        'network':             'Erreur réseau — la dictée vocale nécessite internet.',
        'no-speech':           null,
        'aborted':             null,
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
