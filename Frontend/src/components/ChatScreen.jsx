import React, { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';
import FormattedMessage from './FormattedMessage';
import { Send, LogOut, User, Sparkles, Clock, Compass, HelpCircle, Activity, Calendar, Bot } from 'lucide-react';

export default function ChatScreen({ user, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const chatEndRef = useRef(null);

  // Quick actions/FAQ questions
  const faqs = [
    { text: "Where is the Nephrology clinic?", icon: Compass },
    { text: "What are the Radiology hours?", icon: Clock },
    { text: "How can I book an appointment?", icon: Calendar },
    { text: "Tell me about dentistry services", icon: HelpCircle }
  ];

  // Fetch past messages on mount
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const history = await api.getMessages();
        // Since backend only returns agent messages, map them as agent role
        const mappedHistory = history.map(msg => ({
          _id: msg._id,
          role: 'agent',
          message: msg.message,
          createdAt: msg.createdAt
        }));
        setMessages(mappedHistory);
      } catch (err) {
        console.error("Failed to load chat history:", err);
      }
    };

    fetchMessages();
  }, []);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textToSend) => {
    const query = textToSend || input;
    if (!query.trim() || loading) return;

    if (!textToSend) {
      setInput('');
    }

    setError('');
    
    // Add user message locally
    const userMsgId = 'user-' + Date.now();
    const newUserMsg = {
      _id: userMsgId,
      role: 'user',
      message: query,
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, newUserMsg]);
    setLoading(true);

    try {
      const data = await api.sendMessage(query);
      
      // Add agent message from response
      const newAgentMsg = {
        _id: data._id,
        role: 'agent',
        message: data.message,
        createdAt: data.createdAt
      };
      setMessages(prev => [...prev, newAgentMsg]);
    } catch (err) {
      setError(err.message || 'Failed to send message.');
      // Add a system message block showing the error
      setMessages(prev => [...prev, {
        _id: 'err-' + Date.now(),
        role: 'system',
        message: `Error: Could not reach AI Receptionist. (${err.message})`,
        createdAt: new Date().toISOString()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-container">
      {/* Sidebar Panel */}
      <aside className="chat-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Activity className="sidebar-logo-icon" size={24} />
            <span>AKUH Reception</span>
          </div>
        </div>

        <div className="sidebar-section">
          <h3>Quick Guidelines</h3>
          <div className="sidebar-tips">
            <div className="tip-item">
              <span className="tip-num">1</span>
              <p>Ask for doctor locations, schedules & consult fees.</p>
            </div>
            <div className="tip-item">
              <span className="tip-num">2</span>
              <p>Inquire about radiology, emergency & pharmacy hours.</p>
            </div>
            <div className="tip-item">
              <span className="tip-num">3</span>
              <p>Follow prompts to book appointments directly to Google Calendar.</p>
            </div>
          </div>
        </div>

        <div className="sidebar-section faq-section">
          <h3>Suggested Queries</h3>
          <div className="faq-grid">
            {faqs.map((faq, idx) => {
              const IconComp = faq.icon;
              return (
                <button
                  key={idx}
                  onClick={() => handleSend(faq.text)}
                  className="faq-btn"
                  disabled={loading}
                >
                  <IconComp size={16} className="faq-icon" />
                  <span>{faq.text}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">
              {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="user-info">
              <span className="user-name">{user.username || 'User'}</span>
              <span className="user-email">{user.email}</span>
            </div>
          </div>
          <button onClick={onLogout} className="logout-btn" title="Log Out">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* Main Chat Panel */}
      <main className="chat-main">
        {/* Chat Header */}
        <header className="chat-header">
          <div className="header-agent-info">
            <div className="agent-avatar-wrapper">
              <Bot className="agent-avatar-icon" size={24} />
              <span className="online-indicator"></span>
            </div>
            <div className="agent-details">
              <h2>Hospital AI Receptionist</h2>
              <p>Aga Khan University Hospital Assistant</p>
            </div>
          </div>
          <div className="header-actions">
            <div className="badge">
              <Sparkles size={14} className="badge-icon" />
              <span>RAG Knowledge Base</span>
            </div>
          </div>
        </header>

        {/* Message Thread */}
        <div className="chat-thread">
          {messages.length === 0 && !loading ? (
            <div className="welcome-state">
              <Activity className="welcome-logo" size={64} />
              <h2>Hello, {user.username}!</h2>
              <p>
                I am your Aga Khan Hospital AI Receptionist. I have access to all clinic directories, timings, and calendar services. 
                Ask me anything to get started!
              </p>
              <div className="welcome-cards">
                <div className="w-card" onClick={() => handleSend("What are the OPD clinic timings?")}>
                  <h4>🏥 timings & locations</h4>
                  <p>"Where is the cardiology department located?"</p>
                </div>
                <div className="w-card" onClick={() => handleSend("What are the dentistry packages?")}>
                  <h4>🦷 services & fees</h4>
                  <p>"What is the dental consultation fee?"</p>
                </div>
                <div className="w-card" onClick={() => handleSend("I want to book an appointment")}>
                  <h4>📅 schedule visit</h4>
                  <p>"Help me book an appointment with Dr. Ali"</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="messages-list">
              {messages.map((msg) => (
                <div
                  key={msg._id}
                  className={`message-wrapper ${msg.role === 'user' ? 'msg-user' : msg.role === 'system' ? 'msg-system' : 'msg-agent'}`}
                >
                  <div className="message-avatar">
                    {msg.role === 'user' ? (
                      <User size={16} />
                    ) : msg.role === 'system' ? (
                      <Activity size={16} />
                    ) : (
                      <Bot size={16} />
                    )}
                  </div>
                  <div className="message-bubble-wrapper">
                    <div className="message-bubble">
                      {msg.role === 'agent' ? (
                        <FormattedMessage text={msg.message} />
                      ) : (
                        <p>{msg.message}</p>
                      )}
                    </div>
                    <span className="message-time">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}

              {loading && (
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
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Chat Input Bar */}
        <footer className="chat-footer-bar">
          <div className="input-container">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask about departments, doctors, timings, or type 'book appointment'..."
              disabled={loading}
              rows={1}
            />
            <button
              onClick={() => handleSend()}
              className="send-btn"
              disabled={loading || !input.trim()}
            >
              <Send size={18} />
            </button>
          </div>
          <p className="disclaimer-text">
            Disclaimer: The AI Receptionist provides information based on approved hospital documents. For medical emergencies, please visit the nearest Emergency Room.
          </p>
        </footer>
      </main>
    </div>
  );
}
