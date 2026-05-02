/**
 * Availability Analysis Service - ClickHouse Version
 * Migrated from Sequelize/MySQL to native ClickHouse client
 */

import dayjs from 'dayjs';
import { queryClickHouse, getCurrentDbName } from '../config/clickhouse.js';
import { getCachedOrCompute, generateCacheKey, CACHE_TTL } from '../utils/cacheHelper.js';
import { getTableColumns, columnExists, resolveColumn } from '../utils/schemaHelper.js';

/**
 * Helper to get table column mappings based on the current tenant's database.
 * This handles inconsistencies in column naming/casing across different ClickHouse DBs.
 */
const getColumnMapping = (dbName) => {
    const isMars = !['colpal', 'gcpl', 'cinthol'].includes(dbName);
    // Default mappings (based on colpal/gcpl)
    const mapping = {
        rca_sku_dim: {
            category: (isMars || dbName === 'colpal' || dbName === 'gcpl') ? 'category' : 'category'
        },
        rb_sku_platform: {
            brand_name: isMars ? 'brand' : 'brand_name',
            category: isMars ? 'product_category' : 'Product_type',
            format: isMars ? 'product_category' : 'Category'
        }
    };
    // Ensure rca_sku_dim category is correct for all
    if (dbName === 'colpal' || dbName === 'gcpl') {
        mapping.rca_sku_dim.category = 'Category';
    }
    return mapping;
};

/**
 * Dynamically resolve rb_sku_platform column names by querying the DB schema.
 * This replaces the hardcoded getColumnMapping() approach for rb_sku_platform
 * and works across all DB schemas (mamaearth, mars, colpal, gcpl, etc.).
 */
const getSkuPlatformColumns = async () => {
    const skuPlatCols = await getTableColumns('rb_sku_platform');
    const findCol = (possibleNames) => {
        for (const name of possibleNames) {
            if (columnExists(skuPlatCols, name)) return resolveColumn(skuPlatCols, name);
        }
        return possibleNames[0]; // fallback to first candidate
    };
    return {
        brandCol: findCol(['brand_name', 'brand']),
        categoryCol: findCol(['brand_category', 'sub_category', 'product_category', 'Product_type', 'Category'])
    };
};


// Helper to escape string for SQL
const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

/**
 * Helper to build platform condition based on channel selection
 * @param {string} platform - The selected platform (e.g. 'All', 'Blinkit')
 * @param {string} channel - The selected channel (e.g. 'Ecommerce', 'QuickComm')
 * @param {string} prefix - Table prefix (e.g. 't1.' or '')
 * @returns {Promise<string|null>} - The SQL condition for platform/channel
 */
export const buildPlatformChannelCond = async (platform, channel, prefix = '') => {
    let pArr = [];
    if (platform && platform !== 'All') {
        pArr = Array.isArray(platform) ? platform : [platform];
    } else if (channel && channel !== 'All') {
        try {
            // Dynamically resolve valid platforms for this channel using rca_sku_dim
            // Handle variations like 'Ecom', 'Ecommerce', 'Quickcomm'
            const isEcom = channel.toLowerCase().includes('ecom') || channel.toLowerCase().includes('e-com');
            const searchPattern = isEcom ? '%ecom%' : (channel.toLowerCase().includes('quick') ? '%quick%' : `%${escapeStr(channel.toLowerCase())}%`);
            
            const cols = await getTableColumns('rca_sku_dim');
            const platformCol = resolveColumn(cols, 'platform');
            const channelCol = resolveColumn(cols, 'channel');
            const hasChannel = columnExists(cols, 'channel');
            
            if (hasChannel) {
                const plats = await queryClickHouse(`SELECT DISTINCT ${platformCol} as platform FROM rca_sku_dim WHERE lower(${channelCol}) LIKE '${searchPattern}'`);
                if (plats && plats.length > 0) {
                    pArr = plats.map(r => r.platform).filter(Boolean);
                }
            }
        } catch (error) {
            console.error(`[buildPlatformChannelCond] Failed to fetch platforms for channel ${channel}:`, error.message);
        }
    }

    if (pArr.length > 0) {
        return `lower(replace(${prefix}Platform, ' ', '_')) IN (${pArr.map(p => `'${escapeStr(p.toLowerCase().replace(/\s+/g, '_'))}'`).join(',')})`;
    }
    
    // Fallback if no platforms resolved but channel is selected (prevent empty return which acts as NO filter)
    if (channel && channel !== 'All') {
        const isEcom = channel.toLowerCase().includes('ecom') || channel.toLowerCase().includes('e-com');
        const searchPattern = isEcom ? '%ecom%' : (channel.toLowerCase().includes('quick') ? '%quick%' : `%${escapeStr(channel.toLowerCase())}%`);
        
        try {
            // Try identifying if rb_pdp_olap has a channel column safely
            const rbpCols = await getTableColumns('rb_pdp_olap');
            if (columnExists(rbpCols, 'channel')) {
                const rbpChannelCol = resolveColumn(rbpCols, 'channel');
                return `lower(${prefix}${rbpChannelCol}) LIKE '${searchPattern}'`;
            }
        } catch (e) {
            console.error(`[buildPlatformChannelCond] fallback col resolution failed:`, e.message);
        }
        
        return null;
    }

    return null;
};

/**
 * Robust helper to build WHERE clause for availability queries.
 * Supports all advanced filters and correctly handles arrays.
 */
const buildAvailabilityWhereClause = async (filters, tableAlias = '') => {
    let {
        platform, brand, location, startDate, endDate, dates, months,
        cities, categories, formats, zones, metroFlags, pincodes, productCategory, sku, skus, ownBrandsOnly,
        dimension, dimensionValue
    } = filters;

    // Dashboard drill-down dimension overrides have been removed here.
    // The frontend (TrendsCompetitionDrawer) now fully aggregates all filters
    // (global context, selected column, and manual drawer changes) and explicitly
    // passes them in standard params (platform, brand, category, sku, etc).

    const conditions = [];

    const prefix = tableAlias ? `${tableAlias}.` : '';

    // Standard filters with Channel Support
    const platformCond = await buildPlatformChannelCond(platform, filters.channel, prefix);
    if (platformCond) {
        conditions.push(platformCond);
    }

    if (brand && brand !== 'All') {
        const bArr = Array.isArray(brand) ? brand : [brand];
        conditions.push(`lower(replace(${prefix}Brand, ' ', '_')) IN (${bArr.map(b => `'${escapeStr(b.toLowerCase().replace(/\s+/g, '_'))}'`).join(',')})`);
    }

    // City/Location filter
    const lArr = [];
    const isAllIndia = (val) => val === 'All' || val === 'all' || val === 'All India' || val === 'all india' || val === 'all_india';

    if (location && !isAllIndia(location)) {
        if (Array.isArray(location)) {
            const filtered = location.filter(v => v && !isAllIndia(v));
            lArr.push(...filtered);
        } else {
            lArr.push(location);
        }
    }
    if (cities && !isAllIndia(cities)) {
        if (Array.isArray(cities)) {
            const filtered = cities.filter(v => v && !isAllIndia(v));
            lArr.push(...filtered);
        } else {
            lArr.push(cities);
        }
    }
    // Backward compatibility for 'city' key
    if (filters.city && !isAllIndia(filters.city)) {
        if (Array.isArray(filters.city)) {
            const filtered = filters.city.filter(v => v && !isAllIndia(v));
            lArr.push(...filtered);
        } else {
            lArr.push(filters.city);
        }
    }

    if (lArr.length > 0) {
        const uniqueLArr = [...new Set(lArr)];
        conditions.push(`lower(replace(${prefix}Location, ' ', '_')) IN (${uniqueLArr.map(l => `'${escapeStr(l.toLowerCase().replace(/\s+/g, '_'))}'`).join(',')})`);
    }

    // Dynamically resolve columns and check tables once
    const pdpColsMap = await getTableColumns('rb_pdp_olap');
    const actualCatCol = resolveColumn(pdpColsMap, 'Category', 'Category');
    const actualPcCol = resolveColumn(pdpColsMap, 'Product_type', 'Product_type');

    let hasDarkstoreTable = false;
    if ((zones && zones !== 'All') || (metroFlags && metroFlags !== 'All') || (pincodes && pincodes !== 'All')) {
        try {
            const check = await queryClickHouse(`EXISTS TABLE rb_location_darkstore`);
            hasDarkstoreTable = (Number(check?.[0]?.result) === 1);
        } catch (e) {
            hasDarkstoreTable = false;
        }
    }

    // Category/Format filter
    const cArr = [];
    if (categories && categories !== 'All') {
        if (Array.isArray(categories)) {
            const filtered = categories.filter(v => v !== 'All' && v !== 'all');
            cArr.push(...filtered);
        } else {
            cArr.push(categories);
        }
    }
    if (formats && formats !== 'All') {
        if (Array.isArray(formats)) {
            const filtered = formats.filter(v => v !== 'All' && v !== 'all');
            cArr.push(...filtered);
        } else {
            cArr.push(formats);
        }
    }
    // Backward compatibility for 'category' and 'format' keys
    if (filters.category && filters.category !== 'All') {
        if (Array.isArray(filters.category)) {
            const filtered = filters.category.filter(v => v !== 'All' && v !== 'all');
            cArr.push(...filtered);
        } else {
            cArr.push(filters.category);
        }
    }
    if (filters.format && filters.format !== 'All') {
        if (Array.isArray(filters.format)) {
            const filtered = filters.format.filter(v => v !== 'All' && v !== 'all');
            cArr.push(...filtered);
        } else {
            cArr.push(filters.format);
        }
    }

    if (cArr.length > 0) {
        const uniqueCArr = [...new Set(cArr)];
        conditions.push(`lower(trim(BOTH '\t\\n ' FROM ${prefix}${actualCatCol})) IN (${uniqueCArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(',')})`);
    }

    // Product Category filter
    const pcArr = [];
    if (productCategory && productCategory !== 'All') {
        if (Array.isArray(productCategory)) {
            const filtered = productCategory.filter(v => v !== 'All' && v !== 'all');
            pcArr.push(...filtered);
        } else {
            pcArr.push(productCategory);
        }
    }
    if (filters.productCategory && !productCategory) { // Handle case where it's not array destructured
        if (Array.isArray(filters.productCategory)) {
            const filtered = filters.productCategory.filter(v => v !== 'All' && v !== 'all');
            pcArr.push(...filtered);
        } else if (filters.productCategory !== 'All' && filters.productCategory !== 'all') {
            pcArr.push(filters.productCategory);
        }
    }

    if (pcArr.length > 0) {
        const uniquePcArr = [...new Set(pcArr)];
        conditions.push(`lower(trim(BOTH '\t\n ' FROM ${prefix}${actualPcCol})) IN (${uniquePcArr.map(c => `'${escapeStr(c.toLowerCase())}'`).join(',')})`);
    }

    // SKU filter (Web_Pid based)
    const sArr = [];
    if (sku && sku !== 'All') {
        if (Array.isArray(sku)) {
            const filtered = sku.filter(v => v !== 'All' && v !== 'all');
            sArr.push(...filtered);
        } else {
            sArr.push(sku);
        }
    }
    if (skus && skus !== 'All') {
        if (Array.isArray(skus)) {
            const filtered = skus.filter(v => v !== 'All' && v !== 'all');
            sArr.push(...filtered);
        } else {
            sArr.push(skus);
        }
    }

    if (sArr.length > 0) {
        const uniqueSArr = [...new Set(sArr)];
        // Match against BOTH Web_Pid (ID) and Product (name) columns
        // so the filter works whether the frontend sends IDs or names
        const pidConds = uniqueSArr.map(s => `'${escapeStr(s)}'`).join(',');
        const nameConds = uniqueSArr.map(s => `${prefix}Product ILIKE '%${escapeStr(s)}%'`).join(' OR ');
        conditions.push(`(${prefix}Web_Pid IN (${pidConds}) OR ${nameConds})`);
    }

    // SKU name filter (Product name based - from drawer skuName param)
    if (filters.skuName && filters.skuName !== 'All') {
        const snArr = Array.isArray(filters.skuName) ? filters.skuName.filter(v => v !== 'All') : [filters.skuName];
        if (snArr.length > 0) {
            const snConds = snArr.map(s => `${prefix}Product ILIKE '%${escapeStr(s)}%'`).join(' OR ');
            conditions.push(`(${snConds})`);
        }
    }

    // Date/Month range
    if (dates && Array.isArray(dates) && dates.length > 0) {
        conditions.push(`${prefix}DATE IN (${dates.map(d => `'${d}'`).join(',')})`);
    } else if (months && Array.isArray(months) && months.length > 0) {
        conditions.push(`formatDateTime(${prefix}DATE, '%Y-%m') IN (${months.map(m => `'${m}'`).join(',')})`);
    } else if (startDate && endDate) {
        const startStr = dayjs(startDate).format('YYYY-MM-DD');
        const endStr = dayjs(endDate).format('YYYY-MM-DD');
        conditions.push(`${prefix}DATE BETWEEN '${startStr}' AND '${endStr}'`);
    }

    // Advanced filters requiring subqueries on rb_location_darkstore
    if (hasDarkstoreTable) {
        if (zones && zones !== 'All') {
            const zArr = Array.isArray(zones) ? zones : [zones];
            conditions.push(`lower(${prefix}Location) IN (SELECT lower(location) FROM rb_location_darkstore WHERE region IN (${zArr.map(z => `'${escapeStr(z)}'`).join(',')}))`);
        }
        if (metroFlags && metroFlags !== 'All') {
            const mArr = Array.isArray(metroFlags) ? metroFlags : [metroFlags];
            conditions.push(`lower(${prefix}Location) IN (SELECT lower(location) FROM rb_location_darkstore WHERE tier IN (${mArr.map(m => `'${escapeStr(m)}'`).join(',')}))`);
        }
        if (pincodes && pincodes !== 'All') {
            const pArr = Array.isArray(pincodes) ? pincodes : [pincodes];
            conditions.push(`lower(${prefix}Location) IN (SELECT lower(location) FROM rb_location_darkstore WHERE toString(pincode) IN (${pArr.map(p => `'${escapeStr(p)}'`).join(',')}))`);
        }
    }

    if (ownBrandsOnly === 'true' || ownBrandsOnly === true) {
        conditions.push(`${prefix}Comp_flag = 0`);
    }

    return conditions.length > 0 ? conditions.join(' AND ') : '1=1';
};

/**
 * Helper to get the latest available date from rb_pdp_olap
 */
const getLatestDate = async () => {
    try {
        const query = 'SELECT MAX(toDate(DATE)) as maxDate FROM rb_pdp_olap';
        const result = await queryClickHouse(query);
        const date = result[0]?.maxDate ? dayjs(result[0].maxDate) : dayjs();
        return date;
    } catch (error) {
        console.error('[getLatestDate] Error:', error);
        return dayjs();
    }
};

const getAssortment = async (filters) => {
    const cacheKey = generateCacheKey('assortment', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const { platform, startDate, endDate, brand, location } = filters;

            // Determine target date
            const targetDate = endDate ? dayjs(endDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');

            // Build conditions
            const conditions = [`DATE = '${targetDate}'`];
            if (brand && brand !== 'All') conditions.push(`Brand = '${escapeStr(brand)}'`);
            if (location && location !== 'All') conditions.push(`Location = '${escapeStr(location)}'`);
            if (platform && platform !== 'All') conditions.push(`Platform = '${escapeStr(platform)}'`);

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            // Query by platform breakdown
            const query = `
                SELECT 
                    Platform,
                    COUNT(DISTINCT Web_Pid) as count
                FROM rb_pdp_olap
                ${whereClause}
                GROUP BY Platform
            `;

            const results = await queryClickHouse(query);

            // Convert to object { Platform: Count }
            const assortmentMap = {};
            results.forEach(r => {
                assortmentMap[r.Platform] = parseInt(r.count, 10);
            });

            // Total count
            const totalQuery = `
                SELECT COUNT(DISTINCT Web_Pid) as total
                FROM rb_pdp_olap
                ${whereClause}
            `;
            const totalResult = await queryClickHouse(totalQuery);
            const total = parseInt(totalResult[0]?.total, 10) || 0;

            return {
                breakdown: assortmentMap,
                total: total,
                date: targetDate
            };
        } catch (error) {
            console.error('Error calculating Assortment:', error);
            throw error;
        }
    }, CACHE_TTL.SHORT);
};

