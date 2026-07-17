import { resolveAuthCompanyId } from './auth';

const STORAGE_KEYS = ['companyId', 'company_id'] as const;

function syncCompanyId(value: string) {
    if (typeof window === 'undefined') return;
    STORAGE_KEYS.forEach(key => window.localStorage.setItem(key, value));
}

export function resolveCompanyId(): string {
    // 0. Env var — fastest, always wins. Set VITE_COMPANY_ID in .env to lock the tenant.
    //    This must come BEFORE any localStorage read to prevent stale cached IDs from
    //    a previous tenant overriding the configured one.
    const envCompanyId = (import.meta.env.VITE_COMPANY_ID as string | undefined)?.trim();
    if (envCompanyId) return envCompanyId;

    // 1. Ratings-specific persisted auth session (set by AuthContext after env var check)
    const authCompanyId = resolveAuthCompanyId()?.trim();
    if (authCompanyId) {
        syncCompanyId(authCompanyId);
        return authCompanyId;
    }

    // 2. Root Digital Shelf sessionStorage user object (embedded mode)
    if (typeof window !== 'undefined') {
        try {
            const raw = window.sessionStorage.getItem('user');
            if (raw) {
                const rootUser = JSON.parse(raw);
                const cid = rootUser?.companyId || rootUser?.company_id;
                if (cid && typeof cid === 'string') {
                    syncCompanyId(cid);
                    return cid;
                }
            }
        } catch (e) { /* ignore */ }
    }

    // 3. localStorage fallback (set by syncCompanyId on previous loads)
    if (typeof window !== 'undefined') {
        for (const key of STORAGE_KEYS) {
            const stored = window.localStorage.getItem(key)?.trim();
            if (stored) {
                syncCompanyId(stored);
                return stored;
            }
        }
    }

    throw new Error('Company ID is unavailable. Set VITE_COMPANY_ID in your .env file.');
}

/**
 * Returns the active brand / db name for display in the UI.
 * Priority:
 *  1. Root frontend sessionStorage "user" → dbName  (embedded mode via Digital Shelf)
 *  2. VITE_COMPANY_NAME env var                    (standalone mode)
 *  3. "Prestige"                                   (last resort default)
 */
export function getActiveBrandName(): string {
    if (typeof window !== 'undefined') {
        try {
            // Root Digital Shelf app stores user in sessionStorage with key "user"
            const raw = window.sessionStorage.getItem('user');
            if (raw) {
                const rootUser = JSON.parse(raw);
                const dbName = rootUser?.dbName || rootUser?.db_name || rootUser?.companyName || rootUser?.company_name;
                if (dbName && typeof dbName === 'string') {
                    return capitalizeDbName(dbName);
                }
            }
        } catch (e) {
            // ignore parse errors
        }
    }

    const envName = import.meta.env.VITE_COMPANY_NAME;
    if (envName) return capitalizeDbName(envName);

    return 'Prestige';
}

function capitalizeDbName(name: string): string {
    // Known brand overrides
    const lower = name.toLowerCase().trim();
    const overrides: Record<string, string> = {
        mamaearth: 'Mamaearth',
        prestige: 'Prestige',
        danone: 'Danone',
        drl: 'DRL',
        mars: 'Mars',
        colpal: 'Colpal',
        sugar: 'Sugar',
    };
    if (overrides[lower]) return overrides[lower];
    // Generic: replace underscores, title-case each word
    return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
