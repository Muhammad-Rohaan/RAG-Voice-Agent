import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../utils/api';

const RAG_WS_URL = import.meta.env.VITE_RAG_WS_URL ?? 'ws://localhost:9000';

/**
 * Helper to resample Float32 audio data from hardware rate (e.g. 48kHz/44.1kHz) to 24kHz
 */
function resampleFloat32(inputData, fromSampleRate, toSampleRate = 24000) {
  if (fromSampleRate === toSampleRate || !fromSampleRate) return inputData;
  const ratio = fromSampleRate / toSampleRate;
  const newLength = Math.floor(inputData.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const originPos = i * ratio;
    const index = Math.floor(originPos);
    const decimal = originPos - index;
    const current = inputData[index] || 0;
    const next = (index + 1 < inputData.length) ? inputData[index + 1] : current;
    result[i] = current + (next - current) * decimal;
  }
  return result;
}

/**
 * Helper to convert Float32 array (-1 to 1) to Int16 PCM array (-32768 to 32767)
 */
function floatTo16BitPCM(float32Array) {
  const buffer = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    buffer[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return buffer;
}

/**
 * Helper to convert TypedArray / ArrayBuffer to base64 with byte bounds
 */
function arrayBufferToBase64(typedArrayOrBuffer) {
  let binary = '';
  const bytes = typedArrayOrBuffer.buffer
    ? new Uint8Array(typedArrayOrBuffer.buffer, typedArrayOrBuffer.byteOffset, typedArrayOrBuffer.byteLength)
    : new Uint8Array(typedArrayOrBuffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}


/**
 * Helper to convert Base64 string to Float32Array at 24kHz
 */
function base64ToFloat32PCM(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff);
  }
  return float32;
}

