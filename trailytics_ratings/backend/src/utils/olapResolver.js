import clickhouse from '../config/clickhouse.js';

let _olapEnabledDbs = null;
let _lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 60s cache TTL
let _fetchPromise = null;

/**
 * Refreshes the set of enabled databases from admin_master.tb_database.
 */
export async function refreshOlapEnabledDbs() {
    if (_fetchPromise) return _fetchPromise;

    _fetchPromise = (async () => {
        try {
            const res = await clickhouse.query({
                query: 'SELECT db_name FROM admin_master.tb_database',
                format: 'JSONEachRow'
            });
            const rows = await res.json();
            const dbs = new Set(
                rows
                    .map((r) => (r.db_name || '').trim().toLowerCase())
                    .filter(Boolean)
            );
            if (dbs.size > 0) {
                _olapEnabledDbs = dbs;
                _lastFetchTime = Date.now();
            }
        } catch (err) {
            console.error('[olapResolver] Error fetching db_names from admin_master.tb_database:', err?.message || err);
            if (!_olapEnabledDbs) {
                _olapEnabledDbs = new Set(
                    (process.env.OLAP_ENABLED_DBS || '')
                        .split(',')
                        .map((s) => s.trim().toLowerCase())
                        .filter(Boolean)
                );
            }
        } finally {
            _fetchPromise = null;
        }
        return _olapEnabledDbs;
    })();

    return _fetchPromise;
}

/**
 * Returns the set of enabled OLAP databases.
 * Dynamically populated from admin_master.tb_database.
 */
function getOlapEnabledDbs() {
    const now = Date.now();
    if (_olapEnabledDbs === null || now - _lastFetchTime > CACHE_TTL_MS) {
        refreshOlapEnabledDbs().catch(() => {});
    }

    if (_olapEnabledDbs === null) {
        return new Set(
            (process.env.OLAP_ENABLED_DBS || '')
                .split(',')
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean)
        );
    }
    return _olapEnabledDbs;
}

/**
 * Returns true if the given db name should use the OLAP single-table mode.
 * @param {string} dbName - The database name from the auth context.
 */
export function useOlapTable(dbName) {
    if (!dbName) return false;
    return getOlapEnabledDbs().has(dbName.trim().toLowerCase());
}

/**
 * Returns the exact OLAP table name for a given database.
 * Default is 'rb_review_olap', but databases like marico_4700bc use 'rb_reviews_olap'.
 * @param {string} dbName
 */
export function getOlapTableName(dbName) {
    if (!dbName) return process.env.OLAP_TABLE_NAME || 'rb_review_olap';
    const norm = dbName.trim().toLowerCase();
    if (norm === 'marico_4700bc' || norm.includes('marico')) {
        return 'rb_reviews_olap';
    }
    return process.env.OLAP_TABLE_NAME || 'rb_review_olap';
}

// Initial async fetch on module load
refreshOlapEnabledDbs().catch(() => {});


