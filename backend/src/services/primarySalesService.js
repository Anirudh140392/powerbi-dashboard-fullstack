// src/services/primarySalesService.js
// Service for PRIMARY SUMMARY segment on Business Overview page
// Data source: rb_primary_olap table in the user's DB
// Metric: SUM(amount_inr)

import { queryClickHouse } from '../config/clickhouse.js';

/**
 * Escape ClickHouse string values
 */
const escapeCH = (str) => String(str || '').replace(/'/g, "''");

/**
 * Build a multi-select WHERE condition for ClickHouse
 * Handles 'All' and comma-separated values
 */
const buildMultiCondition = (value, column) => {
    if (!value || value === 'All') return '1=1';
    const values = String(value).split(',').map(v => v.trim()).filter(Boolean);
    if (values.length === 0) return '1=1';
    if (values.length === 1) {
        return `lower(toString(${column})) = lower('${escapeCH(values[0])}')`;
    }
    return `lower(toString(${column})) IN (${values.map(v => `lower('${escapeCH(v)}')`).join(',')})`;
};

/**
 * Build the common WHERE clause from filters
 * Filter mapping:
 *   location     -> location
 *   timeperiod   -> billing_date
 *   brandName    -> brand
 *   channel      -> channel
 *   platform     -> platform
 *   retailerName -> customer_name
 *   product      -> product_description (using description for human-readable names)
 *   division     -> division
 *   zone         -> zone
 */
const buildFilterClause = (filters) => {
    const conditions = [];

    if (filters.location && filters.location !== 'All') {
        conditions.push(buildMultiCondition(filters.location, 'location'));
    }
    if (filters.brandName && filters.brandName !== 'All') {
        conditions.push(buildMultiCondition(filters.brandName, 'brand'));
    }
    if (filters.channel && filters.channel !== 'All') {
        conditions.push(buildMultiCondition(filters.channel, 'channel'));
    }
    if (filters.platform && filters.platform !== 'All') {
        conditions.push(buildMultiCondition(filters.platform, 'platform'));
    }
    if (filters.retailerName && filters.retailerName !== 'All') {
        conditions.push(buildMultiCondition(filters.retailerName, 'customer_name'));
    }
    if (filters.product && filters.product !== 'All') {
        conditions.push(buildMultiCondition(filters.product, 'product_description'));
    }
    if (filters.division && filters.division !== 'All') {
        conditions.push(buildMultiCondition(filters.division, 'division'));
    }
    if (filters.zone && filters.zone !== 'All') {
        conditions.push(buildMultiCondition(filters.zone, 'zone'));
    }

    return conditions.length > 0 ? conditions.join(' AND ') : '1=1';
};

/**
 * Build WHERE clause from filters excluding a specific key
 */
const buildFilterClauseExcluding = (filters, excludeKey) => {
    const conditions = [];

    if (excludeKey !== 'location' && filters.location && filters.location !== 'All') {
        conditions.push(buildMultiCondition(filters.location, 'location'));
    }
    if (excludeKey !== 'brandName' && filters.brandName && filters.brandName !== 'All') {
        conditions.push(buildMultiCondition(filters.brandName, 'brand'));
    }
    if (excludeKey !== 'channel' && filters.channel && filters.channel !== 'All') {
        conditions.push(buildMultiCondition(filters.channel, 'channel'));
    }
    if (excludeKey !== 'platform' && filters.platform && filters.platform !== 'All') {
        conditions.push(buildMultiCondition(filters.platform, 'platform'));
    }
    if (excludeKey !== 'retailerName' && filters.retailerName && filters.retailerName !== 'All') {
        conditions.push(buildMultiCondition(filters.retailerName, 'customer_name'));
    }
    if (excludeKey !== 'product' && filters.product && filters.product !== 'All') {
        conditions.push(buildMultiCondition(filters.product, 'product_description'));
    }
    if (excludeKey !== 'division' && filters.division && filters.division !== 'All') {
        conditions.push(buildMultiCondition(filters.division, 'division'));
    }
    if (excludeKey !== 'zone' && filters.zone && filters.zone !== 'All') {
        conditions.push(buildMultiCondition(filters.zone, 'zone'));
    }

    return conditions.length > 0 ? conditions.join(' AND ') : '1=1';
};

const getMetricColumn = (metricType) => {
    return metricType === 'Units' ? 'quantity' : 'amount_inr';
};

/**
 * Get PRIMARY MOM (Month-over-Month) bar chart data
 * Returns SUM(metricColumn) grouped by month
 */
export const getPrimaryMOM = async (filters = {}, metricType = 'MRP') => {
    const filterClause = buildFilterClause(filters);
    const metricColumn = getMetricColumn(metricType);

    const query = `
        SELECT
            toStartOfMonth(toDate(billing_date)) AS month_start,
            formatDateTime(toDate(billing_date), '%b-%y') AS month_label,
            COALESCE(SUM(toFloat64OrZero(toString(${metricColumn}))), 0) AS value
        FROM rb_primary_olap
        WHERE billing_date IS NOT NULL
          AND ${filterClause}
        GROUP BY month_start, month_label
        ORDER BY month_start ASC
    `;

    const rows = await queryClickHouse(query);

    return rows.map(r => ({
        month: r.month_label,
        monthStart: r.month_start,
        value: parseFloat(r.value || 0),
    }));
};


/**
 * Get QUARTER WISE PRIMARY DATA bar chart data
 * Financial year quarter mapping:
 *   Apr - Jun = Q1
 *   Jul - Sep = Q2
 *   Oct - Dec = Q3
 *   Jan - Mar = Q4
 * Label format: "Q1 FY2026-27" etc.
 */
export const getPrimaryQuarterly = async (filters = {}, metricType = 'MRP') => {
    const filterClause = buildFilterClause(filters);
    const metricColumn = getMetricColumn(metricType);

    // Use ClickHouse month extraction and map to FY quarters
    // Financial year: Apr(4) of year Y to Mar(3) of year Y+1
    // Month 4-6  -> Q1, Month 7-9  -> Q2, Month 10-12 -> Q3, Month 1-3  -> Q4
    const query = `
        SELECT
            CASE
                WHEN toMonth(toDate(billing_date)) BETWEEN 4 AND 6 THEN 1
                WHEN toMonth(toDate(billing_date)) BETWEEN 7 AND 9 THEN 2
                WHEN toMonth(toDate(billing_date)) BETWEEN 10 AND 12 THEN 3
                ELSE 4
            END AS fy_quarter,
            CASE
                WHEN toMonth(toDate(billing_date)) >= 4 THEN toYear(toDate(billing_date))
                ELSE toYear(toDate(billing_date)) - 1
            END AS fy_start_year,
            COALESCE(SUM(toFloat64OrZero(toString(${metricColumn}))), 0) AS value
        FROM rb_primary_olap
        WHERE billing_date IS NOT NULL
          AND ${filterClause}
        GROUP BY fy_quarter, fy_start_year
        ORDER BY fy_start_year ASC, fy_quarter ASC
    `;

    const rows = await queryClickHouse(query);

    return rows.map(r => {
        const fyStart = parseInt(r.fy_start_year);
        const fyEnd = (fyStart + 1) % 100; // last 2 digits of next year
        const qNum = parseInt(r.fy_quarter);
        return {
            quarter: `Q${qNum} FY${fyStart}-${String(fyEnd).padStart(2, '0')}`,
            fyStartYear: fyStart,
            fyQuarter: qNum,
            value: parseFloat(r.value || 0),
        };
    });
};


/**
 * Get BRAND WISE PRIMARY pivot table data
 * X-axis can be: customer_name (Retailer Name), brand (Brand Name),
 *   product_description (Product), division (Division), zone (Zone)
 * Returns rows grouped by the chosen dimension, with monthly columns
 */
export const getPrimaryPivotTable = async (filters = {}, xAxis = 'customer_name', metricType = 'MRP') => {
    const filterClause = buildFilterClause(filters);
    const metricColumn = getMetricColumn(metricType);

    // Map frontend xAxis label to DB column
    const xAxisColumnMap = {
        'Retailer Name': 'customer_name',
        'Brand Name': 'brand',
        'Product': 'product_description',
        'Division': 'division',
        'Zone': 'zone',
    };
    const columnName = xAxisColumnMap[xAxis] || xAxis;

    const query = `
        SELECT
            toString(${columnName}) AS dimension_value,
            formatDateTime(toStartOfMonth(toDate(billing_date)), '%b-%y') AS month_label,
            toStartOfMonth(toDate(billing_date)) AS month_start,
            COALESCE(SUM(toFloat64OrZero(toString(${metricColumn}))), 0) AS value
        FROM rb_primary_olap
        WHERE billing_date IS NOT NULL
          AND ${columnName} IS NOT NULL
          AND toString(${columnName}) != ''
          AND ${filterClause}
        GROUP BY dimension_value, month_label, month_start
        ORDER BY dimension_value ASC, month_start ASC
    `;

    const rows = await queryClickHouse(query);

    // Collect all unique months (ordered)
    const monthSet = new Map(); // month_start -> month_label
    rows.forEach(r => {
        if (!monthSet.has(r.month_start)) {
            monthSet.set(r.month_start, r.month_label);
        }
    });

    // Sort months chronologically
    const sortedMonths = [...monthSet.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, label]) => label);

    // Build pivot: { dimensionValue -> { monthLabel -> value } }
    const pivotMap = {};
    rows.forEach(r => {
        const dim = r.dimension_value || 'Unknown';
        if (!pivotMap[dim]) {
            pivotMap[dim] = { name: dim };
        }
        pivotMap[dim][r.month_label] = parseFloat(r.value || 0);
    });

    // Fill missing months with null
    const tableData = Object.values(pivotMap).map(row => {
        sortedMonths.forEach(m => {
            if (row[m] === undefined) row[m] = null;
        });
        return row;
    });

    // Sort rows by total value descending
    tableData.sort((a, b) => {
        const totalA = sortedMonths.reduce((sum, m) => sum + (a[m] || 0), 0);
        const totalB = sortedMonths.reduce((sum, m) => sum + (b[m] || 0), 0);
        return totalB - totalA;
    });

    return {
        months: sortedMonths,
        data: tableData,
    };
};


