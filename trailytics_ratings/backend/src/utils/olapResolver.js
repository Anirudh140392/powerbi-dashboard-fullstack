/**
 * OLAP table resolver utility.
 *
 * Controls which databases use the unified `rb_review_olap` table instead of
 * the legacy multi-table schema (products, product_snapshots, ml_reviews, reviews,
 * competitor_mentions, stakeholder_mappings).
 *
 * To add a new db to OLAP mode, append its name (case-insensitive) to the
 * OLAP_ENABLED_DBS env var as a comma-separated list, e.g.:
 *   OLAP_ENABLED_DBS=drl,mars,prestige
 *
 * No db name is hardcoded in this file.
 */

let _olapEnabledDbs = null;

function getOlapEnabledDbs() {
    if (_olapEnabledDbs === null) {
        _olapEnabledDbs = new Set(
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

