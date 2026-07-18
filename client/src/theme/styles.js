export const THEMES = {
  dark: {
    bg: '#0f0f1a',
    surface: '#1a1a2e',
    border: '#2d2d44',
    textPrimary: '#e2e8f0',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    textFaint: '#475569',
    accentFrom: '#667eea',
    accentTo: '#764ba2'
  },
  light: {
    bg: '#f4f5fb',
    surface: '#ffffff',
    border: '#e2e4f0',
    textPrimary: '#1e1e2e',
    textSecondary: '#4b5065',
    textMuted: '#6b7280',
    textFaint: '#9aa0b4',
    accentFrom: '#667eea',
    accentTo: '#764ba2'
  }
};

export function getTheme(theme) {
  return THEMES[theme] || THEMES.dark;
}

export function cardStyle(theme) {
  const t = getTheme(theme);
  return {
    background: t.surface,
    border: `1px solid ${t.border}`,
    borderRadius: '16px',
    padding: '24px'
  };
}

export function pageStyle(theme) {
  const t = getTheme(theme);
  return { minHeight: '100vh', background: t.bg, color: t.textPrimary };
}

export const gradient = 'linear-gradient(135deg, #667eea, #764ba2)';

// Shared risk/severity config — previously duplicated verbatim across
// Home/History/ReportPage. Now defined once.
export const RISK_CONFIG = {
  Low: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', emoji: '✅' },
  Medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', emoji: '⚠️' },
  High: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', emoji: '❌' }
};

export const SEVERITY_CONFIG = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', label: '🔴 Critical' },
  high: { color: '#f97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)', label: '🟠 High' },
  medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', label: '🟡 Medium' },
  low: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', label: '🔵 Low' }
};