const getAbsoluteOsaOverview = async (filters) => {
    console.log('[getAbsoluteOsaOverview] Request received with filters:', filters);

    const cacheKey = generateCacheKey('absolute_osa_overview', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const { platform, brand, location, startDate, endDate } = filters;

            // Date calculations
            const currentEndDate = endDate ? dayjs(endDate) : dayjs();
            const currentStartDate = startDate ? dayjs(startDate) : currentEndDate.startOf('month');

            let prevStartDate, prevEndDate;

            if (filters.compareStartDate && filters.compareEndDate) {
                prevStartDate = dayjs(filters.compareStartDate);
                prevEndDate = dayjs(filters.compareEndDate);
                console.log(`[getAbsoluteOsaOverview] Using explicit comparison dates: ${prevStartDate.format('YYYY-MM-DD')} to ${prevEndDate.format('YYYY-MM-DD')}`);
            } else {
                const periodDays = currentEndDate.diff(currentStartDate, 'day') + 1;
                prevEndDate = currentStartDate.subtract(1, 'day');
                prevStartDate = prevEndDate.subtract(periodDays - 1, 'day');
                console.log(`[getAbsoluteOsaOverview] Using calculated comparison dates: ${prevStartDate.format('YYYY-MM-DD')} to ${prevEndDate.format('YYYY-MM-DD')}`);
            }

            // Build filter conditions for current period
            const currentFilters = { ...filters, startDate: currentStartDate.format('YYYY-MM-DD'), endDate: currentEndDate.format('YYYY-MM-DD') };
            const currentWhere = await buildAvailabilityWhereClause(currentFilters);

            // Build filter conditions for previous period
            const prevFilters = { ...filters, startDate: prevStartDate.format('YYYY-MM-DD'), endDate: prevEndDate.format('YYYY-MM-DD') };
            const prevWhere = await buildAvailabilityWhereClause(prevFilters);

            // Check if delivery_date column exists before using it
            let deliveryDaysSQL = 'NULL';
            try {
                const pdpCols = await getTableColumns('rb_pdp_olap');
                if (columnExists(pdpCols, 'delivery_date')) {
                    deliveryDaysSQL = `
                        IF(
                            delivery_date IS NULL OR delivery_date = '' OR delivery_date = '0',
                            NULL,
                            CASE
                                WHEN dateDiff('day', DATE, parseDateTimeBestEffortOrNull(concat(delivery_date, ' ', toString(toYear(DATE))))) < 0 THEN 0
                                WHEN dateDiff('day', DATE, parseDateTimeBestEffortOrNull(concat(delivery_date, ' ', toString(toYear(DATE))))) > 30 THEN NULL
                                ELSE dateDiff('day', DATE, parseDateTimeBestEffortOrNull(concat(delivery_date, ' ', toString(toYear(DATE)))))
                            END
                        )
                    `;

                }
            } catch (colCheckErr) {
                console.warn('[getAbsoluteOsaOverview] Could not check delivery_date column, defaulting to NULL:', colCheckErr.message);
            }

            const queryTemplate = (where) => `
                SELECT 
                    SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) as sumNenoOsa,
                    SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as sumDenoOsa,
                    SUM(ifNull(toFloat64OrZero(toString(buy_box_neno_osa)), 0)) as sumBuyBoxNeno,
                    SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) as sumSales,
                    COUNT(DISTINCT Web_Pid) as skuCount,
                    avg(${deliveryDaysSQL}) as avgDeliveryDays
                FROM rb_pdp_olap
                WHERE ${where}
            `;

            console.log('[getAbsoluteOsaOverview] Fetching current and previous data');
            const [currentResult, prevResult] = await Promise.all([
                queryClickHouse(queryTemplate(currentWhere)),
                queryClickHouse(queryTemplate(prevWhere))
            ]);

            const curr = currentResult[0] || {};
            const prev = prevResult[0] || {};

            const currSumNeno = parseFloat(curr.sumNenoOsa) || 0;
            const currSumDeno = parseFloat(curr.sumDenoOsa) || 0;
            const currSumBuyBox = parseFloat(curr.sumBuyBoxNeno) || 0;
            const currSumSales = parseFloat(curr.sumSales) || 0;

            const prevSumNeno = parseFloat(prev.sumNenoOsa) || 0;
            const prevSumDeno = parseFloat(prev.sumDenoOsa) || 0;
            const prevSumBuyBox = parseFloat(prev.sumBuyBoxNeno) || 0;
            const prevSumSales = parseFloat(prev.sumSales) || 0;

            const stockAvailability = currSumDeno > 0 ? (currSumNeno / currSumDeno) * 100 : 0;
            const prevStockAvailability = prevSumDeno > 0 ? (prevSumNeno / prevSumDeno) * 100 : 0;

            const fillRate = currSumDeno > 0 ? (currSumBuyBox / currSumDeno) * 100 : 0;
            const prevFillRate = prevSumDeno > 0 ? (prevSumBuyBox / prevSumDeno) * 100 : 0;

            const skuCount = curr.skuCount ? parseFloat(curr.skuCount) : 0;

            const psl = stockAvailability > 0 ? currSumSales * ((100 / stockAvailability) - 1) : 0;
            const prevPslValue = prevStockAvailability > 0 ? prevSumSales * ((100 / prevStockAvailability) - 1) : 0;

            const currAvgDeliveryDays = parseFloat(curr.avgDeliveryDays);
            let deliveryTime = "N/A";
            if (!isNaN(currAvgDeliveryDays)) {
                const roundedDays = Math.round(currAvgDeliveryDays);
                if (roundedDays <= 0) deliveryTime = "Same Day";
                else if (roundedDays === 1) deliveryTime = "1 Day";
                else deliveryTime = `${roundedDays} Days`;
            }

            const result = {
                section: "availability_overview",
                stockAvailability: parseFloat(stockAvailability.toFixed(2)),
                prevStockAvailability: parseFloat(prevStockAvailability.toFixed(2)),
                fillRate: parseFloat(fillRate.toFixed(2)),
                prevFillRate: parseFloat(prevFillRate.toFixed(2)),
                skuCount: skuCount,
                psl: parseFloat(psl.toFixed(2)),
                prevPsl: parseFloat(prevPslValue.toFixed(2)),
                deliveryTime: deliveryTime,
                sumNenoOsa: currSumNeno,
                sumDenoOsa: currSumDeno,
                filters: filters,
                currentPeriod: { start: currentStartDate.format('YYYY-MM-DD'), end: currentEndDate.format('YYYY-MM-DD') },
                comparisonPeriod: { start: prevStartDate.format('YYYY-MM-DD'), end: prevEndDate.format('YYYY-MM-DD') },
                timestamp: new Date().toISOString()
            };

            // ---- ADD OSA DETAIL DATA ----
            // We need 31 days of data backwards from the current end date for trends
            const detailStartDate = currentEndDate.subtract(30, 'day').format('YYYY-MM-DD');
            const detailEndDate = currentEndDate.format('YYYY-MM-DD');

            // Query should span from the earliest of currentStartDate and detailStartDate
            const overallStartDate = currentStartDate.isBefore(detailStartDate, 'day') ? currentStartDate : dayjs(detailStartDate);
            const overallEndDate = currentEndDate.isAfter(detailEndDate, 'day') ? currentEndDate : dayjs(detailEndDate);

            const detailFilters = { ...filters, startDate: overallStartDate.format('YYYY-MM-DD'), endDate: overallEndDate.format('YYYY-MM-DD') };
            const detailWhere = await buildAvailabilityWhereClause(detailFilters);

            const detailQuery = `
                SELECT 
                    Web_Pid as sku,
                    Product as name,
                    Platform as platform,
                    Brand as brand,
                    Category as format,
                    DATE as date,
                    SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) as sumNeno,
                    SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as sumDeno
                FROM rb_pdp_olap
                WHERE ${detailWhere} AND Web_Pid IS NOT NULL AND Web_Pid != ''
                GROUP BY Web_Pid, Product, Platform, Brand, Category, DATE
                ORDER BY Web_Pid, DATE
            `;

            console.log('[getAbsoluteOsaOverview] Fetching detail data');
            const detailResult = await queryClickHouse(detailQuery);

            // Structure: { sku: { name: '', values: [0..0] (31 length), cities: [], avg7, avg31, avgSelected, status } }
            const skuMap = {};
            const daysArr = Array.from({ length: 31 }, (_, i) => currentEndDate.subtract(30 - i, 'day').format('YYYY-MM-DD'));

            detailResult.forEach(row => {
                if (!skuMap[row.sku]) {
                    skuMap[row.sku] = {
                        name: row.name || 'Unknown Product',
                        sku: row.sku,
                        platform: row.platform,
                        brand: row.brand,
                        format: row.format,
                        dateMap: {},
                        values: new Array(31).fill(null),
                    };
                }
                const neno = parseFloat(row.sumNeno) || 0;
                const deno = parseFloat(row.sumDeno) || 0;
                const osa = deno > 0 ? Math.round((neno / deno) * 100) : 0;

                skuMap[row.sku].dateMap[row.date] = { osa, neno, deno };
            });

            // Calculate aggregates and fill values array
            const osaDetail = Object.values(skuMap).map(item => {
                let totalNeno31 = 0, totalDeno31 = 0;
                let totalNeno7 = 0, totalDeno7 = 0;
                let totalNenoSelected = 0, totalDenoSelected = 0;

                // For the last 31 days trend
                daysArr.forEach((dateStr, index) => {
                    const data = item.dateMap[dateStr];
                    if (data) {
                        item.values[index] = data.osa;
                        totalNeno31 += data.neno;
                        totalDeno31 += data.deno;
                        if (index >= 24) { // Last 7 days
                            totalNeno7 += data.neno;
                            totalDeno7 += data.deno;
                        }
                    } else {
                        item.values[index] = 0;
                    }
                });

                // For the selected range aggregate
                Object.keys(item.dateMap).forEach(dateStr => {
                    const d = dayjs(dateStr);
                    if (!d.isBefore(currentStartDate, 'day') && !d.isAfter(currentEndDate, 'day')) {
                        totalNenoSelected += item.dateMap[dateStr].neno;
                        totalDenoSelected += item.dateMap[dateStr].deno;
                    }
                });

                const avg31 = totalDeno31 > 0 ? Math.round((totalNeno31 / totalDeno31) * 100) : 0;
                const avg7 = totalDeno7 > 0 ? Math.round((totalNeno7 / totalDeno7) * 100) : 0;
                const avgSelected = totalDenoSelected > 0 ? Math.round((totalNenoSelected / totalDenoSelected) * 100) : 0;
                // Status based on selected period instead of 7 days to match selected dates accuracy
                const status = avgSelected >= 85 ? "Healthy" : avgSelected >= 70 ? "Watch" : "Action";

                return {
                    name: item.name,
                    sku: item.sku,
                    platform: item.platform,
                    brand: item.brand,
                    format: item.format,
                    values: item.values,
                    avg7,
                    avg31,
                    avgSelected,
                    status,
                    cities: []
                };
            });

            // Sort by worst avgSelected descending or name
            osaDetail.sort((a, b) => b.avgSelected - a.avgSelected || a.name.localeCompare(b.name));

            result.osaDetail = osaDetail;

            return result;
        } catch (error) {
            console.error('[getAbsoluteOsaOverview] Error:', error);
            throw error;
        }
    }, CACHE_TTL.SHORT);
};

