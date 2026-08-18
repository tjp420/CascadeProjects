import { useState, useEffect, useCallback } from 'react';
import { navigate } from '../router/HashRouter';
import { isTokenExpired } from '../config';
import {
  readStoredUser,
  resolveIsFreeTier,
  type SessionUser,
} from '../lib/session-tier';

function readAuthToken(): string | null {
  return localStorage.getItem('sb_token')
    || localStorage.getItem('sb-token')
    || localStorage.getItem('auth_token');
}

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isFreeTier, setIsFreeTier] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);

  const refreshAuth = useCallback(() => {
    try {
      const token = readAuthToken();
      if (token && !isTokenExpired()) {
        const storedUser = readStoredUser();
        setIsAuthenticated(true);
        setUser(storedUser);
        setIsFreeTier(resolveIsFreeTier(storedUser, token));
        return;
      }
      setIsAuthenticated(false);
      setUser(null);
      setIsFreeTier(true);
    } catch {
      setIsAuthenticated(false);
      setUser(null);
      setIsFreeTier(true);
    }
  }, []);

  // simplebeacon-ignore: framework-practices — standard React useEffect hook
  useEffect(() => {
    refreshAuth();
    window.addEventListener('storage', refreshAuth);
    window.addEventListener('sb:login', refreshAuth);
    return () => {
      window.removeEventListener('storage', refreshAuth);
      window.removeEventListener('sb:login', refreshAuth);
    };
  }, [refreshAuth]);

  const signOut = useCallback(() => {
    localStorage.removeItem('sb_token');
    localStorage.removeItem('sb-token');
    localStorage.removeItem('sb_user');
    localStorage.removeItem('sb-user');
    localStorage.removeItem('auth_token');
    setIsAuthenticated(false);
    setUser(null);
    setIsFreeTier(true);
    navigate('signin');
  }, []);

  return { isAuthenticated, isFreeTier, user, signOut };
}
