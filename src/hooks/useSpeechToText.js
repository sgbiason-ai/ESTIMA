// src/hooks/useSpeechToText.js
//
// Hook de reconnaissance vocale → texte français.
// Utilise l'API Web Speech (native Chrome / Safari mobile).
// Demande explicitement l'autorisation micro via getUserMedia avant de lancer
// la reconnaissance, pour contourner les blocages en mode PWA standalone.

import { useState, useRef, useCallback, useEffect } from 'react';

const SpeechRecognitionClass = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

/**
 * Demande l'accès au micro via getUserMedia.
 * Retourne true si accordé, false sinon.
 * Libère immédiatement le stream (on veut juste la permission).
 */
const requestMicPermission = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Libérer le micro immédiatement, on veut juste la permission
    stream.getTracks().forEach(t => t.stop());
    return true;
  } catch (e) {
    console.warn('[SpeechToText] Permission micro refusée:', e.message);
    return false;
  }
};

/**
 * @param {Object} options
 * @param {string} options.lang - Langue (défaut: 'fr-FR')
 * @param {boolean} options.continuous - Mode continu (défaut: true)
 * @param {boolean} options.interimResults - Résultats intermédiaires (défaut: true)
 * @returns {{ isListening, transcript, interimTranscript, isSupported, error, start, stop, reset }}
 */
export const useSpeechToText = ({ lang = 'fr-FR', continuous = true, interimResults = true } = {}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const transcriptAccumRef = useRef('');

  // Vérifier support réel (pas juste l'objet, mais aussi getUserMedia)
  const isSupported = !!SpeechRecognitionClass && typeof navigator?.mediaDevices?.getUserMedia === 'function';

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
      setError('Reconnaissance vocale non supportée par ce navigateur');
      return;
    }

    setError(null);

    // 1. Demander la permission micro AVANT de lancer la reconnaissance
    const hasPermission = await requestMicPermission();
    if (!hasPermission) {
      setError('Accès au micro refusé. Vérifiez les permissions.');
      return;
    }

    // 2. Arrêter l'instance précédente si elle existe
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }

    // 3. Créer et configurer la reconnaissance
    const recognition = new SpeechRecognitionClass();
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.maxAlternatives = 1;

    transcriptAccumRef.current = '';

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      // Accumuler les transcriptions finales (en mode continu, les résultats
      // précédents restent dans event.results mais sont déjà finalisés)
      if (finalText) {
        transcriptAccumRef.current = finalText;
        setTranscript(finalText);
      }
      setInterimTranscript(interimText);
    };

    recognition.onerror = (event) => {
      const msg = {
        'not-allowed': 'Accès au micro refusé',
        'no-speech': null, // Bénin : pas de parole détectée
        'aborted': null,   // Bénin : arrêt volontaire
        'network': 'Erreur réseau — vérifiez votre connexion',
        'service-not-allowed': 'Service de reconnaissance non disponible',
        'audio-capture': 'Impossible de capturer l\'audio',
      }[event.error] || `Erreur : ${event.error}`;

      if (msg) {
        console.warn('[SpeechToText] Erreur:', event.error);
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
      console.warn('[SpeechToText] Impossible de démarrer:', e);
      setError('Impossible de démarrer la reconnaissance vocale');
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
    setError(null);
    transcriptAccumRef.current = '';
  }, []);

  return { isListening, transcript, interimTranscript, isSupported, error, start, stop, reset };
};
