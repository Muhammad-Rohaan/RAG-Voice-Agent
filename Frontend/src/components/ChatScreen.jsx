import React, { useState } from 'react';
import useVoiceAgent from '../hooks/useVoiceAgent';
import ChatWindow from './ChatWindow';
import VoiceButton from './VoiceButton';
import { Send, LogOut, Sparkles, Activity, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react';

export default function ChatScreen({ user, onLogout }) {
  const [input, setInput] = useState('');

  const {
    agentState,
    messages,
    error,
    autoContinue,
    toggleAutoContinue,
    handleVoiceAction,
    submitTextQuery,
    cancelSpeaking,
    isSupported
  } = useVoiceAgent();

  const handleSend = async (textToSend) => {
    const query = textToSend || input;
    if (!query.trim() || agentState === 'processing') return;

    if (!textToSend) {
      setInput('');
    }

    // Stop synthesis if user chooses to write manually
    cancelSpeaking();

    // Submit text query through the Voice Agent coordinator
    await submitTextQuery(query);
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
          <h3>Voice Settings</h3>
          <div className="settings-panel">
            <button
              type="button"
              className={`toggle-setting-btn ${autoContinue ? 'active' : ''}`}
              onClick={toggleAutoContinue}
              title="When enabled, the mic will automatically open after the AI finishes speaking"
            >
              <div className="setting-info">
                <span className="setting-label">Hands-free Mode</span>
                <span className="setting-desc">Auto-opens microphone</span>
              </div>
              {autoContinue ? (
                <ToggleRight className="toggle-icon active-toggle" size={28} />
              ) : (
                <ToggleLeft className="toggle-icon" size={28} />
              )}
            </button>
          </div>
        </div>

        <div className="sidebar-section">
          <h3>Quick Guidelines</h3>
          <div className="sidebar-tips">
            <div className="tip-item">
              <span className="tip-num">1</span>
              <p>Click the microphone and speak naturally.</p>
            </div>
            <div className="tip-item">
              <span className="tip-num">2</span>
              <p>Click the microphone while the AI is speaking to interrupt.</p>
            </div>
            <div className="tip-item">
              <span className="tip-num">3</span>
              <p>Confirm appointment summaries to sync with Google Calendar.</p>
            </div>
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
              <Activity className="agent-avatar-icon" size={24} />
              {agentState !== 'disabled' && <span className="online-indicator"></span>}
            </div>
            <div className="agent-details">
              <h2>Hospital AI Receptionist</h2>
              <p>Aga Khan University Hospital Voice Agent</p>
            </div>
          </div>
          <div className="header-actions">
            <div className="badge">
              <Sparkles size={14} className="badge-icon" />
              <span>Voice RAG Core</span>
            </div>
          </div>
        </header>

        {/* Error Banner if any voice or API error exists */}
        {error && (
          <div className="voice-agent-error-bar">
            <AlertTriangle size={16} className="error-bar-icon" />
            <span>{error}</span>
          </div>
        )}

        {/* Chat Thread Scroll Window */}
        <ChatWindow
          messages={messages}
          agentState={agentState}
          username={user.username}
          onQuickQuery={handleSend}
        />

        {/* Chat Input Bar */}
        <footer className="chat-footer-bar">
          <div className="input-container">
            <VoiceButton state={agentState} onClick={handleVoiceAction} />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={
                agentState === 'listening'
                  ? "Listening to your voice... speak now"
                  : "Ask about departments, timings, or type 'book'..."
              }
              disabled={agentState === 'processing' || agentState === 'disabled'}
              rows={1}
            />
            <button
              onClick={() => handleSend()}
              className="send-btn"
              disabled={agentState === 'processing' || agentState === 'disabled' || !input.trim()}
            >
              <Send size={18} />
            </button>
          </div>
          <p className="disclaimer-text">
            Disclaimer: The AI Receptionist uses browser APIs for speech. For acute emergencies, immediately proceed to the nearest Emergency Department.
          </p>
        </footer>
      </main>
    </div>
  );
}