export default function useRealtimeVoiceAgent(wsUrl = RAG_WS_URL) {
  const [isConnected, setIsConnected] = useState(false);
  const [agentState, setAgentState] = useState('idle'); // idle, connecting, ready, listening, speaking, error
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [volumeLevel, setVolumeLevel] = useState(0);

  const socketRef = useRef(null);
  const audioCtxRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const scriptNodeRef = useRef(null);
  const micInitializedRef = useRef(false);
  const isSessionReadyRef = useRef(false);
  const isStreamingRef = useRef(false);

  // Playback queue management
  const activeSourcesRef = useRef([]);
  const nextPlayTimeRef = useRef(0);
  const currentAiMsgIdRef = useRef(null);
  const isBargeInRef = useRef(false); // true while suppressing leftover audio after user interrupts

  // Stop & clear all currently scheduled audio output sources (barge-in / interrupt)
  const stopAudioPlayback = useCallback(() => {
    activeSourcesRef.current.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Source might already be stopped
      }
    });
    activeSourcesRef.current = [];
    if (audioCtxRef.current) {
      nextPlayTimeRef.current = audioCtxRef.current.currentTime;
    }
  }, []);

  // Initialize or resume Web Audio Context
  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AudioCtx({ sampleRate: 24000 });
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Play incoming PCM 24kHz base64 audio chunk seamlessly
  const playAudioChunk = useCallback((base64Delta) => {
    try {
      const audioCtx = getAudioContext();
      const float32Data = base64ToFloat32PCM(base64Delta);

      const buffer = audioCtx.createBuffer(1, float32Data.length, 24000);
      buffer.getChannelData(0).set(float32Data);

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);

      const now = audioCtx.currentTime;
      if (nextPlayTimeRef.current < now) {
        nextPlayTimeRef.current = now;
      }

      source.start(nextPlayTimeRef.current);
      nextPlayTimeRef.current += buffer.duration;

      activeSourcesRef.current.push(source);

      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
        if (activeSourcesRef.current.length === 0 && socketRef.current?.readyState === WebSocket.OPEN) {
          setAgentState('listening');
        }
      };
    } catch (err) {
      console.error("Error playing audio chunk:", err);
    }
  }, [getAudioContext]);

  // Stop microphone stream
  const stopMicrophoneStream = useCallback(() => {
    if (scriptNodeRef.current) {
      scriptNodeRef.current.disconnect();
      scriptNodeRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    micInitializedRef.current = false;
    setVolumeLevel(0);
  }, []);

  const agentStateRef = useRef(agentState);
  useEffect(() => {
    agentStateRef.current = agentState;
  }, [agentState]);

  const initMicrophoneStream = useCallback(async () => {
    try {
      if (micInitializedRef.current) return true;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      mediaStreamRef.current = stream;
      const audioCtx = getAudioContext();

      const source = audioCtx.createMediaStreamSource(stream);
      const scriptNode = audioCtx.createScriptProcessor(4096, 1, 1);
      scriptNodeRef.current = scriptNode;

      // Silent gain node to keep audio processing alive without routing mic input back to speakers
      const silentGain = audioCtx.createGain();
      silentGain.gain.value = 0;

      let lastVolTime = 0;

      scriptNode.onaudioprocess = (audioProcessingEvent) => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

        const inputBuffer = audioProcessingEvent.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);

        // Echo Suppression: Do NOT transmit mic audio while AI output is actively playing
        if (agentStateRef.current === 'speaking') {
          setVolumeLevel(0);
          return;
        }

        // Compute RMS volume level for UI visualizer
        let sum = 0;
        for (let i = 0; i < inputData.length; i += 4) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / (inputData.length / 4));

        // Throttle volume calculation to avoid React re-render lag
        const now = Date.now();
        if (now - lastVolTime > 100) {
          lastVolTime = now;
          setVolumeLevel(rms < 0.003 ? 0 : Math.min(1, rms * 10));
        }

        if (!isStreamingRef.current || !isSessionReadyRef.current) return;

        // Resample audio buffer from hardware rate (e.g. 48kHz/44.1kHz) to target 24kHz PCM for OpenAI Realtime
        const fromRate = inputBuffer.sampleRate || audioCtx.sampleRate || 48000;
        const resampledData = resampleFloat32(inputData, fromRate, 24000);

        // Convert Float32 to 16-bit PCM buffer and send over WebSocket
        const pcm16 = floatTo16BitPCM(resampledData);
        const base64Audio = arrayBufferToBase64(pcm16);

        socketRef.current.send(JSON.stringify({
          type: "audio_buffer",
          audio: base64Audio
        }));
      };

      source.connect(scriptNode);
      scriptNode.connect(silentGain);
      silentGain.connect(audioCtx.destination);
      micInitializedRef.current = true;
      return true;
    } catch (err) {
      console.error("Microphone access error:", err);
      setError("Microphone permission denied or audio device error.");
      setAgentState('error');
      micInitializedRef.current = false;
      isStreamingRef.current = false;
      isSessionReadyRef.current = false;
      throw err;
    }
  }, [getAudioContext]);



  // Connect WebSocket session
  const connect = useCallback(async (userQuery) => {
    if (socketRef.current && (socketRef.current.readyState === WebSocket.CONNECTING || socketRef.current.readyState === WebSocket.OPEN)) {
      return;
    }

    setAgentState('connecting');
    setError('');
    isSessionReadyRef.current = false;
    isStreamingRef.current = false;

    try {
      await initMicrophoneStream();
    } catch {
      return;
    }

    try {
      // Trigger voice agent session on backend with dynamic or default userQuery
      const queryToSend = userQuery && userQuery.trim() ? userQuery.trim() : "Aga Khan Hospital departments doctors timings fees";
      await api.startVoiceSession(queryToSend).catch(err => {
        console.warn("Backend session trigger returned warning (proceeding to WS):", err);
      });
    } catch (err) {
      console.warn("Could not reach backend start-session endpoint:", err);
    }

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;


    ws.onopen = () => {
      console.log("⚡ Realtime Voice WS Connected");
      setIsConnected(true);
      isSessionReadyRef.current = true;
      isStreamingRef.current = true;
      setAgentState('listening');
    };

    ws.onmessage = (event) => {

      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'session.ready':
            console.log("✅ Realtime Session Ready");
            isSessionReadyRef.current = true;
            isStreamingRef.current = true;
            setAgentState('listening');
            break;

          case 'speech_started':
            if (agentStateRef.current === 'speaking') {
              console.log("⚡ User interrupted AI (Barge-in)");
              isBargeInRef.current = true;  // suppress residual audio_delta chunks
              stopAudioPlayback();
              setAgentState('listening');
            }
            break;

          case 'user_transcript':
            if (data.text && data.text.trim()) {
              const text = data.text.trim();
              const isHallucination = /whataburger|subtitles|amara\.org|mbc|you|subscriber|like and subscribe|bobobobo|tellell|badbad|ba-ba-/i.test(text);
              if (!isHallucination && text.length > 2) {
                const userMsg = {
                  _id: 'user-' + Date.now(),
                  role: 'user',
                  message: text,
                  createdAt: new Date().toISOString()
                };
                setMessages(prev => [...prev, userMsg]);
              }
            }
            break;

          case 'ai_transcript_delta':
            if (data.delta) {
              isBargeInRef.current = false; // new AI response started – allow audio again
              setAgentState('speaking');
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'agent' && last._id === currentAiMsgIdRef.current) {
                  return [
                    ...prev.slice(0, -1),
                    { ...last, message: last.message + data.delta }
                  ];
                } else {
                  const newAiId = 'agent-' + Date.now();
                  currentAiMsgIdRef.current = newAiId;
                  return [
                    ...prev,
                    {
                      _id: newAiId,
                      role: 'agent',
                      message: data.delta,
                      createdAt: new Date().toISOString()
                    }
                  ];
                }
              });
            }
            break;

          case 'audio_delta':
            if (data.delta && !isBargeInRef.current) {
              playAudioChunk(data.delta);
            }
            break;

          case 'ai_transcript_done':
            if (activeSourcesRef.current.length === 0) {
              setAgentState('listening');
            }
            break;

          case 'error':
            console.error("Server WS Error:", data.message);
            setError(data.message || "Voice agent error occurred.");
            setAgentState('error');
            break;

          default:
            break;
        }
      } catch (err) {
        console.error("Error processing WS message:", err);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket Error:", err);
      setError("WebSocket connection failed. Ensure RAG server is running.");
      setAgentState('error');
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.log("⚡ Realtime Voice WS Closed");
      setIsConnected(false);
      setAgentState('idle');
      isSessionReadyRef.current = false;
      isStreamingRef.current = false;
      stopMicrophoneStream();
    };
  }, [wsUrl, stopAudioPlayback, initMicrophoneStream, playAudioChunk, stopMicrophoneStream]);

  // Disconnect WebSocket session
  const disconnect = useCallback(() => {
    isSessionReadyRef.current = false;
    isStreamingRef.current = false;
    stopMicrophoneStream();
    stopAudioPlayback();
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setIsConnected(false);
    setAgentState('idle');
  }, [stopAudioPlayback, stopMicrophoneStream]);

  // Toggle voice session connection
  const toggleVoiceSession = useCallback((userQuery) => {
    if (isConnected || agentState === 'connecting' || agentState === 'listening' || agentState === 'speaking') {
      disconnect();
    } else {
      connect(userQuery);
    }
  }, [isConnected, agentState, connect, disconnect]);


  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    agentState,
    messages,
    setMessages,
    error,
    volumeLevel,
    connect,
    disconnect,
    toggleVoiceSession,
    stopAudioPlayback
  };
}