const getAbsoluteOsaPlatformKpiMatrix = async (filters) => {
    console.log('[getAbsoluteOsaPlatformKpiMatrix] Request received with filters:', filters);

    const cacheKey = generateCacheKey('platform_kpi_matrix', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const { viewMode = 'Platform', platform, brand, location, startDate, endDate } = filters;
            console.log(`\n[DEBUG KPI MATRIX] viewMode: "${viewMode}"`);

            // Date calculations
            const currentEndDate = endDate ? dayjs(endDate) : dayjs();
            const currentStartDate = startDate ? dayjs(startDate) : currentEndDate.subtract(30, 'day');
            const periodDays = currentEndDate.diff(currentStartDate, 'day') + 1;
            const prevEndDate = currentStartDate.subtract(1, 'day');
            const prevStartDate = prevEndDate.subtract(periodDays - 1, 'day');

            // Determine group column based on viewMode
            const isMars = getCurrentDbName() === 'mars';
            const vMode = (viewMode || 'Platform').toLowerCase();
            console.log(`\n[DEBUG KPI MATRIX] viewMode: "${viewMode}", normalized: "${vMode}"`);

            const groupColumn = vMode === 'platform' ? 'Platform' :
                (vMode === 'format' || vMode === 'category') ? 'Category' :
                    'Location';
            console.log(`[DEBUG KPI MATRIX] groupColumn: "${groupColumn}"`);
            // Build base filter conditions using the helper (excluding date as it's handled separately for current/prev)
            const baseFilterParams = { ...filters };
            delete baseFilterParams.startDate;
            delete baseFilterParams.endDate;
            delete baseFilterParams.dates;
            delete baseFilterParams.months;

            // Note: We intentionally keep the grouping column filters (platform/location/category)
            // in baseFilterParams so that user-applied segment filters are respected.
            // If the user filters by specific platforms, only those should appear as columns.

            const baseWhereClause = await buildAvailabilityWhereClause(baseFilterParams);
            const baseFilter = baseWhereClause !== '1=1' ? ` AND ${baseWhereClause}` : '';

            console.log('[DEBUG KPI MATRIX] baseFilterParams:', JSON.stringify(baseFilterParams));
            console.log('[DEBUG KPI MATRIX] baseWhereClause:', baseWhereClause);
            console.log('[DEBUG KPI MATRIX] baseFilter:', baseFilter);

            // Get distinct column values
            // For Format viewMode, only show categories with status=1 in rca_sku_dim
            let additionalCategoryFilter = '';
            if (viewMode === 'Format') {
                // Pre-fetch valid categories to avoid correlated subquery (not supported in ClickHouse)
                const dbName = getCurrentDbName();
                const colMap = getColumnMapping(dbName);
                const rcaCatCol = colMap.rca_sku_dim.category;

                console.log(`[DEBUG KPI MATRIX] Format view. Fetching active categories from rca_sku_dim.${rcaCatCol}`);
                const validCatResult = await queryClickHouse(`SELECT DISTINCT ${rcaCatCol} as category FROM rca_sku_dim WHERE status = 1 AND ${rcaCatCol} IS NOT NULL AND ${rcaCatCol} != ''`);
                const validCategories = validCatResult.map(r => r.category).filter(Boolean);
                if (validCategories.length > 0) {
                    additionalCategoryFilter = ` AND ${groupColumn} IN (${validCategories.map(c => `'${escapeStr(c)}'`).join(',')})`;
                }
            }

            const distinctQuery = `
                SELECT DISTINCT ${groupColumn} as value
                FROM rb_pdp_olap
                WHERE ${groupColumn} IS NOT NULL AND ${groupColumn} != ''
                ${baseFilter}
                ${additionalCategoryFilter}
                ORDER BY value
                LIMIT 50
            `;


            const columnValues = (await queryClickHouse(distinctQuery))
                .map(r => r.value)
                .filter(v => v && v.trim());


            if (columnValues.length === 0) {
                return {
                    section: "platform_kpi_matrix",
                    viewMode,
                    columns: ['KPI'],
                    rows: [],
                    filters,
                    timestamp: new Date().toISOString()
                };
            }

            let metroLocationList = [];
            try {
                const check = await queryClickHouse(`SELECT DISTINCT location FROM rb_location_darkstore WHERE tier IN ('Tier 1', 'Tier 2')`);
                metroLocationList = check.map(r => `'${escapeStr(r.location)}'`);
            } catch (e) {}

            const metroFilter = metroLocationList.length > 0 ? `Location IN (${metroLocationList.join(',')})` : '1=0';

            // Calculate KPIs for all columns in a single optimized query
            // OSA uses the selected period
            // DOI uses latest inventory and a 30-day sales lookback (from currentEndDate)
            const doiLookbackDate = currentEndDate.subtract(29, 'day').format('YYYY-MM-DD');
            const prevDoiLookbackDate = prevEndDate.subtract(29, 'day').format('YYYY-MM-DD');

            // Check if delivery_date column exists before using it
            let deliveryDaysSQL = 'NULL';
            try {
                const pdpColsMatrix = await getTableColumns('rb_pdp_olap');
                if (columnExists(pdpColsMatrix, 'delivery_date')) {
                    deliveryDaysSQL = `
                        IF(
                            delivery_date IS NULL OR delivery_date = '' OR delivery_date = '0',
                            NULL,
                            CASE
                                WHEN dateDiff('day', t1.DATE, parseDateTimeBestEffortOrNull(concat(delivery_date, ' ', toString(toYear(t1.DATE))))) < 0 THEN 0
                                WHEN dateDiff('day', t1.DATE, parseDateTimeBestEffortOrNull(concat(delivery_date, ' ', toString(toYear(t1.DATE))))) > 30 THEN NULL
                                ELSE dateDiff('day', t1.DATE, parseDateTimeBestEffortOrNull(concat(delivery_date, ' ', toString(toYear(t1.DATE)))))
                            END
                        )
                    `;

                }
            } catch (colCheckErr) {
                console.warn('[getAbsoluteOsaPlatformKpiMatrix] Could not check delivery_date column, defaulting to NULL:', colCheckErr.message);
            }

            const kpiQuery = `
                WITH daily_stats AS (
                    SELECT 
                        DATE,
                        ${groupColumn} as col_value,
                        SUM(ifNull(toFloat64OrZero(toString(Inventory)), 0)) as daily_inv
                    FROM rb_pdp_olap
                    WHERE DATE BETWEEN '${currentStartDate.format('YYYY-MM-DD')}' AND '${currentEndDate.format('YYYY-MM-DD')}'
                      AND ${groupColumn} IN (${columnValues.map(v => `'${escapeStr(v)}'`).join(',')})
                      ${baseFilter}
                    GROUP BY DATE, ${groupColumn}
                ),
                latest_inv_stats AS (
                    SELECT 
                        col_value,
                        argMax(daily_inv, DATE) as latest_inventory
                    FROM daily_stats
                    WHERE daily_inv > 0
                    GROUP BY col_value
                )
                SELECT 
                    t1.${groupColumn} as col_value,
                    SUM(ifNull(toFloat64OrZero(toString(t1.neno_osa)), 0)) as sum_neno,
                    SUM(ifNull(toFloat64OrZero(toString(t1.deno_osa)), 0)) as sum_deno,
                    SUM(ifNull(toFloat64OrZero(toString(t1.buy_box_neno_osa)), 0)) as sum_buybox_neno,
                    SUM(ifNull(toFloat64OrZero(toString(t1.MSL)), 0)) as sum_msl,
                    SUM(ifNull(toFloat64OrZero(toString(t1.Sales)), 0)) as sum_sales,
                    SUM(if(${metroFilter}, ifNull(toFloat64OrZero(toString(t1.neno_osa)), 0), 0)) as sum_metro_neno,
                    SUM(if(${metroFilter}, ifNull(toFloat64OrZero(toString(t1.deno_osa)), 0), 0)) as sum_metro_deno,
                    COUNT(DISTINCT t1.Web_Pid) as assortment_count,
                    any(l.latest_inventory) as latest_inventory,
                    avg(${deliveryDaysSQL}) as avg_delivery_days
                FROM rb_pdp_olap t1
                LEFT JOIN latest_inv_stats l ON t1.${groupColumn} = l.col_value
                WHERE t1.DATE BETWEEN '${currentStartDate.format('YYYY-MM-DD')}' AND '${currentEndDate.format('YYYY-MM-DD')}'
                  AND t1.${groupColumn} IN (${columnValues.map(v => `'${escapeStr(v)}'`).join(',')})
                  ${baseFilter}
                GROUP BY col_value
            `;

            const prevKpiQuery = `
                WITH daily_stats AS (
                    SELECT 
                        DATE,
                        ${groupColumn} as col_value,
                        SUM(ifNull(toFloat64OrZero(toString(Inventory)), 0)) as daily_inv
                    FROM rb_pdp_olap
                    WHERE DATE BETWEEN '${prevStartDate.format('YYYY-MM-DD')}' AND '${prevEndDate.format('YYYY-MM-DD')}'
                      AND ${groupColumn} IN (${columnValues.map(v => `'${escapeStr(v)}'`).join(',')})
                      ${baseFilter}
                    GROUP BY DATE, ${groupColumn}
                ),
                latest_inv_stats AS (
                    SELECT 
                        col_value,
                        argMax(daily_inv, DATE) as latest_inventory
                    FROM daily_stats
                    WHERE daily_inv > 0
                    GROUP BY col_value
                )
                SELECT 
                    t1.${groupColumn} as col_value,
                    SUM(ifNull(toFloat64OrZero(toString(t1.neno_osa)), 0)) as sum_neno,
                    SUM(ifNull(toFloat64OrZero(toString(t1.deno_osa)), 0)) as sum_deno,
                    SUM(ifNull(toFloat64OrZero(toString(t1.buy_box_neno_osa)), 0)) as sum_buybox_neno,
                    SUM(ifNull(toFloat64OrZero(toString(t1.MSL)), 0)) as sum_msl,
                    SUM(ifNull(toFloat64OrZero(toString(t1.Sales)), 0)) as sum_sales,
                    SUM(if(${metroFilter}, ifNull(toFloat64OrZero(toString(t1.neno_osa)), 0), 0)) as sum_metro_neno,
                    SUM(if(${metroFilter}, ifNull(toFloat64OrZero(toString(t1.deno_osa)), 0), 0)) as sum_metro_deno,
                    COUNT(DISTINCT t1.Web_Pid) as assortment_count,
                    any(l.latest_inventory) as latest_inventory,
                    avg(${deliveryDaysSQL}) as avg_delivery_days
                FROM rb_pdp_olap t1
                LEFT JOIN latest_inv_stats l ON t1.${groupColumn} = l.col_value
                WHERE t1.DATE BETWEEN '${prevStartDate.format('YYYY-MM-DD')}' AND '${prevEndDate.format('YYYY-MM-DD')}'
                  AND t1.${groupColumn} IN (${columnValues.map(v => `'${escapeStr(v)}'`).join(',')})
                  ${baseFilter}
                GROUP BY col_value
            `;

            // DOI sales queries (30-day lookback for current and prev)
            const doiSalesQuery = `
                SELECT 
                    ${groupColumn} as col_value,
                    SUM(ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) as total_qty_sold
                FROM rb_pdp_olap
                WHERE DATE BETWEEN '${doiLookbackDate}' AND '${currentEndDate.format('YYYY-MM-DD')}'
                  AND ${groupColumn} IN (${columnValues.map(v => `'${escapeStr(v)}'`).join(',')})
                  ${baseFilter}
                GROUP BY ${groupColumn}
            `;

            const prevDoiSalesQuery = `
                SELECT 
                    ${groupColumn} as col_value,
                    SUM(ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) as total_qty_sold
                FROM rb_pdp_olap
                WHERE DATE BETWEEN '${prevDoiLookbackDate}' AND '${prevEndDate.format('YYYY-MM-DD')}'
                  AND ${groupColumn} IN (${columnValues.map(v => `'${escapeStr(v)}'`).join(',')})
                  ${baseFilter}
                GROUP BY ${groupColumn}
            `;

            const [currentResults, prevResults, currentSales, prevSales] = await Promise.all([
                queryClickHouse(kpiQuery),
                queryClickHouse(prevKpiQuery),
                queryClickHouse(doiSalesQuery),
                queryClickHouse(prevDoiSalesQuery)
            ]);

            // Build lookup maps
            const currentMap = {};
            currentResults.forEach(r => { currentMap[r.col_value] = r; });
            const prevMap = {};
            prevResults.forEach(r => { prevMap[r.col_value] = r; });

            const currentSalesMap = {};
            currentSales.forEach(r => { currentSalesMap[r.col_value] = r.total_qty_sold; });
            const prevSalesMap = {};
            prevSales.forEach(r => { prevSalesMap[r.col_value] = r.total_qty_sold; });

            // Build KPI rows
            const kpiRows = {
                osa: { kpi: 'OSA', trend: {} },
                buybox: { kpi: 'BUY BOX %', trend: {} },
                doi: { kpi: 'DOI', trend: {} },
                delivery: { kpi: 'DELIVERY TIME', trend: {} },
                skucount: { kpi: 'SKU COUNT', trend: {} },
                metroAvailability: { kpi: 'METRO STOCK AVAILABILITY', trend: {} },
                fillrate: { kpi: 'FILLRATE', trend: {} },
                psl: { kpi: 'PSL', trend: {} }
            };

            for (const colValue of columnValues) {
                const curr = currentMap[colValue] || {};
                const prev = prevMap[colValue] || {};

                // OSA
                const currOsa = (parseFloat(curr.sum_deno) > 0)
                    ? (parseFloat(curr.sum_neno) / parseFloat(curr.sum_deno)) * 100 : 0;
                const prevOsa = (parseFloat(prev.sum_deno) > 0)
                    ? (parseFloat(prev.sum_neno) / parseFloat(prev.sum_deno)) * 100 : 0;
                kpiRows.osa[colValue] = Math.round(currOsa);
                kpiRows.osa.trend[colValue] = Math.round(currOsa - prevOsa);

                // DOI: (Latest Inventory / Last 30 Days Sales) * 30
                const currSalesVal = parseFloat(currentSalesMap[colValue]) || 0;
                const prevSalesVal = parseFloat(prevSalesMap[colValue]) || 0;

                const currDoi = (currSalesVal > 0)
                    ? (parseFloat(curr.latest_inventory) / currSalesVal) * 30 : 0;
                const prevDoi = (prevSalesVal > 0)
                    ? (parseFloat(prev.latest_inventory) / prevSalesVal) * 30 : 0;
                kpiRows.doi[colValue] = parseFloat(currDoi.toFixed(1));
                kpiRows.doi.trend[colValue] = parseFloat((currDoi - prevDoi).toFixed(1));

                // Fillrate: (SUM(buy_box_neno_osa) / SUM(deno_osa)) * 100
                const currFillrate = (parseFloat(curr.sum_deno) > 0)
                    ? (parseFloat(curr.sum_buybox_neno) / parseFloat(curr.sum_deno)) * 100 : 0;
                const prevFillrate = (parseFloat(prev.sum_deno) > 0)
                    ? (parseFloat(prev.sum_buybox_neno) / parseFloat(prev.sum_deno)) * 100 : 0;
                kpiRows.fillrate[colValue] = Math.round(currFillrate);
                kpiRows.fillrate.trend[colValue] = Math.round(currFillrate - prevFillrate);

                // PSL: (SUM(Sales) / OSA_Percentage) - SUM(Sales)  [currency format]
                const currSalesTotal = parseFloat(curr.sum_sales) || 0;
                const prevSalesTotal = parseFloat(prev.sum_sales) || 0;

                const currPsl = currOsa > 0 ? (currSalesTotal / (currOsa / 100)) - currSalesTotal : 0;
                const prevPsl = prevOsa > 0 ? (prevSalesTotal / (prevOsa / 100)) - prevSalesTotal : 0;

                kpiRows.psl[colValue] = parseFloat(currPsl.toFixed(2));
                kpiRows.psl.trend[colValue] = parseFloat((currPsl - prevPsl).toFixed(2));

                // Buy Box (same as fillrate)
                kpiRows.buybox[colValue] = Math.round(currFillrate);
                kpiRows.buybox.trend[colValue] = Math.round(currFillrate - prevFillrate);

                // SKU Count
                const currSku = parseInt(curr.assortment_count) || 0;
                const prevSku = parseInt(prev.assortment_count) || 0;
                kpiRows.skucount[colValue] = currSku;
                kpiRows.skucount.trend[colValue] = currSku - prevSku;

                // Delivery Time
                const currAvgDelivery = parseFloat(curr.avg_delivery_days);
                if (!isNaN(currAvgDelivery)) {
                    const rounded = Math.round(currAvgDelivery);
                    kpiRows.delivery[colValue] = rounded <= 0 ? "Same Day" : (rounded === 1 ? "1 Day" : `${rounded} Days`);
                } else {
                    kpiRows.delivery[colValue] = "N/A";
                }
                kpiRows.delivery.trend[colValue] = 0;

                // Metro Stock Availability
                const currMetroOsa = (parseFloat(curr.sum_metro_deno) > 0)
                    ? (parseFloat(curr.sum_metro_neno) / parseFloat(curr.sum_metro_deno)) * 100 : 0;
                const prevMetroOsa = (parseFloat(prev.sum_metro_deno) > 0)
                    ? (parseFloat(prev.sum_metro_neno) / parseFloat(prev.sum_metro_deno)) * 100 : 0;
                kpiRows.metroAvailability[colValue] = Math.round(currMetroOsa);
                kpiRows.metroAvailability.trend[colValue] = Math.round(currMetroOsa - prevMetroOsa);
            }

            // --- BREAKDOWN LOGIC ---
            const { drillDimension = 'region', includeBreakdown = false } = filters;

            // Only fetch breakdown when explicitly requested (user expanded a row)
            if (includeBreakdown && drillDimension === 'region') {
                // Determine prefix for breakdown query - use t1 for rb_pdp_olap
                const breakdownBaseWhere = await buildAvailabilityWhereClause(baseFilterParams, 't1');
                const breakdownBaseFilter = breakdownBaseWhere !== '1=1' ? ` AND ${breakdownBaseWhere}` : '';

                const regionBreakdownQuery = `
                    WITH location_mapping AS (
                        SELECT lower(location) as l_key, any(region) as mapped_region
                        FROM rb_location_darkstore
                        WHERE region IS NOT NULL AND region != ''
                        GROUP BY l_key
                    )
                    SELECT 
                        t1.${groupColumn} as col_value,
                        l.mapped_region as drill_item,
                        -- KPI Components for selected period
                        SUM(if(t1.DATE BETWEEN '${currentStartDate.format('YYYY-MM-DD')}' AND '${currentEndDate.format('YYYY-MM-DD')}', ifNull(toFloat64OrZero(toString(t1.neno_osa)), 0), 0)) as sum_neno,
                        SUM(if(t1.DATE BETWEEN '${currentStartDate.format('YYYY-MM-DD')}' AND '${currentEndDate.format('YYYY-MM-DD')}', ifNull(toFloat64OrZero(toString(t1.deno_osa)), 0), 0)) as sum_deno,
                        SUM(if(t1.DATE BETWEEN '${currentStartDate.format('YYYY-MM-DD')}' AND '${currentEndDate.format('YYYY-MM-DD')}', ifNull(toFloat64OrZero(toString(t1.buy_box_neno_osa)), 0), 0)) as sum_buybox_neno,
                        SUM(if(t1.DATE BETWEEN '${currentStartDate.format('YYYY-MM-DD')}' AND '${currentEndDate.format('YYYY-MM-DD')}', ifNull(toFloat64OrZero(toString(t1.MSL)), 0), 0)) as sum_msl,
                        SUM(if(t1.DATE BETWEEN '${currentStartDate.format('YYYY-MM-DD')}' AND '${currentEndDate.format('YYYY-MM-DD')}', ifNull(toFloat64OrZero(toString(t1.Sales)), 0), 0)) as sum_sales,
                        
                        -- DOI / Sales components (30-day lookback)
                        SUM(if(t1.DATE BETWEEN '${doiLookbackDate}' AND '${currentEndDate.format('YYYY-MM-DD')}', ifNull(toFloat64OrZero(toString(t1.Qty_Sold)), 0), 0)) as doi_total_qty_sold,
                        
                        -- Latest Inventory (across selected period, prioritized by non-zero)
                        argMax(ifNull(toFloat64OrZero(toString(t1.Inventory)), 0), if(ifNull(toFloat64OrZero(toString(t1.Inventory)), 0) > 0, t1.DATE, toDate('1970-01-01'))) as latest_inventory,
                        avg(if(t1.DATE BETWEEN '${currentStartDate.format('YYYY-MM-DD')}' AND '${currentEndDate.format('YYYY-MM-DD')}', 
                            IF(
                                delivery_date IS NULL OR delivery_date = '' OR delivery_date = '0',
                                NULL,
                                CASE
                                    WHEN dateDiff('day', t1.DATE, parseDateTimeBestEffortOrNull(concat(delivery_date, ' ', toString(toYear(t1.DATE))))) < 0 THEN 0
                                    WHEN dateDiff('day', t1.DATE, parseDateTimeBestEffortOrNull(concat(delivery_date, ' ', toString(toYear(t1.DATE))))) > 30 THEN NULL
                                    ELSE dateDiff('day', t1.DATE, parseDateTimeBestEffortOrNull(concat(delivery_date, ' ', toString(toYear(t1.DATE)))))
                                END
                            ), NULL)) as avg_delivery_days

                    FROM rb_pdp_olap t1
                    LEFT JOIN location_mapping l ON lower(t1.Location) = l.l_key
                    WHERE t1.DATE BETWEEN '${doiLookbackDate}' AND '${currentEndDate.format('YYYY-MM-DD')}'
                      AND t1.${groupColumn} IN (${columnValues.map(v => `'${escapeStr(v)}'`).join(',')})
                      ${breakdownBaseFilter}
                    GROUP BY col_value, drill_item
                `;

                const breakdownResults = await queryClickHouse(regionBreakdownQuery);
                const drillItemsSet = new Set();

                // Initialize breakdown structure for each row
                Object.keys(kpiRows).forEach(k => {
                    kpiRows[k].breakdown = {};
                    columnValues.forEach(cv => {
                        kpiRows[k].breakdown[cv] = {};
                    });
                });

                breakdownResults.forEach(r => {
                    const {
                        col_value, drill_item, sum_neno, sum_deno, sum_buybox_neno,
                        sum_msl, sum_sales, doi_total_qty_sold, latest_inventory, avg_delivery_days
                    } = r;
                    const item = drill_item || 'Unknown';

                    if (kpiRows.osa.breakdown[col_value]) {
                        const osa = parseFloat(sum_deno) > 0 ? (parseFloat(sum_neno) / parseFloat(sum_deno)) * 100 : 0;
                        kpiRows.osa.breakdown[col_value][item] = Math.round(osa);
                    }
                    if (kpiRows.fillrate.breakdown[col_value]) {
                        const fr = parseFloat(sum_deno) > 0 ? (parseFloat(sum_buybox_neno) / parseFloat(sum_deno)) * 100 : 0;
                        kpiRows.fillrate.breakdown[col_value][item] = Math.round(fr);
                    }
                    if (kpiRows.doi.breakdown[col_value]) {
                        const drr = parseFloat(doi_total_qty_sold) / 30;
                        const doi = drr > 0 ? parseFloat(latest_inventory) / drr : 0;
                        kpiRows.doi.breakdown[col_value][item] = parseFloat(doi.toFixed(1));
                    }
                    if (kpiRows.psl.breakdown[col_value]) {
                        const salesVal = parseFloat(sum_sales) || 0;
                        const osaVal = kpiRows.osa.breakdown[col_value][item] || 0;
                        const psl = osaVal > 0 ? (salesVal / (osaVal / 100)) - salesVal : 0;
                        kpiRows.psl.breakdown[col_value][item] = parseFloat(psl.toFixed(2));
                    }
                    if (kpiRows.delivery && kpiRows.delivery.breakdown[col_value]) {
                        const dr = parseFloat(avg_delivery_days);
                        if (!isNaN(dr)) {
                            const rounded = Math.round(dr);
                            kpiRows.delivery.breakdown[col_value][item] = rounded <= 0 ? "Same Day" : (rounded === 1 ? "1 Day" : `${rounded} Days`);
                        } else {
                            kpiRows.delivery.breakdown[col_value][item] = "N/A";
                        }
                    }
                    drillItemsSet.add(item);
                });
                kpiRows.applicableDrillItems = [...drillItemsSet].sort();
            } else if (includeBreakdown && drillDimension === 'period') {
                // Period breakdown (Yesterday, Last Week, MTD, L3M)
                const latestDate = await getLatestDate();
                const yesterdayStr = latestDate.subtract(1, 'day').format('YYYY-MM-DD');
                const lastWeekStr = latestDate.subtract(7, 'day').format('YYYY-MM-DD');
                const mtdStr = latestDate.startOf('month').format('YYYY-MM-DD');
                const l3mStr = latestDate.subtract(90, 'day').format('YYYY-MM-DD');
                const latestStr = latestDate.format('YYYY-MM-DD');

                console.log(`[Matrix Breakdown] Period breakdown dates: Latest=${latestStr}, Yesterday=${yesterdayStr}, MTD=${mtdStr}`);

                const periodQuery = `
                    SELECT 
                        t1.${groupColumn} as col_value,
                        -- Yesterday
                        SUM(if(toDate(t1.DATE) = '${yesterdayStr}', ifNull(toFloat64OrZero(toString(t1.neno_osa)), 0), 0)) as neno_yesterday,
                        SUM(if(toDate(t1.DATE) = '${yesterdayStr}', ifNull(toFloat64OrZero(toString(t1.deno_osa)), 0), 0)) as deno_yesterday,
                        SUM(if(toDate(t1.DATE) = '${yesterdayStr}', ifNull(toFloat64OrZero(toString(t1.buy_box_neno_osa)), 0), 0)) as buybox_neno_yesterday,
                        
                        -- Last Week
                        SUM(if(toDate(t1.DATE) BETWEEN '${lastWeekStr}' AND '${latestStr}', ifNull(toFloat64OrZero(toString(t1.neno_osa)), 0), 0)) as neno_lastweek,
                        SUM(if(toDate(t1.DATE) BETWEEN '${lastWeekStr}' AND '${latestStr}', ifNull(toFloat64OrZero(toString(t1.deno_osa)), 0), 0)) as deno_lastweek,
                        SUM(if(toDate(t1.DATE) BETWEEN '${lastWeekStr}' AND '${latestStr}', ifNull(toFloat64OrZero(toString(t1.buy_box_neno_osa)), 0), 0)) as buybox_neno_lastweek,
                        
                        -- MTD
                        SUM(if(toDate(t1.DATE) BETWEEN '${mtdStr}' AND '${latestStr}', ifNull(toFloat64OrZero(toString(t1.neno_osa)), 0), 0)) as neno_mtd,
                        SUM(if(toDate(t1.DATE) BETWEEN '${mtdStr}' AND '${latestStr}', ifNull(toFloat64OrZero(toString(t1.deno_osa)), 0), 0)) as deno_mtd,
                        SUM(if(toDate(t1.DATE) BETWEEN '${mtdStr}' AND '${latestStr}', ifNull(toFloat64OrZero(toString(t1.buy_box_neno_osa)), 0), 0)) as buybox_neno_mtd,
                        
                        -- L3M
                        SUM(if(toDate(t1.DATE) BETWEEN '${l3mStr}' AND '${latestStr}', ifNull(toFloat64OrZero(toString(t1.neno_osa)), 0), 0)) as neno_l3m,
                        SUM(if(toDate(t1.DATE) BETWEEN '${l3mStr}' AND '${latestStr}', ifNull(toFloat64OrZero(toString(t1.deno_osa)), 0), 0)) as deno_l3m,
                        SUM(if(toDate(t1.DATE) BETWEEN '${l3mStr}' AND '${latestStr}', ifNull(toFloat64OrZero(toString(t1.buy_box_neno_osa)), 0), 0)) as buybox_neno_l3m
                    FROM rb_pdp_olap t1
                    WHERE t1.DATE BETWEEN '${l3mStr}' AND '${latestStr}'
                      AND t1.${groupColumn} IN (${columnValues.map(v => `'${escapeStr(v)}'`).join(',')})
                      ${baseFilter}
                    GROUP BY col_value
                `;

                const periodResults = await queryClickHouse(periodQuery);
                kpiRows.applicableDrillItems = ['Yesterday', 'Last Week', 'MTD', 'L3M'];

                // Initialize breakdown structure
                Object.keys(kpiRows).forEach(k => {
                    kpiRows[k].breakdown = {};
                    columnValues.forEach(cv => {
                        kpiRows[k].breakdown[cv] = {};
                    });
                });

                periodResults.forEach(r => {
                    const cv = r.col_value;

                    const osaMetrics = {
                        'Yesterday': r.deno_yesterday > 0 ? (r.neno_yesterday / r.deno_yesterday) * 100 : 0,
                        'Last Week': r.deno_lastweek > 0 ? (r.neno_lastweek / r.deno_lastweek) * 100 : 0,
                        'MTD': r.deno_mtd > 0 ? (r.neno_mtd / r.deno_mtd) * 100 : 0,
                        'L3M': r.deno_l3m > 0 ? (r.neno_l3m / r.deno_l3m) * 100 : 0
                    };

                    const frMetrics = {
                        'Yesterday': r.deno_yesterday > 0 ? (r.buybox_neno_yesterday / r.deno_yesterday) * 100 : 0,
                        'Last Week': r.deno_lastweek > 0 ? (r.buybox_neno_lastweek / r.deno_lastweek) * 100 : 0,
                        'MTD': r.deno_mtd > 0 ? (r.buybox_neno_mtd / r.deno_mtd) * 100 : 0,
                        'L3M': r.deno_l3m > 0 ? (r.buybox_neno_l3m / r.deno_l3m) * 100 : 0
                    };

                    // Update breakdowns
                    ['Yesterday', 'Last Week', 'MTD', 'L3M'].forEach(periodKey => {
                        if (kpiRows.osa.breakdown[cv]) kpiRows.osa.breakdown[cv][periodKey] = Math.round(osaMetrics[periodKey] || 0);
                        if (kpiRows.fillrate.breakdown[cv]) kpiRows.fillrate.breakdown[cv][periodKey] = Math.round(frMetrics[periodKey] || 0);

                        // For DOI and PSL, we maintain the overall current value for now in period breakdown 
                        // as they involve complex lookbacks per period
                        if (kpiRows.doi.breakdown[cv]) kpiRows.doi.breakdown[cv][periodKey] = kpiRows.doi.data?.[cv]?.value || 0;
                        if (kpiRows.psl.breakdown[cv]) kpiRows.psl.breakdown[cv][periodKey] = kpiRows.psl.data?.[cv]?.value || 0;
                        if (kpiRows.delivery && kpiRows.delivery.breakdown[cv]) kpiRows.delivery.breakdown[cv][periodKey] = kpiRows.delivery[cv] || "N/A";
                    });
                });
            } else if (includeBreakdown && drillDimension === 'competitors') {
                // Competitor breakdown - OSA only as per frontend note
                // 1. Find top 5 competitors by volume (deno_osa) in this context
                const topCompQuery = `
                    SELECT 
                        Brand,
                        SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as total_deno
                    FROM rb_pdp_olap
                    WHERE DATE BETWEEN '${currentStartDate.format('YYYY-MM-DD')}' AND '${currentEndDate.format('YYYY-MM-DD')}'
                      ${baseFilter}
                    GROUP BY Brand
                    ORDER BY total_deno DESC
                    LIMIT 5
                `;
                const topComps = await queryClickHouse(topCompQuery);
                const compBrands = topComps.map(r => r.Brand).filter(Boolean);

                // Initialize breakdown structure for all rows
                Object.keys(kpiRows).forEach(k => {
                    kpiRows[k].breakdown = {};
                    columnValues.forEach(cv => {
                        kpiRows[k].breakdown[cv] = {};
                    });
                });

                if (compBrands.length > 0) {
                    const compQuery = `
                        SELECT 
                            ${groupColumn} as col_value,
                            Brand as drill_item,
                            (SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) / nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0)) * 100 as osa
                        FROM rb_pdp_olap
                        WHERE DATE BETWEEN '${currentStartDate.format('YYYY-MM-DD')}' AND '${currentEndDate.format('YYYY-MM-DD')}'
                          AND ${groupColumn} IN (${columnValues.map(v => `'${escapeStr(v)}'`).join(',')})
                          AND Brand IN (${compBrands.map(b => `'${escapeStr(b)}'`).join(',')})
                          ${baseFilter}
                        GROUP BY col_value, drill_item
                    `;
                    const compResults = await queryClickHouse(compQuery);

                    compResults.forEach(r => {
                        if (kpiRows.osa.breakdown[r.col_value]) {
                            kpiRows.osa.breakdown[r.col_value][r.drill_item] = Math.round(r.osa);
                        }
                    });
                    kpiRows.applicableDrillItems = compBrands;
                } else {
                    kpiRows.applicableDrillItems = [];
                }
            }

            return {
                section: "platform_kpi_matrix",
                viewMode,
                columns: ['KPI', ...columnValues],
                rows: [kpiRows.osa, kpiRows.buybox, kpiRows.doi, kpiRows.delivery, kpiRows.skucount, kpiRows.metroAvailability, kpiRows.fillrate, kpiRows.psl],
                applicableDrillItems: kpiRows.applicableDrillItems || [],
                currentPeriod: { start: currentStartDate.format('YYYY-MM-DD'), end: currentEndDate.format('YYYY-MM-DD') },
                comparisonPeriod: { start: prevStartDate.format('YYYY-MM-DD'), end: prevEndDate.format('YYYY-MM-DD') },
                filters,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[getAbsoluteOsaPlatformKpiMatrix] Error:', error);
            throw error;
        }
    }, CACHE_TTL.SHORT);
};

