/**
 * AuthContext — Ratings-owned server-backed authentication context
 *
 * MFA has been removed from the login flow (backend no longer requires it).
 * A new `ssoLogin` method allows Digital Shelf to pass a short-lived SSO
 * token that the ratings backend exchanges for a full session — enabling
 * seamless single-sign-on when the ratings Dashboard is embedded in DS.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
    authenticatedFetch,
    clearStoredAuthSession,
    getStoredAuthSession,
    persistAuthSession,
    type AuthSession,
    type AuthUser,
} from '../utils/auth';
import { clearAllCache } from '../utils/apiCache';
import { RATINGS_API_BASE } from '../config/apiBase';

export type LoginResult =
    | { status: 'success' }
    | { status: 'error'; error: string; lockedUntil?: string };

interface AuthContextType {
    user: AuthUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<LoginResult>;
    logout: () => Promise<void>;
    refreshSession: () => Promise<void>;
    /** Exchange a short-lived DS-issued SSO token for a full ratings session. */
    ssoLogin: (ssoToken: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const API_BASE = RATINGS_API_BASE;

async function parseJsonSafe(res: Response) {
    try {
        return await res.json();
    } catch {
        return null;
    }
}

async function fetchCurrentSession(session?: AuthSession | null): Promise<AuthSession | null> {
    const activeSession = session || getStoredAuthSession();
    if (!activeSession?.token) return null;

    const response = await authenticatedFetch(`${API_BASE}/api/auth/me`, {
        method: 'GET',
    }, activeSession.user.companyId);

    if (!response.ok) {
        throw new Error('Session is invalid');
    }

    const payload = await parseJsonSafe(response);
    if (!payload?.user || !payload?.token || !payload?.expiresAt) {
        throw new Error('Malformed auth session response');
    }

    return {
        token: payload.token,
        expiresAt: payload.expiresAt,
        user: payload.user,
    };
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const refreshSession = useCallback(async () => {
        setIsLoading(true);
        try {
            const refreshed = await fetchCurrentSession();
            if (!refreshed) {
                clearStoredAuthSession();
                setUser(null);
                return;
            }
            persistAuthSession(refreshed);
            setUser(refreshed.user);
        } catch {
            clearStoredAuthSession();
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshSession();
    }, [refreshSession]);

    /**
     * Standard username + password login.
     * Backend now returns { token, expiresAt, user } directly (no MFA step).
     */
    const login = useCallback(async (username: string, password: string): Promise<LoginResult> => {
        try {
            const response = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const payload = await parseJsonSafe(response);
            if (!response.ok) {
                return {
                    status: 'error',
                    error: payload?.error || 'Invalid username or password',
                    lockedUntil: payload?.lockedUntil,
                };
            }
            if (payload?.token && payload?.user) {
                persistAuthSession({ token: payload.token, expiresAt: payload.expiresAt, user: payload.user });
                setUser(payload.user);
                return { status: 'success' };
            }
            return { status: 'error', error: 'Unexpected response from authentication service.' };
        } catch {
            return { status: 'error', error: 'Unable to reach the authentication service.' };
        }
    }, []);

    /**
     * SSO login — called by ReviewRatingPage in Digital Shelf.
     * Exchanges a short-lived HMAC token (issued by the DS backend) for
     * a full ratings session without requiring a separate login form.
     */
    const ssoLogin = useCallback(async (ssoToken: string): Promise<{ ok: true } | { ok: false; error: string }> => {
        try {
            const response = await fetch(`${API_BASE}/api/auth/sso`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ssoToken }),
            });
            const payload = await parseJsonSafe(response);
            if (!response.ok) {
                return { ok: false, error: payload?.error || 'SSO authentication failed' };
            }
            if (payload?.token && payload?.user) {
                persistAuthSession({ token: payload.token, expiresAt: payload.expiresAt, user: payload.user });
                setUser(payload.user);
                return { ok: true };
            }
            return { ok: false, error: 'Unexpected SSO response from server.' };
        } catch {
            return { ok: false, error: 'Unable to reach the ratings authentication service.' };
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            const session = getStoredAuthSession();
            if (session?.token) {
                await authenticatedFetch(`${API_BASE}/api/auth/logout`, {
                    method: 'POST',
                }, session.user.companyId);
            }
        } catch {
            // Always clear local session, even if the server is unreachable.
        } finally {
            clearAllCache();              // Purge all API caches on sign-out
            clearStoredAuthSession();
            setUser(null);
        }
    }, []);

    const value = useMemo<AuthContextType>(() => ({
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshSession,
        ssoLogin,
    }), [user, isLoading, login, logout, refreshSession, ssoLogin]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
