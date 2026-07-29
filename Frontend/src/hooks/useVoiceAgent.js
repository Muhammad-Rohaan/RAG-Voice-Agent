import { useState, useEffect, useCallback, useRef } from 'react';
import useSpeechRecognition from './useSpeechRecognition';
import useSpeechSynthesis from './useSpeechSynthesis';
import { chatApi } from '../services/chatApi';

export default function useVoiceAgent() {
  const [agentState, setAgentState] = useState('idle'); // idle, listening, processing, speaking, disabled
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [autoContinue, setAutoContinue] = useState(true);
  const autoContinueRef = useRef(autoContinue);

  // Keep ref in sync to access current value in async callbacks
  useEffect(() => {
    autoContinueRef.current = autoContinue;
  }, [autoContinue]);

  // Load conversation history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await chatApi.getMessages();
        const mapped = history.map(msg => ({
          _id: msg._id,
          role: 'agent',
          message: msg.message,
          createdAt: msg.createdAt
        }));
        setMessages(mapped);
      } catch (err) {
        console.error("Failed to load chat history:", err);
      }
    };
    loadHistory();
  }, []);

  // Handle when text transcript is returned from SpeechRecognition
  const handleSpeechResult = useCallback(async (transcriptText) => {
    if (!transcriptText.trim()) {
      setAgentState('idle');
      return;
    }

    // Append user message locally
    const userMsg = {
      _id: 'user-' + Date.now(),
      role: 'user',
      message: transcriptText,
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setAgentState('processing');
    setError('');

    try {
      const data = await chatApi.sendMessage(transcriptText);

      const agentMsg = {
        _id: data._id,
        role: 'agent',
        message: data.message,
        createdAt: data.createdAt
      };

      setMessages(prev => [...prev, agentMsg]);
      setAgentState('speaking');
      speak(agentMsg.message);
    } catch (err) {
      console.error("Error communicating with RAG backend:", err);
      setError(err.message || 'Error communicating with server.');
      setMessages(prev => [...prev, {
        _id: 'err-' + Date.now(),
        role: 'system',
        message: `Error: Could not reach AI Receptionist. (${err.message})`,
        createdAt: new Date().toISOString()
      }]);
      setAgentState('idle');
    }
  }, []);

  const handleSpeechError = useCallback((errMsg) => {
    // If no speech detected, just return to idle gracefully
    if (errMsg.includes('No speech detected')) {
      setAgentState('idle');
      return;
    }
    setError(errMsg);
    setAgentState('idle');
  }, []);

  // Hook for recognition
  const {
    isListening,
    startListening,
    stopListening,
    error: recognitionError,
    isSupported: recognitionSupported
  } = useSpeechRecognition({
    onResult: handleSpeechResult,
    onError: handleSpeechError
  });

  const handleSynthesisStart = useCallback(() => {
    setAgentState('speaking');
  }, []);

  const handleSynthesisEnd = useCallback(() => {
    // Only auto-continue if enabled
    if (autoContinueRef.current) {
      setAgentState('listening');
      // Short delay so it doesn't immediately record system echo or key releases
      setTimeout(() => {
        startListening();
      }, 500);
    } else {
      setAgentState('idle');
    }
  }, [startListening]);

  const handleSynthesisError = useCallback((errMsg) => {
    setError(errMsg);
    setAgentState('idle');
  }, []);

  // Hook for TTS synthesis
  const {
    isSpeaking,
    speak,
    cancel: cancelSpeaking,
    isSupported: synthesisSupported
  } = useSpeechSynthesis({
    onStart: handleSynthesisStart,
    onEnd: handleSynthesisEnd,
    onError: handleSynthesisError
  });

  // Verify browser capability
  useEffect(() => {
    if (!recognitionSupported || !synthesisSupported) {
      setAgentState('disabled');
      setError('Web Speech APIs are not fully supported in this browser. Please use Chrome or Edge.');
    }
  }, [recognitionSupported, synthesisSupported]);

  // Main voice button action handler
  const handleVoiceAction = useCallback(() => {
    if (agentState === 'disabled') return;

    setError('');

    if (agentState === 'speaking') {
      // Interrupt: Stop speech, immediately start listening again
      cancelSpeaking();
      setAgentState('listening');
      startListening();
    } else if (agentState === 'listening') {
      // Manual stop listening
      stopListening();
    } else {
      // Start voice interaction
      cancelSpeaking(); // Ensure nothing is speaking
      setAgentState('listening');
      startListening();
    }
  }, [agentState, startListening, stopListening, cancelSpeaking]);

  const toggleAutoContinue = useCallback(() => {
    setAutoContinue(prev => !prev);
  }, []);

  const activeError = error || recognitionError;

  return {
    agentState,
    messages,
    setMessages,
    error: activeError,
    autoContinue,
    toggleAutoContinue,
    handleVoiceAction,
    submitTextQuery: handleSpeechResult,
    speakManual: speak,
    cancelSpeaking,
    isSupported: recognitionSupported && synthesisSupported
  };
}
