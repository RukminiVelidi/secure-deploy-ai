import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/Login';
import Register from './pages/Register';
import GithubCallback from './pages/GithubCallback';
import Home from './pages/Home';
import ReportPage from './pages/ReportPage';
import AllHistory from './pages/AllHistory';
import History from './pages/History';
import Settings from './pages/Settings';
import Profile from './pages/Profile';

function PrivateRoute({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/github/callback" element={<GithubCallback />} />
          <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
          <Route path="/reports/:id" element={<PrivateRoute><ReportPage /></PrivateRoute>} />
          <Route path="/history" element={<PrivateRoute><AllHistory /></PrivateRoute>} />
          <Route path="/history/:projectId" element={<PrivateRoute><History /></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
