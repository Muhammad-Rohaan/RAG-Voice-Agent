import React, { useEffect, useState } from 'react';
import { Mic, Volume2, Activity } from 'lucide-react';

export default function RealtimeVoiceVisualizer({
  agentState,
  volumeLevel,
}) {
  const [callSeconds, setCallSeconds] = useState(0);

  const isLive =
    agentState === 'listening' || agentState === 'speaking' || agentState === 'ready';

  // Call duration timer
  useEffect(() => {
    if (!isLive) {
      setCallSeconds(0);
      return;
    }
    const interval = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isLive]);

  const formatTime = (secs) => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const getStatusLabel = () => {
    switch (agentState) {
      case 'connecting': return 'Connecting...';
      case 'ready':
      case 'listening': return 'Listening...';
      case 'speaking': return 'Speaking...';
      case 'error': return 'Call ended';
      default: return 'Tap mic to start';
    }
  };

  const level = Math.max(0.12, volumeLevel || 0.12);

  return (
    <div className={`call-screen state-${agentState}`}>
      {/* Background animated rings */}
      {isLive && (
        <div className="call-rings" aria-hidden="true">
          <div className="call-ring ring-1" style={{ transform: `scale(${1 + level * 0.6})` }} />
          <div className="call-ring ring-2" style={{ transform: `scale(${1 + level * 0.4})` }} />
          <div className="call-ring ring-3" />
        </div>
      )}

      {/* Hospital avatar */}
      <div className="call-avatar-wrapper" aria-hidden="true">
        <div className={`call-avatar-orb ${agentState}`}>
          {agentState === 'speaking' ? (
            <Volume2 size={40} className="call-orb-icon" />
          ) : agentState === 'listening' ? (
            <Mic size={40} className="call-orb-icon" />
          ) : (
            <Activity size={40} className="call-orb-icon" />
          )}
        </div>
      </div>

      {/* Caller name */}
      <div className="call-caller-info">
        <h2 className="call-name">AKUH Reception</h2>
        <p className="call-subtitle">Aga Khan University Hospital</p>
      </div>

      {/* Status & Timer */}
      <div className="call-status-row">
        <span className={`call-status-badge ${isLive ? 'live' : ''}`}>
          {isLive ? (
            <><span className="live-dot" />{getStatusLabel()}</>
          ) : (
            <>{agentState === 'connecting' ? 'Connecting...' : 'Tap mic to call'}</>
          )}
        </span>
        {isLive && (
          <span className="call-timer">{formatTime(callSeconds)}</span>
        )}
      </div>

      {/* Wave bars */}
      {isLive && (
        <div className="call-wave-bars" aria-hidden="true">
          {[2.2, 3.2, 4.5, 3.8, 3.0, 2.5, 1.8].map((mult, i) => (
            <div
              key={i}
              className="call-wave-bar"
              style={{ transform: `scaleY(${Math.max(0.2, level * mult)})` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
