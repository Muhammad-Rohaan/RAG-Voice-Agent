import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { api } from '../utils/api';
import { Mail, Lock, User, LogIn, UserPlus, Activity, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function AuthScreen({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let data;
      if (isLogin) {
        data = await api.login(email, password);
      } else {
        data = await api.register(username, email, password);
      }
      onAuthSuccess(data.user);
    } catch (err) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      if (!credentialResponse?.credential) {
        throw new Error('Google credential token not received.');
      }
      const data = await api.googleAuth(credentialResponse.credential);
      onAuthSuccess(data.user);
    } catch (err) {
      console.error('Google Auth Error:', err);
      setError(err.message || 'Google authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google Sign-In was cancelled or failed to connect.');
  };

  return (

    <div className="auth-container">
      <div className="auth-card">
        {/* Left Side: Hospital Branding Banner */}
        <div className="auth-banner">
          <div className="banner-overlay"></div>
          <div className="banner-content">
            <div className="brand-logo">
              <Activity className="brand-icon" size={32} />
              <span>AKUH AI Receptionist</span>
            </div>
            <h2>Welcome to Aga Khan University Hospital</h2>
            <p>Your 24/7 intelligent voice and chat companion for appointments, timings, and department info.</p>
            <div className="banner-features">
              <div className="feature-item">
                <span className="bullet">✦</span> Easy Doctor & Timings Lookups
              </div>
              <div className="feature-item">
                <span className="bullet">✦</span> Direct Calendar Appointment Booking
              </div>
              <div className="feature-item">
                <span className="bullet">✦</span> 24/7 Hospital Information System
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="auth-form-side">
          <div className="form-header">
            <h3>{isLogin ? 'Sign In' : 'Create Account'}</h3>
            <p className="form-subtitle">
              {isLogin ? 'Access the RAG chatbot interface' : 'Sign up to start scheduling appointments'}
            </p>
          </div>

          {error && (
            <div className="auth-error-banner">
              <AlertCircle size={18} className="error-icon" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            {!isLogin && (
              <div className="input-group">
                <label htmlFor="username">Username</label>
                <div className="input-wrapper">
                  <User className="input-icon" size={18} />
                  <input
                    type="text"
                    id="username"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

            <div className="input-group">
              <label htmlFor="email">Email Address</label>
              <div className="input-wrapper">
                <Mail className="input-icon" size={18} />
                <input
                  type="email"
                  id="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <Lock className="input-icon" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? (
                <span className="spinner"></span>
              ) : isLogin ? (
                <>
                  <LogIn size={18} />
                  <span>Sign In</span>
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  <span>Register</span>
                </>
              )}
            </button>
          </form>

          <div className="auth-divider">
            <span>OR</span>
          </div>

          <div className="google-login-wrapper">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              shape="rectangular"
              theme="outline"
              size="large"
              width="100%"
              text={isLogin ? "signin_with" : "signup_with"}
            />
          </div>

          <div className="auth-toggle-link">
            {isLogin ? (
              <p>
                Don't have an account?{' '}
                <button type="button" onClick={() => { setIsLogin(false); setError(''); }}>
                  Sign Up
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button type="button" onClick={() => { setIsLogin(true); setError(''); }}>
                  Sign In
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

