import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios';

const ThemeContext = createContext({ theme: 'dark', setTheme: () => {}, loading: true });

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('dark');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    api.get('/user/me')
      .then(r => setThemeState(r.data.theme || 'dark'))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const setTheme = async next => {
    setThemeState(next); // optimistic — feels instant
    try {
      await api.patch('/user/theme', { theme: next });
    } catch {
      // if it fails to persist, the next fetch will just resync — not worth a rollback dance
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, loading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
