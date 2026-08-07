import React from 'react';
import { Mic, MicOff, Loader, Volume2 } from 'lucide-react';

export default function VoiceButton({ state, onClick }) {
  const getButtonContent = () => {
    switch (state) {
      case 'connecting':
        return (
          <div className="voice-btn-inner connecting-state">
            <Loader className="voice-icon spin-icon" size={26} />
          </div>
        );
      case 'ready':
      case 'listening':
        return (
          <div className="voice-btn-inner listening-state">
            <Mic className="voice-icon pulse-icon" size={26} />
            <div className="glow-ring glow-1"></div>
            <div className="glow-ring glow-2"></div>
          </div>
        );
      case 'processing':
        return (
          <div className="voice-btn-inner processing-state">
            <Loader className="voice-icon spin-icon" size={26} />
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
            <Volume2 className="voice-icon speak-icon" size={22} />
          </div>
        );
      case 'disabled':
        return (
          <div className="voice-btn-inner disabled-state">
            <MicOff className="voice-icon" size={26} />
          </div>
        );
      case 'idle':
      default:
        return (
          <div className="voice-btn-inner idle-state">
            <Mic className="voice-icon" size={26} />
          </div>
        );
    }
  };

  const getButtonTitle = () => {
    switch (state) {
      case 'connecting':
        return 'Connecting... / رابطہ ہو رہا ہے';
      case 'ready':
      case 'listening':
        return 'Listening — tap to stop / سن رہا ہوں — بند کرنے کے لیے دبائیں';
      case 'processing':
        return 'Thinking... / سوچ رہا ہوں';
      case 'speaking':
        return 'Speaking — tap to stop / بول رہا ہوں — روکنے کے لیے دبائیں';
      case 'disabled':
        return 'Voice not available / آواز دستیاب نہیں';
      case 'idle':
      default:
        return 'Tap to talk / بات کرنے کے لیے دبائیں';
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={state === 'disabled'}
      className={`voice-action-btn state-${state}`}
      title={getButtonTitle()}
      aria-label={getButtonTitle()}
    >
      {getButtonContent()}
    </button>
  );
}