const getStandaloneOsaPlatformKpiMatrix = async (filters) => {
    console.log('[getStandaloneOsaPlatformKpiMatrix] Request received with filters:', filters);

    const cacheKey = generateCacheKey('standalone_platform_kpi_matrix', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const { viewMode = 'Platform', startDate, endDate } = filters;
            console.log(`\n[DEBUG STANDALONE MATRIX] viewMode: "${viewMode}"`);

            // Date calculations
            const currentEndDate = endDate ? dayjs(endDate) : dayjs();
            const currentStartDate = startDate ? dayjs(startDate) : currentEndDate.subtract(30, 'day');
            const periodDays = currentEndDate.diff(currentStartDate, 'day') + 1;
            const prevEndDate = currentStartDate.subtract(1, 'day');
            const prevStartDate = prevEndDate.subtract(periodDays - 1, 'day');

            const startStr = currentStartDate.format('YYYY-MM-DD');
            const endStr = currentEndDate.format('YYYY-MM-DD');
            const startPrevStr = prevStartDate.format('YYYY-MM-DD');
            const endPrevStr = prevEndDate.format('YYYY-MM-DD');

            const vMode = (viewMode || 'Platform').toLowerCase();
            const groupColumn = vMode === 'platform' ? 'Platform' : (vMode === 'format' || vMode === 'category') ? 'Category' : 'Location';
            const msGroupColumn = vMode === 'platform' ? 'platform' : (vMode === 'format' || vMode === 'category') ? 'category' : 'location';

            const baseFilterParams = { ...filters };
            delete baseFilterParams.startDate;
            delete baseFilterParams.endDate;
            delete baseFilterParams.dates;
            delete baseFilterParams.months;

            const baseWhereClause = await buildAvailabilityWhereClause(baseFilterParams);
            const baseFilter = baseWhereClause !== '1=1' ? ` AND ${baseWhereClause}` : '';

            // MS Filters Logic
            const buildMsFilters = () => {
                const ms = { ...baseFilterParams };
                if (vMode === 'platform') delete ms.platform;
                if (vMode === 'format' || vMode === 'category') { delete ms.category; delete ms.formats; }
                if (vMode === 'city' || vMode === 'location') { delete ms.location; delete ms.cities; }
                
                let msConds = [];
                if (ms.platform && ms.platform.length > 0 && !ms.platform.includes('All')) {
                    msConds.push(`platform IN (${ms.platform.map(v => `'${escapeStr(v)}'`).join(',')})`);
                }
                if (ms.formats && ms.formats.length > 0 && !ms.formats.includes('All')) {
                    const mappedCats = ms.formats.map(c => {
                        if (c === 'Chocolates') return 'Chocolates (Non Gifting)';
                        if (c === 'Chocolate Gift Pack') return 'Chocolates (Gifting)';
                        return c;
                    });
                    msConds.push(`category IN (${mappedCats.map(v => `'${escapeStr(v)}'`).join(',')})`);
                }
                if (ms.cities && ms.cities.length > 0 && !ms.cities.includes('All') && !ms.cities.includes('All India')) {
                    msConds.push(`location IN (${ms.cities.map(v => `'${escapeStr(v)}'`).join(',')})`);
                }
                if (ms.brand && ms.brand.length > 0 && !ms.brand.includes('All')) {
                    msConds.push(`brand IN (${ms.brand.map(v => `'${escapeStr(v)}'`).join(',')})`);
                }
                return msConds.length > 0 ? ' AND ' + msConds.join(' AND ') : '';
            };

            const msFiltersCond = buildMsFilters();

            // Get our brands
            const brandQuery = `SELECT DISTINCT brand_name FROM rca_sku_dim WHERE comp_flag = 0 AND brand_name IS NOT NULL AND brand_name != ''`;
            const brandResult = await queryClickHouse(brandQuery);
            const ourBrands = brandResult.map(b => b.brand_name).filter(Boolean);
            const marsCond = ourBrands.length > 0 
                ? `lower(group_brand) IN (${ourBrands.map(b => `'${escapeStr(b.toLowerCase())}'`).join(',')})`
                : "1=0";

            /* Get Distinct Columns */
            let additionalCategoryFilter = '';
            if (groupColumn === 'Category') {
                const dbName = getCurrentDbName();
                const colMap = getColumnMapping(dbName);
                const rcaCatCol = colMap.rca_sku_dim.category;
                const validCatResult = await queryClickHouse(`SELECT DISTINCT ${rcaCatCol} as category FROM rca_sku_dim WHERE status = 1 AND ${rcaCatCol} IS NOT NULL AND ${rcaCatCol} != ''`);
                const validCategories = validCatResult.map(r => r.category).filter(Boolean);
                if (validCategories.length > 0) {
                    additionalCategoryFilter = ` AND ${groupColumn} IN (${validCategories.map(c => `'${escapeStr(c)}'`).join(',')})`;
                }
            }

            const distinctQuery = `
                SELECT DISTINCT ${groupColumn} as value
                FROM rb_pdp_olap
                WHERE ${groupColumn} IS NOT NULL AND ${groupColumn} != ''
                ${baseFilter}
                ${additionalCategoryFilter}
                ORDER BY value
                LIMIT 50
            `;

            const columnValues = (await queryClickHouse(distinctQuery))
                .map(r => r.value)
                .filter(v => v && v.trim());

            if (columnValues.length === 0) {
                return { viewMode, columns: ['KPI'], rows: [], applicableDrillItems: [], filters, timestamp: new Date().toISOString() };
            }
            
            const groupValuesFilter = `${groupColumn} IN (${columnValues.map(v => `'${escapeStr(v)}'`).join(',')})`;
            
            // Map MS grouping values (resolving naming mismatch between OLAPs)
            let mappedColumnValues = [...columnValues];
            if (groupColumn === 'Category') {
               mappedColumnValues = columnValues.map(c => {
                   if (c === 'Chocolates') return 'Chocolates (Non Gifting)';
                   if (c === 'Chocolate Gift Pack') return 'Chocolates (Gifting)';
                   return c;
               });
            }
            const msGroupValuesFilter = `${msGroupColumn} IN (${mappedColumnValues.map(v => `'${escapeStr(v)}'`).join(',')})`;

            // 1. Current & Prev OSA
            const osaQuery = `
                SELECT 
                    ${groupColumn} as col_value,
                    SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) as sum_neno,
                    SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as sum_deno
                FROM rb_pdp_olap
                WHERE DATE BETWEEN '${startStr}' AND '${endStr}' AND ${groupValuesFilter} ${baseFilter}
                GROUP BY col_value
            `;
            const prevOsaQuery = `
                SELECT 
                    ${groupColumn} as col_value,
                    SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) as sum_neno,
                    SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as sum_deno
                FROM rb_pdp_olap
                WHERE DATE BETWEEN '${startPrevStr}' AND '${endPrevStr}' AND ${groupValuesFilter} ${baseFilter}
                GROUP BY col_value
            `;

            // 2. Current & Prev MS (Our Brands Sales + Category Size)
            const msQuery = `
                SELECT 
                    ${msGroupColumn} as col_value_raw,
                    SUM(if(${marsCond}, toFloat64OrZero(toString(sales)), 0)) as curr_mw_sales,
                    SUM(toFloat64OrZero(toString(sales))) as curr_cat_sales
                FROM rb_ms_olap
                WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}' AND ${msGroupValuesFilter} ${msFiltersCond}
                GROUP BY col_value_raw
            `;
            const prevMsQuery = `
                SELECT 
                    ${msGroupColumn} as col_value_raw,
                    SUM(if(${marsCond}, toFloat64OrZero(toString(sales)), 0)) as prev_mw_sales,
                    SUM(toFloat64OrZero(toString(sales))) as prev_cat_sales
                FROM rb_ms_olap
                WHERE toDate(created_on) BETWEEN '${startPrevStr}' AND '${endPrevStr}' AND ${msGroupValuesFilter} ${msFiltersCond}
                GROUP BY col_value_raw
            `;

            const [osaRes, prevOsaRes, msRes, prevMsRes] = await Promise.all([
                queryClickHouse(osaQuery), queryClickHouse(prevOsaQuery),
                queryClickHouse(msQuery), queryClickHouse(prevMsQuery)
            ]);

            const mapByCol = (arr) => arr.reduce((acc, curr) => ({ ...acc, [curr.col_value]: curr }), {});
            const osaMap = mapByCol(osaRes);
            const prevOsaMap = mapByCol(prevOsaRes);

            // Re-map MS raw values back to standard PDP OLAP names
            const mapMsByCol = (arr) => arr.reduce((acc, curr) => {
               let standardVal = curr.col_value_raw;
               if (groupColumn === 'Category') {
                   if (standardVal === 'Chocolates (Non Gifting)') standardVal = 'Chocolates';
                   else if (standardVal === 'Chocolates (Gifting)') standardVal = 'Chocolate Gift Pack';
               }
               acc[standardVal] = curr;
               return acc;
            }, {});
            const msMap = mapMsByCol(msRes);
            const prevMsMap = mapMsByCol(prevMsRes);

            const kpiRows = {
                osa: { kpi: 'OSA', trend: {}, breakdown: {} },
                marketShare: { kpi: 'Market Share%', trend: {}, breakdown: {} },
                applicableDrillItems: []
            };

            for (const colValue of columnValues) {
                // OSA KPI
                const currNeno = parseFloat(osaMap[colValue]?.sum_neno || 0);
                const currDeno = parseFloat(osaMap[colValue]?.sum_deno || 0);
                const prevNeno = parseFloat(prevOsaMap[colValue]?.sum_neno || 0);
                const prevDeno = parseFloat(prevOsaMap[colValue]?.sum_deno || 0);
                
                const hasOsaData = osaMap[colValue] !== undefined && currDeno > 0;
                const currOsa = hasOsaData ? (currNeno / currDeno) * 100 : null;
                const hasPrevOsaData = prevOsaMap[colValue] !== undefined && prevDeno > 0;
                const prevOsa = hasPrevOsaData ? (prevNeno / prevDeno) * 100 : null;

                kpiRows.osa[colValue] = currOsa !== null ? Math.round(currOsa) : null;
                kpiRows.osa.trend[colValue] = (currOsa !== null && prevOsa !== null) ? Math.round(currOsa - prevOsa) : null;

                // Market Share KPI
                const currMwSales = parseFloat(msMap[colValue]?.curr_mw_sales || 0);
                const currCatSales = parseFloat(msMap[colValue]?.curr_cat_sales || 0);
                const prevMwSales = parseFloat(prevMsMap[colValue]?.prev_mw_sales || 0);
                const prevCatSales = parseFloat(prevMsMap[colValue]?.prev_cat_sales || 0);
                
                const hasMsData = msMap[colValue] !== undefined && currCatSales > 0;
                const currMs = hasMsData ? (currMwSales / currCatSales) * 100 : null;
                const hasPrevMsData = prevMsMap[colValue] !== undefined && prevCatSales > 0;
                const prevMs = hasPrevMsData ? (prevMwSales / prevCatSales) * 100 : null;

                kpiRows.marketShare[colValue] = currMs !== null ? parseFloat(currMs.toFixed(2)) : null;
                kpiRows.marketShare.trend[colValue] = (currMs !== null && prevMs !== null) ? parseFloat((currMs - prevMs).toFixed(2)) : null;
            }

            // --- BREAKDOWN LOGIC ---
            const { drillDimension = 'region', includeBreakdown = false } = filters;
            
            if (includeBreakdown && drillDimension === 'region') {
                const regionBreakdownQuery = `
                    WITH location_mapping AS (
                        SELECT lower(location) as l_key, any(region) as mapped_region
                        FROM rb_location_darkstore
                        WHERE region IS NOT NULL AND region != ''
                        GROUP BY l_key
                    )
                    SELECT 
                        t1.${groupColumn} as col_value,
                        l.mapped_region as drill_item,
                        SUM(if(t1.DATE BETWEEN '${startStr}' AND '${endStr}', ifNull(toFloat64OrZero(toString(t1.neno_osa)), 0), 0)) as sum_neno,
                        SUM(if(t1.DATE BETWEEN '${startStr}' AND '${endStr}', ifNull(toFloat64OrZero(toString(t1.deno_osa)), 0), 0)) as sum_deno
                    FROM rb_pdp_olap t1
                    LEFT JOIN location_mapping l ON lower(t1.Location) = l.l_key
                    WHERE t1.DATE BETWEEN '${startPrevStr}' AND '${endStr}' 
                      AND t1.${groupValuesFilter} ${baseFilter}
                    GROUP BY col_value, drill_item
                    HAVING drill_item IS NOT NULL AND drill_item != ''
                `;

                const breakdownRes = await queryClickHouse(regionBreakdownQuery);
                const drillItemsSet = new Set();

                for (const row of breakdownRes) {
                    const { col_value, drill_item } = row;
                    drillItemsSet.add(drill_item);
                    if (!kpiRows.osa.breakdown[col_value]) kpiRows.osa.breakdown[col_value] = {};

                    const neno = parseFloat(row.sum_neno || 0);
                    const deno = parseFloat(row.sum_deno || 0);
                    kpiRows.osa.breakdown[col_value][drill_item] = deno > 0 ? Math.round((neno / deno) * 100) : 0;
                }
                kpiRows.applicableDrillItems = Array.from(drillItemsSet).sort();
                
                // MS Region Breakdown
                const msRegionBreakdownQuery = `
                    WITH location_mapping AS (
                        SELECT lower(location) as l_key, any(region) as mapped_region
                        FROM rb_location_darkstore
                        WHERE region IS NOT NULL AND region != ''
                        GROUP BY l_key
                    )
                    SELECT 
                        t1.${msGroupColumn} as col_value_raw,
                        l.mapped_region as drill_item,
                        SUM(if(${marsCond}, toFloat64OrZero(toString(t1.sales)), 0)) as mw_sales,
                        SUM(toFloat64OrZero(toString(t1.sales))) as cat_sales
                    FROM rb_ms_olap t1
                    LEFT JOIN location_mapping l ON lower(t1.location) = l.l_key
                    WHERE toDate(t1.created_on) BETWEEN '${startStr}' AND '${endStr}' 
                      AND t1.${msGroupValuesFilter} ${msFiltersCond}
                    GROUP BY col_value_raw, drill_item
                    HAVING drill_item IS NOT NULL AND drill_item != ''
                `;
                
                const msBreakdownRes = await queryClickHouse(msRegionBreakdownQuery);
                for (const row of msBreakdownRes) {
                    let standardVal = row.col_value_raw;
                    if (groupColumn === 'Category') {
                        if (standardVal === 'Chocolates (Non Gifting)') standardVal = 'Chocolates';
                        else if (standardVal === 'Chocolates (Gifting)') standardVal = 'Chocolate Gift Pack';
                    }
                    const { drill_item } = row;
                    if (!kpiRows.marketShare.breakdown[standardVal]) kpiRows.marketShare.breakdown[standardVal] = {};
                    const mw = parseFloat(row.mw_sales || 0);
                    const cat = parseFloat(row.cat_sales || 0);
                    kpiRows.marketShare.breakdown[standardVal][drill_item] = cat > 0 ? parseFloat(((mw / cat) * 100).toFixed(2)) : 0;
                }
            } else if (includeBreakdown && drillDimension === 'period') {
                const periodBreakdownQuery = `
                    SELECT 
                        ${groupColumn} as col_value,
                        toStartOfWeek(DATE, 1) as drill_item,
                        SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) as sum_neno,
                        SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as sum_deno
                    FROM rb_pdp_olap
                    WHERE DATE BETWEEN '${startStr}' AND '${endStr}' AND ${groupValuesFilter} ${baseFilter}
                    GROUP BY col_value, drill_item
                `;
                const breakdownRes = await queryClickHouse(periodBreakdownQuery);
                
                const formatPeriodLocal = (res) => {
                     return res.map(row => {
                         const dateObj = dayjs(row.drill_item);
                         const weekStart = dateObj.format('DD MMM');
                         const weekEnd = dateObj.add(6, 'day').format('DD MMM');
                         return { ...row, drill_item: `${weekStart} - ${weekEnd}` };
                     });
                };
                const formattedRes = formatPeriodLocal(breakdownRes); 
                
                const drillItemsSet = new Set();
                for (const row of formattedRes) {
                    const { col_value, drill_item } = row;
                    drillItemsSet.add(drill_item);
                    if (!kpiRows.osa.breakdown[col_value]) kpiRows.osa.breakdown[col_value] = {};
                    const neno = parseFloat(row.sum_neno || 0);
                    const deno = parseFloat(row.sum_deno || 0);
                    kpiRows.osa.breakdown[col_value][drill_item] = deno > 0 ? Math.round((neno / deno) * 100) : 0;
                }
                
                const msPeriodBreakdownQuery = `
                    SELECT 
                        ${msGroupColumn} as col_value_raw,
                        toStartOfWeek(toDate(created_on), 1) as drill_item,
                        SUM(if(${marsCond}, toFloat64OrZero(toString(sales)), 0)) as mw_sales,
                        SUM(toFloat64OrZero(toString(sales))) as cat_sales
                    FROM rb_ms_olap
                    WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}' AND ${msGroupValuesFilter} ${msFiltersCond}
                    GROUP BY col_value_raw, drill_item
                `;
                const msBreakdownRes = await queryClickHouse(msPeriodBreakdownQuery);
                const formattedMsRes = formatPeriodLocal(msBreakdownRes);
                for (const row of formattedMsRes) {
                    let standardVal = row.col_value_raw;
                    if (groupColumn === 'Category') {
                        if (standardVal === 'Chocolates (Non Gifting)') standardVal = 'Chocolates';
                        else if (standardVal === 'Chocolates (Gifting)') standardVal = 'Chocolate Gift Pack';
                    }
                    const { drill_item } = row;
                    drillItemsSet.add(drill_item);
                    if (!kpiRows.marketShare.breakdown[standardVal]) kpiRows.marketShare.breakdown[standardVal] = {};
                    const mw = parseFloat(row.mw_sales || 0);
                    const cat = parseFloat(row.cat_sales || 0);
                    kpiRows.marketShare.breakdown[standardVal][drill_item] = cat > 0 ? parseFloat(((mw / cat) * 100).toFixed(2)) : 0;
                }
                kpiRows.applicableDrillItems = Array.from(drillItemsSet).sort();
            } else if (includeBreakdown && drillDimension === 'competitors') {
                const topBrandsQuery = `
                    SELECT lower(Brand) as drill_item, SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) as sales_vol
                    FROM rb_pdp_olap
                    WHERE DATE BETWEEN '${startStr}' AND '${endStr}' ${baseFilter}
                      AND Brand IS NOT NULL AND Brand != ''
                    GROUP BY drill_item
                    ORDER BY sales_vol DESC
                    LIMIT 4
                `;
                const dbBrands = (await queryClickHouse(topBrandsQuery)).map(r => r.drill_item);
                const drillItemsSet = new Set(dbBrands);
                
                if (drillItemsSet.size > 0) {
                    const compBreakdownQuery = `
                        SELECT 
                            ${groupColumn} as col_value,
                            lower(Brand) as drill_item,
                            SUM(if(DATE BETWEEN '${startStr}' AND '${endStr}', ifNull(toFloat64OrZero(toString(neno_osa)), 0), 0)) as sum_neno,
                            SUM(if(DATE BETWEEN '${startStr}' AND '${endStr}', ifNull(toFloat64OrZero(toString(deno_osa)), 0), 0)) as sum_deno
                        FROM rb_pdp_olap
                        WHERE DATE BETWEEN '${startPrevStr}' AND '${endStr}' 
                          AND lower(Brand) IN (${Array.from(drillItemsSet).map(v => `'${escapeStr(v)}'`).join(',')})
                          AND ${groupValuesFilter} ${baseFilter}
                        GROUP BY col_value, drill_item
                    `;
                    const breakdownRes = await queryClickHouse(compBreakdownQuery);
                    
                    for (const row of breakdownRes) {
                        const { col_value, drill_item } = row;
                        if (!kpiRows.osa.breakdown[col_value]) kpiRows.osa.breakdown[col_value] = {};
                        const neno = parseFloat(row.sum_neno || 0);
                        const deno = parseFloat(row.sum_deno || 0);
                        const formattedBrandName = drill_item.split(' ').map(w => w.charAt(0).toUpperCase() + w.substring(1)).join(' ');
                        kpiRows.osa.breakdown[col_value][formattedBrandName] = deno > 0 ? Math.round((neno / deno) * 100) : 0;
                    }
                    kpiRows.applicableDrillItems = Array.from(drillItemsSet).map(name => name.split(' ').map(w => w.charAt(0).toUpperCase() + w.substring(1)).join(' ')).sort();
                }
            }

            return {
                viewMode,
                columns: ['KPI', ...columnValues],
                rows: [kpiRows.osa, kpiRows.marketShare],
                applicableDrillItems: kpiRows.applicableDrillItems || [],
                filters,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[getStandaloneOsaPlatformKpiMatrix] Error:', error);
            throw error;
        }
    }, CACHE_TTL.SHORT);
};

