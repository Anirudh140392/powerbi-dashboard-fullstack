import { getCurrentDbName } from '../config/clickhouse.js';

export function generateCacheKey(section, filters) {
    const rawPlatform = filters['platform[]'] || filters.platform || 'all';
    const rawBrand = filters['brand[]'] || filters.brand || filters.brands || 'all';
    const rawLocation = filters['location[]'] || filters.location || 'all';

    const normalize = (val) => {
        if (!val || val === 'all' || val === 'All') return 'all';
        let values = [];
        if (Array.isArray(val)) {
            values = val;
        } else if (typeof val === 'string' && val.includes(',')) {
            values = val.split(',');
        } else {
            return String(val).toLowerCase().trim().replace(/\s+/g, '_');
        }
        return values
            .map(v => String(v || '').toLowerCase().trim().replace(/\s+/g, '_'))
            .filter(Boolean)
            .sort()
            .join(',');
    };

    const p = normalize(rawPlatform);
    const b = normalize(rawBrand);
    const l = normalize(rawLocation);
    const dbName = getCurrentDbName();

    return `watchtower:db_${dbName}:p_${p}:b_${b}:l_${l}:s_${normalize(section)}`;
}

export const CACHE_TTL = {
    VERY_STATIC: 604800,
    STATIC: 86400,
    METRICS: 7200,
    SHORT: 300,
};

export async function getCachedOrCompute(key, computeFn, ttl = 3600) {
    return await computeFn();
}
