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

    if (absNum >= 1e9) {
        // Billions (Arab)
        return sign + (absNum / 1e9).toFixed(decimals) + ' B';
    } else if (absNum >= 1e7) {
        // Crores
        return sign + (absNum / 1e7).toFixed(decimals) + ' Cr';
    } else if (absNum >= 1e5) {
        // Lakhs (Lac)
        return sign + (absNum / 1e5).toFixed(decimals) + ' Lac';
    } else if (absNum >= 1e3) {
        // Thousands
        return sign + (absNum / 1e3).toFixed(decimals) + ' K';
    } else {
        // Less than 1000
        return sign + absNum.toFixed(decimals);
    }
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

    // Currency KPIs (Rupees)
    if (key.includes('spend') || key.includes('cpc') || key.includes('cpm')) {
        // For small values like CPC, show direct value
        if (Math.abs(value) < 1000) {
            return `₹${value.toFixed(decimals)}`;
        }
        return `₹${formatNumber(value, decimals).replace(/^\s*/, '')}`;
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
        return `₹${value.toFixed(0)}`;
    }

    // For large numbers, use compact Indian scale
    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : '';

    if (absValue >= 1e7) {
        return sign + (absValue / 1e7).toFixed(1) + 'Cr';
    } else if (absValue >= 1e5) {
        return sign + (absValue / 1e5).toFixed(1) + 'L';
    } else if (absValue >= 1e3) {
        return sign + (absValue / 1e3).toFixed(1) + 'K';
    } else {
        return sign + absValue.toFixed(0);
    }
};
