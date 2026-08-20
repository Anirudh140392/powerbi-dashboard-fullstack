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

const OLAP_ENABLED_DBS = new Set(
    (process.env.OLAP_ENABLED_DBS || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
);

/**
 * Returns true if the given db name should use the OLAP single-table mode.
 * @param {string} dbName - The database name from the auth context.
 */
export function useOlapTable(dbName) {
    if (!dbName) return false;
    return OLAP_ENABLED_DBS.has(dbName.trim().toLowerCase());
}
