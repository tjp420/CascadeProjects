import { useState, useEffect, useCallback } from 'react';
import { navigate } from '../router/HashRouter';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isFreeTier, setIsFreeTier] = useState(true);
  const [user, setUser] = useState<{ email?: string; name?: string; role?: string } | null>(null);

  useEffect(() => {
    const checkAuth = () => {
      try {
        const token = localStorage.getItem('sb_token') || localStorage.getItem('auth_token');
        if (token) {
          setIsAuthenticated(true);
          const userData = localStorage.getItem('sb_user');
          if (userData) {
            const parsed = JSON.parse(userData);
            setUser(parsed);
            setIsFreeTier(parsed.plan === 'free' || !parsed.plan);
          }
        } else {
          setIsAuthenticated(false);
          setUser(null);
          setIsFreeTier(true);
        }
      } catch {
        setIsAuthenticated(false);
        setUser(null);
        setIsFreeTier(true);
      }
    };

    checkAuth();
    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem('sb_token');
    localStorage.removeItem('sb_user');
    localStorage.removeItem('auth_token');
    setIsAuthenticated(false);
    setUser(null);
    navigate('signin');
  }, []);

  return { isAuthenticated, isFreeTier, user, signOut };
}
