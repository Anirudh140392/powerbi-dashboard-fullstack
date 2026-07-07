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
// In-Memory Cache (Map)
// ============================================================================

const memCache = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
    const entry = memCache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        memCache.delete(key);
        return null;
    }
    return entry.data;
}

export function setCached<T>(key: string, data: T, ttlMs: number): void {
    memCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidateCached(key: string): void {
    memCache.delete(key);
}

export function clearAllCache(): void {
    memCache.clear();
    try {
        // Clear only our prefixed keys from sessionStorage
        const keysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const k = sessionStorage.key(i);
            if (k?.startsWith('_rc_')) keysToRemove.push(k);
        }
        keysToRemove.forEach(k => sessionStorage.removeItem(k));
    } catch {
        // sessionStorage may be unavailable (private mode, etc.)
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
