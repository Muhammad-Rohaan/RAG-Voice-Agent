import React, { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import { Activity, Bot } from 'lucide-react';

export default function ChatWindow({ messages, agentState, username, onQuickQuery }) {
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, agentState]);

  const getStatusIndicator = () => {
    switch (agentState) {
      case 'listening':
        return {
          text: 'Listening... / سن رہا ہوں',
          class: 'status-listening',
          icon: '🎤',
        };
      case 'processing':
        return {
          text: 'Thinking... / سوچ رہا ہوں',
          class: 'status-processing',
          icon: '🤔',
        };
      case 'speaking':
        return {
          text: 'Speaking... / بول رہا ہوں',
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
          <h2>Hello, {username}! / السلام علیکم</h2>
          <span className="welcome-urdu">آپ کیسے ہیں؟</span>
          <p>
            Press the mic button and ask about clinics, doctors, timings, or appointments.
          </p>
          <span className="welcome-urdu-desc">
            مائیک بٹن دبائیں اور کلینک، ڈاکٹر، اوقات یا اپائنٹمنٹ کے بارے میں پوچھیں۔
          </span>

          <div className="welcome-cards">
            <button
              type="button"
              className="w-card"
              onClick={() => onQuickQuery('What are the OPD clinic timings?')}
            >
              <span className="w-card-emoji">🏥</span>
              <h4>Clinic Timings</h4>
              <span className="w-card-ur">کلینک کے اوقات</span>
              <p>&quot;Cardiology department kahan hai?&quot;</p>
            </button>
            <button
              type="button"
              className="w-card"
              onClick={() => onQuickQuery('What are the dentistry packages?')}
            >
              <span className="w-card-emoji">🦷</span>
              <h4>Services & Fees</h4>
              <span className="w-card-ur">سروسز اور فیس</span>
              <p>&quot;Dental checkup ki fees kitni hai?&quot;</p>
            </button>
            <button
              type="button"
              className="w-card"
              onClick={() => onQuickQuery('I want to book an appointment')}
            >
              <span className="w-card-emoji">📅</span>
              <h4>Book Appointment</h4>
              <span className="w-card-ur">اپائنٹمنٹ بک کریں</span>
              <p>&quot;Dr. Ali se appointment chahiye&quot;</p>
            </button>
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
