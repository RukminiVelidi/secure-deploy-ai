import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import Layout from '../components/Layout';
import RepoFileBrowser from '../components/RepoFileBrowser';
import { useTheme } from '../context/ThemeContext';
import { cardStyle, getTheme, gradient, RISK_CONFIG } from '../theme/styles';

export default function Home() {
  const { theme } = useTheme();
  const t = getTheme(theme);

  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [latestReports, setLatestReports] = useState({});
  const [scanning, setScanning] = useState({});

  const [connectOpen, setConnectOpen] = useState(false);
  const [connectTab, setConnectTab] = useState('github');
  const [installations, setInstallations] = useState([]);
  const [selectedInstallation, setSelectedInstallation] = useState('');
  const [repos, setRepos] = useState([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [connectingRepo, setConnectingRepo] = useState('');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('');

  const [publicQuery, setPublicQuery] = useState('');
  const [publicMode, setPublicMode] = useState('user');
  const [publicRepos, setPublicRepos] = useState([]);
  const [publicLoading, setPublicLoading] = useState(false);

  const uploadFileRef = useRef(null);
  const [uploadName, setUploadName] = useState('');
  const [uploading, setUploading] = useState(false);

  const [pickerConfig, setPickerConfig] = useState(null);

  const load = () => {
    api.get('/projects').then(r => {
      setProjects(r.data);
      r.data.forEach(p => {
        api.get('/reports/project/' + p._id).then(rr => {
          setLatestReports(prev => ({ ...prev, [p._id]: rr.data[0] }));
        });
      });
    });
    api.get('/reports/stats/overview').then(r => setStats(r.data));
    api.get('/github/installations').then(r => setInstallations(r.data)).catch(() => {});
  };
  useEffect(load, []);

  useEffect(() => {
    if (!selectedInstallation) { setRepos([]); return; }
    setReposLoading(true);
    api.get('/github/repos', { params: { installationId: selectedInstallation } })
      .then(r => setRepos(r.data))
      .catch(() => setRepos([]))
      .finally(() => setReposLoading(false));
  }, [selectedInstallation]);

  const connectedRepoNames = new Set(projects.map(p => p.repoName));

  const triggerScan = async projectId => {
    setScanning(prev => ({ ...prev, [projectId]: true }));
    try {
      const { data } = await api.post('/projects/' + projectId + '/scan');
      setLatestReports(prev => ({ ...prev, [projectId]: data }));
    } catch (e) {
      alert(e.response?.data?.message || 'Scan failed');
    }
    setScanning(prev => ({ ...prev, [projectId]: false }));
  };

  const disconnectProject = async projectId => {
    if (!window.confirm('Disconnect this repository? Its scan history stays saved.')) return;
    await api.delete('/projects/' + projectId);
    setProjects(prev => prev.filter(p => p._id !== projectId));
  };

  const connectApp = async () => {
    const { data } = await api.get('/github/install-url');
    window.location.href = data.url;
  };

  const openPickerThenConnect = repo => {
    setPickerConfig({
      title: 'Select files to scan in ' + repo.repoName,
      fetchTree: () => api.get('/github/repo-tree', {
        params: { installationId: selectedInstallation, repoName: repo.repoName, branch: repo.defaultBranch }
      }).then(r => r.data),
      onConfirm: async paths => {
        setConnectingRepo(repo.repoName);
        try {
          const { data } = await api.post('/projects/connect', {
            repoName: repo.repoName, repoUrl: repo.repoUrl, repoId: repo.repoId,
            installationId: Number(selectedInstallation), defaultBranch: repo.defaultBranch, paths
          });
          setProjects(prev => [...prev, data]);
          setMsg('Connected ' + repo.repoName); setMsgType('success');
        } catch (err) {
          setMsg(err.response?.data?.message || 'Connection failed'); setMsgType('error');
        }
        setConnectingRepo('');
      }
    });
  };

  const openPickerThenConnectPublic = repo => {
    setPickerConfig({
      title: 'Select files to scan in ' + repo.repoName,
      fetchTree: () => api.get('/github/public-repo-tree', {
        params: { repoName: repo.repoName, branch: repo.defaultBranch }
      }).then(r => r.data),
      onConfirm: async paths => {
        setConnectingRepo(repo.repoName);
        try {
          const { data } = await api.post('/projects/connect-public', {
            repoName: repo.repoName, repoUrl: repo.repoUrl, repoId: repo.repoId,
            defaultBranch: repo.defaultBranch, paths
          });
          setProjects(prev => [...prev, data]);
          setMsg('Connected ' + repo.repoName + ' (read-only)'); setMsgType('success');
        } catch (err) {
          setMsg(err.response?.data?.message || 'Connection failed'); setMsgType('error');
        }
        setConnectingRepo('');
      }
    });
  };

  const browsePublicRepos = async () => {
    if (!publicQuery.trim()) return;
    setPublicLoading(true);
    setPublicRepos([]);
    try {
      const params = publicMode === 'user' ? { username: publicQuery.trim() } : { q: publicQuery.trim() };
      const { data } = await api.get('/github/public-repos', { params });
      setPublicRepos(data);
    } catch (err) {
      setMsg(err.response?.data?.message || 'Could not load public repos'); setMsgType('error');
    }
    setPublicLoading(false);
  };

  const uploadAndScan = async () => {
    const file = uploadFileRef.current?.files?.[0];
    if (!file) { setMsg('Choose a .zip file first'); setMsgType('error'); return; }
    setUploading(true);
    setMsg('');
    const formData = new FormData();
    formData.append('archive', file);
    formData.append('projectName', uploadName || file.name.replace(/\.zip$/i, ''));
    try {
      const { data } = await api.post('/projects/upload-scan', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMsg('Scan complete — ' + data.findings.length + ' finding(s), ' + data.riskLevel + ' risk. Opening report…');
      setMsgType('success');
      load();
      setTimeout(() => { window.location.href = '/reports/' + data._id; }, 1200);
    } catch (err) {
      setMsg(err.response?.data?.message || 'Upload/scan failed'); setMsgType('error');
    }
    setUploading(false);
  };

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: t.textPrimary }}>Dashboard</h1>
        <p style={{ color: t.textMuted, marginTop: '4px' }}>Monitor your repositories for security risks</p>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Scans', value: stats.totalScans, icon: '🔍', color: '#667eea' },
            { label: 'Blocked', value: stats.blocked, icon: '🚫', color: '#ef4444' },
            { label: 'Top Issue', value: stats.mostCommonIssue?.replace(/_/g, ' ') || 'None', icon: '⚠️', color: '#f59e0b' }
          ].map(s => (
            <div key={s.label} style={cardStyle(theme)}>
              <div className="flex justify-between items-start">
                <div>
                  <p style={{ color: t.textMuted, fontSize: '13px' }}>{s.label}</p>
                  <p style={{ color: s.color, fontSize: '28px', fontWeight: '700', marginTop: '4px' }}>{s.value}</p>
                </div>
                <span style={{ fontSize: '28px' }}>{s.icon}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ ...cardStyle(theme), marginBottom: '24px' }}>
        <div className="flex justify-between items-center" style={{ cursor: 'pointer' }} onClick={() => setConnectOpen(!connectOpen)}>
          <h2 style={{ color: t.textPrimary, fontWeight: '600', fontSize: '16px' }}>+ Connect a Repository</h2>
          <span style={{ color: t.textMuted }}>{connectOpen ? '▲' : '▼'}</span>
        </div>

        {connectOpen && (
          <div className="mt-4">
            <div className="flex gap-2 mb-4">
              {[
                { key: 'github', label: '🐙 GitHub App' },
                { key: 'public', label: '🌐 Public Repo' },
                { key: 'upload', label: '📤 Upload' }
              ].map(tab => (
                <button key={tab.key} onClick={() => setConnectTab(tab.key)} style={{
                  padding: '8px 16px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer',
                  background: connectTab === tab.key ? gradient : t.bg,
                  color: connectTab === tab.key ? 'white' : t.textMuted,
                  border: '1px solid ' + t.border
                }}>{tab.label}</button>
              ))}
            </div>

            {connectTab === 'github' && (
              <div>
                <button onClick={connectApp} style={{
                  background: '#24292e', color: 'white', padding: '10px 20px', borderRadius: '8px',
                  fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer', marginBottom: '14px'
                }}>{installations.length > 0 ? '+ Install on another account/org' : 'Connect GitHub App'}</button>

                {installations.length > 0 && (
                  <React.Fragment>
                    <select
                      value={selectedInstallation}
                      onChange={e => setSelectedInstallation(e.target.value)}
                      style={{ width: '100%', background: t.bg, border: '1px solid ' + t.border, borderRadius: '10px', padding: '10px 14px', color: t.textPrimary, fontSize: '14px', marginBottom: '12px' }}
                    >
                      <option value="">Select an account/org…</option>
                      {installations.map(i => <option key={i.installationId} value={i.installationId}>{i.accountLogin} ({i.accountType})</option>)}
                    </select>

                    {reposLoading && <p style={{ color: t.textMuted, fontSize: '13px' }}>Loading repositories…</p>}

                    {repos.length > 0 && (
                      <div className="space-y-2" style={{ maxHeight: '260px', overflowY: 'auto' }}>
                        {repos.map(r => (
                          <div key={r.repoId} style={{ background: t.bg, border: '1px solid ' + t.border, borderRadius: '10px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: t.textPrimary, fontSize: '13px' }}>{r.repoName} {r.private && '🔒'}</span>
                            {connectedRepoNames.has(r.repoName) ? (
                              <span style={{ color: '#10b981', fontSize: '12px' }}>✓ Connected</span>
                            ) : (
                              <button onClick={() => openPickerThenConnect(r)} disabled={connectingRepo === r.repoName} style={{ background: gradient, color: 'white', padding: '5px 14px', borderRadius: '7px', fontSize: '12px', border: 'none', cursor: 'pointer' }}>
                                {connectingRepo === r.repoName ? 'Connecting…' : 'Choose files & connect'}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </React.Fragment>
                )}
              </div>
            )}

            {connectTab === 'public' && (
              <div>
                <p style={{ color: t.textMuted, fontSize: '12px', marginBottom: '10px' }}>No install needed — read-only, manual scans only.</p>
                <div className="flex gap-2 mb-3">
                  {['user', 'search'].map(m => (
                    <button key={m} onClick={() => setPublicMode(m)} style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', background: publicMode === m ? gradient : t.bg, color: publicMode === m ? 'white' : t.textMuted, border: '1px solid ' + t.border }}>
                      {m === 'user' ? 'By username' : 'Search all of GitHub'}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mb-3">
                  <input value={publicQuery} onChange={e => setPublicQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && browsePublicRepos()}
                    placeholder={publicMode === 'user' ? 'e.g. torvalds' : 'e.g. react starter template'}
                    style={{ flex: 1, background: t.bg, border: '1px solid ' + t.border, borderRadius: '10px', padding: '10px 14px', color: t.textPrimary, fontSize: '14px', outline: 'none' }} />
                  <button onClick={browsePublicRepos} disabled={publicLoading} style={{ background: gradient, color: 'white', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer' }}>
                    {publicLoading ? 'Loading…' : 'Browse'}
                  </button>
                </div>
                {publicRepos.length > 0 && (
                  <div className="space-y-2" style={{ maxHeight: '260px', overflowY: 'auto' }}>
                    {publicRepos.map(r => (
                      <div key={r.repoId} style={{ background: t.bg, border: '1px solid ' + t.border, borderRadius: '10px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ color: t.textPrimary, fontSize: '13px', fontWeight: '500' }}>{r.repoName} <span style={{ color: t.textFaint, fontWeight: 400 }}>⭐ {r.stars}</span></p>
                          {r.description && <p style={{ color: t.textFaint, fontSize: '11px', marginTop: '2px' }}>{r.description}</p>}
                        </div>
                        {connectedRepoNames.has(r.repoName) ? (
                          <span style={{ color: '#10b981', fontSize: '12px', flexShrink: 0, marginLeft: '10px' }}>✓ Connected</span>
                        ) : (
                          <button onClick={() => openPickerThenConnectPublic(r)} disabled={connectingRepo === r.repoName} style={{ background: t.surface, color: '#667eea', padding: '5px 14px', borderRadius: '7px', fontSize: '12px', border: '1px solid rgba(102,126,234,0.3)', cursor: 'pointer', flexShrink: 0, marginLeft: '10px' }}>
                            {connectingRepo === r.repoName ? 'Connecting…' : 'Choose files & connect'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {connectTab === 'upload' && (
              <div className="space-y-3">
                <p style={{ color: t.textMuted, fontSize: '12px' }}>No GitHub connection at all — zip your project and scan it directly. One-time scan, up to 25MB.</p>
                <input value={uploadName} onChange={e => setUploadName(e.target.value)} placeholder="Project name (optional)"
                  style={{ width: '100%', background: t.bg, border: '1px solid ' + t.border, borderRadius: '10px', padding: '10px 14px', color: t.textPrimary, fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                <input ref={uploadFileRef} type="file" accept=".zip" style={{ width: '100%', background: t.bg, border: '1px dashed ' + t.border, borderRadius: '10px', padding: '10px 14px', color: t.textSecondary, fontSize: '13px' }} />
                <button onClick={uploadAndScan} disabled={uploading} style={{ background: uploading ? t.border : gradient, color: 'white', padding: '10px 24px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', border: 'none', cursor: uploading ? 'not-allowed' : 'pointer' }}>
                  {uploading ? '⏳ Uploading & scanning…' : '📤 Upload & Scan'}
                </button>
              </div>
            )}

            {msg && (
              <div style={{ marginTop: '14px', background: msgType === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: '1px solid ' + (msgType === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'), borderRadius: '10px', padding: '12px' }}>
                <p style={{ color: msgType === 'success' ? '#10b981' : '#f87171', fontSize: '13px' }}>{msg}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <h2 className="text-lg font-semibold mb-4" style={{ color: t.textPrimary }}>Connected Repositories</h2>

      {projects.length === 0 ? (
        <div style={{ ...cardStyle(theme), textAlign: 'center', padding: '60px' }}>
          <span style={{ fontSize: '48px' }}>🔗</span>
          <p style={{ color: t.textMuted, marginTop: '12px' }}>No repos connected yet — use the panel above</p>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map(p => {
            const report = latestReports[p._id];
            const risk = report ? RISK_CONFIG[report.riskLevel] : null;
            return (
              <div key={p._id} style={{ ...cardStyle(theme), display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: risk ? risk.border : t.border }}>
                <div>
                  <div className="flex items-center gap-3">
                    <span style={{ fontSize: '20px' }}>{p.source === 'upload' ? '📤' : p.source === 'public' ? '🌐' : '📦'}</span>
                    <p style={{ color: t.textPrimary, fontWeight: '600' }}>{p.repoName}</p>
                    {p.selectedPaths && p.selectedPaths.length > 0 && (
                      <span style={{ background: t.surface, color: t.textFaint, fontSize: '11px', padding: '2px 8px', borderRadius: '10px' }}>{p.selectedPaths.length} file(s) selected</span>
                    )}
                  </div>
                  <p style={{ color: t.textFaint, fontSize: '12px', marginTop: '4px', marginLeft: '32px' }}>{p.repoUrl || 'Uploaded project'}</p>
                  {report && risk && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: risk.bg, border: '1px solid ' + risk.border, borderRadius: '20px', padding: '4px 12px', marginTop: '10px', marginLeft: '32px' }}>
                      <span style={{ fontSize: '12px' }}>{risk.emoji}</span>
                      <span style={{ color: risk.color, fontSize: '12px', fontWeight: '500' }}>{report.riskLevel} Risk — Score: {report.riskScore}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {p.source !== 'upload' && (
                    <button onClick={() => triggerScan(p._id)} disabled={scanning[p._id]} style={{ background: scanning[p._id] ? t.border : gradient, color: 'white', padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '500', border: 'none', cursor: 'pointer' }}>
                      {scanning[p._id] ? '⏳ Scanning...' : '🔍 Scan Now'}
                    </button>
                  )}
                  <Link to={'/history/' + p._id} style={{ background: t.bg, color: t.textSecondary, padding: '8px 18px', borderRadius: '8px', fontSize: '13px', border: '1px solid ' + t.border }}>History</Link>
                  {report && <Link to={'/reports/' + report._id} style={{ background: t.bg, color: '#667eea', padding: '8px 18px', borderRadius: '8px', fontSize: '13px', border: '1px solid rgba(102,126,234,0.3)' }}>Report</Link>}
                  <button onClick={() => disconnectProject(p._id)} style={{
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171',
                    padding: '8px 18px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer'
                  }}>Disconnect</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RepoFileBrowser
        open={!!pickerConfig}
        onClose={() => setPickerConfig(null)}
        fetchTree={pickerConfig ? pickerConfig.fetchTree : (() => Promise.resolve([]))}
        onConfirm={pickerConfig ? pickerConfig.onConfirm : (() => {})}
        title={pickerConfig ? pickerConfig.title : ''}
      />
    </Layout>
  );
}
