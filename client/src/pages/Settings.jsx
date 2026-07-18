import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import Layout from '../components/Layout';
import RepoFileBrowser from '../components/RepoFileBrowser';
import { useTheme } from '../context/ThemeContext';
import { cardStyle, getTheme, gradient } from '../theme/styles';

const CHECK_LABELS = {
  checkSecrets: 'Secrets',
  checkEnv: 'Env vars',
  checkDeps: 'Dependencies',
  checkDebug: 'Debug code',
  checkConsole: 'Console logs',
  checkTodos: 'TODOs',
  checkVulnerabilities: 'Vulnerabilities (SQLi/XSS/SSRF/etc)',
  autoOpenFixPRs: 'Auto-open fix PRs'
};

export default function Settings() {
  const { theme } = useTheme();
  const t = getTheme(theme);

  const [me, setMe] = useState(null);
  const [projects, setProjects] = useState([]);
  const [pickerProject, setPickerProject] = useState(null);

  const load = () => {
    api.get('/user/me').then(r => setMe(r.data));
    api.get('/projects').then(r => setProjects(r.data));
  };
  useEffect(load, []);

  const updateEmailPref = async pref => {
    await api.patch('/user/email-preference', { emailPreference: pref });
    setMe(prev => ({ ...prev, emailPreference: pref }));
  };

  const toggleProjectSetting = async (project, key) => {
    const newSettings = { ...project.settings, [key]: !project.settings[key] };
    const { data } = await api.patch(`/projects/${project._id}/settings`, newSettings);
    setProjects(prev => prev.map(p => (p._id === data._id ? data : p)));
  };

  const removeProject = async id => {
    if (!window.confirm('Remove this repository?')) return;
    await api.delete(`/projects/${id}`);
    setProjects(prev => prev.filter(p => p._id !== id));
  };

  const editFiles = project => {
    setPickerProject(project);
  };

  const fetchTreeForPicker = () => {
    if (!pickerProject) return Promise.resolve([]);
    if (pickerProject.source === 'public') {
      return api.get('/github/public-repo-tree', {
        params: { repoName: pickerProject.repoName, branch: pickerProject.defaultBranch }
      }).then(r => r.data);
    }
    return api.get('/github/repo-tree', {
      params: { installationId: pickerProject.installationId, repoName: pickerProject.repoName, branch: pickerProject.defaultBranch }
    }).then(r => r.data);
  };

  const confirmFileSelection = async paths => {
    const { data } = await api.patch(`/projects/${pickerProject._id}/paths`, { paths });
    setProjects(prev => prev.map(p => (p._id === data._id ? data : p)));
  };

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: t.textPrimary }}>Settings</h1>
        <p style={{ color: t.textMuted, marginTop: '4px' }}>Account preferences and per-repository scan configuration</p>
      </div>

      {/* --- GitHub identity (read-only status; connecting/browsing repos happens on the Dashboard now) --- */}
      <div style={{ ...cardStyle(theme), marginBottom: '24px' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span style={{ background: gradient, borderRadius: '10px', padding: '8px', fontSize: '18px' }}>🐙</span>
            <div>
              <h2 style={{ color: t.textPrimary, fontWeight: '600', fontSize: '16px' }}>GitHub Connection</h2>
              <p style={{ color: t.textMuted, fontSize: '13px' }}>
                {me?.githubUsername ? `Connected as @${me.githubUsername}` : 'Not connected yet'}
              </p>
            </div>
          </div>
          <Link to="/" style={{
            background: t.bg, color: '#667eea', border: '1px solid rgba(102,126,234,0.3)',
            padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '500'
          }}>Connect repos on Dashboard →</Link>
        </div>
      </div>

      {/* --- Notification email preference --- */}
      <div style={{ ...cardStyle(theme), marginBottom: '24px' }}>
        <h2 style={{ color: t.textPrimary, fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>Scan Report Emails</h2>
        <p style={{ color: t.textMuted, fontSize: '13px', marginBottom: '14px' }}>
          Where should we send high-risk alerts and scan reports?
        </p>
        <div className="flex gap-3">
          {[
            { key: 'profile', label: 'Profile email', value: me?.email },
            { key: 'github', label: 'GitHub email', value: me?.githubEmail || 'Not connected' }
          ].map(opt => (
            <button key={opt.key} onClick={() => updateEmailPref(opt.key)} disabled={opt.key === 'github' && !me?.githubEmail} style={{
              flex: 1, textAlign: 'left', padding: '14px', borderRadius: '10px', cursor: 'pointer',
              background: me?.emailPreference === opt.key ? 'rgba(102,126,234,0.1)' : t.bg,
              border: me?.emailPreference === opt.key ? '1px solid #667eea' : `1px solid ${t.border}`,
              opacity: (opt.key === 'github' && !me?.githubEmail) ? 0.5 : 1
            }}>
              <p style={{ color: t.textPrimary, fontSize: '13px', fontWeight: '600' }}>{opt.label}</p>
              <p style={{ color: t.textMuted, fontSize: '12px', marginTop: '2px' }}>{opt.value}</p>
            </button>
          ))}
        </div>
      </div>

      {/* --- Connected repos: per-repo scan settings + file selection --- */}
      <div style={cardStyle(theme)}>
        <h2 style={{ color: t.textPrimary, fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>Repository Scan Settings</h2>
        <p style={{ color: t.textMuted, fontSize: '13px', marginBottom: '16px' }}>
          {projects.length} repo{projects.length !== 1 ? 's' : ''} connected
        </p>

        {projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', border: `1px dashed ${t.border}`, borderRadius: '12px' }}>
            <span style={{ fontSize: '36px' }}>🔍</span>
            <p style={{ color: t.textFaint, marginTop: '8px', fontSize: '14px' }}>No repositories connected yet</p>
            <Link to="/" style={{ color: '#667eea', fontSize: '13px' }}>Connect one from the Dashboard →</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map(p => (
              <div key={p._id} style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '16px' }}>
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <p style={{ color: t.textPrimary, fontWeight: '500', fontSize: '14px' }}>{p.repoName}</p>
                    <p style={{ color: t.textFaint, fontSize: '12px' }}>
                      {p.selectedPaths && p.selectedPaths.length > 0
                        ? `${p.selectedPaths.length} file(s) selected`
                        : 'Scanning all supported files'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {p.source !== 'upload' && (
                      <button onClick={() => editFiles(p)} style={{
                        background: t.surface, border: `1px solid ${t.border}`, color: t.textSecondary,
                        padding: '6px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer'
                      }}>✏️ Edit files</button>
                    )}
                    <button onClick={() => removeProject(p._id)} style={{
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                      color: '#f87171', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer'
                    }}>Remove</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(CHECK_LABELS).map(([key, label]) => (
                    <button key={key} onClick={() => toggleProjectSetting(p, key)} style={{
                      fontSize: '11px', padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
                      background: p.settings?.[key] ? 'rgba(16,185,129,0.1)' : t.surface,
                      border: `1px solid ${p.settings?.[key] ? 'rgba(16,185,129,0.3)' : t.border}`,
                      color: p.settings?.[key] ? '#10b981' : t.textFaint
                    }}>
                      {p.settings?.[key] ? '✓' : '○'} {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <RepoFileBrowser
        open={!!pickerProject}
        onClose={() => setPickerProject(null)}
        fetchTree={fetchTreeForPicker}
        initialSelected={pickerProject?.selectedPaths || []}
        onConfirm={confirmFileSelection}
        title={pickerProject ? `Edit scanned files — ${pickerProject.repoName}` : ''}
      />
    </Layout>
  );
}
