import React from 'react';
import { PhoneCall, PhoneOff, Mic, Volume2, Activity } from 'lucide-react';

export default function RealtimeVoiceVisualizer({
  agentState,
  volumeLevel,
  latestAiMessage,
  latestUserMessage,
}) {
  const getStatusText = () => {
    switch (agentState) {
      case 'connecting':
        return { en: 'Connecting...', ur: 'رابطہ ہو رہا ہے...' };
      case 'ready':
      case 'listening':
        return { en: 'Live — I am listening', ur: 'براہ راست — سن رہا ہوں' };
      case 'speaking':
        return { en: 'Live — I am speaking', ur: 'براہ راست — بول رہا ہوں' };
      case 'error':
        return { en: 'Call ended', ur: 'کال ختم ہو گئی' };
      case 'idle':
      default:
        return { en: 'Tap mic to start talking', ur: 'مائیک دبائیں اور بولیں' };
    }
  };

  const status = getStatusText();
  const isLive =
    agentState === 'listening' || agentState === 'speaking' || agentState === 'ready';
  const level = Math.max(0.12, volumeLevel || 0.12);

  return (
    <div className={`realtime-visualizer-container state-${agentState}`}>
      <div className="visualizer-header">
        <div className="visualizer-status-left">
          <div className={`status-dot ${isLive ? 'live' : ''}`} />
          {isLive ? (
            <PhoneCall size={18} className="call-icon active-call" aria-hidden="true" />
          ) : (
            <PhoneOff size={18} className="call-icon offline-call" aria-hidden="true" />
          )}
          <div className="status-label-group">
            <span className="status-label">{status.en}</span>
            <span className="status-label-ur">{status.ur}</span>
          </div>
        </div>

        {isLive && (
          <div className="visualizer-wave-bars" aria-hidden="true">
            <div
              className="wave-bar"
              style={{ transform: `scaleY(${Math.max(0.25, level * 2.2)})` }}
            />
            <div
              className="wave-bar"
              style={{ transform: `scaleY(${Math.max(0.4, level * 3.2)})` }}
            />
            <div
              className="wave-bar"
              style={{ transform: `scaleY(${Math.max(0.7, level * 4.5)})` }}
            />
            <div
              className="wave-bar"
              style={{ transform: `scaleY(${Math.max(0.4, level * 3.0)})` }}
            />
            <div
              className="wave-bar"
              style={{ transform: `scaleY(${Math.max(0.25, level * 1.8)})` }}
            />
          </div>
        )}
      </div>

      {isLive && (
        <div className="realtime-live-stage">
          <div className="orb-container" aria-hidden="true">
            <div
              className={`orb-aura ${agentState}`}
              style={{
                transform: `scale(${
                  agentState === 'speaking'
                    ? 1.15 + level * 0.35
                    : agentState === 'listening'
                      ? 1.0 + level * 0.4
                      : 1
                })`,
                opacity: agentState === 'speaking' ? 0.9 : 0.4,
              }}
            />
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

          <div className="live-caption-card">
            <div className="caption-speaker">
              {agentState === 'speaking' ? (
                <>
                  <Volume2 size={16} className="caption-mic" aria-hidden="true" />
                  <span>Hospital Reply / ہسپتال کا جواب</span>
                </>
              ) : (
                <>
                  <Mic size={16} className="caption-mic" aria-hidden="true" />
                  <span>Your Question / آپ کا سوال</span>
                </>
              )}
            </div>
            <p className="caption-body">
              {agentState === 'speaking'
                ? latestAiMessage?.message || 'Speaking now... / اب بول رہا ہوں...'
                : latestUserMessage?.message ||
                  'Speak now... / اب بولیں...'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
