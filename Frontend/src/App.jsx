import React, { useState, useEffect } from 'react';
import AuthScreen from './components/AuthScreen';
import ChatScreen from './components/ChatScreen';
import { api } from './utils/api';
import './App.css';

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('akuh_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Validate session on mount if user is stored in local storage
    if (user) {
      const validateSession = async () => {
        try {
          // Attempt to load messages (protected endpoint) to verify cookie validity
          await api.getMessages();
        } catch (err) {
          // If unauthorized or expired, clean user state
          console.error("Session validation failed. Clearing credentials.", err);
          handleLogout();
        }
      };
      validateSession();
    }
  }, []);

  const handleAuthSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem('akuh_user', JSON.stringify(userData));
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await api.logout();
    } catch (err) {
      console.error("Logout request failed, cleaning local state anyway:", err);
    } finally {
      setUser(null);
      localStorage.removeItem('akuh_user');
      setLoading(false);
    }
  };

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
