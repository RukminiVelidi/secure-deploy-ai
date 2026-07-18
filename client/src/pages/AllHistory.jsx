import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import Layout from '../components/Layout';
import { useTheme } from '../context/ThemeContext';
import { cardStyle, getTheme, gradient, RISK_CONFIG } from '../theme/styles';

export default function AllHistory() {
  const { theme } = useTheme();
  const t = getTheme(theme);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterRepo, setFilterRepo] = useState('all');

  useEffect(() => {
    api.get('/reports').then(r => { setReports(r.data); setLoading(false); });
  }, []);

  const deleteReport = async (e, reportId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Delete this scan report? This cannot be undone.')) return;
    await api.delete(`/reports/${reportId}`);
    setReports(prev => prev.filter(r => r._id !== reportId));
  };

  const repoNames = useMemo(() => [...new Set(reports.map(r => r.repoName))].sort(), [reports]);
  const filtered = filterRepo === 'all' ? reports : reports.filter(r => r.repoName === filterRepo);

  const blocked = reports.filter(r => r.status === 'blocked').length;
  const avgScore = reports.length ? Math.round(reports.reduce((a, r) => a + r.riskScore, 0) / reports.length) : 0;

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: t.textPrimary }}>Scan History</h1>
        <p style={{ color: t.textMuted, marginTop: '4px' }}>Every scan across all connected repositories</p>
      </div>

      {reports.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Scans', value: reports.length, icon: '🔍', color: '#667eea' },
            { label: 'Blocked', value: blocked, icon: '🚫', color: '#ef4444' },
            { label: 'Avg Score', value: avgScore, icon: '📊', color: '#f59e0b' }
          ].map(s => (
            <div key={s.label} style={cardStyle(theme)}>
              <div className="flex justify-between items-center">
                <div>
                  <p style={{ color: t.textMuted, fontSize: '13px' }}>{s.label}</p>
                  <p style={{ color: s.color, fontSize: '26px', fontWeight: '700' }}>{s.value}</p>
                </div>
                <span style={{ fontSize: '26px' }}>{s.icon}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {repoNames.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button onClick={() => setFilterRepo('all')} style={{
            padding: '6px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer',
            background: filterRepo === 'all' ? gradient : t.surface,
            color: filterRepo === 'all' ? 'white' : t.textMuted, border: `1px solid ${t.border}`
          }}>All repos</button>
          {repoNames.map(name => (
            <button key={name} onClick={() => setFilterRepo(name)} style={{
              padding: '6px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer',
              background: filterRepo === name ? gradient : t.surface,
              color: filterRepo === name ? 'white' : t.textMuted, border: `1px solid ${t.border}`
            }}>{name}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: t.textFaint }}>⏳ Loading history...</div>
      ) : filtered.length === 0 ? (
        <div style={{ ...cardStyle(theme), textAlign: 'center', padding: '60px' }}>
          <span style={{ fontSize: '48px' }}>📭</span>
          <p style={{ color: t.textFaint, marginTop: '12px' }}>No scans yet</p>
        </div>
      ) : (
        <div style={cardStyle(theme)}>
          <div className="space-y-3">
            {filtered.map(r => {
              const risk = RISK_CONFIG[r.riskLevel] || RISK_CONFIG.Low;
              return (
                <div key={r._id} style={{
                  background: t.bg, border: `1px solid ${risk.border}`, borderRadius: '12px',
                  padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'
                }}>
                  <div className="flex items-center gap-4">
                    <div style={{ background: risk.bg, border: `1px solid ${risk.border}`, borderRadius: '10px', padding: '10px', fontSize: '20px' }}>{risk.emoji}</div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p style={{ color: t.textPrimary, fontWeight: '600', fontSize: '14px' }}>{r.repoName}</p>
                        <span style={{ color: t.textFaint, fontSize: '12px' }}>· {r.branch}</span>
                        <span style={{
                          background: r.status === 'blocked' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                          color: r.status === 'blocked' ? '#ef4444' : '#10b981',
                          border: `1px solid ${r.status === 'blocked' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                          padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500'
                        }}>{r.status === 'blocked' ? '❌ BLOCKED' : '✅ ALLOWED'}</span>
                      </div>
                      <p style={{ color: t.textFaint, fontSize: '12px', marginTop: '4px' }}>
                        {new Date(r.createdAt).toLocaleString()} · {r.findings.length} findings · {r.filesScanned} files
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ color: risk.color, fontSize: '22px', fontWeight: '700' }}>{r.riskScore}</p>
                      <p style={{ color: t.textFaint, fontSize: '11px' }}>{r.riskLevel} Risk</p>
                    </div>
                    <Link to={`/reports/${r._id}`} style={{ background: gradient, color: 'white', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '500' }}>View →</Link>
                    <button onClick={e => deleteReport(e, r._id)} style={{
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171',
                      padding: '8px 12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer'
                    }}>🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Layout>
  );
}