/**
 * Get filter options for the PRIMARY SUMMARY segment
 * Returns distinct values for each filter dropdown
 */
export const getPrimaryFilterOptions = async (filters = {}) => {
    const brandClause = buildFilterClauseExcluding(filters, 'brandName');
    const retailerClause = buildFilterClauseExcluding(filters, 'retailerName');
    const productClause = buildFilterClauseExcluding(filters, 'product');
    const divisionClause = buildFilterClauseExcluding(filters, 'division');
    const zoneClause = buildFilterClauseExcluding(filters, 'zone');
    const locationClause = buildFilterClauseExcluding(filters, 'location');
    const channelClause = buildFilterClauseExcluding(filters, 'channel');
    const platformClause = buildFilterClauseExcluding(filters, 'platform');

    const [brands, retailers, products, divisions, zones, locations, channels, platforms] = await Promise.all([
        queryClickHouse(`SELECT DISTINCT toString(brand) AS val FROM rb_primary_olap WHERE brand IS NOT NULL AND toString(brand) != '' AND ${brandClause} ORDER BY val`),
        queryClickHouse(`SELECT DISTINCT toString(customer_name) AS val FROM rb_primary_olap WHERE customer_name IS NOT NULL AND toString(customer_name) != '' AND ${retailerClause} ORDER BY val`),
        queryClickHouse(`SELECT DISTINCT toString(product_description) AS val FROM rb_primary_olap WHERE product_description IS NOT NULL AND toString(product_description) != '' AND ${productClause} ORDER BY val`),
        queryClickHouse(`SELECT DISTINCT toString(division) AS val FROM rb_primary_olap WHERE division IS NOT NULL AND toString(division) != '' AND ${divisionClause} ORDER BY val`),
        queryClickHouse(`SELECT DISTINCT toString(zone) AS val FROM rb_primary_olap WHERE zone IS NOT NULL AND toString(zone) != '' AND ${zoneClause} ORDER BY val`),
        queryClickHouse(`SELECT DISTINCT toString(location) AS val FROM rb_primary_olap WHERE location IS NOT NULL AND toString(location) != '' AND ${locationClause} ORDER BY val`),
        queryClickHouse(`SELECT DISTINCT toString(channel) AS val FROM rb_primary_olap WHERE channel IS NOT NULL AND toString(channel) != '' AND ${channelClause} ORDER BY val`),
        queryClickHouse(`SELECT DISTINCT toString(platform) AS val FROM rb_primary_olap WHERE platform IS NOT NULL AND toString(platform) != '' AND ${platformClause} ORDER BY val`),
    ]);

    return {
        brandName: brands.map(r => r.val).filter(Boolean),
        retailerName: retailers.map(r => r.val).filter(Boolean),
        product: products.map(r => r.val).filter(Boolean),
        division: divisions.map(r => r.val).filter(Boolean),
        zone: zones.map(r => r.val).filter(Boolean),
        location: locations.map(r => r.val).filter(Boolean),
        channel: channels.map(r => r.val).filter(Boolean),
        platform: platforms.map(r => r.val).filter(Boolean),
    };
};