const getAbsoluteOsaPercentageDetail = async (filters) => {
    console.log('[getAbsoluteOsaPercentageDetail] Request received with filters:', filters);

    // Apply default dates if not provided to ensure performance and "not applied" behavior
    const effectiveFilters = { ...filters };
    if (!effectiveFilters.startDate && !effectiveFilters.endDate && !effectiveFilters.dates && !effectiveFilters.months) {
        effectiveFilters.endDate = dayjs().format('YYYY-MM-DD');
        effectiveFilters.startDate = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
    }

    const cacheKey = generateCacheKey('osa_percentage_detail_with_cities', effectiveFilters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const whereClause = await buildAvailabilityWhereClause(effectiveFilters);

            // Dynamically resolve columns from the PDP table
            const pdpColsMap = await getTableColumns('rb_pdp_olap');
            const catCol = resolveColumn(pdpColsMap, 'Category', 'Category');
            const pcCol = resolveColumn(pdpColsMap, 'Product_type', 'Product_type');

            const query = `
                SELECT 
                    Product as name,
                    Web_Pid as sku,
                    Brand as brand,
                    Location as city,
                    Platform as platform,
                    ${catCol} as category_name,
                    ${pcCol} as product_category_name,
                    DATE,
                    SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) as sum_neno,
                    SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as sum_deno
                FROM rb_pdp_olap
                WHERE ${whereClause}
                  AND Product != '0'
                  AND Product != ''
                  AND length(trim(Product)) > 0
                GROUP BY Product, Web_Pid, Brand, Location, Platform, ${catCol}, ${pcCol}, DATE
                ORDER BY Product, Web_Pid, Brand, Location, DATE
            `;

            const results = await queryClickHouse(query);

            const skuMap = {};

            // Determine the full date range for gap filling
            let rangeStart = effectiveFilters.startDate;
            let rangeEnd = effectiveFilters.endDate;

            if (!rangeStart || !rangeEnd) {
                if (effectiveFilters.months && effectiveFilters.months.length > 0) {
                    const sortedMonths = [...effectiveFilters.months].sort();
                    rangeStart = dayjs(sortedMonths[0]).startOf('month').format('YYYY-MM-DD');
                    rangeEnd = dayjs(sortedMonths[sortedMonths.length - 1]).endOf('month').format('YYYY-MM-DD');
                } else if (results.length > 0) {
                    const allDatesArr = results.map(r => dayjs(r.DATE).format('YYYY-MM-DD')).sort();
                    rangeStart = allDatesArr[0];
                    rangeEnd = allDatesArr[allDatesArr.length - 1];
                } else {
                    rangeEnd = dayjs().format('YYYY-MM-DD');
                    rangeStart = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
                }
            }

            // Generate full date list
            const sortedDates = [];
            let current = dayjs(rangeStart);
            const end = dayjs(rangeEnd);
            while (current.isBefore(end) || current.isSame(end)) {
                sortedDates.push(current.format('YYYY-MM-DD'));
                current = current.add(1, 'day');
            }

            // Process results into nested map: SKU -> Date -> OSA, and SKU -> City -> Date -> OSA
            results.forEach(row => {
                // Normalize Web_Pid to lowercase – ClickHouse may return mixed-case
                // UUIDs across different dates, causing duplicate skuMap entries.
                const skuId = (row.sku || '').toLowerCase();
                const cityStr = row.city;
                const dateStr = dayjs(row.DATE).format('YYYY-MM-DD');

                const neno = parseFloat(row.sum_neno) || 0;
                const deno = parseFloat(row.sum_deno) || 0;

                if (!skuMap[skuId]) {
                    skuMap[skuId] = {
                        name: row.name,
                        sku: skuId, // Use normalized lowercase SKU
                        brand: row.brand,
                        platform: row.platform,
                        category_name: row.category_name,
                        product_category_name: row.product_category_name,
                        days: {}, // Overall SKU daily aggregations: { date: { neno, deno } }
                        cities: {} // Nested city data: { city: { date: osa } }
                    };
                }

                // Overall SKU aggregation
                if (!skuMap[skuId].days[dateStr]) {
                    skuMap[skuId].days[dateStr] = { neno: 0, deno: 0 };
                }
                skuMap[skuId].days[dateStr].neno += neno;
                skuMap[skuId].days[dateStr].deno += deno;

                // City specific data
                if (cityStr && cityStr.trim() !== '') {
                    if (!skuMap[skuId].cities[cityStr]) {
                        skuMap[skuId].cities[cityStr] = {};
                    }
                    if (!skuMap[skuId].cities[cityStr][dateStr]) {
                        skuMap[skuId].cities[cityStr][dateStr] = { neno: 0, deno: 0 };
                    }
                    skuMap[skuId].cities[cityStr][dateStr].neno += neno;
                    skuMap[skuId].cities[cityStr][dateStr].deno += deno;
                }
            });

            // Map data into final format: [{ name, sku, values: [...], avg31, status, cities: [{ name, values: [...], avg31 }] }]
            const formattedData = Object.values(skuMap).map(item => {
                let totalNeno = 0;
                let totalDeno = 0;

                // Determine overall SKU daily OSA
                const skuValues = sortedDates.map(d => {
                    const dayData = item.days[d];
                    if (dayData) {
                        totalNeno += dayData.neno;
                        totalDeno += dayData.deno;
                        if (dayData.deno > 0) {
                            return parseFloat(((dayData.neno / dayData.deno) * 100).toFixed(1));
                        }
                    }
                    return 0; // fallback UI
                });

                const skuAvg31 = totalDeno > 0 ? Math.round((totalNeno / totalDeno) * 100) : 0;
                const avgSelected = skuAvg31;

                const last7Values = skuValues.slice(-7);
                const avg7 = last7Values.length > 0
                    ? Math.round(last7Values.reduce((a, b) => a + b, 0) / last7Values.length)
                    : skuAvg31;

                let status = "Healthy";
                if (avgSelected < 70) status = "Action"; // Status based on selected period
                else if (avgSelected < 85) status = "Watch";

                // Format nested cities
                const sortedCities = Object.entries(item.cities).map(([cityName, cityDays]) => {
                    let cityNeno = 0;
                    let cityDeno = 0;
                    const cityValues = sortedDates.map(d => {
                        const dayData = cityDays[d];
                        if (dayData) {
                            cityNeno += dayData.neno;
                            cityDeno += dayData.deno;
                            if (dayData.deno > 0) {
                                return parseFloat(((dayData.neno / dayData.deno) * 100).toFixed(1));
                            }
                        }
                        return 0;
                    });
                    const cityAvg31 = cityDeno > 0 ? Math.round((cityNeno / cityDeno) * 100) : 0;
                    const cityAvgSelected = cityAvg31;

                    return {
                        name: cityName,
                        values: cityValues,
                        avg31: cityAvg31,
                        avgSelected: cityAvgSelected
                    };
                }).sort((a, b) => a.name.localeCompare(b.name));

                // Filter out products where both neno and deno over the selected period are 0
                if (totalNeno === 0 && totalDeno === 0) {
                    return null;
                }

                return {
                    name: item.name,
                    sku: item.sku,
                    brand: item.brand,
                    platform: item.platform,
                    format: item.category_name,
                    productCategory: item.product_category_name,
                    values: skuValues,
                    avg7: avg7,
                    avg31: skuAvg31,
                    avgSelected: avgSelected,
                    status: status,
                    cities: sortedCities
                };
            }).filter(Boolean).sort((a, b) => b.avgSelected - a.avgSelected || a.name.localeCompare(b.name));

            return formattedData;
        } catch (error) {
            console.error('[getAbsoluteOsaPercentageDetail] Error:', error);
            throw error;
        }
    }, CACHE_TTL.SHORT);
};

