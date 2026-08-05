import React from 'react';
import { PhoneCall, PhoneOff, Mic, Volume2, Sparkles, Activity } from 'lucide-react';

export default function RealtimeVoiceVisualizer({
  agentState,
  volumeLevel,
  latestAiMessage,
  latestUserMessage
}) {
  const getStatusText = () => {
    switch (agentState) {
      case 'connecting':
        return 'Connecting to AI Receptionist...';
      case 'ready':
      case 'listening':
        return 'Live Call Active • Listening to your voice...';
      case 'speaking':
        return 'Live Call Active • AI Receptionist is speaking...';
      case 'error':
        return 'Voice Call Disconnected (Error)';
      case 'idle':
      default:
        return 'Realtime Voice Call Offline';
    }
  };

  const isLive = agentState === 'listening' || agentState === 'speaking' || agentState === 'ready';
  const level = Math.max(0.12, volumeLevel || 0.12);

  return (
    <div className={`realtime-visualizer-container state-${agentState}`}>
      {/* Top Bar Status */}
      <div className="visualizer-header">
        <div className="visualizer-status-left">
          <div className={`status-dot ${isLive ? 'live' : ''}`} />
          {isLive ? (
            <PhoneCall size={16} className="call-icon active-call" />
          ) : (
            <PhoneOff size={16} className="call-icon offline-call" />
          )}
          <span className="status-label">{getStatusText()}</span>
        </div>

        {/* Live Audio Waveform */}
        {isLive && (
          <div className="visualizer-wave-bars">
            <div className="wave-bar" style={{ transform: `scaleY(${Math.max(0.25, level * 2.2)})` }} />
            <div className="wave-bar" style={{ transform: `scaleY(${Math.max(0.4, level * 3.2)})` }} />
            <div className="wave-bar" style={{ transform: `scaleY(${Math.max(0.7, level * 4.5)})` }} />
            <div className="wave-bar" style={{ transform: `scaleY(${Math.max(0.4, level * 3.0)})` }} />
            <div className="wave-bar" style={{ transform: `scaleY(${Math.max(0.25, level * 1.8)})` }} />
          </div>
        )}
      </div>

      {/* Live AI Talking Visual Stage (Centerpiece) */}
      {isLive && (
        <div className="realtime-live-stage">
          <div className="orb-container">
            {/* Outer Aura Ring */}
            <div
              className={`orb-aura ${agentState}`}
              style={{
                transform: `scale(${agentState === 'speaking' ? 1.15 + level * 0.35 : agentState === 'listening' ? 1.0 + level * 0.4 : 1})`,
                opacity: agentState === 'speaking' ? 0.9 : 0.4
              }}
            />
            {/* Core Orb */}
            <div className={`orb-core ${agentState}`}>
              {agentState === 'speaking' ? (
                <Volume2 size={28} className="orb-icon speaking-pulse" />
              ) : agentState === 'listening' ? (
                <Mic size={28} className="orb-icon listening-pulse" />
              ) : (
                <Activity size={28} className="orb-icon ready-pulse" />
              )}
            </div>
          </div>

          {/* Realtime Live Speech Subtitle Caption */}
          <div className="live-caption-card">
            <div className="caption-speaker">
              {agentState === 'speaking' ? (
                <>
                  <Sparkles size={14} className="caption-sparkle" />
                  <span>AI Receptionist Spoken Response:</span>
                </>
              ) : (
                <>
                  <Mic size={14} className="caption-mic" />
                  <span>Your Spoken Voice Query:</span>
                </>
              )}
            </div>
            <p className="caption-body">
              {agentState === 'speaking'
                ? (latestAiMessage?.message || 'Speaking in real-time...')
                : (latestUserMessage?.message || 'Listening... Speak your query about Aga Khan Hospital.')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
