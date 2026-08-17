// src/services/primarySalesService.js
// Service for PRIMARY SUMMARY segment on Business Overview page
// Data source: drl_primary_sales_olap table in the user's DB
// Metric: SUM(amount_inr)

import { queryClickHouse, getCurrentDbName } from '../config/clickhouse.js';

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
const buildFilterClause = (filters, ignoreDates = false) => {
    const conditions = [];

    if (filters.location && filters.location !== 'All') {
        conditions.push(buildMultiCondition(filters.location, 'location'));
    }
    if (filters.brandName && filters.brandName !== 'All') {
        conditions.push(buildMultiCondition(filters.brandName, 'brand'));
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

    if (filters.monthYear && filters.monthYear !== 'All') {
        const myValues = String(filters.monthYear).split(',').map(v => v.trim()).filter(Boolean);
        if (myValues.length > 0) {
            if (myValues.length === 1) {
                conditions.push(`formatDateTime(toStartOfMonth(toDate(billing_date)), '%b-%y') = '${escapeCH(myValues[0])}'`);
            } else {
                conditions.push(`formatDateTime(toStartOfMonth(toDate(billing_date)), '%b-%y') IN (${myValues.map(v => `'${escapeCH(v)}'`).join(',')})`);
            }
        }
    }

    if (filters.fy && filters.fy !== 'All') {
        const fyValues = String(filters.fy).split(',').map(v => v.trim()).filter(Boolean);
        const fyConditions = [];
        fyValues.forEach(fyVal => {
            const fyMatch = fyVal.match(/FY(\d{4})-(\d{2})/i);
            if (fyMatch) {
                const startYear = fyMatch[1];
                const endYear = parseInt(startYear) + 1;
                fyConditions.push(`(toDate(billing_date) >= toDate('${startYear}-04-01') AND toDate(billing_date) <= toDate('${endYear}-03-31'))`);
            }
        });
        if (fyConditions.length > 0) {
            conditions.push(`(${fyConditions.join(' OR ')})`);
        }
    }

    if (!ignoreDates && filters.startDate && filters.endDate) {
        conditions.push(`toDate(billing_date) >= toDate('${escapeCH(filters.startDate)}') AND toDate(billing_date) <= toDate('${escapeCH(filters.endDate)}')`);
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

    if (excludeKey !== 'monthYear' && filters.monthYear && filters.monthYear !== 'All') {
        const myValues = String(filters.monthYear).split(',').map(v => v.trim()).filter(Boolean);
        if (myValues.length > 0) {
            if (myValues.length === 1) {
                conditions.push(`formatDateTime(toStartOfMonth(toDate(billing_date)), '%b-%y') = '${escapeCH(myValues[0])}'`);
            } else {
                conditions.push(`formatDateTime(toStartOfMonth(toDate(billing_date)), '%b-%y') IN (${myValues.map(v => `'${escapeCH(v)}'`).join(',')})`);
            }
        }
    }

    if (excludeKey !== 'fy' && filters.fy && filters.fy !== 'All') {
        const fyValues = String(filters.fy).split(',').map(v => v.trim()).filter(Boolean);
        const fyConditions = [];
        fyValues.forEach(fyVal => {
            const fyMatch = fyVal.match(/FY(\d{4})-(\d{2})/i);
            if (fyMatch) {
                const startYear = fyMatch[1];
                const endYear = parseInt(startYear) + 1;
                fyConditions.push(`(toDate(billing_date) >= toDate('${startYear}-04-01') AND toDate(billing_date) <= toDate('${endYear}-03-31'))`);
            }
        });
        if (fyConditions.length > 0) {
            conditions.push(`(${fyConditions.join(' OR ')})`);
        }
    }

    return conditions.length > 0 ? conditions.join(' AND ') : '1=1';
};

const getMetricColumn = (metricType) => {
    return metricType === 'Units' ? 'quantity' : 'COALESCE(amount_inr, net_amount * 100000)';
};

/**
 * Get PRIMARY KPI summary cards data (Total Sales, Total Units Sold, Growth rates)
 */
export const getPrimaryKpis = async (filters = {}) => {
    const dbName = getCurrentDbName();
    const table = `${dbName}.rb_primary_olap`;
    const filterClause = buildFilterClause(filters);

    const query = `
        SELECT
            COALESCE(SUM(toFloat64OrZero(toString(COALESCE(amount_inr, net_amount * 100000)))), 0) AS total_sales,
            COALESCE(SUM(toInt64OrZero(toString(quantity))), 0) AS total_units
        FROM ${table}
        WHERE billing_date IS NOT NULL
          AND ${filterClause}
    `;

    const rows = await queryClickHouse(query);
    const totalSales = parseFloat(rows[0]?.total_sales || 0);
    const totalUnits = parseInt(rows[0]?.total_units || 0);

    // Calculate latest month vs previous month growth
    const momQuery = `
        SELECT
            toStartOfMonth(toDate(billing_date)) AS month_start,
            COALESCE(SUM(toFloat64OrZero(toString(COALESCE(amount_inr, net_amount * 100000)))), 0) AS sales,
            COALESCE(SUM(toInt64OrZero(toString(quantity))), 0) AS units
        FROM ${table}
        WHERE billing_date IS NOT NULL
          AND ${filterClause}
        GROUP BY month_start
        ORDER BY month_start DESC
        LIMIT 2
    `;

    const momRows = await queryClickHouse(momQuery);
    let salesGrowth = 0;
    let unitsGrowth = 0;

    if (momRows.length >= 2) {
        const currSales = parseFloat(momRows[0].sales || 0);
        const prevSales = parseFloat(momRows[1].sales || 0);
        if (prevSales > 0) {
            salesGrowth = parseFloat((((currSales - prevSales) / prevSales) * 100).toFixed(2));
        }

        const currUnits = parseInt(momRows[0].units || 0);
        const prevUnits = parseInt(momRows[1].units || 0);
        if (prevUnits > 0) {
            unitsGrowth = parseFloat((((currUnits - prevUnits) / prevUnits) * 100).toFixed(2));
        }
    }

    return {
        totalSales,
        totalUnits,
        salesGrowth,
        unitsGrowth,
    };
};

/**
 * Get latest available billing dates in rb_primary_olap
 */
export const getPrimaryLatestDate = async () => {
    const dbName = getCurrentDbName();
    const table = `${dbName}.rb_primary_olap`;
    const query = `
        SELECT 
            formatDateTime(MAX(toDate(billing_date)), '%Y-%m-%d') AS max_date,
            formatDateTime(MIN(toDate(billing_date)), '%Y-%m-%d') AS min_date
        FROM ${table}
        WHERE billing_date IS NOT NULL
    `;
    const rows = await queryClickHouse(query);
    const maxDate = rows[0]?.max_date || '2026-07-30';
    const minDate = rows[0]?.min_date || '2024-04-01';
    
    // Default start date is 1st day of the max date month
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
 * Get PRIMARY MOM (Month-over-Month) bar chart data
 * Returns SUM(metricColumn) grouped by month
 */
export const getPrimaryMOM = async (filters = {}, metricType = 'MRP') => {
    const dbName = getCurrentDbName();
    const table = `${dbName}.rb_primary_olap`;
    const filterClause = buildFilterClause(filters, false);
    const metricColumn = getMetricColumn(metricType);

    const query = `
        SELECT
            toStartOfMonth(toDate(billing_date)) AS month_start,
            formatDateTime(toDate(billing_date), '%b-%y') AS month_label,
            COALESCE(SUM(toFloat64OrZero(toString(${metricColumn}))), 0) AS value
        FROM ${table}
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
 * Get PRIMARY Retailer Daily / MoM trend chart data for Retailer Wise Analysis
 */
export const getPrimaryRetailerDailyTrend = async (filters = {}, metricType = 'MRP') => {
    const dbName = getCurrentDbName();
    const table = `${dbName}.rb_primary_olap`;
    const filterClause = buildFilterClause(filters, false);
    const metricColumn = getMetricColumn(metricType);

    const query = `
        SELECT
            toDate(billing_date) AS date_val,
            formatDateTime(toDate(billing_date), '%d %b''%y') AS date_label,
            toString(customer_name) AS retailer,
            COALESCE(SUM(toFloat64OrZero(toString(${metricColumn}))), 0) AS value
        FROM ${table}
        WHERE billing_date IS NOT NULL
          AND customer_name IS NOT NULL
          AND toString(customer_name) != ''
          AND toString(customer_name) != '0'
          AND ${filterClause}
        GROUP BY date_val, date_label, retailer
        ORDER BY date_val ASC
    `;

    const rows = await queryClickHouse(query);
    return rows.map(r => ({
        date: r.date_label,
        dateVal: r.date_val,
        retailer: r.retailer,
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
    const dbName = getCurrentDbName();
    const table = `${dbName}.rb_primary_olap`;
    const filterClause = buildFilterClause(filters, false);
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
        FROM ${table}
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
    const dbName = getCurrentDbName();
    const table = `${dbName}.rb_primary_olap`;

    // Map frontend xAxis label to DB column
    const xAxisColumnMap = {
        'Retailer Name': 'customer_name',
        'Brand Name': 'brand',
        'Product': 'product_description',
        'Division': 'division',
        'Zone': 'zone',
    };
    const columnName = xAxisColumnMap[xAxis] || xAxis;

    // Build exact filter clause for the current period (respects exact startDate/endDate)
    const currentFilterClause = buildFilterClause(filters, false);

    // Build comparison period filter clause (prior full month)
    let compLabel = null;
    let compRows = [];
    if (filters.startDate) {
        const d = new Date(filters.startDate);
        d.setMonth(d.getMonth() - 1);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const compStart = `${yyyy}-${mm}-01`;
        const compEnd = `${yyyy}-${mm}-${new Date(yyyy, d.getMonth() + 1, 0).getDate()}`;
        compLabel = `${new Date(compStart).toLocaleString('default', { month: 'short' })}-${String(yyyy).slice(-2)}`;

        const compFilters = { ...filters, startDate: compStart, endDate: compEnd };
        const compFilterClause = buildFilterClause(compFilters, false);

        const compQuery = `
            SELECT
                toString(${columnName}) AS dimension_value,
                COALESCE(SUM(toFloat64OrZero(toString(COALESCE(amount_inr, net_amount * 100000)))), 0) AS sales_val,
                COALESCE(SUM(toInt64OrZero(toString(quantity))), 0) AS units_val
            FROM ${table}
            WHERE billing_date IS NOT NULL
              AND ${columnName} IS NOT NULL
              AND toString(${columnName}) != ''
              AND ${compFilterClause}
            GROUP BY dimension_value
            ORDER BY dimension_value ASC
        `;
        compRows = await queryClickHouse(compQuery);
    }

    // Build index of comparison data
    const compMap = {};
    compRows.forEach(r => {
        compMap[r.dimension_value || 'Unknown'] = {
            sales_val: parseFloat(r.sales_val || 0),
            units_val: parseFloat(r.units_val || 0),
        };
    });

    // Derive current period label from startDate month
    const userMonthLabel = filters.startDate
        ? (() => {
            const d = new Date(filters.startDate);
            return `${d.toLocaleString('default', { month: 'short' })}-${String(d.getFullYear()).slice(-2)}`;
          })()
        : null;

    // Query for exact current period
    const currentQuery = `
        SELECT
            toString(${columnName}) AS dimension_value,
            COALESCE(SUM(toFloat64OrZero(toString(COALESCE(amount_inr, net_amount * 100000)))), 0) AS sales_val,
            COALESCE(SUM(toInt64OrZero(toString(quantity))), 0) AS units_val
        FROM ${table}
        WHERE billing_date IS NOT NULL
          AND ${columnName} IS NOT NULL
          AND toString(${columnName}) != ''
          AND ${currentFilterClause}
        GROUP BY dimension_value
        ORDER BY dimension_value ASC
    `;

    const currentRows = await queryClickHouse(currentQuery);

    // Merge current + comparison into pivot rows
    const pivotMap = {};

    // Add all entities from current period
    currentRows.forEach(r => {
        const dim = r.dimension_value || 'Unknown';
        const sVal = parseFloat(r.sales_val || 0);
        const uVal = parseFloat(r.units_val || 0);
        const comp = compMap[dim] || { sales_val: 0, units_val: 0 };

        pivotMap[dim] = {
            name: dim,
            rawName: dim,
            sales_total: sVal,
            units_total: uVal,
        };

        // Current period columns
        if (userMonthLabel) {
            pivotMap[dim][userMonthLabel] = metricType === 'Units' ? uVal : sVal;
            pivotMap[dim][userMonthLabel + '_sales'] = sVal;
            pivotMap[dim][userMonthLabel + '_units'] = uVal;
        }

        // Comparison period columns
        if (compLabel) {
            pivotMap[dim][compLabel] = metricType === 'Units' ? comp.units_val : comp.sales_val;
            pivotMap[dim][compLabel + '_sales'] = comp.sales_val;
            pivotMap[dim][compLabel + '_units'] = comp.units_val;
        }
    });

    // Also add entities that ONLY appear in comparison period (not current) — for drainers
    compRows.forEach(r => {
        const dim = r.dimension_value || 'Unknown';
        if (!pivotMap[dim]) {
            const comp = compMap[dim] || { sales_val: 0, units_val: 0 };
            pivotMap[dim] = {
                name: dim,
                rawName: dim,
                sales_total: 0,
                units_total: 0,
            };
            if (userMonthLabel) {
                pivotMap[dim][userMonthLabel] = 0;
                pivotMap[dim][userMonthLabel + '_sales'] = 0;
                pivotMap[dim][userMonthLabel + '_units'] = 0;
            }
            if (compLabel) {
                pivotMap[dim][compLabel] = metricType === 'Units' ? comp.units_val : comp.sales_val;
                pivotMap[dim][compLabel + '_sales'] = comp.sales_val;
                pivotMap[dim][compLabel + '_units'] = comp.units_val;
            }
        }
    });

    const sortedMonths = userMonthLabel ? [userMonthLabel] : [];
    const allSortedMonths = compLabel ? [compLabel, ...(userMonthLabel ? [userMonthLabel] : [])] : sortedMonths;

    const tableData = Object.values(pivotMap);

    // Sort by sales_total descending
    tableData.sort((a, b) => (b.sales_total || 0) - (a.sales_total || 0));

    return {
        months: sortedMonths,
        allMonths: allSortedMonths,
        data: tableData,
    };
};


/**
 * Get filter options for the PRIMARY SUMMARY segment
 * Returns distinct values for each filter dropdown
 */
export const getPrimaryFilterOptions = async (filters = {}) => {
    const dbName = getCurrentDbName();
    const table = `${dbName}.rb_primary_olap`;

    const brandClause = buildFilterClauseExcluding(filters, 'brandName');
    const retailerClause = buildFilterClauseExcluding(filters, 'retailerName');
    const productClause = buildFilterClauseExcluding(filters, 'product');
    const divisionClause = buildFilterClauseExcluding(filters, 'division');
    const zoneClause = buildFilterClauseExcluding(filters, 'zone');
    const locationClause = buildFilterClauseExcluding(filters, 'location');

    const [brands, retailers, products, divisions, zones, locations, monthYears] = await Promise.all([
        queryClickHouse(`SELECT DISTINCT toString(brand) AS val FROM ${table} WHERE brand IS NOT NULL AND toString(brand) != '' AND toString(brand) != '0' AND ${brandClause} ORDER BY val`),
        queryClickHouse(`SELECT DISTINCT toString(customer_name) AS val FROM ${table} WHERE customer_name IS NOT NULL AND toString(customer_name) != '' AND toString(customer_name) != '0' AND ${retailerClause} ORDER BY val`),
        queryClickHouse(`SELECT DISTINCT toString(product_description) AS val FROM ${table} WHERE product_description IS NOT NULL AND toString(product_description) != '' AND toString(product_description) != '0' AND ${productClause} ORDER BY val`),
        queryClickHouse(`SELECT DISTINCT toString(division) AS val FROM ${table} WHERE division IS NOT NULL AND toString(division) != '' AND toString(division) != '0' AND ${divisionClause} ORDER BY val`),
        queryClickHouse(`SELECT DISTINCT toString(zone) AS val FROM ${table} WHERE zone IS NOT NULL AND toString(zone) != '' AND toString(zone) != '0' AND ${zoneClause} ORDER BY val`),
        queryClickHouse(`SELECT DISTINCT toString(location) AS val FROM ${table} WHERE location IS NOT NULL AND toString(location) != '' AND toString(location) != '0' AND ${locationClause} ORDER BY val`),
        queryClickHouse(`SELECT DISTINCT formatDateTime(toStartOfMonth(toDate(billing_date)), '%b-%y') AS val, toStartOfMonth(toDate(billing_date)) AS m_start FROM ${table} WHERE billing_date IS NOT NULL ORDER BY m_start ASC`),
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

    const brandList = formatList(brands);
    const retailerList = formatList(retailers);
    const productList = formatList(products);
    const divisionList = formatList(divisions);
    const zoneList = formatList(zones);
    const locationList = formatList(locations);
    const monthYearList = monthYears.map(r => r.val).filter(Boolean);
    const fyList = ["FY2022-23", "FY2023-24", "FY2024-25", "FY2025-26", "FY2026-27"];

    return {
        brandName: brandList,
        brands: brandList,
        retailerName: retailerList,
        retailers: retailerList,
        product: productList,
        products: productList,
        division: divisionList,
        divisions: divisionList,
        zone: zoneList,
        zones: zoneList,
        location: locationList,
        locations: locationList,
        monthYears: monthYearList,
        monthYear: monthYearList,
        fyList: fyList,
        fy: fyList,
        channel: [],
        platform: [],
    };
};

/**
 * Get top products or sub-items for a specific entity (Retailer/Brand/Product/Division/Zone)
 * Supports multi-level hierarchical drilldowns: Retailer -> Zone -> Division -> Brand -> Product
 */
export const getPrimaryTopProducts = async (
    filters = {},
    entityName = '',
    xAxis = 'Retailer Name',
    metricType = 'MRP',
    targetLevel = '',
    retailerName = '',
    zoneName = '',
    divisionName = '',
    brandName = ''
) => {
    const dbName = getCurrentDbName();
    const table = `${dbName}.rb_primary_olap`;

    let parentCol = 'customer_name';
    let targetCol = 'product_description';

    const normalizedX = (xAxis || '').toLowerCase();

    if (targetLevel) {
        // Map targetLevel to actual DB column names
        const targetLevelMap = {
            'product': 'product_description',
            'brand': 'brand',
            'division': 'division',
            'zone': 'zone',
            'retailer': 'customer_name',
        };
        targetCol = targetLevelMap[targetLevel.toLowerCase()] || targetLevel;
    } else {
        if (normalizedX.includes('brand')) {
            parentCol = 'brand';
            targetCol = 'product_description';
        } else if (normalizedX.includes('product')) {
            parentCol = 'product_description';
            targetCol = 'customer_name';
        } else if (normalizedX.includes('division')) {
            parentCol = 'division';
            targetCol = 'product_description';
        } else if (normalizedX.includes('zone')) {
            parentCol = 'zone';
            targetCol = 'division';
        } else {
            parentCol = 'customer_name';
            targetCol = 'zone';
        }
    }

    // Keep base filters (dates, location, channel, platform) but strip dimension filters
    // since those are applied via parentConditions below
    const scopedFilters = { ...filters };
    delete scopedFilters.retailerName;
    delete scopedFilters.zone;
    delete scopedFilters.division;
    delete scopedFilters.brandName;
    delete scopedFilters.product;

    const metricColumn = getMetricColumn(metricType);
    const filterClause = buildFilterClause(scopedFilters, false);

    // Build hierarchical parent conditions
    let parentConditions = '';
    if (retailerName) {
        const cleanName = escapeCH(retailerName.trim());
        parentConditions += ` AND (lower(trim(toString(customer_name))) = lower(trim('${cleanName}')) OR lower(toString(customer_name)) LIKE lower('${cleanName}%'))`;
    }
    if (zoneName) {
        const cleanZone = escapeCH(zoneName.trim());
        parentConditions += ` AND lower(trim(toString(zone))) = lower(trim('${cleanZone}'))`;
    }
    if (divisionName) {
        const cleanDiv = escapeCH(divisionName.trim());
        parentConditions += ` AND lower(trim(toString(division))) = lower(trim('${cleanDiv}'))`;
    }
    if (brandName) {
        const cleanBrand = escapeCH(brandName.trim());
        parentConditions += ` AND lower(trim(toString(brand))) = lower(trim('${cleanBrand}'))`;
    }

    // Fallback if no specific parent level conditions were passed but entityName was
    if (!parentConditions && entityName) {
        if (normalizedX.includes('brand')) parentCol = 'brand';
        else if (normalizedX.includes('product')) parentCol = 'product_description';
        else if (normalizedX.includes('division')) parentCol = 'division';
        else if (normalizedX.includes('zone')) parentCol = 'zone';
        else parentCol = 'customer_name';

        const cleanEntity = escapeCH(entityName.trim());
        parentConditions = ` AND (lower(trim(toString(${parentCol}))) = lower(trim('${cleanEntity}')) OR lower(toString(${parentCol})) LIKE lower('${cleanEntity}%'))`;
    }

    const query = `
        SELECT
            toString(${targetCol}) AS sub_name,
            COALESCE(SUM(toFloat64OrZero(toString(COALESCE(amount_inr, net_amount * 100000)))), 0) AS sales_val,
            COALESCE(SUM(toInt64OrZero(toString(quantity))), 0) AS units_val
        FROM ${table}
        WHERE ${targetCol} IS NOT NULL
          AND toString(${targetCol}) != ''
          AND toString(${targetCol}) != '0'
          AND ${filterClause}
          ${parentConditions}
        GROUP BY sub_name
        ORDER BY sales_val DESC
        LIMIT 10
    `;

    const rows = await queryClickHouse(query);
    return rows.map(r => ({
        name: r.sub_name ? r.sub_name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : 'Unknown',
        val: parseFloat(r.sales_val || 0),
        unitsVal: parseFloat(r.units_val || 0),
        rawName: r.sub_name,
    }));
};
