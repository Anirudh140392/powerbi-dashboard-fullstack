/**
 * Utility helper to build case-insensitive web_pid SQL filter conditions for ClickHouse.
 * Handles:
 *  - Case normalization (e.g. uppercase ASINs like 'B0DJ196Z61' vs lowercase DB values like 'b0dj196z61')
 *  - Single web_pid (e.g. "b0dj196z61" or "B0DJ196Z61")
 *  - Comma-separated list of web_pids (e.g. "b0dj196z61,b0dfml8557")
 *  - Array of web_pids
 *
 * @param {string|string[]} web_pid - The web_pid input from query/params
 * @param {string} col - SQL column with optional table alias (e.g. 'o.web_pid', 'r.web_pid', 'web_pid')
 * @param {object} queryParams - ClickHouse query_params object to populate
 * @param {string} [paramName='webPid'] - Base name for query parameter
 * @returns {string|null} SQL condition or null if web_pid is empty
 */
export function buildWebPidCondition(web_pid, col = 'o.web_pid', queryParams = {}, paramName = 'webPid') {
    if (!web_pid) return null;
    let str = '';
    if (Array.isArray(web_pid)) {
        str = web_pid.join(',');
    } else {
        str = String(web_pid).trim();
    }
    if (!str) return null;

    const pids = str.split(',').map(p => p.trim().toLowerCase()).filter(Boolean);
    if (pids.length === 0) return null;

    if (pids.length === 1) {
        queryParams[paramName] = pids[0];
        return `lower(${col}) = {${paramName}:String}`;
    }

    const listParam = `${paramName}List`;
    queryParams[listParam] = pids;
    return `lower(${col}) IN {${listParam}:Array(String)}`;
}

/**
 * Normalizes web_pid to lowercase string or array of lowercase strings.
 */
export function normalizeWebPid(web_pid) {
    if (!web_pid) return '';
    if (Array.isArray(web_pid)) return web_pid.map(p => String(p).trim().toLowerCase()).filter(Boolean);
    return String(web_pid).trim().toLowerCase();
}

