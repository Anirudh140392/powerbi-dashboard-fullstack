import { resolveAuthCompanyId } from './auth';

const STORAGE_KEYS = ['companyId', 'company_id'] as const;

function syncCompanyId(value: string) {
    if (typeof window === 'undefined') return;
    STORAGE_KEYS.forEach(key => window.localStorage.setItem(key, value));
}

/**
 * Resolves the active company_id for ratings API calls.
 *
 * Priority order (DS sessionStorage must come FIRST to avoid stale localStorage
 * from a previous client overriding the currently logged-in user's company):
 *
 *  1. DS sessionStorage "user".companyId   — live login from admin_master.tb_database
 *  2. VITE_COMPANY_ID env var              — standalone mode / build-time fallback
 *  3. ratings_auth_session localStorage    — standalone full-auth mode
 *  4. companyId / company_id localStorage  — last-resort stale cache
 */
export function resolveCompanyId(): string {
    // 1. Root Digital Shelf sessionStorage — most authoritative source.
    //    Populated on every DS login from admin_master.tb_database.company_id.
    //    MUST come before localStorage reads to prevent stale cross-session data
    //    (e.g., danone leftover in localStorage overriding a freshly-logged-in prestige user).
    if (typeof window !== 'undefined') {
        try {
            const raw = window.sessionStorage.getItem('user');
            if (raw) {
                const rootUser = JSON.parse(raw);
                const cid = rootUser?.companyId || rootUser?.company_id;
                if (cid && typeof cid === 'string' && cid.trim()) {
                    syncCompanyId(cid);
                    return cid.trim();
                }
            }
        } catch (e) { /* ignore parse errors */ }
    }

    // 2. Env var — standalone ratings mode or when no DS session exists.
    //    Also prevents stale localStorage from a wrong client bleeding through on first load.
    const envCompanyId = (import.meta.env.VITE_COMPANY_ID as string | undefined)?.trim();
    if (envCompanyId) {
        syncCompanyId(envCompanyId);
        return envCompanyId;
    }

    // 3. Ratings-specific persisted auth session (standalone full-auth flow).
    const authCompanyId = resolveAuthCompanyId()?.trim();
    if (authCompanyId) {
        syncCompanyId(authCompanyId);
        return authCompanyId;
    }

    // 4. localStorage fallback (set by syncCompanyId on previous loads).
    if (typeof window !== 'undefined') {
        for (const key of STORAGE_KEYS) {
            const stored = window.localStorage.getItem(key)?.trim();
            if (stored) {
                syncCompanyId(stored);
                return stored;
            }
        }
    }

    throw new Error('Company ID is unavailable. Log in via Digital Shelf or set VITE_COMPANY_ID in your .env file.');
}

/**
 * Resolves the ClickHouse database name for the currently logged-in user.
 * This is required by every ratings API call so the backend queries the
 * correct per-client ClickHouse database (e.g. "prestige" vs "danone").
 *
 * Priority:
 *  1. DS sessionStorage "user".dbName  — live login value from admin_master.tb_database
 *  2. VITE_COMPANY_NAME env var        — standalone / build-time fallback
 *  3. Empty string                     — backend will use its CLICKHOUSE_DB env default
 */
export function resolveDbName(): string {
    if (typeof window !== 'undefined') {
        try {
            const raw = window.sessionStorage.getItem('user');
            if (raw) {
                const rootUser = JSON.parse(raw);
                const dbName = rootUser?.dbName || rootUser?.db_name;
                if (dbName && typeof dbName === 'string' && dbName.trim()) {
                    return dbName.trim().toLowerCase();
                }
            }
        } catch (e) { /* ignore */ }
    }

    const envName = (import.meta.env.VITE_COMPANY_NAME as string | undefined)?.trim();
    if (envName) return envName.toLowerCase();

    return '';
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
