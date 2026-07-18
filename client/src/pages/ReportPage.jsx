import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import Layout from '../components/Layout';
import { useTheme } from '../context/ThemeContext';
import { cardStyle, getTheme, gradient, RISK_CONFIG, SEVERITY_CONFIG } from '../theme/styles';

export default function ReportPage() {
  const { id } = useParams();
  const { theme } = useTheme();
  const t = getTheme(theme);
  const [report, setReport] = useState(null);
  const [filter, setFilter] = useState('all');
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');

  useEffect(() => {
    api.get(`/reports/${id}`).then(r => setReport(r.data));
  }, [id]);

  if (!report) return (
    <Layout><div style={{ textAlign: 'center', padding: '80px', color: t.textFaint }}><span style={{ fontSize: '48px' }}>⏳</span><p style={{ marginTop: '12px' }}>Loading report...</p></div></Layout>
  );

  const risk = RISK_CONFIG[report.riskLevel] || RISK_CONFIG.Low;
  const badge = `[![SecureDeploy AI](https://img.shields.io/badge/SecureDeploy AI-${report.riskLevel}%20Risk-${report.riskLevel === 'Low' ? 'green' : report.riskLevel === 'Medium' ? 'yellow' : 'red'})](${window.location.href})`;

  const severities = ['all', 'critical', 'high', 'medium', 'low'];
  const filtered = filter === 'all' ? report.findings : report.findings.filter(f => f.severity === filter);
  const counts = {
    critical: report.findings.filter(f => f.severity === 'critical').length,
    high: report.findings.filter(f => f.severity === 'high').length,
    medium: report.findings.filter(f => f.severity === 'medium').length,
    low: report.findings.filter(f => f.severity === 'low').length
  };

  const copyBadge = () => {
    navigator.clipboard.writeText(badge);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadReport = async () => {
    setDownloading(true);
    try {
      const response = await api.get(`/reports/${id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `securedeployai-report-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Download failed — check the backend logs');
    }
    setDownloading(false);
  };

  const emailReport = async () => {
    setEmailing(true);
    setEmailMsg('');
    try {
      const { data } = await api.post(`/reports/${id}/email`);
      setEmailMsg(data.message);
    } catch (err) {
      setEmailMsg(err.response?.data?.message || 'Could not send email');
    }
    setEmailing(false);
    setTimeout(() => setEmailMsg(''), 4000);
  };

  const deleteReport = async () => {
    if (!window.confirm('Delete this scan report? This cannot be undone.')) return;
    await api.delete(`/reports/${id}`);
    window.location.href = '/history';
  };

  return (
    <Layout>
      <div className="flex items-center gap-4 mb-8" style={{ flexWrap: 'wrap' }}>
        <Link to="/" style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.textSecondary, padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}>← Back</Link>
        <div style={{ flex: 1 }}>
          <h1 className="text-3xl font-bold" style={{ color: t.textPrimary }}>Scan Report</h1>
          <p style={{ color: t.textMuted, marginTop: '4px' }}>{new Date(report.createdAt).toLocaleString()}</p>
        </div>
        <div className="flex gap-2" style={{ alignItems: 'center' }}>
          {emailMsg && <span style={{ color: t.textMuted, fontSize: '12px' }}>{emailMsg}</span>}
          <button onClick={emailReport} disabled={emailing} style={{
            background: t.surface, border: `1px solid ${t.border}`, color: t.textSecondary,
            padding: '8px 16px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer'
          }}>{emailing ? 'Sending…' : '📧 Email Report'}</button>
          <button onClick={downloadReport} disabled={downloading} style={{
            background: gradient, border: 'none', color: 'white',
            padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer'
          }}>{downloading ? 'Preparing…' : '⬇️ Download PDF'}</button>
          <button onClick={deleteReport} style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171',
            padding: '8px 16px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer'
          }}>🗑️ Delete</button>
        </div>
      </div>

      <div style={{ ...cardStyle(theme), background: `linear-gradient(135deg, ${t.surface}, ${risk.bg})`, border: `1px solid ${risk.border}`, marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div className="flex items-center gap-3 mb-4">
              <span style={{ fontSize: '36px' }}>{risk.emoji}</span>
              <div>
                <p style={{ color: risk.color, fontSize: '28px', fontWeight: '800' }}>{report.riskLevel} Risk</p>
                <p style={{ color: t.textMuted, fontSize: '13px' }}>Score: <span style={{ color: risk.color, fontWeight: '700' }}>{report.riskScore} pts</span></p>
              </div>
              <span style={{
                background: report.status === 'blocked' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
                border: `1px solid ${report.status === 'blocked' ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)'}`,
                color: report.status === 'blocked' ? '#ef4444' : '#10b981',
                padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', marginLeft: '8px'
              }}>{report.status === 'blocked' ? '❌ BLOCKED' : '✅ ALLOWED'}</span>
            </div>

            <div style={{ display: 'flex', gap: '24px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {[
                { label: 'Branch', value: report.branch, icon: '🌿' },
                { label: 'Commit', value: report.commitSha?.slice(0, 8), icon: '📌' },
                { label: 'Files Scanned', value: report.filesScanned, icon: '📁' },
                { label: 'Total Findings', value: report.findings.length, icon: '🔍' }
              ].map(m => (
                <div key={m.label}>
                  <p style={{ color: t.textFaint, fontSize: '11px' }}>{m.icon} {m.label}</p>
                  <p style={{ color: t.textPrimary, fontWeight: '600', fontSize: '14px' }}>{m.value}</p>
                </div>
              ))}
            </div>

            {report.gptSummary && (
              <div style={{ background: 'rgba(102,126,234,0.08)', border: '1px solid rgba(102,126,234,0.2)', borderRadius: '10px', padding: '14px' }}>
                <p style={{ color: t.textMuted, fontSize: '12px', marginBottom: '4px' }}>🤖 AI Summary</p>
                <p style={{ color: t.textPrimary, fontSize: '14px', lineHeight: '1.6' }}>{report.gptSummary}</p>
              </div>
            )}
          </div>

          <div style={{
            width: '100px', height: '100px', borderRadius: '50%', background: risk.bg, border: `3px solid ${risk.color}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginLeft: '24px', flexShrink: 0
          }}>
            <p style={{ color: risk.color, fontSize: '28px', fontWeight: '800' }}>{report.riskScore}</p>
            <p style={{ color: t.textMuted, fontSize: '10px' }}>SCORE</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {Object.entries(counts).map(([sev, count]) => {
          const cfg = SEVERITY_CONFIG[sev];
          return (
            <div key={sev} style={{
              ...cardStyle(theme), padding: '16px', cursor: 'pointer',
              border: filter === sev ? `1px solid ${cfg.color}` : `1px solid ${t.border}`, opacity: count === 0 ? 0.4 : 1
            }} onClick={() => setFilter(filter === sev ? 'all' : sev)}>
              <p style={{ color: cfg.color, fontSize: '22px', fontWeight: '700' }}>{count}</p>
              <p style={{ color: t.textMuted, fontSize: '12px', textTransform: 'capitalize' }}>{sev}</p>
            </div>
          );
        })}
      </div>

      <div style={{ ...cardStyle(theme), marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ color: t.textPrimary, fontWeight: '600' }}>Findings ({filtered.length}{filter !== 'all' ? ` ${filter}` : ''})</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            {severities.map(s => (
              <button key={s} onClick={() => setFilter(s)} style={{
                background: filter === s ? gradient : t.bg, color: filter === s ? 'white' : t.textMuted,
                border: `1px solid ${t.border}`, padding: '4px 12px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', textTransform: 'capitalize'
              }}>{s}</button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', border: `1px dashed ${t.border}`, borderRadius: '12px' }}>
            <span style={{ fontSize: '36px' }}>✅</span>
            <p style={{ color: t.textFaint, marginTop: '8px' }}>{filter === 'all' ? 'No issues found — clean deployment!' : `No ${filter} severity issues`}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((f, i) => {
              const sev = SEVERITY_CONFIG[f.severity] || SEVERITY_CONFIG.low;
              return (
                <div key={i} style={{ background: t.bg, border: `1px solid ${sev.border}`, borderRadius: '12px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ background: sev.bg, border: `1px solid ${sev.border}`, color: sev.color, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{sev.label}</span>
                      <span style={{ background: t.surface, color: t.textSecondary, padding: '3px 10px', borderRadius: '20px', fontSize: '11px' }}>{f.type?.replace(/_/g, ' ')}</span>
                      {f.detectionMethod && (
                        <span style={{ background: t.surface, color: t.textFaint, padding: '3px 10px', borderRadius: '20px', fontSize: '10px' }}>via {f.detectionMethod}</span>
                      )}
                    </div>
                    <code style={{ background: t.surface, color: '#667eea', padding: '3px 10px', borderRadius: '6px', fontSize: '12px' }}>{f.file}{f.line ? `:${f.line}` : ''}</code>
                  </div>

                  {f.confidence && (
                    <p style={{ color: t.textFaint, fontSize: '10px', marginBottom: '8px' }}>
                      Match confidence: <span style={{ textTransform: 'capitalize' }}>{f.confidence}</span> — informational only, doesn't affect the risk score
                    </p>
                  )}

                  <p style={{ color: t.textPrimary, fontSize: '14px', fontWeight: '500', marginBottom: '10px' }}>{f.message}</p>

                  {f.gptExplanation && (
                    <div style={{ background: 'rgba(102,126,234,0.06)', border: '1px solid rgba(102,126,234,0.15)', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
                      <p style={{ color: '#667eea', fontSize: '11px', fontWeight: '600', marginBottom: '4px' }}>🤖 AI Explanation</p>
                      <p style={{ color: t.textSecondary, fontSize: '13px', lineHeight: '1.5' }}>{f.gptExplanation}</p>
                    </div>
                  )}

                  {f.gptFix && (
                    <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '8px', padding: '12px', marginBottom: f.prUrl ? '8px' : 0 }}>
                      <p style={{ color: '#10b981', fontSize: '11px', fontWeight: '600', marginBottom: '4px' }}>💡 Suggested Fix</p>
                      <p style={{ color: t.textSecondary, fontSize: '13px', lineHeight: '1.5' }}>{f.gptFix}</p>
                    </div>
                  )}

                  {f.prUrl && (
                    <a href={f.prUrl} target="_blank" rel="noreferrer" style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(102,126,234,0.1)',
                      border: '1px solid rgba(102,126,234,0.3)', color: '#667eea', padding: '6px 12px',
                      borderRadius: '8px', fontSize: '12px', fontWeight: '600'
                    }}>🔧 View fix PR on GitHub →</a>
                  )}
                  {!f.prUrl && f.fixable && f.prStatus === 'failed' && (
                    <p style={{ color: '#f87171', fontSize: '11px' }}>⚠️ Fix PR failed to open — check backend logs</p>
                  )}
                  {!f.prUrl && f.fixable && f.prStatus !== 'failed' && (
                    <p style={{ color: t.textFaint, fontSize: '11px' }}>Fix PR pending…</p>
                  )}
                  {!f.prUrl && !f.fixable && (
                    <p style={{ color: t.textFaint, fontSize: '11px' }}>Not auto-fixable — requires manual remediation (see explanation above)</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={cardStyle(theme)}>
        <h3 style={{ color: t.textPrimary, fontWeight: '600', marginBottom: '12px' }}>🏷️ README Badge</h3>
        <div style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: '10px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <code style={{ color: '#667eea', fontSize: '12px', wordBreak: 'break-all', flex: 1 }}>{badge}</code>
          <button onClick={copyBadge} style={{
            background: copied ? 'rgba(16,185,129,0.2)' : gradient, color: copied ? '#10b981' : 'white',
            border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', flexShrink: 0, fontWeight: '500'
          }}>{copied ? '✅ Copied!' : '📋 Copy'}</button>
        </div>
      </div>
    </Layout>
  );
}
