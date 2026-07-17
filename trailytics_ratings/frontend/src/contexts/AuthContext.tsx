import React, { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { type AuthUser, persistAuthSession, clearStoredAuthSession } from '../utils/auth';

/** 
 * Resolves company identity for the ratings module.
 * Priority:
 *  1. VITE_COMPANY_ID env var  — set in root frontend .env for embedded mode, or ratings .env for standalone
 *  2. Root Digital Shelf sessionStorage user → companyId / company_id
 *  3. Hardcoded fallback (last resort — avoids throwing)
 */
function resolveRootUser(): { companyId: string; companyName: string } {
    // 1. Env var — most reliable, set explicitly in .env for the active client
    const envCompanyId = import.meta.env.VITE_COMPANY_ID as string | undefined;
    const envCompanyName = import.meta.env.VITE_COMPANY_NAME as string | undefined;
    if (envCompanyId) {
        return {
            companyId: envCompanyId,
            companyName: envCompanyName || 'prestige',
        };
    }

    // 2. Root Digital Shelf sessionStorage user (set after login in root frontend)
    if (typeof window !== 'undefined') {
        try {
            const raw = window.sessionStorage.getItem('user');
            if (raw) {
                const rootUser = JSON.parse(raw);
                const companyId = rootUser?.companyId || rootUser?.company_id;
                const companyName = rootUser?.dbName || rootUser?.db_name || rootUser?.companyName;
                if (companyId) {
                    return { companyId, companyName: companyName || 'prestige' };
                }
            }
        } catch (e) {
            console.warn('[RatingsAuth] Could not parse root user from sessionStorage:', e);
        }
    }

    // 3. Last-resort fallback (prevents crash, but data will be wrong)
    console.warn('[RatingsAuth] VITE_COMPANY_ID not set — using hardcoded prestige fallback. Set VITE_COMPANY_ID in your .env file.');
    return { companyId: '297e37ea-a5ac-47df-bebd-ac44e52b7979', companyName: 'prestige' };
}

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
    const { companyId, companyName } = resolveRootUser();

    const dummyUser: AuthUser = {
        id: '1',
        username: 'admin',
        email: 'admin@trailytics.com',
        displayName: 'Admin User',
        role: 'admin',
        companyId,
        companyName,
        allowedPlatformUuids: [],
        platformScope: 'all'
    };

    // Always clear any previously cached session first (prevents stale company IDs
    // from a different tenant persisting in localStorage and overriding the current one),
    // then persist fresh with the resolved company ID.
    useEffect(() => {
        clearStoredAuthSession();
        persistAuthSession({
            token: 'bypass-token',
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            user: dummyUser,
        });
    }, [companyId, companyName]); // re-run if the active tenant changes

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
    }), [companyId, companyName]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
