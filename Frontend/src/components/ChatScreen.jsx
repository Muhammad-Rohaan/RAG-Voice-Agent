import React, { useState } from 'react';
import useVoiceAgent from '../hooks/useVoiceAgent';
import useRealtimeVoiceAgent from '../hooks/useRealtimeVoiceAgent';
import ChatWindow from './ChatWindow';
import VoiceButton from './VoiceButton';
import RealtimeVoiceVisualizer from './VoiceAgent/RealtimeVoiceVisualizer';
import { Send, LogOut, Activity, AlertTriangle, Radio, Sparkles, HelpCircle, Menu, X } from 'lucide-react';

export default function ChatScreen({ user, onLogout }) {
  const [input, setInput] = useState('');
  const [useRealtimeMode, setUseRealtimeMode] = useState(true);
  const [showMobileHelp, setShowMobileHelp] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const ragWsUrl = import.meta.env.VITE_RAG_WS_URL ?? 'wss://akuh-voice-agent.onrender.com';

  const realtimeVoice = useRealtimeVoiceAgent(ragWsUrl);
  const standardVoice = useVoiceAgent();

  const activeAgentState = useRealtimeMode ? realtimeVoice.agentState : standardVoice.agentState;
  const activeMessages = useRealtimeMode
    ? realtimeVoice.messages.length > 0
      ? realtimeVoice.messages
      : standardVoice.messages
    : standardVoice.messages;
  const activeError = useRealtimeMode ? realtimeVoice.error : standardVoice.error;

  const handleSend = async (textToSend) => {
    const query = textToSend || input;
    if (!query.trim() || activeAgentState === 'processing') return;
    if (!textToSend) setInput('');

    if (useRealtimeMode) {
      realtimeVoice.stopAudioPlayback();
    } else {
      standardVoice.cancelSpeaking();
      await standardVoice.submitTextQuery(query);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceButtonClick = () => {
    if (useRealtimeMode) {
      realtimeVoice.toggleVoiceSession(input);
    } else {
      standardVoice.handleVoiceAction();
    }
  };

  const handleModeToggle = () => {
    if (!useRealtimeMode && standardVoice.agentState === 'speaking') {
      standardVoice.cancelSpeaking();
    } else if (useRealtimeMode && realtimeVoice.isConnected) {
      realtimeVoice.disconnect();
    }
    setUseRealtimeMode((prev) => !prev);
  };

  const helpSteps = [
    { en: 'Press the mic button and speak your question.' },
    { en: 'You can ask in English or Urdu.' },
    { en: 'Or type your question in the box below.' },
  ];

  return (
    <div className="chat-container">
      {isSidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`chat-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Activity className="sidebar-logo-icon" size={26} />
            <div>
              <span>AKUH Reception</span>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close Sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">
            <span className="en">Voice Mode</span>
          </div>
          <button
            type="button"
            className={`toggle-card ${useRealtimeMode ? 'active' : ''}`}
            onClick={handleModeToggle}
            aria-pressed={useRealtimeMode}
          >
            <div className="toggle-card-info">
              <span className="toggle-card-label">
                {useRealtimeMode ? '📞 Live Voice Call' : '💬 Type & Talk'}
              </span>
              <span className="toggle-card-desc">
                {useRealtimeMode ? 'Real-time voice conversation' : 'Chat with voice support'}
              </span>
            </div>
            <div className={`toggle-pill ${useRealtimeMode ? 'on' : ''}`} aria-hidden="true" />
          </button>
        </div>

        {!useRealtimeMode && (
          <div className="sidebar-section">
            <div className="sidebar-section-title">
              <span className="en">Auto Listen</span>
            </div>
            <button
              type="button"
              className={`toggle-card ${standardVoice.autoContinue ? 'active' : ''}`}
              onClick={standardVoice.toggleAutoContinue}
              aria-pressed={standardVoice.autoContinue}
            >
              <div className="toggle-card-info">
                <span className="toggle-card-label">🎙️ Keep Mic Open</span>
                <span className="toggle-card-desc">No need to tap again</span>
              </div>
              <div
                className={`toggle-pill ${standardVoice.autoContinue ? 'on' : ''}`}
                aria-hidden="true"
              />
            </button>
          </div>
        )}

        <div className="sidebar-section">
          <div className="sidebar-section-title">
            <span className="en">How to Use</span>
          </div>
          <div className="sidebar-tips">
            {helpSteps.map((step, index) => (
              <div className="tip-item" key={index}>
                <span className="tip-num">{index + 1}</span>
                <div className="tip-item-text">
                  <span className="en">{step.en}</span>
                </div>
              </div>
            ))}
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
          <button onClick={onLogout} className="logout-btn" title="Logout">
            <LogOut size={16} />
            <span className="logout-label">Exit</span>
          </button>
        </div>
      </aside>

      <main className="chat-main">
        <header className="chat-header">
          <button
            type="button"
            className="mobile-sidebar-toggle"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            aria-label="Toggle Menu"
          >
            {isSidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <div className="header-agent-info">
            <div className="agent-avatar-wrapper">
              <Activity className="agent-avatar-icon" size={24} />
              {activeAgentState !== 'disabled' && <span className="online-indicator" />}
            </div>
            <div className="agent-details">
              <h2>Hospital Help Desk</h2>
              <p>Aga Khan University Hospital</p>
            </div>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="mobile-help-btn"
              onClick={() => setShowMobileHelp((prev) => !prev)}
              aria-expanded={showMobileHelp}
              aria-label="Show help"
            >
              <HelpCircle size={20} />
              <span>Help</span>
            </button>

            <div className={`badge ${useRealtimeMode ? 'mode-badge-active' : ''}`}>
              {useRealtimeMode ? (
                <Radio size={14} className="badge-icon" />
              ) : (
                <Sparkles size={14} className="badge-icon" />
              )}
              <span>{useRealtimeMode ? 'Live Voice' : 'Type & Talk'}</span>
            </div>
          </div>
        </header>

        {showMobileHelp && (
          <div className="mobile-help-panel">
            <p className="mobile-help-title">How to Use</p>
            <div className="sidebar-tips">
              {helpSteps.map((step, index) => (
                <div className="tip-item" key={index}>
                  <span className="tip-num">{index + 1}</span>
                  <div className="tip-item-text">
                    <span className="en">{step.en}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {useRealtimeMode && (
          <RealtimeVoiceVisualizer
            agentState={realtimeVoice.agentState}
            volumeLevel={realtimeVoice.volumeLevel}
          />
        )}

        {activeError && (
          <div className="voice-agent-error-bar" role="alert">
            <AlertTriangle size={18} className="error-bar-icon" />
            <span>{activeError}</span>
          </div>
        )}

        {!useRealtimeMode && (
          <ChatWindow
            messages={activeMessages}
            agentState={activeAgentState}
            username={user.username}
            onQuickQuery={handleSend}
            onPlayAudio={async (url, doneCallback) => {
              await standardVoice.speakManual(url);
              if (doneCallback) doneCallback();
            }}
          />
        )}

        <footer className="chat-footer-bar">
          <div className="input-container">
            <VoiceButton state={activeAgentState} onClick={handleVoiceButtonClick} />
            {!useRealtimeMode && (
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={
                  activeAgentState === 'listening'
                    ? 'Listening... speak now'
                    : 'Type your question...'
                }
                disabled={activeAgentState === 'processing' || activeAgentState === 'disabled'}
                rows={1}
                aria-label="Type your question"
              />
            )}
            {useRealtimeMode && (
              <div className="realtime-footer-hint">
                {activeAgentState === 'listening' ? '🎤 Listening...' :
                 activeAgentState === 'speaking' ? '🔊 Speaking...' :
                 activeAgentState === 'connecting' ? '⏳ Connecting...' :
                 activeAgentState === 'ready' ? '✅ Connected — speak anytime' :
                 'Tap mic to start your voice call'}
              </div>
            )}
            {!useRealtimeMode && (
              <button
                onClick={() => handleSend()}
                className="send-btn"
                disabled={
                  activeAgentState === 'processing' ||
                  activeAgentState === 'disabled' ||
                  !input.trim()
                }
                title="Send"
                aria-label="Send message"
              >
                <Send size={20} />
              </button>
            )}
          </div>
          <p className="disclaimer-text">
            <span className="disclaimer-en">
              For emergencies, go to the Emergency Room immediately.
            </span>
          </p>
        </footer>
      </main>
    </div>
  );
}
