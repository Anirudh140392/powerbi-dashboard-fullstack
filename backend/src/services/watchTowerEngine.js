import dayjs from 'dayjs';
import { queryClickHouse } from '../config/clickhouse.js';

/**
 * Standardized string escaping for ClickHouse
 */
export const escapeStr = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/'/g, "''");
};

/**
 * Generate standard time buckets for a given range and step
 */
export const generateStandardBuckets = (startDate, endDate, timeStep = 'Daily') => {
    const buckets = [];
    let current = dayjs(startDate).startOf('day');
    const end = dayjs(endDate).endOf('day');

    while (current.isBefore(end) || current.isSame(end, 'day')) {
        let label;
        let groupKey;

        if (timeStep === 'Monthly') {
            label = current.format("MMM 'YY");
            groupKey = current.format('YYYY-MM-01');
            current = current.add(1, 'month');
        } else if (timeStep === 'Weekly') {
            label = `Wk ${current.isoWeek()}`;
            groupKey = current.format('YYYY-WW'); // Simplification for internal mapping
            current = current.add(1, 'week');
        } else { // Daily
            label = current.format('DD MMM');
            groupKey = current.format('YYYY-MM-DD');
            current = current.add(1, 'day');
        }

        buckets.push({
            label,
            groupKey,
            date: current.clone().subtract(1, 'day').toDate(), // Representing the point
            value: 0
        });
    }

    return buckets;
};

/**
 * Shared ClickHouse condition builder
 */
export const buildClickHouseConditions = (filters, options = {}) => {
    const { startDate, endDate, platform, brand, location, category, skuName, skuCode, channel, compFlag } = filters;
    const {
        dateCol = 'DATE',
        platformCol = 'Platform',
        locationCol = 'Location',
        categoryCol = 'Category',
        brandCol = 'Brand',
        productCol = 'Product',
        pidCol = 'Web_Pid'
    } = options;

    const conds = [];

    if (startDate && endDate) {
        conds.push(`toDate(${dateCol}) BETWEEN '${dayjs(startDate).format('YYYY-MM-DD')}' AND '${dayjs(endDate).format('YYYY-MM-DD')}'`);
    }

    if (compFlag !== undefined && compFlag !== null) {
        conds.push(`Comp_flag = ${compFlag}`);
    }

    if (platform && platform !== 'All') {
        const platformList = Array.isArray(platform) ? platform : [platform];
        conds.push(`${platformCol} IN (${platformList.map(p => `'${escapeStr(p)}'`).join(', ')})`);
    }

    if (brand && brand !== 'All') {
        const brandList = Array.isArray(brand) ? brand : [brand];
        const brandConds = brandList.map(b => `${brandCol} LIKE '%${escapeStr(b)}%'`).join(' OR ');
        conds.push(`(${brandConds})`);
    }

    if (location && location !== 'All') {
        const locationList = typeof location === 'string' && location.includes(',') ? location.split(',').map(l => l.trim()) : (Array.isArray(location) ? location : [location]);
        conds.push(`${locationCol} IN (${locationList.map(l => `'${escapeStr(l)}'`).join(', ')})`);
    }

    if (category && category !== 'All') {
        const categoryList = typeof category === 'string' && category.includes(',') ? category.split(',').map(c => c.trim()) : (Array.isArray(category) ? category : [category]);
        conds.push(`lower(${categoryCol}) IN (${categoryList.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`);
    }

    // SKU Search
    if (skuName && skuName !== 'All') {
        const skuArr = Array.isArray(skuName) ? skuName : [skuName];
        conds.push(`(${skuArr.map(s => `${productCol} LIKE '%${escapeStr(s)}%'`).join(' OR ')})`);
    }
    if (skuCode && skuCode !== 'All') {
        const codeArr = Array.isArray(skuCode) ? skuCode : [skuCode];
        conds.push(`(${codeArr.map(c => `toString(${pidCol}) LIKE '%${escapeStr(c)}%'`).join(' OR ')})`);
    }

    // Channel-based logic (standardized)
    if (channel === 'Ecommerce') {
        conds.push(`${platformCol} IN ('Blinkit', 'Zepto', 'Instamart', 'Swiggy Instamart', 'Amazon', 'Flipkart')`);
    } else if (channel === 'Modern Trades') {
        conds.push(`${platformCol} NOT IN ('Blinkit', 'Zepto', 'Instamart', 'Swiggy Instamart', 'Amazon', 'Flipkart')`);
    }

    return conds.join(' AND ');
};

/**
 * Standardized currency formatting
 */
export const formatCurrency = (value) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
    return `₹${Math.round(value).toLocaleString('en-IN')}`;
};
