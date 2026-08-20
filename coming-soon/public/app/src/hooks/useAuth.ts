import { useState, useEffect, useCallback } from 'react';
import { navigate } from '../router/HashRouter';
import { isTokenExpired } from '../config';

export function useAuth() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isFreeTier, setIsFreeTier] = useState(true);
    const [user, setUser] = useState<{ email?: string; name?: string; role?: string } | null>(null);

    // simplebeacon-ignore: framework-practices — standard React useEffect hook
    useEffect(() => {
        const checkAuth = () => {
            try {
                const token =
                    localStorage.getItem('sb_token') ||
                    localStorage.getItem('sb-token') ||
                    localStorage.getItem('auth_token');
                if (token && !isTokenExpired()) {
                    setIsAuthenticated(true);
                    const userData = localStorage.getItem('sb_user');
                    if (userData) {
                        const parsed = JSON.parse(userData);
                        setUser(parsed);
                        const tier = parsed.plan || parsed.tier || '';
                        const isAdmin = parsed.role === 'admin' || parsed.role === 'superuser';
                        setIsFreeTier(!isAdmin && (tier === 'free' || !tier));
                    }
                } else {
                    // Token missing or expired — clear all auth state
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
        localStorage.removeItem('sb-token');
        localStorage.removeItem('sb_user');
        localStorage.removeItem('auth_token');
        setIsAuthenticated(false);
        setUser(null);
        navigate('signin');
    }, []);

    return { isAuthenticated, isFreeTier, user, signOut };
}
