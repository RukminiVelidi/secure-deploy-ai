import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../api/axios';
import { useTheme } from '../context/ThemeContext';
import { getTheme, gradient } from '../theme/styles';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const t = getTheme(theme);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    api.get('/user/me').then(r => setProfile(r.data)).catch(() => {});
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const isActive = path => location.pathname === path;

  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/history', label: 'History' },
    { path: '/settings', label: 'Settings' }
  ];

  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.textPrimary, transition: 'background 0.2s' }}>
      <nav style={{ background: t.surface, borderBottom: `1px solid ${t.border}` }} className="px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">🛡️</span>
            <span className="text-xl font-bold" style={{
              background: gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>SecureDeploy AI</span>
          </Link>

          <div className="flex gap-2 items-center">
            {navItems.map(({ path, label }) => (
              <Link key={path} to={path} style={{
                background: isActive(path) ? gradient : 'transparent',
                color: isActive(path) ? 'white' : t.textSecondary,
                padding: '6px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: '500'
              }}>{label}</Link>
            ))}

            {/* Theme toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title="Toggle theme"
              style={{
                background: t.bg, border: `1px solid ${t.border}`, color: t.textSecondary,
                width: '34px', height: '34px', borderRadius: '8px', fontSize: '15px', cursor: 'pointer'
              }}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {/* Profile avatar — always visible, links to Profile page */}
            <Link to="/profile" title="Profile" style={{ display: 'inline-flex' }}>
              <div style={{
                width: '34px', height: '34px', borderRadius: '50%',
                background: profile?.avatarUrl ? `url(${profile.avatarUrl}) center/cover` : gradient,
                border: isActive('/profile') ? `2px solid ${t.accentFrom}` : `2px solid transparent`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: '13px', fontWeight: '700'
              }}>
                {!profile?.avatarUrl && (profile?.name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || '?')}
              </div>
            </Link>

            <button onClick={logout} style={{
              background: 'rgba(239,68,68,0.1)', color: '#f87171', padding: '6px 16px',
              borderRadius: '8px', fontSize: '14px', border: '1px solid rgba(239,68,68,0.2)'
            }}>Logout</button>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
