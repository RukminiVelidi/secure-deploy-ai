import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ghLoading, setGhLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', form);
      localStorage.setItem('token', data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
    setLoading(false);
  };

  const loginWithGithub = async () => {
    setGhLoading(true);
    try {
      const { data } = await api.get('/github/oauth-url', { params: { intent: 'login' } });
      window.location.href = data.url;
    } catch {
      setError('Could not start GitHub sign-in');
      setGhLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f0f1a' }}>
      <div style={{
        background: '#1a1a2e', border: '1px solid #2d2d44', borderRadius: '20px',
        padding: '40px', width: '100%', maxWidth: '400px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
      }}>
        <div className="text-center mb-8">
          <span className="text-5xl">🛡️</span>
          <h1 className="text-2xl font-bold mt-3" style={{
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
          }}>SecureDeploy AI</h1>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>AI-powered deployment safety</p>
        </div>

        <button onClick={loginWithGithub} disabled={ghLoading} style={{
          width: '100%', background: '#24292e', color: 'white', padding: '12px',
          borderRadius: '10px', fontSize: '14px', fontWeight: '600', border: 'none',
          cursor: ghLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: '8px', marginBottom: '20px'
        }}>
          <svg width="18" height="18" viewBox="0 0 16 16" fill="white"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          {ghLoading ? 'Redirecting...' : 'Continue with GitHub'}
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div style={{ flex: 1, height: '1px', background: '#2d2d44' }} />
          <span style={{ color: '#475569', fontSize: '12px' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: '#2d2d44' }} />
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px', marginBottom: '16px' }}>
            <p style={{ color: '#f87171', fontSize: '14px' }}>⚠️ {error}</p>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          {['email', 'password'].map(field => (
            <div key={field}>
              <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
                {field.charAt(0).toUpperCase() + field.slice(1)}
              </label>
              <input
                type={field}
                placeholder={field === 'email' ? 'you@example.com' : '••••••••'}
                value={form[field]}
                onChange={e => setForm({ ...form, [field]: e.target.value })}
                required
                style={{
                  width: '100%', background: '#0f0f1a', border: '1px solid #2d2d44', borderRadius: '10px',
                  padding: '12px 16px', color: '#e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
          ))}
          <button type="submit" disabled={loading} style={{
            width: '100%', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white',
            padding: '12px', borderRadius: '10px', fontSize: '15px', fontWeight: '600', border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: '8px'
          }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', marginTop: '20px' }}>
          No account? <Link to="/register" style={{ color: '#667eea' }}>Register</Link>
        </p>
      </div>
    </div>
  );
}
