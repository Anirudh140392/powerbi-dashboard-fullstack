/**
 * Pricing Analysis Utility Functions
 * Heatmap coloring, currency formatting, and data transformation utilities
 */

/**
 * Get heatmap background color based on value within range
 * Lower values = green (good), Higher values = red (action needed)
 * @param {number} value - Current value
 * @param {number} min - Minimum value in range
 * @param {number} max - Maximum value in range
 * @param {boolean} inverse - If true, higher = green (good for RPI)
 * @returns {object} - { backgroundColor, textColor }
 */
export function getHeatmapColor(value, min = 0, max = 100, inverse = false) {
    if (value === null || value === undefined || isNaN(value)) {
        return { backgroundColor: 'transparent', textColor: 'inherit' }
    }

    // Normalize value to 0-1 range
    const normalized = Math.max(0, Math.min(1, (value - min) / (max - min || 1)))
    const ratio = inverse ? 1 - normalized : normalized

    // Color stops: green (0) -> yellow (0.5) -> orange (0.75) -> red (1)
    let r, g, b

    if (ratio < 0.25) {
        // Green to light green
        r = Math.round(74 + (ratio / 0.25) * 80)
        g = Math.round(222 - (ratio / 0.25) * 30)
        b = Math.round(128 - (ratio / 0.25) * 60)
    } else if (ratio < 0.5) {
        // Light green to yellow
        const t = (ratio - 0.25) / 0.25
        r = Math.round(154 + t * 101)
        g = Math.round(192 + t * 7)
        b = Math.round(68 - t * 32)
    } else if (ratio < 0.75) {
        // Yellow to orange
        const t = (ratio - 0.5) / 0.25
        r = 255
        g = Math.round(199 - t * 80)
        b = Math.round(36 + t * 20)
    } else {
        // Orange to red
        const t = (ratio - 0.75) / 0.25
        r = Math.round(255 - t * 7)
        g = Math.round(119 - t * 48)
        b = Math.round(56 + t * 15)
    }

    const backgroundColor = `rgb(${r}, ${g}, ${b})`
    // Use dark text for light backgrounds, light text for dark backgrounds
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    const textColor = luminance > 0.5 ? '#1e293b' : '#ffffff'

    return { backgroundColor, textColor }
}

/**
 * Get trend indicator color and symbol
 * @param {number} value - Trend value (positive or negative)
 * @returns {object} - { symbol, color, className }
 */
export function getTrendIndicator(value) {
    if (value === null || value === undefined || value === 0) {
        return { symbol: '→', color: '#94a3b8', className: 'text-slate-400' }
    }
    if (value > 0) {
        return { symbol: '↓', color: '#ef4444', className: 'text-red-500' } // Price increase = bad
    }
    return { symbol: '↑', color: '#22c55e', className: 'text-green-500' } // Price decrease = good
}

/**
 * Get delta indicator (for general metrics)
 * @param {number} value - Delta value
 * @param {boolean} inverseColor - If true, negative = green
 * @returns {object}
 */
export function getDeltaIndicator(value, inverseColor = false) {
    if (value === null || value === undefined || value === 0) {
        return { symbol: '→', color: '#94a3b8', className: 'text-slate-400' }
    }
    const isPositive = value > 0
    const isGood = inverseColor ? !isPositive : isPositive

    return {
        symbol: isPositive ? '▲' : '▼',
        color: isGood ? '#22c55e' : '#ef4444',
        className: isGood ? 'text-emerald-600' : 'text-red-500'
    }
}

/**
 * Format currency value
 * @param {number} value - Value to format
 * @param {string} currency - Currency symbol (default: ₹)
 * @param {number} decimals - Decimal places
 * @returns {string}
 */
export function formatCurrency(value, currency = '₹', decimals = 0) {
    if (value === null || value === undefined) return '—'

    const formatted = Number(value).toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    })

    return `${currency}${formatted}`
}

/**
 * Format percentage value
 * @param {number} value - Value to format
 * @param {number} decimals - Decimal places
 * @returns {string}
 */
export function formatPercent(value, decimals = 0) {
    if (value === null || value === undefined) return '—'
    return `${Number(value).toFixed(decimals)}%`
}

/**
 * Calculate RPI (Relative Price Index)
 * RPI = ECP / (MRP * standard_factor)
 * @param {number} mrp - Maximum Retail Price
 * @param {number} ecp - Effective Consumer Price
 * @returns {number}
 */
export function calculateRPI(mrp, ecp) {
    if (!mrp || mrp === 0) return 0
    return Number((ecp / mrp).toFixed(2))
}

/**
 * Calculate ECP per unit (ml/g)
 * @param {number} ecp - Effective Consumer Price
 * @param {number} volume - Volume in ml or weight in g
 * @returns {number}
 */
export function calculateEcpPerUnit(ecp, volume) {
    if (!volume || volume === 0) return 0
    return Number((ecp / volume).toFixed(2))
}

/**
 * Group flat data by hierarchy levels for drill-down display
 * @param {Array} data - Flat array of records
 * @param {Array} levels - Array of key names for hierarchy levels
 * @returns {Array} - Nested structure for rendering
 */
export function groupByHierarchy(data, levels) {
    if (!levels || levels.length === 0) return data

    const [currentLevel, ...remainingLevels] = levels
    const groups = {}

    data.forEach(item => {
        const key = item[currentLevel] || 'Other'
        if (!groups[key]) {
            groups[key] = []
        }
        groups[key].push(item)
    })

    return Object.entries(groups).map(([key, items]) => ({
        name: key,
        key: currentLevel,
        items: remainingLevels.length > 0 ? groupByHierarchy(items, remainingLevels) : items,
        isLeaf: remainingLevels.length === 0
    }))
}

/**
 * Aggregate platform values from grouped data
 * @param {Array} items - Array of items to aggregate
 * @param {Array} platforms - Platform keys to aggregate
 * @returns {object} - { platformKey: aggregatedValue }
 */
export function aggregatePlatformValues(items, platforms = ['blinkit', 'instamart', 'zepto']) {
    const result = {}
    platforms.forEach(platform => {
        const values = items
            .map(item => item[platform])
            .filter(v => v !== null && v !== undefined && !isNaN(v))
        result[platform] = values.length > 0
            ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1))
            : null
    })
    // Total is average of all platforms
    const allValues = Object.values(result).filter(v => v !== null)
    result.total = allValues.length > 0
        ? Number((allValues.reduce((a, b) => a + b, 0) / allValues.length).toFixed(1))
        : null
    return result
}

/**
 * Parse volume string to number (e.g., "100 ml" -> 100)
 * @param {string} volumeStr - Volume string
 * @returns {number}
 */
export function parseVolume(volumeStr) {
    if (!volumeStr) return 0
    const match = volumeStr.toString().match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0
}

/**
 * Generate date options for day-level view
 * @param {number} days - Number of days to generate
 * @returns {Array} - Array of date objects
 */
export function generateDateOptions(days = 7) {
    const dates = []
    const today = new Date()

    for (let i = 0; i < days; i++) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        dates.push({
            key: date.toISOString().split('T')[0],
            label: date.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            }),
            shortLabel: date.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short'
            })
        })
    }

    return dates
}
