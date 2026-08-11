import React, { useState, useEffect } from 'react';
import AuthScreen from './components/AuthScreen';
import ChatScreen from './components/ChatScreen';
import { api } from './utils/api';
import { Activity } from 'lucide-react';
import './App.css';

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('akuh_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isValidating, setIsValidating] = useState(() => {
    return !!localStorage.getItem('akuh_user');
  });

  useEffect(() => {
    // Validate session on mount if user is stored in local storage
    if (user) {
      const validateSession = async () => {
        try {
          // Attempt to load messages (protected endpoint) to verify cookie validity
          await api.getMessages();
        } catch (err) {
          console.error("Session validation issue:", err);
          // If explicitly unauthorized (401 / expired session), clean user state
          if (err.message && (err.message.includes('401') || err.message.toLowerCase().includes('unauthorized') || err.message.toLowerCase().includes('token'))) {
            handleLogout();
          }
        } finally {
          setIsValidating(false);
        }
      };
      validateSession();
    } else {
      setIsValidating(false);
    }
  }, []);

  const handleAuthSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem('akuh_user', JSON.stringify(userData));
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (err) {
      console.error("Logout request failed, cleaning local state anyway:", err);
    } finally {
      setUser(null);
      localStorage.removeItem('akuh_user');
      setIsValidating(false);
    }
  };

  if (isValidating) {
    return (
      <div className="app-loading-screen">
        <div className="loading-card">
          <div className="loading-logo">
            <Activity size={36} className="spin-slow" />
          </div>
          <p className="loading-text">Loading AKUH AI Receptionist...</p>
          <span className="loading-text-ur">آغا خان ہسپتال استقبالیہ لوڈ ہو رہا ہے...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      {user ? (
        <ChatScreen user={user} onLogout={handleLogout} />
      ) : (
        <AuthScreen onAuthSuccess={handleAuthSuccess} />
      )}
    </div>
  );
}

export default App;
