/**
 * AuthContext — Ratings-owned server-backed authentication context
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

export type LoginResult =
    | { status: 'success' }
    | { status: 'error'; error: string; lockedUntil?: string }
    | { status: 'enrol'; challengeToken: string; email: string; displayName: string }
    | { status: 'verify'; challengeToken: string };

interface AuthContextType {
    user: AuthUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<LoginResult>;
    logout: () => Promise<void>;
    refreshSession: () => Promise<void>;
    // MFA handoff: caller passes the challenge token from login() and the
    // freshly-typed code; on success the full session is persisted + user set.
    completeMfaVerify: (challengeToken: string, code: string, isBackupCode?: boolean) =>
        Promise<{ ok: true } | { ok: false; error: string; attemptsRemaining?: number; lockedUntil?: string }>;
    completeMfaEnrolment: (challengeToken: string, code: string) =>
        Promise<{ ok: true; backupCodes: string[] } | { ok: false; error: string }>;
    startMfaEnrolment: (challengeToken: string) =>
        Promise<{ ok: true; challengeToken: string; qrDataUri: string; manualSecret: string; otpauthUri: string; email: string; issuer: string } | { ok: false; error: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const API_BASE = import.meta.env.VITE_API_URL || '';

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

    const login = useCallback(async (username: string, password: string): Promise<LoginResult> => {
        // NOTE: do NOT flip isLoading here. isLoading is reserved for the
        // initial session refresh on app mount. Flipping it during the form
        // submission would unmount LoginPage mid-flight and discard the
        // step state (password → enrol/verify), trapping the user on the
        // password screen even after the server returned an MFA challenge.
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
            if (payload?.step === 'enrol') {
                return { status: 'enrol', challengeToken: payload.challengeToken, email: payload.email, displayName: payload.displayName };
            }
            if (payload?.step === 'verify') {
                return { status: 'verify', challengeToken: payload.challengeToken };
            }
            // Legacy single-step response (shouldn't happen after MFA rollout but fail safe).
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

    const startMfaEnrolment = useCallback(async (challengeToken: string) => {
        try {
            const r = await fetch(`${API_BASE}/api/auth/mfa/enrol/start`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ challengeToken }),
            });
            const payload = await parseJsonSafe(r);
            if (!r.ok) return { ok: false as const, error: payload?.error || 'Failed to start MFA enrolment' };
            return { ok: true as const, ...payload };
        } catch {
            return { ok: false as const, error: 'Network error' };
        }
    }, []);

    const completeMfaEnrolment = useCallback(async (challengeToken: string, code: string) => {
        try {
            const r = await fetch(`${API_BASE}/api/auth/mfa/enrol/confirm`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ challengeToken, code }),
            });
            const payload = await parseJsonSafe(r);
            if (!r.ok) return { ok: false as const, error: payload?.error || 'Could not confirm code' };
            persistAuthSession({ token: payload.token, expiresAt: payload.expiresAt, user: payload.user });
            setUser(payload.user);
            return { ok: true as const, backupCodes: payload.backupCodes || [] };
        } catch {
            return { ok: false as const, error: 'Network error' };
        }
    }, []);

    const completeMfaVerify = useCallback(async (challengeToken: string, code: string, isBackupCode?: boolean) => {
        try {
            const r = await fetch(`${API_BASE}/api/auth/mfa/verify`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ challengeToken, code, isBackupCode: !!isBackupCode }),
            });
            const payload = await parseJsonSafe(r);
            if (!r.ok) {
                return {
                    ok: false as const,
                    error: payload?.error || 'Verification failed',
                    attemptsRemaining: payload?.attemptsRemaining,
                    lockedUntil: payload?.lockedUntil,
                };
            }
            persistAuthSession({ token: payload.token, expiresAt: payload.expiresAt, user: payload.user });
            setUser(payload.user);
            return { ok: true as const };
        } catch {
            return { ok: false as const, error: 'Network error' };
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
        startMfaEnrolment,
        completeMfaEnrolment,
        completeMfaVerify,
    }), [user, isLoading, login, logout, refreshSession, startMfaEnrolment, completeMfaEnrolment, completeMfaVerify]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
