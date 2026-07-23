import { useState, useEffect, useRef, useCallback } from 'react';
import { getSpeechRecognitionConstructor, isSpeechRecognitionSupported } from '../utils/speech';

export default function useSpeechRecognition({ onResult, onError } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (!isSpeechRecognitionSupported()) {
      setError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    const SpeechRecConstructor = getSpeechRecognitionConstructor();
    const recognition = new SpeechRecConstructor();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setError('');
      setTranscript('');
    };

    recognition.onresult = (event) => {
      const result = event.results[0];
      const resultText = result[0].transcript;
      setTranscript(resultText);
      if (result.isFinal && onResult) {
        onResult(resultText);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      let errMsg = 'Speech recognition failed.';
      if (event.error === 'not-allowed') {
        errMsg = 'Microphone access denied. Please allow microphone permissions.';
      } else if (event.error === 'no-speech') {
        errMsg = 'No speech detected. Please speak clearly.';
      }
      setError(errMsg);
      if (onError) {
        onError(errMsg);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [onResult, onError]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
    } catch (e) {
      console.warn('SpeechRecognition start failed or already active:', e);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch (e) {
      console.warn('SpeechRecognition stop failed:', e);
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    resetTranscript,
    isSupported: isSpeechRecognitionSupported()
  };
}
