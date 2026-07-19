/**
 * AuthContext — Ratings-owned server-backed authentication context (Auth Bypassed)
 */

import React, { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { type AuthUser, persistAuthSession } from '../utils/auth';

// Real company ID — sourced from CLICKHOUSE_DB=prestige tenant in the ratings backend .env
const HARDCODED_COMPANY_ID = '297e37ea-a5ac-47df-bebd-ac44e52b7979';
const HARDCODED_COMPANY_NAME = 'prestige';

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
    ssoLogin: (ssoToken: string) => Promise<{ ok: true } | { ok: false; error: string }>;
    logout: () => Promise<void>;
    refreshSession: () => Promise<void>;
    completeMfaVerify: (challengeToken: string, code: string, isBackupCode?: boolean) =>
        Promise<{ ok: true } | { ok: false; error: string; attemptsRemaining?: number; lockedUntil?: string }>;
    completeMfaEnrolment: (challengeToken: string, code: string) =>
        Promise<{ ok: true; backupCodes: string[] } | { ok: false; error: string }>;
    startMfaEnrolment: (challengeToken: string) =>
        Promise<{ ok: true; challengeToken: string; qrDataUri: string; manualSecret: string; otpauthUri: string; email: string; issuer: string } | { ok: false; error: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
    children: ReactNode;
    companyId?: string;
    companyName?: string;
}

function getSessionUser(): AuthUser | null {
    if (typeof window === 'undefined') return null;
    try {
        const stored = window.sessionStorage.getItem('user');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.dbId && parsed.dbName) {
                return {
                    id: parsed.userId || '1',
                    username: parsed.name || 'User',
                    email: parsed.email || '',
                    displayName: parsed.name || 'User',
                    role: parsed.role || 'user',
                    companyId: parsed.dbId,
                    companyName: parsed.dbName,
                    allowedPlatformUuids: [],
                    platformScope: 'all'
                };
            }
        }
    } catch (e) {
        console.error("Error reading parent session user:", e);
    }
    return null;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, companyId, companyName }) => {
    const dummyUser = useMemo<AuthUser>(() => {
        const parentUser = getSessionUser();
        const finalId = companyId || parentUser?.companyId || HARDCODED_COMPANY_ID;
        const finalName = companyName || parentUser?.companyName || HARDCODED_COMPANY_NAME;

        return {
            id: parentUser?.id || '1',
            username: parentUser?.username || 'admin',
            email: parentUser?.email || 'admin@trailytics.com',
            displayName: parentUser?.displayName || 'Admin User',
            role: parentUser?.role || 'admin',
            companyId: finalId,
            companyName: finalName,
            allowedPlatformUuids: [],
            platformScope: 'all'
        };
    }, [companyId, companyName]);

    // Persist the session to localStorage so resolveAuthCompanyId() / tenant.ts
    // can find the companyId without requiring a real login flow.
    useEffect(() => {
        persistAuthSession({
            token: 'bypass-token',
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            user: dummyUser,
        });
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('companyName', dummyUser.companyName);
        }
    }, [dummyUser]);

    const value = useMemo<AuthContextType>(() => ({
        user: dummyUser,
        isAuthenticated: true,
        isLoading: false,
        login: async () => ({ status: 'success' }),
        ssoLogin: async () => ({ ok: true }),
        logout: async () => { },
        refreshSession: async () => { },
        startMfaEnrolment: async () => ({ ok: false, error: 'Disabled' }),
        completeMfaEnrolment: async () => ({ ok: false, error: 'Disabled' }),
        completeMfaVerify: async () => ({ ok: true }),
    }), [dummyUser]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
