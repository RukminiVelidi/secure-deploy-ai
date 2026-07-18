import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../api/axios';
import Layout from '../components/Layout';
import { useTheme } from '../context/ThemeContext';
import { cardStyle, getTheme, gradient, RISK_CONFIG } from '../theme/styles';

function CustomTooltip({ active, payload, label, t }) {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '10px', padding: '12px' }}>
        <p style={{ color: t.textMuted, fontSize: '12px' }}>{label}</p>
        <p style={{ color: '#667eea', fontWeight: '600' }}>Score: {payload[0].value}</p>
      </div>
    );
  }
  return null;
}

export default function History() {
  const { projectId } = useParams();
  const { theme } = useTheme();
  const t = getTheme(theme);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/reports/project/${projectId}`).then(r => { setReports(r.data); setLoading(false); });
  }, [projectId]);

  const deleteReport = async (e, reportId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Delete this scan report? This cannot be undone.')) return;
    await api.delete(`/reports/${reportId}`);
    setReports(prev => prev.filter(r => r._id !== reportId));
  };

  const chartData = [...reports].reverse().map(r => ({
    date: new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: r.riskScore
  }));

  const blocked = reports.filter(r => r.status === 'blocked').length;
  const avgScore = reports.length
    ? Math.round(reports.reduce((a, r) => a + r.riskScore, 0) / reports.length)
    : 0;

  return (
    <Layout>
      <div className="flex items-center gap-4 mb-8">
        <Link to="/" style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.textSecondary, padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}>← Back</Link>
        <div>
          <h1 className="text-3xl font-bold" style={{ color: t.textPrimary }}>Scan History</h1>
          <p style={{ color: t.textMuted, marginTop: '4px' }}>{reports.length} scans recorded</p>
        </div>
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

      {chartData.length > 1 && (
        <div style={{ ...cardStyle(theme), marginBottom: '24px' }}>
          <h2 style={{ color: t.textPrimary, fontWeight: '600', marginBottom: '20px' }}>📈 Risk Score Over Time</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
              <XAxis dataKey="date" tick={{ fill: t.textMuted, fontSize: 11 }} axisLine={false} />
              <YAxis tick={{ fill: t.textMuted, fontSize: 11 }} axisLine={false} />
              <Tooltip content={<CustomTooltip t={t} />} />
              <Line type="monotone" dataKey="score" stroke="#667eea" strokeWidth={2.5} dot={{ fill: '#667eea', r: 4 }} activeDot={{ r: 6, fill: '#764ba2' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: t.textFaint }}>⏳ Loading history...</div>
      ) : reports.length === 0 ? (
        <div style={{ ...cardStyle(theme), textAlign: 'center', padding: '60px' }}>
          <span style={{ fontSize: '48px' }}>📭</span>
          <p style={{ color: t.textFaint, marginTop: '12px' }}>No scans yet for this repository</p>
        </div>
      ) : (
        <div style={cardStyle(theme)}>
          <h2 style={{ color: t.textPrimary, fontWeight: '600', marginBottom: '16px' }}>All Scans</h2>
          <div className="space-y-3">
            {reports.map(r => {
              const risk = RISK_CONFIG[r.riskLevel] || RISK_CONFIG.Low;
              return (
                <div key={r._id} style={{
                  background: t.bg, border: `1px solid ${risk.border}`, borderRadius: '12px',
                  padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div className="flex items-center gap-4">
                    <div style={{ background: risk.bg, border: `1px solid ${risk.border}`, borderRadius: '10px', padding: '10px', fontSize: '20px' }}>{risk.emoji}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p style={{ color: t.textPrimary, fontWeight: '500', fontSize: '14px' }}>{r.branch}</p>
                        <code style={{ background: t.surface, color: '#667eea', padding: '2px 8px', borderRadius: '6px', fontSize: '12px' }}>{r.commitSha?.slice(0, 8)}</code>
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
