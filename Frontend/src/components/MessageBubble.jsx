import React from 'react';
import { User, Bot, Activity } from 'lucide-react';
import FormattedMessage from './FormattedMessage';

export default function MessageBubble({ message }) {
  const { role, message: text, createdAt } = message;

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
        {role !== 'system' && (
          <span className="message-time">
            {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  );
}
