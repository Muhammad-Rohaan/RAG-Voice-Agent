import React, { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import { Activity, Bot } from 'lucide-react';

export default function ChatWindow({ messages, agentState, username, onQuickQuery }) {
  const chatEndRef = useRef(null);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, agentState]);

  const getStatusIndicator = () => {
    switch (agentState) {
      case 'listening':
        return { text: 'Listening...', class: 'status-listening', icon: '🎤' };
      case 'processing':
        return { text: 'Thinking...', class: 'status-processing', icon: '🤔' };
      case 'speaking':
        return { text: 'Speaking...', class: 'status-speaking', icon: '🔊' };
      case 'idle':
      default:
        return null;
    }
  };

  const status = getStatusIndicator();

  return (
    <div className="chat-thread">
      {messages.length === 0 && agentState === 'idle' ? (
        <div className="welcome-state">
          <Activity className="welcome-logo" size={64} />
          <h2>Hello, {username}!</h2>
          <p>
            I am your Aga Khan Hospital AI Voice Receptionist. Click the microphone button and talk naturally to ask about clinics, check department schedules, or book appointments.
          </p>
          <div className="welcome-cards">
            <div className="w-card" onClick={() => onQuickQuery("What are the OPD clinic timings?")}>
              <h4>🏥 timings & locations</h4>
              <p>"Where is the cardiology department located?"</p>
            </div>
            <div className="w-card" onClick={() => onQuickQuery("What are the dentistry packages?")}>
              <h4>🦷 services & fees</h4>
              <p>"What is the dental consultation fee?"</p>
            </div>
            <div className="w-card" onClick={() => onQuickQuery("I want to book an appointment")}>
              <h4>📅 schedule visit</h4>
              <p>"Help me book an appointment with Dr. Ali"</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="messages-list">
          {messages.map((msg) => (
            <MessageBubble key={msg._id} message={msg} />
          ))}

          {agentState === 'processing' && (
            <div className="message-wrapper msg-agent msg-loading">
              <div className="message-avatar">
                <Bot size={16} />
              </div>
              <div className="message-bubble-wrapper">
                <div className="message-bubble typing-bubble">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
              </div>
            </div>
          )}

          {status && (
            <div className={`voice-floating-status ${status.class}`}>
              <span className="status-indicator-dot"></span>
              <span className="status-icon">{status.icon}</span>
              <span className="status-text">{status.text}</span>
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>
      )}
    </div>
  );
}
