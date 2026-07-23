import React from 'react';
import { Mic, MicOff, Loader, Volume2 } from 'lucide-react';

export default function VoiceButton({ state, onClick }) {
  const getButtonContent = () => {
    switch (state) {
      case 'listening':
        return (
          <div className="voice-btn-inner listening-state">
            <Mic className="voice-icon pulse-icon" size={24} />
            <div className="glow-ring glow-1"></div>
            <div className="glow-ring glow-2"></div>
          </div>
        );
      case 'processing':
        return (
          <div className="voice-btn-inner processing-state">
            <Loader className="voice-icon spin-icon" size={24} />
            <div className="orbit-line"></div>
          </div>
        );
      case 'speaking':
        return (
          <div className="voice-btn-inner speaking-state">
            <div className="voice-wave-bars">
              <span className="bar bar-1"></span>
              <span className="bar bar-2"></span>
              <span className="bar bar-3"></span>
              <span className="bar bar-4"></span>
              <span className="bar bar-5"></span>
              <span className="bar bar-6"></span>
            </div>
            <Volume2 className="voice-icon speak-icon" size={20} />
          </div>
        );
      case 'disabled':
        return (
          <div className="voice-btn-inner disabled-state">
            <MicOff className="voice-icon" size={24} />
          </div>
        );
      case 'idle':
      default:
        return (
          <div className="voice-btn-inner idle-state">
            <Mic className="voice-icon" size={24} />
          </div>
        );
    }
  };

  const getButtonTitle = () => {
    switch (state) {
      case 'listening':
        return 'Listening... Click to stop';
      case 'processing':
        return 'Thinking...';
      case 'speaking':
        return 'AI is speaking. Click to interrupt';
      case 'disabled':
        return 'Speech APIs are not supported in this browser';
      case 'idle':
      default:
        return 'Click to start speaking';
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={state === 'disabled'}
      className={`voice-action-btn state-${state}`}
      title={getButtonTitle()}
    >
      {getButtonContent()}
    </button>
  );
}
