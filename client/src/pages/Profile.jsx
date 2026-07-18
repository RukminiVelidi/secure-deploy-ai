import React, { useEffect, useRef, useState } from 'react';
import api from '../api/axios';
import Layout from '../components/Layout';
import { useTheme } from '../context/ThemeContext';
import { cardStyle, getTheme, gradient } from '../theme/styles';

export default function Profile() {
  const { theme, setTheme } = useTheme();
  const t = getTheme(theme);
  const fileRef = useRef(null);

  const [me, setMe] = useState(null);
  const [name, setName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/user/me').then(r => { setMe(r.data); setName(r.data.name || ''); });
  }, []);

  const saveName = async () => {
    setSaving(true);
    const { data } = await api.patch('/user/profile', { name });
    setMe(data);
    setSaving(false);
    setMsg('Saved');
    setTimeout(() => setMsg(''), 2000);
  };

  const handleAvatarPick = () => fileRef.current?.click();

  const uploadAvatar = async e => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const { data } = await api.post('/user/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMe(prev => ({ ...prev, avatarUrl: data.avatarUrl }));
    } catch (err) {
      alert(err.response?.data?.message || 'Upload failed');
    }
    setUploading(false);
  };

  if (!me) return <Layout><p style={{ color: t.textMuted }}>Loading…</p></Layout>;

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: t.textPrimary }}>Profile</h1>
        <p style={{ color: t.textMuted, marginTop: '4px' }}>Manage your avatar, name, and appearance</p>
      </div>

      <div style={{ ...cardStyle(theme), marginBottom: '24px' }}>
        <div className="flex items-center gap-6">
          <div style={{ position: 'relative' }}>
            <div style={{
              width: '90px', height: '90px', borderRadius: '50%',
              background: me.avatarUrl ? `url(${me.avatarUrl}) center/cover` : gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: '32px', fontWeight: '700', border: `3px solid ${t.border}`
            }}>
              {!me.avatarUrl && (me.name?.[0]?.toUpperCase() || me.email?.[0]?.toUpperCase() || '?')}
            </div>
            <button onClick={handleAvatarPick} disabled={uploading} style={{
              position: 'absolute', bottom: 0, right: 0, background: gradient, color: 'white',
              border: `2px solid ${t.surface}`, borderRadius: '50%', width: '28px', height: '28px',
              fontSize: '13px', cursor: 'pointer'
            }}>📷</button>
            <input ref={fileRef} type="file" accept="image/*" onChange={uploadAvatar} style={{ display: 'none' }} />
          </div>

          <div style={{ flex: 1 }}>
            <label style={{ color: t.textSecondary, fontSize: '13px', display: 'block', marginBottom: '6px' }}>Display name</label>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                style={{
                  flex: 1, background: t.bg, border: `1px solid ${t.border}`, borderRadius: '10px',
                  padding: '10px 14px', color: t.textPrimary, fontSize: '14px', outline: 'none'
                }}
              />
              <button onClick={saveName} disabled={saving} style={{
                background: gradient, color: 'white', padding: '10px 20px', borderRadius: '10px',
                fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer'
              }}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
            {msg && <p style={{ color: '#10b981', fontSize: '12px', marginTop: '6px' }}>{msg}</p>}
            {uploading && <p style={{ color: t.textMuted, fontSize: '12px', marginTop: '6px' }}>Uploading avatar…</p>}
          </div>
        </div>
      </div>

      <div style={{ ...cardStyle(theme), marginBottom: '24px' }}>
        <h2 style={{ color: t.textPrimary, fontWeight: '600', fontSize: '15px', marginBottom: '12px' }}>Account</h2>
        <div className="space-y-2" style={{ fontSize: '13px' }}>
          <p style={{ color: t.textMuted }}>Email: <span style={{ color: t.textPrimary }}>{me.email}</span></p>
          {me.githubUsername && (
            <p style={{ color: t.textMuted }}>GitHub: <span style={{ color: t.textPrimary }}>@{me.githubUsername}</span></p>
          )}
          {me.githubEmail && (
            <p style={{ color: t.textMuted }}>GitHub email: <span style={{ color: t.textPrimary }}>{me.githubEmail}</span></p>
          )}
        </div>
      </div>

      <div style={cardStyle(theme)}>
        <h2 style={{ color: t.textPrimary, fontWeight: '600', fontSize: '15px', marginBottom: '12px' }}>Appearance</h2>
        <div className="flex gap-3">
          {['dark', 'light'].map(opt => (
            <button key={opt} onClick={() => setTheme(opt)} style={{
              flex: 1, padding: '14px', borderRadius: '10px', cursor: 'pointer', textAlign: 'center',
              background: theme === opt ? 'rgba(102,126,234,0.1)' : t.bg,
              border: theme === opt ? '1px solid #667eea' : `1px solid ${t.border}`,
              color: t.textPrimary, fontSize: '13px', fontWeight: '600', textTransform: 'capitalize'
            }}>
              {opt === 'dark' ? '🌙' : '☀️'} {opt}
            </button>
          ))}
        </div>
      </div>
    </Layout>
  );
}
