import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loginUser, registerUser, getMe, refreshAccessToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const saveTokens = (accessToken, refreshToken) => {
    try {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
    } catch {
      // Private browsing or quota exceeded — session will work in-memory
      // but won't persist across page reloads
    }
  };

  const clearTokens = () => {
    try {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } catch {
      // Ignore — clearing a missing item is harmless
    }
  };

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  useEffect(() => {
    let token = null;
    try { token = localStorage.getItem('accessToken'); } catch { /* private browsing */ }
    if (!token) {
      setLoading(false);
      return;
    }
    getMe()
      .then((res) => setUser(res.data))
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [logout]);

  const login = async (email, password) => {
    const res = await loginUser(email, password);
    saveTokens(res.data.accessToken, res.data.refreshToken);
    setUser(res.data.user);
    return res.data;
  };

  const register = async ({ email, password, firstName, lastName }) => {
    const res = await registerUser({ email, password, firstName, lastName });
    saveTokens(res.data.accessToken, res.data.refreshToken);
    setUser(res.data.user);
    return res.data;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export { refreshAccessToken };
