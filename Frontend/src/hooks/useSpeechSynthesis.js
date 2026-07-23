import { useState, useEffect, useRef, useCallback } from 'react';
import { getEnglishVoice, isSpeechSynthesisSupported } from '../utils/speech';

export default function useSpeechSynthesis({ onStart, onEnd, onError } = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState('');
  const [voice, setVoice] = useState(null);
  const utteranceRef = useRef(null);

  // Initialize voice on mount
  useEffect(() => {
    if (!isSpeechSynthesisSupported()) {
      setError('Speech synthesis is not supported in this browser.');
      return;
    }

    getEnglishVoice().then((selectedVoice) => {
      setVoice(selectedVoice);
    });
  }, []);

  const cancel = useCallback(() => {
    if (!isSpeechSynthesisSupported()) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const speak = useCallback((text) => {
    if (!isSpeechSynthesisSupported()) return;

    // Cancel any current speaking
    window.speechSynthesis.cancel();

    // Clean markdown characters so speech synthesis sounds natural
    // (e.g. don't read out bullet dashes, asterisks, or table separator dashes/pipes)
    const cleanText = text
      .replace(/\*\*([^*]+)\*\*/g, '$1') // remove bold tags
      .replace(/\*([^*]+)\*/g, '$1')     // remove italic tags
      .replace(/[-*]\s+/g, '')            // remove list bullets
      .replace(/\|/g, ' ')                // replace table column pipes with space
      .replace(/-{3,}/g, ' ')             // remove table dashes
      .replace(/#{1,6}\s+/g, '')          // remove heading hashtags
      .replace(/\n+/g, ' ')               // replace newlines with spaces
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    if (voice) {
      utterance.voice = voice;
    }
    
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setError('');
      if (onStart) onStart();
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      // Ignore normal user cancels
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.error('SpeechSynthesis error:', e);
        setError('Speech synthesis failed.');
        if (onError) onError('Speech synthesis failed.');
      }
      setIsSpeaking(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [voice, onStart, onEnd, onError]);

  // Cancel speech on unmount
  useEffect(() => {
    return () => {
      if (isSpeechSynthesisSupported()) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    isSpeaking,
    error,
    speak,
    cancel,
    voice,
    isSupported: isSpeechSynthesisSupported()
  };
}
