import React, { useState } from 'react';
import { User, Bot, Activity, Volume2, Loader } from 'lucide-react';
import FormattedMessage from './FormattedMessage';

export default function MessageBubble({ message, onPlayAudio }) {
  const { role, message: text, createdAt, audioUrl } = message;
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlayAudio = () => {
    if (onPlayAudio) {
      setIsPlaying(true);
      onPlayAudio(audioUrl, () => setIsPlaying(false));
    }
  };

  return (
    <div
      className={`message-wrapper ${
        role === 'user' ? 'msg-user' : role === 'system' ? 'msg-system' : 'msg-agent'
      }`}
    >
      <div className="message-avatar">
        {role === 'user' ? (
          <User size={16} />
        ) : role === 'system' ? (
          <Activity size={16} />
        ) : (
          <Bot size={16} />
        )}
      </div>
      <div className="message-bubble-wrapper">
        <div className="message-bubble">
          {role === 'agent' ? (
            <FormattedMessage text={text} />
          ) : (
            <p>{text}</p>
          )}
        </div>
        <div className="message-footer">
          {/* {role === 'agent' && onPlayAudio && (
            <button
              type="button"
              className={`play-urdu-btn ${isPlaying ? 'playing' : ''}`}
              onClick={handlePlayAudio}
              title="Play Pakistani Urdu Voice / اردو آواز سنیں"
            >
              {isPlaying ? <Loader className="spin-icon" size={13} /> : <Volume2 size={13} />}
              <span>{isPlaying ? 'Playing Audio...' : 'Listen Urdu / اردو آواز'}</span>
            </button>
          )} */}
          {role !== 'system' && (
            <span className="message-time">
              {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
