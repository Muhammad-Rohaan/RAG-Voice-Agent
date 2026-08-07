import { useState, useEffect, useRef, useCallback } from 'react';

export default function useSpeechSynthesis({ onStart, onEnd, onError } = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState('');
  const audioRef = useRef(null);

  const cancel = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback((audioSource) => {
    cancel(); // Cancel any existing audio playback

    const timestamp = Date.now();
    const ragBaseUrl = import.meta.env.VITE_RAG_API_BASE_URL ?? 'http://localhost:9000';
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

    // Construct primary candidate URL
    let primaryUrl;
    if (typeof audioSource === 'string' && (audioSource.startsWith('http://') || audioSource.startsWith('https://'))) {
      primaryUrl = audioSource.includes('?') ? audioSource : `${audioSource}?t=${timestamp}`;
    } else {
      primaryUrl = `${ragBaseUrl}/speech.mp3?t=${timestamp}`;
    }

    const fallbackUrl = `${apiBaseUrl}/speech.mp3?t=${timestamp}`;

    const playAudioUrl = (urlToPlay, isFallback = false) => {
      const audio = new Audio();
      audioRef.current = audio;

      audio.onplay = () => {
        setIsSpeaking(true);
        setError('');
        if (onStart) onStart();
      };

      audio.onended = () => {
        setIsSpeaking(false);
        audioRef.current = null;
        if (onEnd) onEnd();
      };

      const handleFailure = (err) => {
        if (!isFallback) {
          console.warn(`Primary audio failed from ${urlToPlay}, trying fallback ${fallbackUrl}`, err);
          playAudioUrl(fallbackUrl, true);
        } else {
          console.error('Audio playback failed on both primary and fallback URLs:', err);
          setIsSpeaking(false);
          audioRef.current = null;
          if (onError) onError('Audio playback failed.');
        }
      };

      audio.onerror = (e) => handleFailure(e);

      audio.src = urlToPlay;
      audio.play().catch((err) => handleFailure(err));
    };

    playAudioUrl(primaryUrl);
  }, [cancel, onStart, onEnd, onError]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return {
    isSpeaking,
    error,
    speak,
    cancel,
    isSupported: true
  };
}


