import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { cardStyle, getTheme, gradient } from '../theme/styles';

/**
 * fetchTree: async () => [{ path, size }]
 * onConfirm: (selectedPaths: string[]) => void   — empty array means "scan everything"
 */
export default function RepoFileBrowser({ open, onClose, fetchTree, initialSelected = [], onConfirm, title }) {
  const { theme } = useTheme();
  const t = getTheme(theme);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tree, setTree] = useState([]);
  const [selected, setSelected] = useState(new Set(initialSelected));
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    fetchTree()
      .then(data => setTree(data))
      .catch(err => setError(err.response?.data?.message || 'Could not load file list'))
      .finally(() => setLoading(false));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setSelected(new Set(initialSelected)), [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const topFolders = useMemo(() => {
    const folders = new Set();
    tree.forEach(f => {
      const parts = f.path.split('/');
      if (parts.length > 1) folders.add(parts[0]);
    });
    return [...folders].sort();
  }, [tree]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return tree;
    const q = filter.toLowerCase();
    return tree.filter(f => f.path.toLowerCase().includes(q));
  }, [tree, filter]);

  if (!open) return null;

  const toggle = path => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const toggleFolder = folder => {
    const inFolder = tree.filter(f => f.path.startsWith(folder + '/')).map(f => f.path);
    const allSelected = inFolder.every(p => selected.has(p));
    setSelected(prev => {
      const next = new Set(prev);
      inFolder.forEach(p => (allSelected ? next.delete(p) : next.add(p)));
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(tree.map(f => f.path)));
  const selectNone = () => setSelected(new Set());

  const confirm = () => {
    // If everything is selected, store as empty array (= "scan everything", stays
    // correct even as the repo grows instead of freezing today's file list).
    const allSelected = tree.length > 0 && tree.every(f => selected.has(f.path));
    onConfirm(allSelected ? [] : [...selected]);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }} onClick={onClose}>
      <div
        style={{ ...cardStyle(theme), width: '100%', maxWidth: '620px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3">
          <h2 style={{ color: t.textPrimary, fontWeight: '600', fontSize: '16px' }}>{title || 'Select files to scan'}</h2>
          <button onClick={onClose} style={{ color: t.textMuted, background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>
        <p style={{ color: t.textMuted, fontSize: '12px', marginBottom: '12px' }}>
          Leave everything selected to scan the whole repo, or narrow it down — only the files
          you pick here will be scanned on every future run, including automatic scans on push.
        </p>

        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter by path…"
          style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: '8px', padding: '8px 12px', color: t.textPrimary, fontSize: '13px', marginBottom: '10px', outline: 'none' }}
        />

        {topFolders.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {topFolders.map(folder => (
              <button key={folder} onClick={() => toggleFolder(folder)} style={{
                fontSize: '11px', padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
                background: t.bg, border: `1px solid ${t.border}`, color: t.textSecondary
              }}>📁 {folder}/</button>
            ))}
          </div>
        )}

        <div className="flex gap-2 mb-3">
          <button onClick={selectAll} style={{ fontSize: '12px', color: '#667eea', background: 'none', border: 'none', cursor: 'pointer' }}>Select all</button>
          <span style={{ color: t.textFaint }}>·</span>
          <button onClick={selectNone} style={{ fontSize: '12px', color: '#667eea', background: 'none', border: 'none', cursor: 'pointer' }}>Select none</button>
          <span style={{ color: t.textFaint, fontSize: '12px', marginLeft: 'auto' }}>{selected.size} / {tree.length} selected</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', border: `1px solid ${t.border}`, borderRadius: '10px' }}>
          {loading ? (
            <p style={{ color: t.textMuted, fontSize: '13px', padding: '20px', textAlign: 'center' }}>Loading file tree…</p>
          ) : error ? (
            <p style={{ color: '#f87171', fontSize: '13px', padding: '20px', textAlign: 'center' }}>{error}</p>
          ) : filtered.length === 0 ? (
            <p style={{ color: t.textFaint, fontSize: '13px', padding: '20px', textAlign: 'center' }}>No matching files</p>
          ) : (
            filtered.map(f => (
              <label key={f.path} style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px',
                borderBottom: `1px solid ${t.border}`, cursor: 'pointer', fontSize: '12px'
              }}>
                <input type="checkbox" checked={selected.has(f.path)} onChange={() => toggle(f.path)} />
                <span style={{ color: t.textPrimary, fontFamily: 'monospace' }}>{f.path}</span>
              </label>
            ))
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} style={{ background: t.bg, color: t.textSecondary, border: `1px solid ${t.border}`, padding: '8px 18px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
          <button onClick={confirm} disabled={loading || !!error} style={{ background: gradient, color: 'white', border: 'none', padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Confirm selection</button>
        </div>
      </div>
    </div>
  );
}