const getDOI = async (filters) => {
    console.log('[getDOI] Request received with filters:', filters);

    const cacheKey = generateCacheKey('doi_overview', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const { platform, brand, location, startDate, endDate } = filters;

            const currentEndDate = endDate ? dayjs(endDate) : dayjs();
            const currentStartDate = startDate ? dayjs(startDate) : currentEndDate.startOf('month');
            const prevEndDate = currentEndDate.subtract(30, 'day').subtract(1, 'day');
            const prevStartDate = prevEndDate.subtract(29, 'day');

            // Build filter conditions using buildAvailabilityWhereClause
            // Note: We exclude dates from the base params and add them manually for each sub-query
            const baseParams = { ...filters };
            delete baseParams.startDate;
            delete baseParams.endDate;
            delete baseParams.dates;
            delete baseParams.months;

            const baseWhere = await buildAvailabilityWhereClause(baseParams);
            const baseFilter = baseWhere !== '1=1' ? ` AND ${baseWhere}` : '';

            // Get latest non-zero total inventory and 30-day sales
            // This query follows the exact logic requested:
            // Latest Inventory (where total > 0) divided by 30rd Qty_Sold, times 30.
            const thirtyDaysAgo = currentEndDate.subtract(29, 'day');

            const mainDoiQuery = `
                SELECT
                    latest_inventory,
                    total_qty_sold_30d,
                    if(total_qty_sold_30d > 0, (latest_inventory / total_qty_sold_30d) * 30, 0) AS DOI
                FROM
                (
                    -- Latest Inventory (non-zero, latest date)
                    SELECT
                        argMax(total_inventory, DATE) AS latest_inventory
                    FROM
                    (
                        SELECT
                            DATE,
                            sum(ifNull(toFloat64OrZero(toString(Inventory)), 0)) AS total_inventory
                        FROM rb_pdp_olap
                        WHERE DATE BETWEEN '${currentStartDate.format('YYYY-MM-DD')}' AND '${currentEndDate.format('YYYY-MM-DD')}'
                        ${baseFilter}
                        GROUP BY DATE
                    )
                    WHERE total_inventory > 0
                ) inv
                CROSS JOIN
                (
                    -- Total Qty Sold in last 30 days
                    SELECT
                        sum(ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) AS total_qty_sold_30d
                    FROM rb_pdp_olap
                    WHERE DATE BETWEEN '${thirtyDaysAgo.format('YYYY-MM-DD')}' AND '${currentEndDate.format('YYYY-MM-DD')}'
                    ${baseFilter}
                ) sales
            `;

            // Previous period DOI query
            const prevDoiQuery = `
                SELECT
                    latest_inventory,
                    total_qty_sold_30d,
                    if(total_qty_sold_30d > 0, (latest_inventory / total_qty_sold_30d) * 30, 0) AS DOI
                FROM
                (
                    -- Latest Inventory (non-zero, latest date)
                    SELECT
                        argMax(total_inventory, DATE) AS latest_inventory
                    FROM
                    (
                        SELECT
                            DATE,
                            sum(ifNull(toFloat64OrZero(toString(Inventory)), 0)) AS total_inventory
                        FROM rb_pdp_olap
                        WHERE DATE BETWEEN '${prevStartDate.format('YYYY-MM-DD')}' AND '${prevEndDate.format('YYYY-MM-DD')}'
                        ${baseFilter}
                        GROUP BY DATE
                    )
                    WHERE total_inventory > 0
                ) inv
                CROSS JOIN
                (
                    -- Total Qty Sold in last 30 days
                    SELECT
                        sum(ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) AS total_qty_sold_30d
                    FROM rb_pdp_olap
                    WHERE DATE BETWEEN '${prevStartDate.format('YYYY-MM-DD')}' AND '${prevEndDate.format('YYYY-MM-DD')}'
                    ${baseFilter}
                ) sales
            `;

            const [mainDoiResult, prevDoiResult] = await Promise.all([
                queryClickHouse(mainDoiQuery),
                queryClickHouse(prevDoiQuery)
            ]);

            const todayInventory = parseFloat(mainDoiResult[0]?.latest_inventory) || 0;
            const totalQtySold = parseFloat(mainDoiResult[0]?.total_qty_sold_30d) || 0;
            const currentDOI = parseFloat(mainDoiResult[0]?.DOI) || 0;

            const prevInventory = parseFloat(prevDoiResult[0]?.latest_inventory) || 0;
            const prevTotalQtySold = parseFloat(prevDoiResult[0]?.total_qty_sold_30d) || 0;
            const prevDOI = parseFloat(prevDoiResult[0]?.DOI) || 0;

            const changePercent = prevDOI > 0 ? ((currentDOI - prevDOI) / prevDOI) * 100 : 0;

            return {
                section: "doi_overview",
                doi: parseFloat(currentDOI.toFixed(1)),
                prevDoi: parseFloat(prevDOI.toFixed(1)),
                changePercent: parseFloat(changePercent.toFixed(1)),
                todayInventory: todayInventory,
                totalQtySold: totalQtySold,
                filters: filters,
                currentPeriod: {
                    inventoryDate: currentEndDate.format('YYYY-MM-DD'),
                    qtySoldStart: thirtyDaysAgo.format('YYYY-MM-DD'),
                    qtySoldEnd: currentEndDate.format('YYYY-MM-DD')
                },
                comparisonPeriod: {
                    inventoryDate: prevEndDate.format('YYYY-MM-DD'),
                    qtySoldStart: prevStartDate.format('YYYY-MM-DD'),
                    qtySoldEnd: prevEndDate.format('YYYY-MM-DD')
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[getDOI] Error:', error);
            throw error;
        }
    }, CACHE_TTL.SHORT);
};

const getMetroCities = async () => {
    const cacheKey = generateCacheKey('metro_cities_list', {});

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const query = `
                SELECT DISTINCT location
                FROM rb_location_darkstore
                WHERE lower(tier) = 'tier 1'
            `;
            const results = await queryClickHouse(query);
            return results.map(r => r.location).filter(Boolean);
        } catch (error) {
            console.error('[getMetroCities] Error:', error);
            return [];
        }
    }, CACHE_TTL.LONG);
};

const isMetroCity = async (location) => {
    if (!location || location === 'All') return true;
    const metroCities = await getMetroCities();
    return metroCities.some(city => city.toLowerCase() === location.toLowerCase());
};

const getMetroCityStockAvailability = async (filters) => {
    console.log('[getMetroCityStockAvailability] Request received with filters:', filters);

    const cacheKey = generateCacheKey('metro_city_osa', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const { platform, brand, location, startDate, endDate } = filters;

            const metroCities = await getMetroCities();
            if (metroCities.length === 0) {
                return {
                    section: "metro_city_osa",
                    stockAvailability: 0,
                    prevStockAvailability: 0,
                    change: 0,
                    isMetroCity: false,
                    filters: filters,
                    timestamp: new Date().toISOString()
                };
            }

            let isLocationMetro = true;
            let targetLocations = metroCities;

            if (location && location !== 'All') {
                isLocationMetro = metroCities.some(c => c.toLowerCase() === location.toLowerCase());
                if (!isLocationMetro) {
                    return {
                        section: "metro_city_osa",
                        stockAvailability: 0,
                        prevStockAvailability: 0,
                        change: 0,
                        isMetroCity: false,
                        filters: filters,
                        timestamp: new Date().toISOString()
                    };
                }
                targetLocations = [location];
            }

            // Build date conditions
            const currentEndDate = endDate ? dayjs(endDate) : dayjs();
            const currentStartDate = startDate ? dayjs(startDate) : currentEndDate.startOf('month');
            const periodDays = currentEndDate.diff(currentStartDate, 'day') + 1;
            const prevEndDate = currentStartDate.subtract(1, 'day');
            const prevStartDate = prevEndDate.subtract(periodDays - 1, 'day');

            // Build filter objects for current and previous periods
            const currentFilters = {
                ...filters,
                startDate: currentStartDate.format('YYYY-MM-DD'),
                endDate: currentEndDate.format('YYYY-MM-DD'),
                location: targetLocations
            };
            const prevFilters = {
                ...filters,
                startDate: prevStartDate.format('YYYY-MM-DD'),
                endDate: prevEndDate.format('YYYY-MM-DD'),
                location: targetLocations
            };

            // Build filter conditions using buildAvailabilityWhereClause
            const currentWhere = await buildAvailabilityWhereClause(currentFilters);
            const prevWhere = await buildAvailabilityWhereClause(prevFilters);

            const [currentResult, prevResult] = await Promise.all([
                queryClickHouse(`
                    SELECT 
                        SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) as sumNeno,
                        SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as sumDeno
                    FROM rb_pdp_olap
                    WHERE ${currentWhere}
                `),
                queryClickHouse(`
                    SELECT 
                        SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) as sumNeno,
                        SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as sumDeno
                    FROM rb_pdp_olap
                    WHERE ${prevWhere}
                `)
            ]);

            const currNeno = parseFloat(currentResult[0]?.sumNeno) || 0;
            const currDeno = parseFloat(currentResult[0]?.sumDeno) || 0;
            const prevNeno = parseFloat(prevResult[0]?.sumNeno) || 0;
            const prevDeno = parseFloat(prevResult[0]?.sumDeno) || 0;

            const currentOsa = currDeno > 0 ? (currNeno / currDeno) * 100 : 0;
            const prevOsa = prevDeno > 0 ? (prevNeno / prevDeno) * 100 : 0;

            return {
                section: "metro_city_osa",
                stockAvailability: parseFloat(currentOsa.toFixed(2)),
                prevStockAvailability: parseFloat(prevOsa.toFixed(2)),
                change: parseFloat((currentOsa - prevOsa).toFixed(2)),
                isMetroCity: true,
                metroCitiesCount: targetLocations.length,
                filters: filters,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[getMetroCityStockAvailability] Error:', error);
            throw error;
        }
    }, CACHE_TTL.SHORT);
};

const getAvailabilityFilterOptions = async ({ filterType, platform, brand, category, productCategory, city, location, months, metroFlag, ownBrandsOnly, channel }) => {
    const pKey = Array.isArray(platform) ? platform.join(',') : (platform || 'all');
    const bKey = Array.isArray(brand) ? brand.join(',') : (brand || 'all');
    const cKey = Array.isArray(category) ? category.join(',') : (category || 'all');
    const pcKey = Array.isArray(productCategory) ? productCategory.join(',') : (productCategory || 'all');
    const ctKey = Array.isArray(city) ? city.join(',') : (city || 'all');
    const mKey = Array.isArray(months) ? months.join(',') : (months || 'all');
    const mfKey = Array.isArray(metroFlag) ? metroFlag.join(',') : (metroFlag || 'all');
    const chKey = Array.isArray(channel) ? channel.join(',') : (channel || 'all');
    const obKey = ownBrandsOnly ? 'own' : 'all';

    const cacheKey = `availability_filter:${filterType}:${pKey.toLowerCase()}:${bKey.toLowerCase()}:${cKey.toLowerCase()}:${pcKey.toLowerCase()}:${ctKey.toLowerCase()}:${mKey.toLowerCase()}:${mfKey.toLowerCase()}:${chKey.toLowerCase()}:${obKey}`;

    // Helper to build IN clause or equality
    const buildInClause = (col, val) => {
        const arr = Array.isArray(val) ? val : [val];
        if (arr.length === 1) return `${col} = '${escapeStr(arr[0])}'`;
        return `${col} IN (${arr.map(v => `'${escapeStr(v)}'`).join(',')})`;
    };

    if (filterType === 'categories' || filterType === 'formats') {
        try {
            const pdpColsMap = await getTableColumns('rb_pdp_olap');
            const actualCatCol = resolveColumn(pdpColsMap, 'Category', 'Category');
            
            const platformCond = await buildPlatformChannelCond(platform, channel);
            const whereClause = platformCond ? `WHERE ${actualCatCol} IS NOT NULL AND ${actualCatCol} != '' AND ${platformCond}` : `WHERE ${actualCatCol} IS NOT NULL AND ${actualCatCol} != ''`;

            const query = `
                        SELECT DISTINCT ${actualCatCol} as value 
                        FROM rb_pdp_olap
                        ${whereClause}
                        ORDER BY value
                    `;
            const results = await queryClickHouse(query);
            return { options: results.map(r => r.value).filter(Boolean) };
        } catch (error) {
            console.error('[getAvailabilityFilterOptions] Categories Error:', error);
            return { options: [] };
        }
    }

    if (filterType === 'productCategories') {
        try {
            const pdpColsMap = await getTableColumns('rb_pdp_olap');
            const actualPcCol = resolveColumn(pdpColsMap, 'Product_type', 'Product_type');

            const platformCond = await buildPlatformChannelCond(platform, channel);
            const whereClause = platformCond ? `WHERE ${actualPcCol} IS NOT NULL AND ${actualPcCol} != '' AND ${platformCond}` : `WHERE ${actualPcCol} IS NOT NULL AND ${actualPcCol} != ''`;

            const query = `
                        SELECT DISTINCT ${actualPcCol} as value 
                        FROM rb_pdp_olap
                        ${whereClause}
                        ORDER BY value
                    `;
            const results = await queryClickHouse(query);
            return { options: results.map(r => r.value).filter(Boolean) };
        } catch (error) {
            console.error('[getAvailabilityFilterOptions] Product Categories Error:', error);
            return { options: [] };
        }
    }

    return getCachedOrCompute(cacheKey, async () => {
        try {
            console.log(`[getAvailabilityFilterOptions] Fetching ${filterType}`);

            if (filterType === 'platforms') {
                const platformCond = await buildPlatformChannelCond(null, channel);
                const whereClause = platformCond ? `WHERE platform IS NOT NULL AND platform != '' AND ${platformCond}` : `WHERE platform IS NOT NULL AND platform != ''`;
                const query = `SELECT DISTINCT platform as value FROM rca_sku_dim ${whereClause} ORDER BY platform`;
                const results = await queryClickHouse(query);
                return { options: results.map(r => r.value).filter(Boolean) };
            }

            if (filterType === 'zones') {
                const query = `SELECT DISTINCT region as value FROM rb_location_darkstore WHERE region IS NOT NULL AND region != '' ORDER BY value`;
                const results = await queryClickHouse(query);
                return { options: results.map(r => r.value).filter(Boolean) };
            }

            if (filterType === 'metroFlags') {
                const query = `SELECT DISTINCT tier as value FROM rb_location_darkstore WHERE tier IS NOT NULL AND tier != '' ORDER BY value`;
                const results = await queryClickHouse(query);
                return { options: results.map(r => r.value).filter(Boolean) };
            }

            if (filterType === 'pincodes') {
                const pincodeConditions = [`pincode IS NOT NULL`];
                if (platform && platform !== 'All') pincodeConditions.push(buildInClause('platform', platform));
                if (city && city !== 'All') pincodeConditions.push(buildInClause('location', city));

                const whereClause = pincodeConditions.length > 0 ? `WHERE ${pincodeConditions.join(' AND ')}` : '';
                const query = `SELECT DISTINCT toString(pincode) as value FROM rb_location_darkstore ${whereClause} ORDER BY value`;
                const results = await queryClickHouse(query);
                return { options: results.map(r => r.value).filter(Boolean) };
            }

            if (filterType === 'kpis') {
                return { options: ['OSA', 'DOI', 'Fillrate', 'PSL'] };
            }

            if (filterType === 'cities') {
                const cityConditions = [];
                if (platform && platform !== 'All') cityConditions.push(buildInClause('platform', platform));
                if (brand && brand !== 'All') cityConditions.push(buildInClause('brand_name', brand));

                if (category && category !== 'All') {
                    cityConditions.push(buildInClause('category', category));
                }

                cityConditions.push(`location IS NOT NULL AND location != ''`);
                cityConditions.push(`comp_flag = 0`);

                const whereClause = cityConditions.length > 0 ? `WHERE ${cityConditions.join(' AND ')}` : '';
                const query = `SELECT DISTINCT location as value FROM rca_sku_dim ${whereClause} ORDER BY location`;
                const results = await queryClickHouse(query);
                return { options: results.map(r => r.value).filter(Boolean) };
            }

            if (filterType === 'brands') {
                const brandConditions = [];
                if (platform && platform !== 'All') brandConditions.push(buildInClause('platform', platform));
                if (city && city !== 'All') brandConditions.push(buildInClause('location', city));

                if (category && category !== 'All') {
                    brandConditions.push(buildInClause('category', category));
                }

                if (ownBrandsOnly === 'true' || ownBrandsOnly === true) {
                    brandConditions.push(`Comp_flag = 0`);
                }

                brandConditions.push(`Brand IS NOT NULL AND Brand != ''`);
                const whereClause = brandConditions.length > 0 ? `WHERE ${brandConditions.join(' AND ')}` : '';
                const query = `SELECT DISTINCT brand_name as value FROM rca_sku_dim ${whereClause} ORDER BY value`;
                const results = await queryClickHouse(query);
                return { options: results.map(r => r.value).filter(Boolean) };
            }

            if (filterType === 'months') {
                const query = `
                    SELECT DISTINCT formatDateTime(DATE, '%Y-%m') as value
                    FROM rb_pdp_olap
                    WHERE DATE IS NOT NULL
                    ORDER BY value DESC
                `;
                const results = await queryClickHouse(query);
                return { options: results.map(r => r.value).filter(Boolean) };
            }

            if (filterType === 'dates') {
                const dateConditions = [`DATE IS NOT NULL`];
                if (months && months !== 'All') {
                    dateConditions.push(buildInClause("formatDateTime(DATE, '%Y-%m')", months));
                }

                const query = `
                    SELECT DISTINCT toString(DATE) as value
                    FROM rb_pdp_olap
                    WHERE ${dateConditions.join(' AND ')}
                    ORDER BY value DESC
                `;
                const results = await queryClickHouse(query);
                return { options: results.map(r => r.value).filter(Boolean) };
            }

            return { options: [] };
        } catch (error) {
            console.error('[getAvailabilityFilterOptions] Error:', error);
            return { options: [] };
        }
    }, CACHE_TTL.MEDIUM);
};

