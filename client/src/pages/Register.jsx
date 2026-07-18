import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function Register() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', form);
      localStorage.setItem('token', data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    }
    setLoading(false);
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
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>Create your account</p>
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
                placeholder={field === 'email' ? 'you@example.com' : 'min 8 characters'}
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
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', marginTop: '20px' }}>
          Have an account? <Link to="/login" style={{ color: '#667eea' }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
