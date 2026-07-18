import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function GithubCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      localStorage.setItem('token', token);
      // Replace the URL so the token doesn't linger in browser history/bookmarks.
      window.history.replaceState({}, '', '/github/callback');
      navigate('/', { replace: true });
    } else {
      navigate('/login?error=github_auth_failed', { replace: true });
    }
  }, [params, navigate]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f1a', color: '#94a3b8' }}>
      <p>Finishing GitHub sign-in…</p>
    </div>
  );
}
