import React, { useState } from 'react';
import useVoiceAgent from '../hooks/useVoiceAgent';
import useRealtimeVoiceAgent from '../hooks/useRealtimeVoiceAgent';
import ChatWindow from './ChatWindow';
import VoiceButton from './VoiceButton';
import RealtimeVoiceVisualizer from './VoiceAgent/RealtimeVoiceVisualizer';
import { Send, LogOut, Sparkles, Activity, ToggleLeft, ToggleRight, AlertTriangle, Radio } from 'lucide-react';


export default function ChatScreen({ user, onLogout }) {
  const [input, setInput] = useState('');
  const [useRealtimeMode, setUseRealtimeMode] = useState(true);

  const ragWsUrl = import.meta.env.VITE_RAG_WS_URL || 'ws://localhost:9000';

  // Realtime Audio Socket Voice Agent Hook
  const realtimeVoice = useRealtimeVoiceAgent(ragWsUrl);

  // Web Speech API / Text Chat Hook
  const standardVoice = useVoiceAgent();

  // Active hook depending on selected mode
  const activeAgentState = useRealtimeMode ? realtimeVoice.agentState : standardVoice.agentState;
  const activeMessages = useRealtimeMode
    ? (realtimeVoice.messages.length > 0 ? realtimeVoice.messages : standardVoice.messages)
    : standardVoice.messages;
  const activeError = useRealtimeMode ? realtimeVoice.error : standardVoice.error;

  const handleSend = async (textToSend) => {
    const query = textToSend || input;
    if (!query.trim() || activeAgentState === 'processing') return;

    if (!textToSend) {
      setInput('');
    }

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
          <h3>Voice Agent Mode</h3>
          <div className="settings-panel">
            <button
              type="button"
              className={`toggle-setting-btn ${useRealtimeMode ? 'active' : ''}`}
              onClick={() => {
                if (!useRealtimeMode && standardVoice.agentState === 'speaking') {
                  standardVoice.cancelSpeaking();
                } else if (useRealtimeMode && realtimeVoice.isConnected) {
                  realtimeVoice.disconnect();
                }
                setUseRealtimeMode(prev => !prev);
              }}
              title="Toggle between OpenAI Realtime Voice WebSockets and Web Speech API"
            >
              <div className="setting-info">
                <span className="setting-label">Realtime PCM Voice</span>
                <span className="setting-desc">OpenAI Audio WebSockets</span>
              </div>
              {useRealtimeMode ? (
                <ToggleRight className="toggle-icon active-toggle" size={28} />
              ) : (
                <ToggleLeft className="toggle-icon" size={28} />
              )}
            </button>
          </div>
        </div>

        {!useRealtimeMode && (
          <div className="sidebar-section">
            <h3>Voice Settings</h3>
            <div className="settings-panel">
              <button
                type="button"
                className={`toggle-setting-btn ${standardVoice.autoContinue ? 'active' : ''}`}
                onClick={standardVoice.toggleAutoContinue}
                title="When enabled, mic will auto-open after AI finishes speaking"
              >
                <div className="setting-info">
                  <span className="setting-label">Hands-free Mode</span>
                  <span className="setting-desc">Auto-opens microphone</span>
                </div>
                {standardVoice.autoContinue ? (
                  <ToggleRight className="toggle-icon active-toggle" size={28} />
                ) : (
                  <ToggleLeft className="toggle-icon" size={28} />
                )}
              </button>
            </div>
          </div>
        )}

        <div className="sidebar-section">
          <h3>Quick Guidelines</h3>
          <div className="sidebar-tips">
            <div className="tip-item">
              <span className="tip-num">1</span>
              <p>Click mic to start live voice session with OpenAI Realtime API.</p>
            </div>
            <div className="tip-item">
              <span className="tip-num">2</span>
              <p>Speak naturally to interrupt the AI Receptionist anytime.</p>
            </div>
            <div className="tip-item">
              <span className="tip-num">3</span>
              <p>Ask about hospital departments, doctor timings, and fees.</p>
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
              {activeAgentState !== 'disabled' && <span className="online-indicator"></span>}
            </div>
            <div className="agent-details">
              <h2>Hospital AI Receptionist</h2>
              <p>Aga Khan University Hospital Voice Agent</p>
            </div>
          </div>
          <div className="header-actions">
            <div className={`badge ${useRealtimeMode ? 'mode-badge-active' : ''}`}>
              {useRealtimeMode ? <Radio size={14} className="badge-icon" /> : <Sparkles size={14} className="badge-icon" />}
              <span>{useRealtimeMode ? 'Realtime Voice (PCM 24kHz)' : 'Voice RAG Core'}</span>
            </div>
          </div>
        </header>

        {/* Realtime Live Visualizer Bar */}
        {useRealtimeMode && (
          <RealtimeVoiceVisualizer
            agentState={realtimeVoice.agentState}
            volumeLevel={realtimeVoice.volumeLevel}
            latestAiMessage={[...realtimeVoice.messages].reverse().find(m => m.role === 'agent')}
            latestUserMessage={[...realtimeVoice.messages].reverse().find(m => m.role === 'user')}
          />
        )}

        {/* Error Banner if any voice or API error exists */}
        {activeError && (
          <div className="voice-agent-error-bar">
            <AlertTriangle size={16} className="error-bar-icon" />
            <span>{activeError}</span>
          </div>
        )}

        {/* Chat Thread Scroll Window */}
        <ChatWindow
          messages={activeMessages}
          agentState={activeAgentState}
          username={user.username}
          onQuickQuery={handleSend}
        />

        {/* Chat Input Bar */}
        <footer className="chat-footer-bar">
          <div className="input-container">
            <VoiceButton state={activeAgentState} onClick={handleVoiceButtonClick} />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={
                activeAgentState === 'listening'
                  ? "Listening... Speak directly to the AI Receptionist"
                  : "Ask about departments, timings, or doctors..."
              }
              disabled={activeAgentState === 'processing' || activeAgentState === 'disabled'}
              rows={1}
            />
            <button
              onClick={() => handleSend()}
              className="send-btn"
              disabled={activeAgentState === 'processing' || activeAgentState === 'disabled' || !input.trim()}
            >
              <Send size={18} />
            </button>
          </div>
          <p className="disclaimer-text">
            Disclaimer: The AI Receptionist uses real-time audio models. For acute medical emergencies, immediately proceed to the nearest Emergency Room.
          </p>
        </footer>
      </main>
    </div>
  );
}
