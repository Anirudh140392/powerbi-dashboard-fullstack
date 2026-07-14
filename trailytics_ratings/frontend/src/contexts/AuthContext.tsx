/**
 * AuthContext — Ratings-owned server-backed authentication context (Auth Bypassed)
 */

import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { type AuthUser } from '../utils/auth';

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

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const dummyUser: AuthUser = {
        id: '1',
        username: 'admin',
        email: 'admin@trailytics.com',
        displayName: 'Admin User',
        role: 'admin',
        companyId: 'dummy-company',
        companyName: 'Dummy Company',
        allowedPlatformUuids: [],
        platformScope: 'all'
    };

    const value = useMemo<AuthContextType>(() => ({
        user: dummyUser,
        isAuthenticated: true,
        isLoading: false,
        login: async () => ({ status: 'success' }),
        ssoLogin: async () => ({ ok: true }),
        logout: async () => {},
        refreshSession: async () => {},
        startMfaEnrolment: async () => ({ ok: false, error: 'Disabled' }),
        completeMfaEnrolment: async () => ({ ok: false, error: 'Disabled' }),
        completeMfaVerify: async () => ({ ok: true }),
    }), []);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
