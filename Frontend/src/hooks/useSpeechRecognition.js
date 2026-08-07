import { useState, useEffect, useRef, useCallback } from 'react';
import { getSpeechRecognitionConstructor, isSpeechRecognitionSupported } from '../utils/speech';

export default function useSpeechRecognition({ onStart, onResult, onError } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef('');
  const networkRetryCountRef = useRef(0);
  const shouldRetryRef = useRef(true);

  // Use refs to store callback functions to avoid re-triggering the main setup useEffect
  const onStartRef = useRef(onStart);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);

  // Sync refs on every render
  useEffect(() => {
    onStartRef.current = onStart;
    onResultRef.current = onResult;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    if (!isSpeechRecognitionSupported()) {
      setError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    const SpeechRecConstructor = getSpeechRecognitionConstructor();
    const recognition = new SpeechRecConstructor();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setError('');
      setTranscript('');
      finalTranscriptRef.current = '';
      if (onStartRef.current) onStartRef.current();
    };

    recognition.onresult = (event) => {
      let currentInterim = '';
      let currentFinal = finalTranscriptRef.current;

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const res = event.results[i];
        if (res.isFinal) {
          currentFinal += res[0].transcript + ' ';
        } else {
          currentInterim += res[0].transcript;
        }
      }

      finalTranscriptRef.current = currentFinal;
      const combined = (currentFinal + currentInterim).trim();
      setTranscript(combined);

      // When a final result segment is ready, stop recognition and pass text
      if (currentFinal.trim()) {
        const capturedText = currentFinal.trim();
        finalTranscriptRef.current = '';
        try {
          recognition.stop();
        } catch (e) {
          // ignore
        }
        if (onResultRef.current) {
          onResultRef.current(capturedText);
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'aborted') return;

      console.warn('Speech recognition event error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        const errMsg = 'Microphone access denied. Please allow microphone access in browser settings.';
        setError(errMsg);
        if (onErrorRef.current) onErrorRef.current(errMsg);
      } else if (event.error === 'no-speech') {
        // Silently reset state without displaying permanent red error banner
        setIsListening(false);
      } else if (event.error === 'network') {
        // Handle transient network errors by retrying
        if (shouldRetryRef.current && networkRetryCountRef.current < 3) {
          networkRetryCountRef.current += 1;
          console.warn(`Speech recognition network error. Retrying in 1.5s (Attempt ${networkRetryCountRef.current}/3)...`);
          setTimeout(() => {
            if (recognitionRef.current && shouldRetryRef.current) {
              try {
                // Restart it
                recognitionRef.current.start();
              } catch (e) {
                console.warn('Failed to restart speech recognition during retry:', e);
              }
            }
          }, 1500);
        } else {
          const errMsg = 'Speech recognition network error. Please check your internet connection.';
          setError(errMsg);
          if (onErrorRef.current) onErrorRef.current(errMsg);
        }
      } else {
        const errMsg = `Speech recognition error (${event.error}).`;
        setError(errMsg);
        if (onErrorRef.current) onErrorRef.current(errMsg);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (finalTranscriptRef.current && finalTranscriptRef.current.trim() && onResultRef.current) {
        const text = finalTranscriptRef.current.trim();
        finalTranscriptRef.current = '';
        onResultRef.current(text);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    setError('');
    setTranscript('');
    finalTranscriptRef.current = '';
    networkRetryCountRef.current = 0;
    shouldRetryRef.current = true;
    try {
      recognitionRef.current.start();
    } catch (e) {
      console.warn('SpeechRecognition start failed or already active:', e);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    shouldRetryRef.current = false;
    try {
      recognitionRef.current.stop();
    } catch (e) {
      console.warn('SpeechRecognition stop failed:', e);
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    finalTranscriptRef.current = '';
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