/**
 * Internal helper to build WHERE clause for availability analysis with advanced filters
 */

const getOsaDetailByCategory = async (filters) => {
    console.log('[getOsaDetailByCategory] Request received with filters:', filters);

    // Apply default dates if not provided to ensure performance and "not applied" behavior
    const effectiveFilters = { ...filters };
    if (!effectiveFilters.startDate && !effectiveFilters.endDate && !effectiveFilters.dates && !effectiveFilters.months) {
        effectiveFilters.endDate = dayjs().format('YYYY-MM-DD');
        effectiveFilters.startDate = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
    }

    const cacheKey = generateCacheKey('osa_detail_sku_level', effectiveFilters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const whereClause = await buildAvailabilityWhereClause(effectiveFilters, 't1');

            // Dynamically resolve columns
            const pdpColsMap = await getTableColumns('rb_pdp_olap');
            const catCol = resolveColumn(pdpColsMap, 'Category', 'Category');
            const pcCol = resolveColumn(pdpColsMap, 'Product_type', 'Product_type');
            // Query SKU-level data joined with rca_sku_dim to filter by active segments (status=1)
            // Note: rca_sku_dim uses lowercase column names (platform, location, brand_name, category)
            const query = `
                SELECT 
                    t1.Product as name,
                    t1.Web_Pid as sku,
                    t1.DATE,
                    SUM(ifNull(toFloat64OrZero(toString(t1.neno_osa)), 0)) as sum_neno,
                    SUM(ifNull(toFloat64OrZero(toString(t1.deno_osa)), 0)) as sum_deno
                FROM rb_pdp_olap t1
                JOIN rca_sku_dim t2 ON lower(t1.Platform) = lower(t2.platform) 
                    AND lower(t1.Location) = lower(t2.location) 
                    AND lower(t1.Brand) = lower(t2.brand_name) 
                    AND lower(t1.${catCol}) = lower(t2.category)
                WHERE ${whereClause}
                  AND t2.status = 1
                GROUP BY t1.Product, t1.Web_Pid, t1.DATE
                ORDER BY t1.Product, t1.Web_Pid, t1.DATE
            `;


            const results = await queryClickHouse(query);

            // Transform into the format the frontend expects: { name, sku, values, avg31, status }
            const skuMap = {};

            // Determine the full date range for gap filling
            let rangeStart = effectiveFilters.startDate;
            let rangeEnd = effectiveFilters.endDate;

            if (!rangeStart || !rangeEnd) {
                // If using months filter instead of explicit range
                if (effectiveFilters.months && effectiveFilters.months.length > 0) {
                    const sortedMonths = [...effectiveFilters.months].sort();
                    rangeStart = dayjs(sortedMonths[0]).startOf('month').format('YYYY-MM-DD');
                    rangeEnd = dayjs(sortedMonths[sortedMonths.length - 1]).endOf('month').format('YYYY-MM-DD');
                } else if (results.length > 0) {
                    // Fallback to the dates present in results
                    const allDatesArr = results.map(r => dayjs(r.DATE).format('YYYY-MM-DD')).sort();
                    rangeStart = allDatesArr[0];
                    rangeEnd = allDatesArr[allDatesArr.length - 1];
                } else {
                    // Total fallback
                    rangeEnd = dayjs().format('YYYY-MM-DD');
                    rangeStart = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
                }
            }

            // Generate full date list
            const sortedDates = [];
            let current = dayjs(rangeStart);
            const end = dayjs(rangeEnd);
            while (current.isBefore(end) || current.isSame(end)) {
                sortedDates.push(current.format('YYYY-MM-DD'));
                current = current.add(1, 'day');
            }

            results.forEach(row => {
                // Normalize Web_Pid to lowercase – ClickHouse may return mixed-case
                // UUIDs across different dates, causing duplicate skuMap entries.
                const skuId = (row.sku || '').toLowerCase();
                const dateStr = dayjs(row.DATE).format('YYYY-MM-DD');

                const neno = parseFloat(row.sum_neno) || 0;
                const deno = parseFloat(row.sum_deno) || 0;
                const osa = deno > 0 ? (neno / deno) * 100 : 0;

                if (!skuMap[skuId]) {
                    skuMap[skuId] = {
                        name: row.name,
                        sku: skuId, // Use normalized lowercase SKU
                        dailyOsa: {},
                        totalNeno: 0,
                        totalDeno: 0
                    };
                }
                skuMap[skuId].dailyOsa[dateStr] = parseFloat(osa.toFixed(1));
                skuMap[skuId].totalNeno += neno;
                skuMap[skuId].totalDeno += deno;
            });

            const categories = Object.values(skuMap)
                .filter(item => item.totalNeno > 0 || item.totalDeno > 0)
                .map(item => {
                    // Map to sortedDates and fill gaps with 0
                    const values = sortedDates.map(d => item.dailyOsa[d] ?? 0);

                    // Overall average
                    const totalSum = values.reduce((a, b) => a + b, 0);
                    const avg31 = values.length > 0 ? Math.round(totalSum / values.length) : 0;

                    // Health status logic (based on last 7 days of the selected range)
                    const last7Values = values.slice(-7);
                    const avg7 = last7Values.length > 0
                        ? Math.round(last7Values.reduce((a, b) => a + b, 0) / last7Values.length)
                        : avg31;

                    let status = "Healthy";
                    if (avg7 < 70) status = "Action";
                    else if (avg7 < 85) status = "Watch";

                    return {
                        name: item.name,
                        sku: item.sku,
                        values: values,
                        avg31: avg31,
                        status: status
                    };
                });

            return {
                section: "osa_percentage_detail",
                categories: categories,
                dates: sortedDates,
                filters,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[getOsaDetailByCategory] Error:', error);
            throw error;
        }
    }, CACHE_TTL.SHORT);
};

const getAvailabilityKpiTrends = async (filters) => {
    console.log('[getAvailabilityKpiTrends] Request received with filters:', filters);

    const cacheKey = generateCacheKey('availability_kpi_trends', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            let { platform, brand, location, category, period = '1M', timeStep = 'daily', startDate: filterStart, endDate: filterEnd, dimension, dimensionValue } = filters;

            // Dimension overrides have been removed here.
            // The frontend explicitly sends all necessary filters.

            console.log(`\n[DEBUG TRENDS] Filters:`, JSON.stringify(filters));

            const periodDays = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
            const days = periodDays[period] || 30;

            let currentEndDate, currentStartDate;
            if (filterStart && filterEnd) {
                currentEndDate = dayjs(filterEnd);
                currentStartDate = dayjs(filterStart);
            } else {
                currentEndDate = await getLatestDate();
                currentStartDate = currentEndDate.subtract(days - 1, 'days');
            }

            // Build filter conditions using the enhanced where clause
            // CRITICAL: We MUST pass the calculated startDate and endDate to buildAvailabilityWhereClause
            // so that the SQL query is restricted to the selected period.
            const whereClause = await buildAvailabilityWhereClause({
                ...filters,
                startDate: currentStartDate.format('YYYY-MM-DD'),
                endDate: currentEndDate.format('YYYY-MM-DD')
            });

            // Check if delivery_date and buy_box_neno_osa columns exist before using them
            let deliveryDaysSQL = 'NULL';
            let buyBoxSQL = '0';
            try {
                const pdpCols = await getTableColumns('rb_pdp_olap');
                if (columnExists(pdpCols, 'delivery_date')) {
                    deliveryDaysSQL = `
                        IF(
                            delivery_date IS NULL OR delivery_date = '' OR delivery_date = '0',
                            NULL,
                            CASE
                                WHEN dateDiff('day', DATE, parseDateTimeBestEffortOrNull(concat(delivery_date, ' ', toString(toYear(DATE))))) < 0 THEN 0
                                WHEN dateDiff('day', DATE, parseDateTimeBestEffortOrNull(concat(delivery_date, ' ', toString(toYear(DATE))))) > 30 THEN NULL
                                ELSE dateDiff('day', DATE, parseDateTimeBestEffortOrNull(concat(delivery_date, ' ', toString(toYear(DATE)))))
                            END
                        )
                    `;
                }
                if (columnExists(pdpCols, 'buy_box_neno_osa')) {
                    buyBoxSQL = 'SUM(toFloat64OrZero(toString(buy_box_neno_osa)))';
                }
            } catch (colCheckErr) {
                console.warn('[getAvailabilityKpiTrends] Could not check columns, using defaults:', colCheckErr.message);
            }

            console.log(`[getAvailabilityKpiTrends] Querying for period ${currentStartDate.format('YYYY-MM-DD')} to ${currentEndDate.format('YYYY-MM-DD')}`);

            const query = `
                SELECT 
                    DATE as ref_date,
                    SUM(toFloat64OrZero(toString(neno_osa))) as total_neno,
                    SUM(toFloat64OrZero(toString(deno_osa))) as total_deno,
                    ${buyBoxSQL} as total_buybox_neno,
                    AVG(${deliveryDaysSQL}) as avg_delivery_days,
                    SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) as sum_sales,
                    SUM(toFloat64OrZero(toString(Inventory))) as total_inventory,
                    SUM(toFloat64OrZero(toString(Qty_Sold))) as total_qty_sold,
                    SUM(toFloat64OrZero(toString(MSL))) as total_msl,
                    COUNT(DISTINCT Web_Pid) as assortment_count,
                    AVG(toFloat64OrZero(toString(listing_percent))) as avg_listing_percent
                FROM rb_pdp_olap
                WHERE ${whereClause}
                GROUP BY DATE
                ORDER BY DATE ASC
            `;

            const results = await queryClickHouse(query);

            const timeSeries = results.map(row => {
                const neno = parseFloat(row.total_neno) || 0;
                const deno = parseFloat(row.total_deno) || 0;
                const buyboxNeno = parseFloat(row.total_buybox_neno) || 0;
                const dailyUniquePids = parseInt(row.assortment_count, 10) || 0;

                const osa = deno > 0 ? (neno / deno) * 100 : 0;
                const fillrate = deno > 0 ? (buyboxNeno / deno) * 100 : 0;
                const listing = parseFloat(row.avg_listing_percent) || 0;
                const delivery = row.avg_delivery_days !== null ? parseFloat(row.avg_delivery_days) : 0;

                const totalSales = parseFloat(row.sum_sales) || 0;
                const psl = osa > 0 ? (totalSales / (osa / 100)) - totalSales : 0;

                // DOI = (Current Inventory / Daily Run Rate) where DRR = Qty_Sold / 30
                const totalInventory = parseFloat(row.total_inventory) || 0;
                const totalQtySold = parseFloat(row.total_qty_sold) || 0;
                const drr = totalQtySold / 30;
                const doi = drr > 0 ? totalInventory / drr : 0;

                return {
                    date: dayjs(row.ref_date).format("DD MMM'YY"),
                    Osa: parseFloat(osa.toFixed(1)),
                    Doi: parseFloat(doi.toFixed(1)),
                    Fillrate: parseFloat(fillrate.toFixed(1)),
                    Listing: parseFloat(listing.toFixed(1)),
                    Assortment: dailyUniquePids,
                    Delivery: parseFloat(delivery.toFixed(1)),
                    Psl: parseFloat(psl.toFixed(1))
                };
            });

            return {
                metrics: [
                    { id: 'Osa', label: 'OSA', color: '#F97316', default: true },
                    { id: 'Doi', label: 'DOI (Days)', color: '#14b8a6', default: true },
                    { id: 'Fillrate', label: 'Buy Box %', color: '#F59E0B', default: true },
                    { id: 'Listing', label: 'Listing %', color: '#0EA5E9', default: true },
                    { id: 'Assortment', label: 'Assortment', color: '#22C55E', default: false },
                    { id: 'Delivery', label: 'Delivery Time', color: '#EC4899', default: false },
                    { id: 'Psl', label: 'PSL (₹)', color: '#8B5CF6', default: false }
                ],
                timeSeries,
                period,
                dateRange: { start: currentStartDate.format('YYYY-MM-DD'), end: currentEndDate.format('YYYY-MM-DD') }
            };
        } catch (error) {
            console.error('[getAvailabilityKpiTrends] Error:', error);
            return { metrics: [], timeSeries: [] };
        }
    }, CACHE_TTL.SHORT);
};

const getAvailabilityCompetitionData = async (filters = {}) => {
    console.log('[getAvailabilityCompetitionData] Request with filters:', filters);

    const cacheKey = generateCacheKey('availability_competition_data', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            let { platform = 'All', location = 'All', category = 'All', brand = 'All', period = '1M', startDate: fStart, endDate: fEnd } = filters;
            if (location === 'All India') location = 'All';

            const periodDays = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };

            let startDate, endDate;
            if (fStart && fEnd) {
                startDate = dayjs(fStart);
                endDate = dayjs(fEnd);
            } else {
                const days = periodDays[period] || 30;
                endDate = await getLatestDate();
                startDate = endDate.subtract(days, 'days');
            }

            const whereClause = await buildAvailabilityWhereClause({ ...filters, startDate, endDate });

            const query = `
                WITH latest_skus AS (
                    SELECT
                        Brand,
                        Web_Pid,
                        argMax(toFloat64OrZero(toString(Inventory)), if(toFloat64OrZero(toString(Inventory)) > 0, DATE, toDate('1970-01-01'))) as latest_inv
                    FROM rb_pdp_olap
                    WHERE ${whereClause}
                    GROUP BY Brand, Web_Pid
                )
                SELECT
                    Brand as brand_name,
                    SUM(toFloat64OrZero(toString(neno_osa))) as total_neno,
                    SUM(toFloat64OrZero(toString(deno_osa))) as total_deno,
                    SUM(toFloat64OrZero(toString(Qty_Sold))) as total_qty_sold,
                    SUM(latest_inv) as total_inventory,
                    SUM(toFloat64OrZero(toString(Sales))) as total_sales,
                    COUNT(DISTINCT Web_Pid) as assortment_count,
                    AVG(toFloat64OrZero(toString(listing_percent))) as avg_listing_percent
                FROM rb_pdp_olap
                LEFT JOIN latest_skus ON rb_pdp_olap.Web_Pid = latest_skus.Web_Pid AND rb_pdp_olap.Brand = latest_skus.Brand
                WHERE ${whereClause}
                GROUP BY Brand
                ORDER BY total_deno DESC
                LIMIT 10
            `;


            const results = await queryClickHouse(query);

            const brands = results.map((row, idx) => {
                const neno = parseFloat(row.total_neno) || 0;
                const deno = parseFloat(row.total_deno) || 0;
                const dailyUniquePids = parseInt(row.assortment_count, 10) || 0;
                const brandName = row.brand_name;

                const totalQtySold = parseFloat(row.total_qty_sold) || 0;
                const totalBrandInv = parseFloat(row.total_inventory) || 0;
                const totalSales = parseFloat(row.total_sales) || 0;

                const osa = deno > 0 ? (neno / deno) * 100 : 0;
                const listing = parseFloat(row.avg_listing_percent) || 0;

                // DOI = (Current Inventory / Total Sales in Period) * period_days
                // Assuming 1M period (30 days) as default
                const doi = totalQtySold > 0 ? (totalBrandInv / totalQtySold) * 30 : 0;

                // PSL = (SUM(Sales) / (OSA_Percentage / 100)) - SUM(Sales)  [currency format]
                const psl = osa > 0 ? (totalSales / (osa / 100)) - totalSales : 0;

                return {
                    rank: idx + 1,
                    brand: brandName,
                    osa: parseFloat(osa.toFixed(1)),
                    osaDelta: 0,
                    listing: parseFloat(listing.toFixed(1)),
                    listingDelta: 0,
                    assortment: dailyUniquePids,
                    assortmentDelta: 0,
                    doi: parseFloat(doi.toFixed(1)),
                    fillrate: 'Coming Soon',
                    psl: parseFloat(psl.toFixed(2))
                };
            });

            const skuQuery = `
                SELECT 
                    Product as sku_name,
                    Brand as brand_name,
                    SUM(toFloat64OrZero(toString(neno_osa))) as total_neno,
                    SUM(toFloat64OrZero(toString(deno_osa))) as total_deno,
                    SUM(toFloat64OrZero(toString(Qty_Sold))) as total_qty_sold,
                    SUM(toFloat64OrZero(toString(Sales))) as total_sales,
                    AVG(toFloat64OrZero(toString(listing_percent))) as avg_listing_percent,
                    argMax(toFloat64OrZero(toString(Inventory)), if(toFloat64OrZero(toString(Inventory)) > 0, DATE, toDate('1970-01-01'))) as latest_sku_inventory
                FROM rb_pdp_olap
                WHERE ${whereClause}
                  AND Product IS NOT NULL AND Product != ''
                GROUP BY Product, Brand
                ORDER BY total_deno DESC
                LIMIT 8
            `;


            const skuResults = await queryClickHouse(skuQuery);
            const skus = skuResults.map(s => {
                const neno = parseFloat(s.total_neno) || 0;
                const deno = parseFloat(s.total_deno) || 0;
                const totalQtySold = parseFloat(s.total_qty_sold) || 0;
                const latestInv = parseFloat(s.latest_sku_inventory) || 0;
                const totalSales = parseFloat(s.total_sales) || 0;

                const osa = deno > 0 ? (neno / deno) * 100 : 0;
                const listing = parseFloat(s.avg_listing_percent) || 0;
                const doi = totalQtySold > 0 ? (latestInv / totalQtySold) * 30 : 0;

                // PSL = (SUM(Sales) / (OSA_Percentage / 100)) - SUM(Sales)  [currency format]
                const psl = osa > 0 ? (totalSales / (osa / 100)) - totalSales : 0;

                return {
                    sku_name: s.sku_name,
                    brand_name: s.brand_name,
                    osa: parseFloat(osa.toFixed(1)),
                    osaDelta: 0,
                    doi: parseFloat(doi.toFixed(1)),
                    fillrate: 'Coming Soon',
                    assortment: 1,
                    psl: parseFloat(psl.toFixed(2)),
                    listing: parseFloat(listing.toFixed(1))
                };
            });

            return {
                brands,
                skus,
                period,
                filters,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[getAvailabilityCompetitionData] Error:', error);
            return { brands: [], skus: [] };
        }
    }, CACHE_TTL.SHORT);
};

