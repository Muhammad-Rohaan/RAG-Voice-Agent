import React, { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import { Activity, Bot } from 'lucide-react';

export default function ChatWindow({ messages, agentState, username, onQuickQuery, onPlayAudio }) {
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, agentState]);

  const getStatusIndicator = () => {
    switch (agentState) {
      case 'listening':
        return {
          text: 'Listening...',
          class: 'status-listening',
          icon: '🎤',
        };
      case 'processing':
        return {
          text: 'Thinking...',
          class: 'status-processing',
          icon: '🤔',
        };
      case 'speaking':
        return {
          text: 'Speaking...',
          class: 'status-speaking',
          icon: '🔊',
        };
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
          <div className="welcome-logo-wrapper">
            <Activity size={44} />
          </div>
          <h2>Welcome, {username}!</h2>
          <p>
            Press the mic button and ask about clinics, doctors, timings, or appointments.
          </p>

          <div className="welcome-cards">
            <button
              type="button"
              className="w-card"
              onClick={() => onQuickQuery('What are the OPD clinic timings?')}
            >
              <span className="w-card-emoji">🏥</span>
              <h4>Clinic Timings</h4>
              <p>&quot;Cardiology department kahan hai?&quot;</p>
            </button>
            <button
              type="button"
              className="w-card"
              onClick={() => onQuickQuery('What are the dentistry packages?')}
            >
              <span className="w-card-emoji">🦷</span>
              <h4>Services & Fees</h4>
              <p>&quot;Dental checkup ki fees kitni hai?&quot;</p>
            </button>
            <button
              type="button"
              className="w-card"
              onClick={() => onQuickQuery('I want to book an appointment')}
            >
              <span className="w-card-emoji">📅</span>
              <h4>Book Appointment</h4>
              <p>&quot;Dr. Ali se appointment chahiye&quot;</p>
            </button>
          </div>
        </div>
      ) : (
        <div className="messages-list">
          {messages.map((msg) => (
            <MessageBubble key={msg._id} message={msg} onPlayAudio={onPlayAudio} />
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
