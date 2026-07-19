import { resolveAuthCompanyId } from './auth';

const STORAGE_KEYS = ['companyId', 'company_id'] as const;

function syncCompanyId(value: string) {
    if (typeof window === 'undefined') return;
    STORAGE_KEYS.forEach(key => window.localStorage.setItem(key, value));
}

export function resolveCompanyId(): string {
    const authCompanyId = resolveAuthCompanyId()?.trim();
    if (authCompanyId) {
        syncCompanyId(authCompanyId);
        return authCompanyId;
    }

    if (typeof window !== 'undefined') {
        for (const key of STORAGE_KEYS) {
            const stored = window.localStorage.getItem(key)?.trim();
            if (stored) {
                syncCompanyId(stored);
                return stored;
            }
        }
    }
    
    // Fallback to environment variable if authentication is removed
    const envCompanyId = import.meta.env.VITE_COMPANY_ID;
    if (envCompanyId) {
        return envCompanyId;
    }

    throw new Error('Company ID is unavailable. Sign in to establish the active Ratings tenant.');
}

export function resolveCompanyName(): string {
    if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem('companyName')?.trim();
        if (stored) return stored;
    }
    return import.meta.env.VITE_COMPANY_NAME || 'prestige';
}
