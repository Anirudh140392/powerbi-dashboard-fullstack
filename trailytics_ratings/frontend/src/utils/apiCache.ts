/**
 * apiCache — NO-OP STUB (ALL CACHING DISABLED FOR DEVELOPMENT)
 *
 * ⚠️ DEVELOPMENT MODE: All frontend caching is disabled.
 * Every API request will reach the backend immediately.
 * No browser storage, no in-memory cache, no sessionStorage.
 *
 * This is temporary while migrating to ClickHouse.
 * Restore caching in production by reverting these functions.
 */

// ============================================================================
// NO-OP Cache Functions (all return null/do nothing)
// ============================================================================

/**
 * DISABLED: Always returns null (no cache check)
 */
export function getCached<T>(_key: string): T | null {
    return null;
}

/**
 * DISABLED: No-op, never stores anything
 */
export function setCached<_T>(_key: string, _data: _T, _ttlMs: number): void {
    // Intentionally disabled for development
}

/**
 * DISABLED: No-op, nothing to invalidate
 */
export function invalidateCached(_key: string): void {
    // Intentionally disabled for development
}

/**
 * DISABLED: No-op, nothing to clear
 */
export function clearAllCache(): void {
    // Intentionally disabled for development
}

// ============================================================================
// NO-OP SessionStorage Functions (all return null/do nothing)
// ============================================================================

/**
 * DISABLED: Always returns null (no sessionStorage cache)
 */
export function sessionGet<T>(_key: string): T | null {
    return null;
}

/**
 * DISABLED: Never stores to sessionStorage
 */
export function sessionSet<_T>(_key: string, _data: _T, _ttlMs: number): void {
    // Intentionally disabled for development
}

// ============================================================================
// Cache Key Builder — Stub only (not used anymore)
// ============================================================================

export function buildCacheKey(endpoint: string, _params: Record<string, string | number | undefined | null> = {}): string {
    // Returns a placeholder key (not used since getCached always returns null)
    return endpoint;
}

// ============================================================================
// TTL Constants — KEPT FOR REFERENCE ONLY (no longer used)
// ============================================================================

export const TTL = {
    /** DISABLED: Static reference data */
    STATIC: 0,
    /** DISABLED: Product/filter metadata */
    METADATA: 0,
    /** DISABLED: Aggregated filter results */
    FILTER: 0,
    /** DISABLED: Drill-down results */
    DRILLDOWN: 0,
} as const;
