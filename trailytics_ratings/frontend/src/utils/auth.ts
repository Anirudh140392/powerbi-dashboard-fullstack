export interface AuthUser {
    id: string;
    username: string;
    email: string;
    displayName: string;
    role: string;
    companyId: string;
    companyName: string;
    allowedPlatformUuids: string[];
    platformScope: 'all' | 'restricted';
}

export interface AuthSession {
    token: string;
    expiresAt: string;
    user: AuthUser;
}

const SESSION_STORAGE_KEY = 'ratings_auth_session';
const COMPANY_STORAGE_KEYS = ['companyId', 'company_id'] as const;

function syncCompanyId(companyId: string) {
    if (typeof window === 'undefined') return;
    COMPANY_STORAGE_KEYS.forEach(key => window.localStorage.setItem(key, companyId));
}

export function getStoredAuthSession(): AuthSession | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as AuthSession;
    } catch {
        return null;
    }
}

export function persistAuthSession(session: AuthSession) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    syncCompanyId(session.user.companyId);
}

export function clearStoredAuthSession() {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    COMPANY_STORAGE_KEYS.forEach(key => window.localStorage.removeItem(key));
}

export function resolveAuthCompanyId(): string | null {
    return getStoredAuthSession()?.user.companyId ?? null;
}

export function getAuthToken(): string | null {
    return getStoredAuthSession()?.token ?? null;
}

export function buildAuthHeaders(init?: HeadersInit, _companyId?: string): Headers {
    const headers = new Headers(init);
    const session = getStoredAuthSession();
    if (session?.token) {
        headers.set('Authorization', `Bearer ${session.token}`);
    }

    // Removed X-Company-ID header to avoid unnecessary CORS preflight requests
    // The company_id is already passed as a query parameter in useRatingsAPI.ts


    return headers;
}

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}, companyId?: string) {
    const headers = buildAuthHeaders(init.headers, companyId);
    return fetch(input, { ...init, headers });
}
