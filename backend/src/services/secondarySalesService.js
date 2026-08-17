// src/services/secondarySalesService.js
// Service for SECONDARY SUMMARY segment
// Data source: rb_secondary_olap table in ClickHouse

import { queryClickHouse, getCurrentDbName } from '../config/clickhouse.js';

const escapeCH = (str) => String(str || '').replace(/'/g, "''");

const buildMultiCondition = (value, column) => {
    if (!value || value === 'All') return '1=1';
    const values = String(value).split(',').map(v => v.trim()).filter(Boolean);
    if (values.length === 0) return '1=1';
    if (values.length === 1) {
        return `lower(toString(${column})) = lower('${escapeCH(values[0])}')`;
    }
    return `lower(toString(${column})) IN (${values.map(v => `lower('${escapeCH(v)}')`).join(',')})`;
};

const buildFilterClause = (filters, ignoreDates = false) => {
    const conditions = [];

    if (filters.seller && filters.seller !== 'All') {
        conditions.push(buildMultiCondition(filters.seller, 'Seller_name'));
    }
    if (filters.platformName && filters.platformName !== 'All') {
        conditions.push(buildMultiCondition(filters.platformName, 'pf_name'));
    }
    if (filters.brand && filters.brand !== 'All') {
        conditions.push(buildMultiCondition(filters.brand, 'brand_name'));
    }
    if (filters.subBrand && filters.subBrand !== 'All') {
        conditions.push(buildMultiCondition(filters.subBrand, '`Sub Brand`'));
    }
    if (filters.sku && filters.sku !== 'All') {
        conditions.push(buildMultiCondition(filters.sku, 'SKU'));
    }
    if (filters.sapCode && filters.sapCode !== 'All') {
        conditions.push(buildMultiCondition(filters.sapCode, '`DRL Sap Code`'));
    }
    if (filters.fiscalYear && filters.fiscalYear !== 'All') {
        conditions.push(buildMultiCondition(filters.fiscalYear, 'FY'));
    }
    if (filters.quarter && filters.quarter !== 'All') {
        conditions.push(buildMultiCondition(filters.quarter, 'Qtr'));
    }

    if (!ignoreDates && filters.startDate && filters.endDate) {
        conditions.push(`toDate(date) >= toDate('${escapeCH(filters.startDate)}') AND toDate(date) <= toDate('${escapeCH(filters.endDate)}')`);
    }

    return conditions.length > 0 ? conditions.join(' AND ') : '1=1';
};

const buildFilterClauseExcluding = (filters, excludeKey) => {
    const scoped = { ...filters };
    delete scoped[excludeKey];
    return buildFilterClause(scoped, true);
};

export const getSecondaryFilterOptions = async (filters = {}) => {
    const dbName = getCurrentDbName();
    const table = `${dbName}.rb_secondary_olap`;

    const sellerClause = buildFilterClauseExcluding(filters, 'seller');
    const platformClause = buildFilterClauseExcluding(filters, 'platformName');
    const brandClause = buildFilterClauseExcluding(filters, 'brand');
    const subBrandClause = buildFilterClauseExcluding(filters, 'subBrand');
    const skuClause = buildFilterClauseExcluding(filters, 'sku');
    const sapCodeClause = buildFilterClauseExcluding(filters, 'sapCode');
    const fyClause = buildFilterClauseExcluding(filters, 'fiscalYear');
    const quarterClause = buildFilterClauseExcluding(filters, 'quarter');

    const [sellers, platforms, brands, subBrands, skus, sapCodes, fys, qtrs] = await Promise.all([
        queryClickHouse(`SELECT DISTINCT toString(Seller_name) AS val FROM ${table} WHERE Seller_name IS NOT NULL AND toString(Seller_name) != '' AND toString(Seller_name) != '0' AND ${sellerClause} ORDER BY val`),
        queryClickHouse(`SELECT DISTINCT toString(pf_name) AS val FROM ${table} WHERE pf_name IS NOT NULL AND toString(pf_name) != '' AND toString(pf_name) != '0' AND ${platformClause} ORDER BY val`),
        queryClickHouse(`SELECT DISTINCT toString(brand_name) AS val FROM ${table} WHERE brand_name IS NOT NULL AND toString(brand_name) != '' AND toString(brand_name) != '0' AND ${brandClause} ORDER BY val`),
        queryClickHouse(`SELECT DISTINCT toString(\`Sub Brand\`) AS val FROM ${table} WHERE \`Sub Brand\` IS NOT NULL AND toString(\`Sub Brand\`) != '' AND toString(\`Sub Brand\`) != '0' AND ${subBrandClause} ORDER BY val`),
        queryClickHouse(`SELECT DISTINCT toString(SKU) AS val FROM ${table} WHERE SKU IS NOT NULL AND toString(SKU) != '' AND toString(SKU) != '0' AND ${skuClause} ORDER BY val`),
        queryClickHouse(`SELECT DISTINCT toString(\`DRL Sap Code\`) AS val FROM ${table} WHERE \`DRL Sap Code\` IS NOT NULL AND toString(\`DRL Sap Code\`) != '' AND toString(\`DRL Sap Code\`) != '0' AND ${sapCodeClause} ORDER BY val`),
        queryClickHouse(`SELECT DISTINCT toString(FY) AS val FROM ${table} WHERE FY IS NOT NULL AND toString(FY) != '' AND toString(FY) != '0' AND ${fyClause} ORDER BY val`),
        queryClickHouse(`SELECT DISTINCT toString(Qtr) AS val FROM ${table} WHERE Qtr IS NOT NULL AND toString(Qtr) != '' AND toString(Qtr) != '0' AND ${quarterClause} ORDER BY val`),
    ]);

    const formatList = (arr) => {
        const uniqueMap = new Map();
        arr.forEach(r => {
            if (!r.val) return;
            const str = String(r.val).trim();
            if (!str || str === '0' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') return;
            const formatted = str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            if (!uniqueMap.has(formatted.toLowerCase())) {
                uniqueMap.set(formatted.toLowerCase(), formatted);
            }
        });
        return Array.from(uniqueMap.values()).sort();
    };

    return {
        seller: formatList(sellers),
        platformName: formatList(platforms),
        brand: formatList(brands),
        subBrand: formatList(subBrands),
        sku: formatList(skus),
        sapCode: formatList(sapCodes),
        fiscalYear: formatList(fys),
        quarter: formatList(qtrs),
    };
};

export const getSecondaryLatestDate = async () => {
    const dbName = getCurrentDbName();
    const table = `${dbName}.rb_secondary_olap`;
    const query = `
        SELECT
            formatDateTime(MAX(toDate(date)), '%Y-%m-%d') AS max_date,
            formatDateTime(MIN(toDate(date)), '%Y-%m-%d') AS min_date
        FROM ${table}
        WHERE date IS NOT NULL
    `;
    const rows = await queryClickHouse(query);
    const maxDate = rows[0]?.max_date || '2026-08-02';
    const minDate = rows[0]?.min_date || '2022-04-01';

    const defaultStartDate = maxDate.substring(0, 7) + '-01';
    const defaultEndDate = maxDate;

    return {
        maxDate,
        minDate,
        defaultStartDate,
        defaultEndDate,
    };
};

/**
 * Format a numeric rupee value into a human-readable label (L / CR)
 */
const formatRupeeLabel = (val) => {
    if (val >= 1e7) return `${(val / 1e7).toFixed(2)}CR`;
    if (val >= 1e5) return `${(val / 1e5).toFixed(2)}L`;
    if (val >= 1e3) return `${(val / 1e3).toFixed(2)}K`;
    return `${val.toFixed(2)}`;
};

/**
 * GET Seller Wise Sales — donut + table breakdown
 * Returns top sellers by MRP sales or units, sorted descending
 */
export const getSecondarySellerWise = async (filters = {}, metricType = 'MRP') => {
    const dbName = getCurrentDbName();
    const table = `${dbName}.rb_secondary_olap`;
    const filterClause = buildFilterClause(filters);
    const metricCol = metricType === 'Units' ? 'qty' : '`MRP Sales Final`';

    const query = `
        SELECT
            toString(Seller_name) AS seller,
            COALESCE(SUM(toFloat64OrZero(toString(${metricCol}))), 0) AS value
        FROM ${table}
        WHERE Seller_name IS NOT NULL
          AND toString(Seller_name) != ''
          AND toString(Seller_name) != '0'
          AND date IS NOT NULL
          AND ${filterClause}
        GROUP BY seller
        ORDER BY value DESC
        LIMIT 10
    `;

    const rows = await queryClickHouse(query);
    const COLORS = ['#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5', '#4338ca'];
    const total = rows.reduce((acc, r) => acc + parseFloat(r.value || 0), 0);
    const toTitle = (s) => String(s || '').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

    return {
        total: formatRupeeLabel(total),
        totalRaw: total,
        items: rows.map((r, i) => ({
            name: toTitle(r.seller),
            value: parseFloat(r.value || 0),
            label: formatRupeeLabel(parseFloat(r.value || 0)),
            color: COLORS[i % COLORS.length],
        })),
    };
};

/**
 * GET Quarter Wise Sales — ranked list with QoQ growth and share %
 */
export const getSecondaryQuarterWise = async (filters = {}, metricType = 'MRP') => {
    const dbName = getCurrentDbName();
    const table = `${dbName}.rb_secondary_olap`;
    const filterClause = buildFilterClause(filters, true); // ignore date range — show all quarters
    const metricCol = metricType === 'Units' ? 'qty' : '`MRP Sales Final`';

    const query = `
        SELECT
            toString(FY) AS fy,
            toString(Qtr) AS qtr,
            COALESCE(SUM(toFloat64OrZero(toString(${metricCol}))), 0) AS value
        FROM ${table}
        WHERE date IS NOT NULL
          AND FY IS NOT NULL AND toString(FY) != '' AND toString(FY) != '0'
          AND Qtr IS NOT NULL AND toString(Qtr) != '' AND toString(Qtr) != '0'
          AND ${filterClause}
        GROUP BY fy, qtr
        ORDER BY fy ASC, qtr ASC
    `;

    const rows = await queryClickHouse(query);
    const fmtQtr = (qtr, fy) => `${String(qtr || '').toUpperCase()} ${String(fy || '').toUpperCase()}`;

    // Build chronological list for QoQ calculation
    const chronological = rows.map((r, i) => ({
        quarter: fmtQtr(r.qtr, r.fy),
        val: parseFloat(r.value || 0),
        prevVal: i > 0 ? parseFloat(rows[i - 1].value || 0) : null,
    }));

    const total = chronological.reduce((acc, r) => acc + r.val, 0);
    const maxVal = chronological.reduce((acc, r) => Math.max(acc, r.val), 0);

    // Build a map from quarter label -> QoQ so we can reference after sort
    const qoqMap = {};
    chronological.forEach(r => {
        const qoq = r.prevVal !== null && r.prevVal > 0
            ? (((r.val - r.prevVal) / r.prevVal) * 100).toFixed(1)
            : null;
        qoqMap[r.quarter] = qoq;
    });

    // Sort by value DESC for ranking
    const sorted = [...chronological].sort((a, b) => b.val - a.val);

    return {
        peak: formatRupeeLabel(maxVal),
        total: formatRupeeLabel(total),
        totalRaw: total,
        items: sorted.map((r, i) => {
            const qoq = qoqMap[r.quarter];
            const share = total > 0 ? ((r.val / total) * 100).toFixed(1) : '0.0';
            return {
                rank: `#${i + 1}`,
                quarter: r.quarter,
                val: r.val,
                label: formatRupeeLabel(r.val),
                qoq: qoq !== null ? `${parseFloat(qoq) >= 0 ? '+' : ''}${qoq}% QoQ` : null,
                qoqPositive: qoq !== null ? parseFloat(qoq) >= 0 : null,
                share: `${share}%`,
                shareRaw: parseFloat(share),
            };
        }),
        chronological: chronological.map(r => ({
            quarter: r.quarter,
            val: r.val,
            label: formatRupeeLabel(r.val),
        })),
    };
};

/**
 * GET Top 5 Brand Contribution — ranked list with share %
 */
export const getSecondaryTopBrands = async (filters = {}, metricType = 'MRP') => {
    const dbName = getCurrentDbName();
    const table = `${dbName}.rb_secondary_olap`;
    const filterClause = buildFilterClause(filters);
    const metricCol = metricType === 'Units' ? 'qty' : '`MRP Sales Final`';

    const query = `
        SELECT
            toString(brand_name) AS brand,
            COALESCE(SUM(toFloat64OrZero(toString(${metricCol}))), 0) AS value
        FROM ${table}
        WHERE brand_name IS NOT NULL
          AND toString(brand_name) != ''
          AND toString(brand_name) != '0'
          AND date IS NOT NULL
          AND ${filterClause}
        GROUP BY brand
        ORDER BY value DESC
        LIMIT 5
    `;

    const rows = await queryClickHouse(query);
    const total = rows.reduce((acc, r) => acc + parseFloat(r.value || 0), 0);
    const toTitle = (s) => String(s || '').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

    return {
        total: formatRupeeLabel(total),
        totalRaw: total,
        items: rows.map((r, i) => {
            const val = parseFloat(r.value || 0);
            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
            return {
                rank: `#${i + 1}`,
                name: toTitle(r.brand),
                val,
                label: `₹${formatRupeeLabel(val)}`,
                pct: `${pct}%`,
                tag: `+${pct}% Share`,
            };
        }),
    };
};

/**
 * GET MRP Sales / Units Timeline — monthly area/bar chart
 */
export const getSecondarySalesTimeline = async (filters = {}, metricType = 'MRP') => {
    const dbName = getCurrentDbName();
    const table = `${dbName}.rb_secondary_olap`;
    // Use date filters to make timeline dynamic
    const filterClause = buildFilterClause(filters);
    const metricCol = metricType === 'Units' ? 'qty' : '`MRP Sales Final`';

    console.log('[getSecondarySalesTimeline] Filters:', filters);
    console.log('[getSecondarySalesTimeline] Filter clause:', filterClause);

    const query = `
        SELECT
            toStartOfMonth(toDate(date)) AS month_start,
            formatDateTime(toStartOfMonth(toDate(date)), '%b-%y') AS month_label,
            COALESCE(SUM(toFloat64OrZero(toString(${metricCol}))), 0) AS value
        FROM ${table}
        WHERE date IS NOT NULL
          AND ${filterClause}
        GROUP BY month_start, month_label
        ORDER BY month_start ASC
    `;

    console.log('[getSecondarySalesTimeline] Query:', query);

    const rows = await queryClickHouse(query);
    console.log('[getSecondarySalesTimeline] Rows returned:', rows.length);

    return rows.map(r => ({
        month: r.month_label,
        value: parseFloat(r.value || 0),
        label: formatRupeeLabel(parseFloat(r.value || 0)),
    }));
};
