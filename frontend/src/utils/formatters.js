/**
 * Derive formatted client display name from logged in user or sessionStorage
 * @param {object} user - User object from AuthContext
 * @returns {string} Client display name (e.g. MARS, Mamaearth, boAt, Zydus)
 */
export const getClientDisplayName = (user) => {
    try {
        const u = user || JSON.parse(sessionStorage.getItem('user') || '{}');
        const db = u?.dbName ? String(u.dbName).toLowerCase().trim() : '';
        if (!db) return 'Trailytics';

        if (db === 'mamaearth') return 'Mamaearth';
        if (db === 'mars_petcare') return 'Mars Petcare';
        if (db === 'mars_dmart' || db === 'mars') return 'MARS';
        if (db === 'boat') return 'boAt';
        if (db === 'zydus' || db === 'hm_zydus') return 'Zydus';
        if (db === 'sugar') return 'Sugar';
        if (db === 'pidilite') return 'Pidilite';
        if (db === 'cheffin') return 'Cheffin';
        if (db === 'drl') return 'DRL';
        if (db === 'emami') return 'Emami';
        if (db === 'hm_titan_bags') return 'Fastrack';
        if (db === 'hm_titan_skinn') return 'Titan Skinn';
        if (db === 'hm_titan_perfume') return 'Titan Perfume';
        if (db === 'hm_amz_dev') return 'Amazon Device';
        if (db === 'hm_stahl') return 'Stahl';
        if (db === 'trailytics') return 'Trailytics';

        return db.replace(/^hm_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    } catch (e) {
        return 'Trailytics';
    }
};

/**
 * Format numbers to Indian currency format (K, Lac, Cr, B)
 * @param {number} num - Number to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted number string
 */
export const formatNumber = (num, decimals = 2) => {
    if (num === null || num === undefined || isNaN(num)) {
        return '0';
    }

    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';

    if (absNum >= 1e7) {
        // Crores
        return sign + (absNum / 1e7).toFixed(decimals) + ' Cr';
    } else if (absNum >= 1e5) {
        // Lakhs (Lacs)
        return sign + (absNum / 1e5).toFixed(decimals) + ' Lacs';
    } else if (absNum >= 1e3) {
        // Thousands
        return sign + (absNum / 1e3).toFixed(decimals) + ' K';
    } else {
        // Less than 1000
        return sign + absNum.toFixed(decimals);
    }
};

const getCurrencySymbol = () => {
    try {
        const u = JSON.parse(sessionStorage.getItem('user'));
        if (u?.dbName?.toLowerCase().includes('hayatna')) {
            return 'AED ';
        }
    } catch (e) {
        // ignore
    }
    return '₹';
};

/**
 * Format KPI values based on their type
 * @param {number} value - Value to format
 * @param {string} kpiKey - KPI identifier (e.g., 'offtakes', 'spend', 'conversion')
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted value with appropriate unit
 */
export const formatKpiValue = (value, kpiKey, decimals = 2) => {
    if (value === null || value === undefined || isNaN(value)) {
        return '-';
    }

    const key = kpiKey.toLowerCase();

    // Currency KPIs (Rupees or AED)
    if (key.includes('spend') || key.includes('cpc') || key.includes('cpm')) {
        const currency = getCurrencySymbol();
        // For small values like CPC, show direct value
        if (Math.abs(value) < 1000) {
            return `${currency}${value.toFixed(decimals)}`;
        }
        return `${currency}${formatNumber(value, decimals).replace(/^\s*/, '')}`;
    }

    // Percentage KPIs
    if (key.includes('conversion') || key.includes('availability') ||
        key.includes('share') || key.includes('osa') || key.includes('fillrate')) {
        return `${value.toFixed(decimals)}%`;
    }

    // Ratio KPIs
    if (key.includes('roas')) {
        return `${value.toFixed(decimals)}x`;
    }

    // Days KPIs
    if (key.includes('doi')) {
        return `${value.toFixed(0)} days`;
    }

    // Default: Large numbers with Indian scale
    if (Math.abs(value) >= 1000) {
        return formatNumber(value, decimals);
    }

    // Small numbers as-is
    return value.toFixed(decimals);
};

/**
 * Format Y-axis tick values for charts
 * @param {number} value - Tick value
 * @param {string} kpiKey - KPI identifier
 * @returns {string} Formatted tick label
 */
export const formatYAxisTick = (value, kpiKey) => {
    if (value === null || value === undefined || isNaN(value)) {
        return '';
    }

    const key = kpiKey ? kpiKey.toLowerCase() : '';

    // For percentage-based KPIs, show simple numbers with % symbol
    if (key.includes('conversion') || key.includes('availability') ||
        key.includes('share') || key.includes('osa') || key.includes('fillrate')) {
        return `${value.toFixed(0)}%`;
    }

    // For ratio KPIs, show with x suffix
    if (key.includes('roas')) {
        return `${value.toFixed(1)}x`;
    }

    // For currency with small values
    if ((key.includes('cpc') || key.includes('cpm') || key.includes('spend')) && Math.abs(value) < 1000) {
        const currency = getCurrencySymbol();
        return `${currency}${value.toFixed(0)}`;
    }

    // For large numbers, use compact Indian scale
    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : '';

    if (absValue >= 1e7) {
        return sign + (absValue / 1e7).toFixed(1) + ' Cr';
    } else if (absValue >= 1e5) {
        return sign + (absValue / 1e5).toFixed(1) + ' Lacs';
    } else if (absValue >= 1e3) {
        return sign + (absValue / 1e3).toFixed(1) + ' K';
    } else {
        return sign + absValue.toFixed(0);
    }
};
