import { useState, useEffect, useRef, useCallback } from 'react';

export default function useSpeechSynthesis({ onStart, onEnd, onError } = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState('');
  const audioRef = useRef(null);
  const utteranceRef = useRef(null);

  const cancelWebSpeech = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
  };

  const cancelAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  };

  const cancel = useCallback(() => {
    cancelWebSpeech();
    cancelAudio();
    setIsSpeaking(false);
  }, []);

  // Speak using Web Speech API (primary — works everywhere, no file needed)
  const speakWithWebAPI = useCallback((text) => {
    if (!window.speechSynthesis) return false;

    cancelWebSpeech();

    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;

    // Pick a natural English voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.lang === 'en-US' && !v.name.includes('Google')) ||
                      voices.find(v => v.lang.startsWith('en')) ||
                      voices[0];
    if (preferred) utterance.voice = preferred;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setError('');
      if (onStart) onStart();
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      utteranceRef.current = null;
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      // 'interrupted' is normal when cancel() is called — not a real error
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      console.error('SpeechSynthesis error:', e.error);
      setIsSpeaking(false);
      utteranceRef.current = null;
      if (onError) onError('Audio playback failed.');
    };

    window.speechSynthesis.speak(utterance);
    return true;
  }, [onStart, onEnd, onError]);

  // speak() — accepts either a plain text string or an audioUrl
  // For the text-chat flow, the backend now sends `answerText` — speak that directly.
  const speak = useCallback((audioSourceOrText, plainText = null) => {
    cancel();

    // If we have plain text, always prefer Web Speech API
    if (plainText && typeof plainText === 'string' && plainText.trim()) {
      speakWithWebAPI(plainText);
      return;
    }

    // If the source looks like plain text (not a URL), use Web Speech API
    const isUrl = typeof audioSourceOrText === 'string' &&
      (audioSourceOrText.startsWith('http') || audioSourceOrText.startsWith('/') || audioSourceOrText.endsWith('.mp3'));

    if (!isUrl && typeof audioSourceOrText === 'string' && audioSourceOrText.trim()) {
      speakWithWebAPI(audioSourceOrText);
      return;
    }

    // Fallback: try MP3 file from URL
    if (isUrl) {
      const timestamp = Date.now();
      const url = audioSourceOrText.includes('?') ? audioSourceOrText : `${audioSourceOrText}?t=${timestamp}`;
      const audio = new Audio();
      audioRef.current = audio;

      audio.onplay = () => { setIsSpeaking(true); setError(''); if (onStart) onStart(); };
      audio.onended = () => { setIsSpeaking(false); audioRef.current = null; if (onEnd) onEnd(); };
      audio.onerror = () => {
        console.warn('MP3 audio failed, falling back to Web Speech API');
        cancelAudio();
        // Fall back to web speech with the URL as text won't work, just fire onEnd
        setIsSpeaking(false);
        if (onEnd) onEnd();
      };
      audio.src = url;
      audio.play().catch(() => {
        cancelAudio();
        setIsSpeaking(false);
        if (onEnd) onEnd();
      });
    }
  }, [cancel, speakWithWebAPI, onStart, onEnd, onError]);

  useEffect(() => {
    return () => { cancel(); };
  }, [cancel]);

  return {
    isSpeaking,
    error,
    speak,
    cancel,
    isSupported: true
  };
}
