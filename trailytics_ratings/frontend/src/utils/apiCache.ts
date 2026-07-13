/**
 * apiCache — Unified client-side cache for API responses
 *
 * Two storage tiers:
 *  1. In-memory Map   — ultra-fast, survives filter changes, lost on hard refresh
 *  2. sessionStorage  — survives soft nav / React re-mounts, cleared on tab close
 *
 * Usage:
 *   const cached = getCached<T>(key);
 *   if (cached) return cached;
 *   const data = await fetch(...);
 *   setCached(key, data, 5 * 60_000); // 5 min TTL
 */

// ============================================================================
// Types
// ============================================================================

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

// ============================================================================
// In-Memory Cache (Map) + persistent weekly localStorage tier
// ============================================================================

const memCache = new Map<string, CacheEntry<unknown>>();

// Persistent browser cache. The crawl refreshes data on a ~weekly cadence, so
// aggregated responses can safely live in localStorage until the week rolls
// over — repeat visits (even after a full reload or browser restart) then
// render instantly with NO server round-trip, until the user clears browser
// data. Bucketing the key by week auto-invalidates the cache in step with the
// weekly refresh, so there's no week-long stale data and no server coordination.
const LOCAL_PREFIX = '_rcl_';
const WEEK_MS = 7 * 24 * 60 * 60_000;
function weekBucket(): number { return Math.floor(Date.now() / WEEK_MS); }
function localKey(key: string): string { return `${LOCAL_PREFIX}${weekBucket()}_${key}`; }

function localGet<T>(key: string): T | null {
    try {
        const raw = localStorage.getItem(localKey(key));
        if (!raw) return null;
        const entry: CacheEntry<T> = JSON.parse(raw);
        if (Date.now() > entry.expiresAt) { localStorage.removeItem(localKey(key)); return null; }
        return entry.data;
    } catch { return null; }
}

// Drop entries from previous week buckets (and legacy keys) so the persistent
// cache can't grow unbounded across weeks.
function pruneOldLocal(): void {
    try {
        const keep = `${LOCAL_PREFIX}${weekBucket()}_`;
        const drop: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(LOCAL_PREFIX) && !k.startsWith(keep)) drop.push(k);
        }
        drop.forEach(k => localStorage.removeItem(k));
    } catch { /* ignore */ }
}

function localSet<T>(key: string, data: T): void {
    // Expiry a touch beyond a week; the week-bucket key is the real invalidator.
    const write = () => localStorage.setItem(localKey(key), JSON.stringify({ data, expiresAt: Date.now() + WEEK_MS + 86_400_000 }));
    try { write(); }
    catch {
        // Quota exceeded — clear old-week entries and retry once, else memory-only.
        pruneOldLocal();
        try { write(); } catch { /* persistence skipped */ }
    }
}

export function getCached<T>(key: string): T | null {
    const entry = memCache.get(key) as CacheEntry<T> | undefined;
    if (entry) {
        if (Date.now() <= entry.expiresAt) return entry.data;
        memCache.delete(key);
    }
    // Fall back to the persistent weekly tier (survives reloads); warm memory.
    const persisted = localGet<T>(key);
    if (persisted !== null) {
        memCache.set(key, { data: persisted, expiresAt: Date.now() + TTL.FILTER });
        return persisted;
    }
    return null;
}

export function setCached<T>(key: string, data: T, ttlMs: number): void {
    memCache.set(key, { data, expiresAt: Date.now() + ttlMs });
    localSet(key, data); // write-through to the persistent weekly tier
}

export function invalidateCached(key: string): void {
    memCache.delete(key);
    try { localStorage.removeItem(localKey(key)); } catch { /* ignore */ }
}

export function clearAllCache(): void {
    memCache.clear();
    try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const k = sessionStorage.key(i);
            if (k?.startsWith('_rc_')) keysToRemove.push(k);
        }
        keysToRemove.forEach(k => sessionStorage.removeItem(k));
    } catch {
        // sessionStorage may be unavailable (private mode, etc.)
    }
    try {
        const drop: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k?.startsWith(LOCAL_PREFIX)) drop.push(k);
        }
        drop.forEach(k => localStorage.removeItem(k));
    } catch {
        // localStorage may be unavailable (private mode, etc.)
    }
}

// ============================================================================
// SessionStorage Cache (for static reference data that survives soft reloads)
// ============================================================================

const SESSION_PREFIX = '_rc_';

export function sessionGet<T>(key: string): T | null {
    try {
        const raw = sessionStorage.getItem(SESSION_PREFIX + key);
        if (!raw) return null;
        const entry: CacheEntry<T> = JSON.parse(raw);
        if (Date.now() > entry.expiresAt) {
            sessionStorage.removeItem(SESSION_PREFIX + key);
            return null;
        }
        return entry.data;
    } catch {
        return null;
    }
}

export function sessionSet<T>(key: string, data: T, ttlMs: number): void {
    try {
        const entry: CacheEntry<T> = { data, expiresAt: Date.now() + ttlMs };
        sessionStorage.setItem(SESSION_PREFIX + key, JSON.stringify(entry));
    } catch {
        // Storage quota exceeded — fall back to memory only
        setCached(key, data, ttlMs);
    }
}

// ============================================================================
// Cache Key Builder — stable, sorted param serialization
// ============================================================================

/**
 * Builds a deterministic cache key for an endpoint + params combo.
 * Params are sorted by key to ensure identical filter combos produce
 * the same cache key regardless of object property insertion order.
 */
export function buildCacheKey(
    endpoint: string,
    params: Record<string, string | number | undefined | null> = {},
): string {
    const sorted = Object.keys(params)
        .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
        .sort()
        .map(k => `${k}=${params[k]}`)
        .join('&');
    return `${endpoint}?${sorted}`;
}

// ============================================================================
// TTL Constants (milliseconds) — centralised, easy to tune
// ============================================================================

export const TTL = {
    /** Static reference data — platforms, configs, brand names */
    STATIC: 30 * 60_000,       // 30 minutes
    /** Product/filter metadata — categories, price ranges */
    METADATA: 10 * 60_000,     // 10 minutes
    /** Aggregated filter results — summary, health, issues */
    FILTER: 5 * 60_000,        // 5 minutes
    /** Drill-down results — sku lists, issue detail */
    DRILLDOWN: 3 * 60_000,     // 3 minutes
} as const;