const getAvailabilityCompetitionFilterOptions = async (filters = {}) => {
    console.log('[getAvailabilityCompetitionFilterOptions] Request with filters:', filters);

    try {
        const { platform = 'All', location = 'All', category = 'All', brand = 'All' } = filters;

        // 1. Build base condition (Platform and Location)
        const baseWhere = await buildAvailabilityWhereClause({ platform, location, channel: filters.channel, metroFlag: filters.metroFlag, zones: filters.zones, pincodes: filters.pincodes });
        const baseCondsStr = baseWhere !== '1=1' ? `${baseWhere} AND ` : '';

        // Dynamically resolve columns
        const pdpColsMap = await getTableColumns('rb_pdp_olap');
        const catCol = resolveColumn(pdpColsMap, 'Category', 'Category');
        const pcCol = resolveColumn(pdpColsMap, 'Product_type', 'Product_type');

        // 2. Build Category conditions (filtered by Platform/Location/Advanced)
        const catQuery = `SELECT DISTINCT ${catCol} as value FROM rb_pdp_olap WHERE ${baseCondsStr}${catCol} IS NOT NULL AND ${catCol} != '' ORDER BY value`;

        // 3. Build Brand conditions (filtered by Platform/Location/Advanced/Category)
        const brandWhere = await buildAvailabilityWhereClause({ platform, location, category, channel: filters.channel, metroFlag: filters.metroFlag, zones: filters.zones, pincodes: filters.pincodes });
        const brandCondsStr = brandWhere !== '1=1' ? `${brandWhere} AND ` : '';
        const brandQuery = `SELECT DISTINCT Brand as value FROM rb_pdp_olap WHERE ${brandCondsStr}Brand IS NOT NULL AND Brand != '' ORDER BY Brand`;

        // 4. Build SKU conditions (filtered by Platform/Location/Advanced/Category/Brand)
        const skuWhere = await buildAvailabilityWhereClause({ platform, location, category, brand, channel: filters.channel, metroFlag: filters.metroFlag, zones: filters.zones, pincodes: filters.pincodes });
        const skuCondsStr = skuWhere !== '1=1' ? `${skuWhere} AND ` : '';
        const skuQuery = `SELECT DISTINCT Product as value FROM rb_pdp_olap WHERE ${skuCondsStr}Product IS NOT NULL AND Product != '' ORDER BY Product LIMIT 200`;

        const [locationResults, categoryResults, brandResults, skuResults] = await Promise.all([
            queryClickHouse(`SELECT DISTINCT Location as value FROM rb_pdp_olap WHERE Location IS NOT NULL AND Location != '' ORDER BY Location`),
            queryClickHouse(catQuery),
            queryClickHouse(brandQuery),
            queryClickHouse(skuQuery)
        ]);

        return {
            locations: ['All India', ...locationResults.map(r => r.value).filter(Boolean)],
            categories: ['All', ...categoryResults.map(r => r.value).filter(Boolean)],
            brands: ['All', ...brandResults.map(r => r.value).filter(Boolean)],
            skus: ['All', ...skuResults.map(r => r.value).filter(Boolean)]
        };
    } catch (error) {
        console.error('[getAvailabilityCompetitionFilterOptions] Error:', error);
        return { locations: ['All India'], categories: ['All'], brands: ['All'], skus: ['All'] };
    }
};

const getAvailabilityCompetitionBrandTrends = async (filters = {}) => {
    console.log('[getAvailabilityCompetitionBrandTrends] Request with filters:', filters);

    const cacheKey = generateCacheKey('availability_competition_brand_trends', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            let { brands = 'All', location = 'All', category = 'All', period = '1M', startDate: fStart, endDate: fEnd } = filters;
            if (location === 'All India') location = 'All';

            let brandList = [];
            if (brands && brands !== 'All') {
                if (Array.isArray(brands)) {
                    brandList = brands;
                } else {
                    brandList = brands.split(',').map(b => b.trim());
                }
            }

            // If no specific brands selected, auto-fetch top 5 brands by volume
            if (brandList.length === 0) {
                let startDate, endDate;
                if (fStart && fEnd) {
                    startDate = dayjs(fStart);
                    endDate = dayjs(fEnd);
                } else {
                    const periodDays = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
                    const days = periodDays[period] || 30;
                    endDate = await getLatestDate();
                    startDate = endDate.subtract(days, 'days');
                }

                const autoWhereClause = await buildAvailabilityWhereClause({ ...filters, brands: undefined, brand: undefined, startDate, endDate });
                const topBrandsQuery = `
                    SELECT Brand, SUM(toFloat64OrZero(toString(deno_osa))) as total_deno
                    FROM rb_pdp_olap
                    WHERE ${autoWhereClause}
                      AND Brand IS NOT NULL AND Brand != ''
                    GROUP BY Brand
                    ORDER BY total_deno DESC
                    LIMIT 5
                `;
                const topBrandsResult = await queryClickHouse(topBrandsQuery);
                brandList = topBrandsResult.map(r => r.Brand).filter(Boolean);
                console.log('[getAvailabilityCompetitionBrandTrends] Auto-fetched top brands:', brandList);

                if (brandList.length === 0) {
                    return { metrics: [], timeSeries: {}, brands: [], dates: [] };
                }
            }

            let startDate, endDate;
            if (fStart && fEnd) {
                startDate = dayjs(fStart);
                endDate = dayjs(fEnd);
            } else {
                const periodDays = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
                const days = periodDays[period] || 30;
                endDate = await getLatestDate();
                startDate = endDate.subtract(days, 'days');
            }

            const whereClause = await buildAvailabilityWhereClause({ ...filters, startDate, endDate });

            const query = `
                SELECT 
                    Brand,
                    DATE as ref_date,
                    SUM(toFloat64OrZero(toString(neno_osa))) as total_neno,
                    SUM(toFloat64OrZero(toString(deno_osa))) as total_deno,
                    SUM(toFloat64OrZero(toString(Inventory))) as total_inventory,
                    SUM(toFloat64OrZero(toString(Qty_Sold))) as total_qty_sold,
                    SUM(toFloat64OrZero(toString(Sales))) as total_sales,
                    COUNT(DISTINCT Web_Pid) as assortment_count,
                    AVG(toFloat64OrZero(toString(listing_percent))) as avg_listing_percent
                FROM rb_pdp_olap
                WHERE ${whereClause}
                GROUP BY Brand, DATE
                ORDER BY DATE ASC
            `;

            const results = await queryClickHouse(query);

            // Get all unique dates in the results
            const uniqueDates = Array.from(new Set(results.map(r => dayjs(r.ref_date).format("DD MMM'YY")))).sort((a, b) => {
                const dateA = dayjs(a, "DD MMM'YY");
                const dateB = dayjs(b, "DD MMM'YY");
                return dateA.diff(dateB);
            });

            // Prepare the response in the format expected by TrendView
            const response = {
                dates: uniqueDates,
                osa: {},
                doi: {},
                listing: {},
                assortment: {},
                fillrate: {},
                psl: {}
            };

            // Initialize brand arrays for each metric
            brandList.forEach(brandName => {
                response.osa[brandName] = new Array(uniqueDates.length).fill(0);
                response.doi[brandName] = new Array(uniqueDates.length).fill(0);
                response.listing[brandName] = new Array(uniqueDates.length).fill(0);
                response.assortment[brandName] = new Array(uniqueDates.length).fill(0);
                response.fillrate[brandName] = new Array(uniqueDates.length).fill(0);
                response.psl[brandName] = new Array(uniqueDates.length).fill(0);
            });

            // Map results into the prefilled response arrays
            results.forEach(row => {
                const brandName = row.Brand;
                const dateStr = dayjs(row.ref_date).format("DD MMM'YY");
                const dateIndex = uniqueDates.indexOf(dateStr);

                if (dateIndex !== -1 && response.osa[brandName]) {
                    const neno = parseFloat(row.total_neno) || 0;
                    const deno = parseFloat(row.total_deno) || 0;
                    const dailyUniquePids = parseInt(row.assortment_count, 10) || 0;
                    const totalQtySold = parseFloat(row.total_qty_sold) || 0;
                    const totalInv = parseFloat(row.total_inventory) || 0;

                    const osa = deno > 0 ? (neno / deno) * 100 : 0;
                    const listing = parseFloat(row.avg_listing_percent) || 0;
                    const doi = totalQtySold > 0 ? (totalInv / totalQtySold) * 30 : 0;
                    const totalSales = parseFloat(row.total_sales) || 0;

                    // PSL = (SUM(Sales) / (OSA_Percentage / 100)) - SUM(Sales)  [currency format]
                    const psl = osa > 0 ? (totalSales / (osa / 100)) - totalSales : 0;

                    response.osa[brandName][dateIndex] = parseFloat(osa.toFixed(1));
                    response.listing[brandName][dateIndex] = parseFloat(listing.toFixed(1));
                    response.assortment[brandName][dateIndex] = dailyUniquePids;
                    response.doi[brandName][dateIndex] = parseFloat(doi.toFixed(1));
                    response.psl[brandName][dateIndex] = parseFloat(psl.toFixed(2));
                }
            });

            return response;
        } catch (error) {
            console.error('[getAvailabilityCompetitionBrandTrends] Error:', error);
            return { metrics: [], timeSeries: {}, brands: [] };
        }
    }, CACHE_TTL.SHORT);
};

// ==========================================
// Brand → SKU → City Day-Level ECP
// ==========================================
const getBrandSkuCityDayLevel = async (filters) => {
    console.log('[getBrandSkuCityDayLevel] Request received with filters:', filters);

    const cacheKey = generateCacheKey('brand_sku_city_day', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const { dayRange = 7 } = filters;

            // Use the latest available date as end date
            const latestDateResult = await queryClickHouse('SELECT MAX(toDate(DATE)) as maxDate FROM rb_pdp_olap');
            const latestDate = latestDateResult?.[0]?.maxDate
                ? dayjs(latestDateResult[0].maxDate)
                : dayjs();
            const startDate = latestDate.subtract(dayRange - 1, 'day');

            // Build base filter conditions
            const baseFilterParams = { ...filters };
            delete baseFilterParams.dayRange;
            delete baseFilterParams.startDate;
            delete baseFilterParams.endDate;
            delete baseFilterParams.dates;
            delete baseFilterParams.months;

            const baseWhereClause = await buildAvailabilityWhereClause(baseFilterParams);
            const baseFilter = baseWhereClause !== '1=1' ? ` AND ${baseWhereClause}` : '';

            // Query: Brand, Product (SKU), Location (city), DATE, avg Selling_Price, MRP, OSA, Fillrate
            const query = `
                SELECT 
                    Brand as brand,
                    Product as sku_name,
                    Web_Pid as sku_id,
                    Location as city,
                    toDate(DATE) as date,
                    ROUND(AVG(NULLIF(toFloat64OrZero(toString(Selling_Price)), 0)), 0) as ecp,
                    ROUND(AVG(NULLIF(toFloat64OrZero(toString(MRP)), 0)), 0) as mrp,
                    SUM(toFloat64OrZero(toString(neno_osa))) as total_neno,
                    SUM(toFloat64OrZero(toString(deno_osa))) as total_deno,
                    SUM(toFloat64OrZero(toString(buy_box_neno_osa))) as total_bb_neno
                FROM rb_pdp_olap
                WHERE DATE BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${latestDate.format('YYYY-MM-DD')}'
                  AND Brand IS NOT NULL AND Brand != ''
                  AND Product IS NOT NULL AND Product != ''
                  ${baseFilter}
                GROUP BY Brand, Product, Web_Pid, Location, toDate(DATE)
                ORDER BY Brand, Product, Location, date DESC
            `;

            const results = await queryClickHouse(query);

            // Structure: { brand -> { days: {}, skus: { sku_id: { days: {}, cities: {} } } } }
            const brandMap = {};

            for (const row of results) {
                const { brand, sku_name, sku_id, city, date, ecp, mrp, total_neno, total_deno, total_bb_neno } = row;
                const dateStr = dayjs(date).format('YYYY-MM-DD');
                const ecpVal = Math.round(parseFloat(ecp) || 0);
                const mrpVal = Math.round(parseFloat(mrp) || 0);
                const discount = mrpVal > 0 ? Math.round(((mrpVal - ecpVal) / mrpVal) * 100) : 0;

                const neno = parseFloat(total_neno) || 0;
                const deno = parseFloat(total_deno) || 0;
                const bb_neno = parseFloat(total_bb_neno) || 0;
                const osa = deno > 0 ? Math.round((neno / deno) * 100) : 0;
                const fillrate = deno > 0 ? Math.round((bb_neno / deno) * 100) : 0;

                if (!brandMap[brand]) {
                    brandMap[brand] = {
                        days: {},
                        skus: {}
                    };
                }

                // Brand-level aggregation
                if (!brandMap[brand].days[dateStr]) {
                    brandMap[brand].days[dateStr] = { nenoSum: 0, denoSum: 0, bbNenoSum: 0, ecpSum: 0, mrpSum: 0, count: 0 };
                }
                const bAgg = brandMap[brand].days[dateStr];
                bAgg.nenoSum += neno;
                bAgg.denoSum += deno;
                bAgg.bbNenoSum += bb_neno;
                bAgg.ecpSum += ecpVal;
                bAgg.mrpSum += mrpVal;
                bAgg.count += 1;

                const skuKey = `${sku_id}__${sku_name}`;
                if (!brandMap[brand].skus[skuKey]) {
                    brandMap[brand].skus[skuKey] = {
                        name: sku_name,
                        id: sku_id,
                        days: {},
                        cities: {}
                    };
                }
                const skuData = brandMap[brand].skus[skuKey];

                // SKU-level: aggregate total neno/deno across cities
                if (!skuData.days[dateStr]) {
                    skuData.days[dateStr] = { nenoSum: 0, denoSum: 0, bbNenoSum: 0, ecpSum: 0, mrpSum: 0, count: 0 };
                }
                const sAgg = skuData.days[dateStr];
                sAgg.nenoSum += neno;
                sAgg.denoSum += deno;
                sAgg.bbNenoSum += bb_neno;
                sAgg.ecpSum += ecpVal;
                sAgg.mrpSum += mrpVal;
                sAgg.count += 1;

                // City level
                if (city && city.trim()) {
                    if (!skuData.cities[city]) {
                        skuData.cities[city] = {};
                    }
                    skuData.cities[city][dateStr] = {
                        osa,
                        fillrate,
                        ecp: ecpVal,
                        discount,
                        mrp: mrpVal
                    };
                }
            }

            // Transform into the frontend format
            const data = Object.entries(brandMap).map(([brandName, brandContent], bIdx) => {
                const brandDays = {};
                for (const [dateStr, agg] of Object.entries(brandContent.days)) {
                    const bOsa = agg.denoSum > 0 ? Math.round((agg.nenoSum / agg.denoSum) * 100) : 0;
                    const bFr = agg.denoSum > 0 ? Math.round((agg.bbNenoSum / agg.denoSum) * 100) : 0;
                    const avgEcp = Math.round(agg.ecpSum / agg.count);
                    const avgMrp = Math.round(agg.mrpSum / agg.count);
                    const bDiscount = avgMrp > 0 ? Math.round(((avgMrp - avgEcp) / avgMrp) * 100) : 0;
                    brandDays[dateStr] = { osa: bOsa, fillrate: bFr, ecp: avgEcp, discount: bDiscount, mrp: avgMrp };
                }

                const skuList = Object.entries(brandContent.skus).map(([skuKey, skuData], sIdx) => {
                    // Average SKU-level days across cities for ECP/MRP, and total ratio for OSA/FR
                    const days = {};
                    for (const [dateStr, agg] of Object.entries(skuData.days)) {
                        const skuOsa = agg.denoSum > 0 ? Math.round((agg.nenoSum / agg.denoSum) * 100) : 0;
                        const skuFr = agg.denoSum > 0 ? Math.round((agg.bbNenoSum / agg.denoSum) * 100) : 0;
                        const avgEcp = Math.round(agg.ecpSum / agg.count);
                        const avgMrp = Math.round(agg.mrpSum / agg.count);
                        const discount = avgMrp > 0 ? Math.round(((avgMrp - avgEcp) / avgMrp) * 100) : 0;
                        days[dateStr] = { osa: skuOsa, fillrate: skuFr, ecp: avgEcp, discount, mrp: avgMrp };
                    }

                    const cities = Object.entries(skuData.cities).map(([cityName, cityDays], cIdx) => ({
                        id: `c${cIdx}-${skuData.id}`,
                        name: cityName,
                        days: cityDays
                    }));

                    return {
                        id: skuData.id || `s${sIdx}`,
                        name: skuData.name,
                        ml: '', // rb_pdp_olap doesn't have a pack size column
                        days,
                        cities
                    };
                });

                return {
                    id: `b${bIdx}`,
                    brand: brandName,
                    days: brandDays,
                    skus: skuList
                };
            });

            return {
                success: true,
                data,
                dateRange: {
                    start: startDate.format('YYYY-MM-DD'),
                    end: latestDate.format('YYYY-MM-DD')
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[getBrandSkuCityDayLevel] Error:', error);
            throw error;
        }
    }, CACHE_TTL.SHORT);
};

export default {
    getAssortment,
    getAbsoluteOsaOverview,
    getAbsoluteOsaPlatformKpiMatrix,
    getStandaloneOsaPlatformKpiMatrix,
    getAbsoluteOsaPercentageDetail,
    getDOI,
    isMetroCity,
    getMetroCities,
    getMetroCityStockAvailability,
    getAvailabilityFilterOptions,
    getOsaDetailByCategory,
    getAvailabilityKpiTrends,
    getAvailabilityCompetitionData,
    getAvailabilityCompetitionFilterOptions,
    getAvailabilityCompetitionBrandTrends,
    getBrandSkuCityDayLevel
};