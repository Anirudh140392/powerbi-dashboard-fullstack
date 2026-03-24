import availabilityService from '../services/availabilityService.js';
import { generateCacheKey, getCachedOrCompute, CACHE_TTL } from '../utils/cacheHelper.js';
import { queryClickHouse, getCurrentDbName } from '../config/clickhouse.js';
import { getTableColumns, resolveColumn } from '../utils/schemaHelper.js';
import dayjs from 'dayjs';

/**
 * Robust filter parsing to handle strings, arrays, and comma-separated values.
 * Prevents crashes when multiple values are passed from the frontend.
 */
const parseFilter = (val) => {
    if (!val || val === 'All' || val === 'all' || val === 'undefined') return 'All';
    if (Array.isArray(val)) return val.length > 0 ? val : 'All';
    if (typeof val === 'string' && val.includes(',')) {
        return val.split(',').map(v => v.trim()).filter(v => v !== '');
    }
    return val;
};

/**
 * Helper to escape SQL single quotes
 */
const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

/**
 * Scales metrics for Mars-related entries if needed (100x scaling fix).
 * Data analysis shows financial/qty metrics for Mars brands are 100x inflated in source.
 */
const scaleMarsMetrics = (data, key) => {
    if (!data || !key) return data;
    const lowerKey = key.toLowerCase();
    const marsKeywords = ['snickers', 'galaxy', 'bounty', 'twix', 'mars', "m&m's", 'orbit', 'doublemint', 'boomer', 'skittles', 'chocolates (gifting)', 'chocolates (non gifting)', 'gmfc'];

    const isMars = marsKeywords.some(kw => lowerKey.includes(kw));
    if (!isMars) return data;

    // Direct assignment to modify object properties if they exist
    const fields = ['totalQtySold', 'currSales', 'prevSales', 'offtake', 'compOfftake', 'qty_sold', 'ad_sales', 'ad_spend', 'clicks', 'impressions', 'avgInventory', 'revenue', 'totalClicks', 'totalImpressions'];
    
    fields.forEach(f => {
        if (data[f] !== undefined && data[f] !== null) {
            data[f] = parseFloat(data[f]) * 0.01;
        }
    });
    return data;
};

export const AvailabilityControlTower = async (req, res) => {
    try {
        const filters = req.query;
        console.log("analytical analysis api request received", filters);

        const assortment = await availabilityService.getAssortment(filters);

        res.json({
            message: "Availability Analysis API called successfully",
            filters: filters,
            metrics: {
                assortment
            }
        });
    } catch (error) {
        console.error('Error in Availability Analysis:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// ==================== Absolute OSA Section APIs ====================

/**
 * Get Availability Overview for Absolute OSA page
 */
export const getAvailabilityOverview = async (req, res) => {
    try {
        const filters = {
            platform: parseFilter(req.query.platform),
            brand: parseFilter(req.query.brand),
            location: parseFilter(req.query.location),
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            dates: parseFilter(req.query.dates),
            months: parseFilter(req.query.months),
            cities: parseFilter(req.query.cities),
            categories: parseFilter(req.query.categories),
            formats: parseFilter(req.query.formats),
            category: parseFilter(req.query.category),
            format: parseFilter(req.query.format),
            zones: parseFilter(req.query.zones),
            metroFlags: parseFilter(req.query.metroFlags),
            pincodes: parseFilter(req.query.pincodes),
            channel: req.query.channel,
            productCategory: parseFilter(req.query.productCategory),
            compareStartDate: req.query.compareStartDate,
            compareEndDate: req.query.compareEndDate,
            ownBrandsOnly: req.query.ownBrandsOnly
        };
        console.log('\n========== AVAILABILITY OVERVIEW API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));

        const data = await availabilityService.getAbsoluteOsaOverview(filters);

        console.log('[SUCCESS] Availability Overview. Records:', data?.length || 0);
        console.log('================================================\n');

        res.json(data);
    } catch (error) {
        console.error('[ERROR] Availability Overview:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Get Platform KPI Matrix for Absolute OSA page
 */
export const getPlatformKpiMatrix = async (req, res) => {
    try {
        const filters = {
            viewMode: req.query.viewMode || 'Platform',  // Platform, Format, or City
            platform: parseFilter(req.query.platform),
            brand: parseFilter(req.query.brand),
            location: parseFilter(req.query.location),
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            dates: parseFilter(req.query.dates),
            months: parseFilter(req.query.months),
            cities: parseFilter(req.query.cities),
            categories: parseFilter(req.query.categories),
            formats: parseFilter(req.query.formats),
            category: parseFilter(req.query.category),
            format: parseFilter(req.query.format),
            zones: parseFilter(req.query.zones),
            metroFlags: parseFilter(req.query.metroFlags),
            pincodes: parseFilter(req.query.pincodes),
            drillDimension: req.query.drillDimension || 'region',
            includeBreakdown: req.query.includeBreakdown === 'true',
            channel: req.query.channel,
            productCategory: parseFilter(req.query.productCategory),
            compareStartDate: req.query.compareStartDate,
            compareEndDate: req.query.compareEndDate,
            ownBrandsOnly: req.query.ownBrandsOnly
        };
        console.log('\n========== PLATFORM KPI MATRIX API ==========');
        console.log('[DEBUG] viewMode from query:', req.query.viewMode);
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));

        const data = await availabilityService.getAbsoluteOsaPlatformKpiMatrix(filters);

        console.log('[RESPONSE] viewMode:', data.viewMode);
        console.log('[RESPONSE] Columns:', JSON.stringify(data.columns));
        console.log('==============================================\n');

        res.json(data);
    } catch (error) {
        console.error('[ERROR] Platform KPI Matrix:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Get OSA Percentage Detail View for Absolute OSA page
 */
export const getOsaPercentageDetail = async (req, res) => {
    try {
        const filters = {
            platform: parseFilter(req.query.platform),
            brand: parseFilter(req.query.brand),
            location: parseFilter(req.query.location),
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            dates: parseFilter(req.query.dates),
            months: parseFilter(req.query.months),
            cities: parseFilter(req.query.cities),
            categories: parseFilter(req.query.categories),
            formats: parseFilter(req.query.formats),
            category: parseFilter(req.query.category),
            format: parseFilter(req.query.format),
            zones: parseFilter(req.query.zones),
            metroFlags: parseFilter(req.query.metroFlags),
            pincodes: parseFilter(req.query.pincodes),
            channel: req.query.channel,
            productCategory: parseFilter(req.query.productCategory),
            compareStartDate: req.query.compareStartDate,
            compareEndDate: req.query.compareEndDate,
            ownBrandsOnly: req.query.ownBrandsOnly
        };
        console.log('\n========== OSA PERCENTAGE DETAIL API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));

        const data = await availabilityService.getAbsoluteOsaPercentageDetail(filters);

        console.log('[SUCCESS] OSA Percentage Detail. Records:', data?.length || 0);
        console.log('================================================\n');

        res.json(data);
    } catch (error) {
        console.error('[ERROR] getOsaPercentageDetail:', error.message);
        console.error(error.stack);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
};

/**
 * Get Days of Inventory (DOI) for Availability Overview
 */
export const getDOI = async (req, res) => {
    try {
        const filters = {
            platform: parseFilter(req.query.platform),
            brand: parseFilter(req.query.brand),
            location: parseFilter(req.query.location),
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            dates: parseFilter(req.query.dates),
            months: parseFilter(req.query.months),
            cities: parseFilter(req.query.cities),
            categories: parseFilter(req.query.categories),
            formats: parseFilter(req.query.formats),
            category: parseFilter(req.query.category),
            format: parseFilter(req.query.format),
            zones: parseFilter(req.query.zones),
            metroFlags: parseFilter(req.query.metroFlags),
            pincodes: parseFilter(req.query.pincodes),
            channel: req.query.channel,
            productCategory: parseFilter(req.query.productCategory),
            compareStartDate: req.query.compareStartDate,
            compareEndDate: req.query.compareEndDate,
            ownBrandsOnly: req.query.ownBrandsOnly
        };
        console.log('\n========== DOI (DAYS OF INVENTORY) API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));

        const data = await availabilityService.getDOI(filters);

        console.log('[SUCCESS] DOI. Records:', data?.length || 0);
        console.log('==================================================\n');

        res.json(data);
    } catch (error) {
        console.error('[ERROR] DOI:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Get Metro City Stock Availability for Availability Overview
 */
export const getMetroCityStockAvailability = async (req, res) => {
    try {
        const filters = {
            platform: parseFilter(req.query.platform),
            brand: parseFilter(req.query.brand),
            location: parseFilter(req.query.location),
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            dates: parseFilter(req.query.dates),
            months: parseFilter(req.query.months),
            cities: parseFilter(req.query.cities),
            categories: parseFilter(req.query.categories),
            formats: parseFilter(req.query.formats),
            category: parseFilter(req.query.category),
            format: parseFilter(req.query.format),
            zones: parseFilter(req.query.zones),
            metroFlags: parseFilter(req.query.metroFlags),
            pincodes: parseFilter(req.query.pincodes),
            channel: req.query.channel,
            productCategory: parseFilter(req.query.productCategory),
            compareStartDate: req.query.compareStartDate,
            compareEndDate: req.query.compareEndDate,
            ownBrandsOnly: req.query.ownBrandsOnly
        };
        console.log('\n========== METRO CITY STOCK AVAILABILITY API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));

        const data = await availabilityService.getMetroCityStockAvailability(filters);

        console.log('[SUCCESS] Metro City Stock Availability. Records:', data?.length || 0);
        console.log('========================================================\n');

        res.json(data);
    } catch (error) {
        console.error('[ERROR] Metro City Stock Availability:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Get Availability Filter Options
 * Fetches dynamic filter options from rca_sku_dim (for Platform, City, Category) 
 * and rb_pdp_olap (for Date, Month)
 */
export const getAvailabilityFilterOptions = async (req, res) => {
    try {
        const { filterType, platform, brand, category, productCategory, format, city, location, months, metroFlag } = req.query;
        console.log('\n========== AVAILABILITY FILTER OPTIONS API ==========');
        console.log('[REQUEST] filterType:', filterType, 'platform:', platform, 'brand:', brand, 'category:', category, 'productCategory:', productCategory, 'format:', format, 'city:', city, 'location:', location, 'months:', months, 'metroFlag:', metroFlag);

        const data = await availabilityService.getAvailabilityFilterOptions({
            filterType: filterType || 'platforms',
            platform: parseFilter(platform),
            brand: parseFilter(brand),
            category: parseFilter(category || format),
            productCategory: parseFilter(productCategory),
            city: parseFilter(city),
            location: parseFilter(location),
            months: parseFilter(months),
            metroFlag: parseFilter(metroFlag),
            ownBrandsOnly: req.query.ownBrandsOnly
        });

        console.log('[RESPONSE]:', data.options?.length, 'options returned');
        console.log('=====================================================\n');

        res.json(data);
    } catch (error) {
        console.error('[ERROR] Availability Filter Options:', error);
        res.status(500).json({ error: 'Internal Server Error', options: [] });
    }
};

/**
 * Get OSA Detail by Category for the OSA Detail View table
 * Returns categories with daily OSA % for last 31 days
 */
export const getOsaDetailByCategory = async (req, res) => {
    try {
        const filters = {
            platform: parseFilter(req.query.platform),
            brand: parseFilter(req.query.brand),
            location: parseFilter(req.query.location),
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            dates: parseFilter(req.query.dates),
            months: parseFilter(req.query.months),
            cities: parseFilter(req.query.cities),
            categories: parseFilter(req.query.categories),
            formats: parseFilter(req.query.formats),
            category: parseFilter(req.query.category),
            format: parseFilter(req.query.format),
            zones: parseFilter(req.query.zones),
            metroFlags: parseFilter(req.query.metroFlags),
            pincodes: parseFilter(req.query.pincodes),
            kpis: parseFilter(req.query.kpis),
            channel: req.query.channel,
            productCategory: parseFilter(req.query.productCategory),
            compareStartDate: req.query.compareStartDate,
            compareEndDate: req.query.compareEndDate,
            ownBrandsOnly: req.query.ownBrandsOnly
        };
        console.log('\n========== OSA DETAIL BY CATEGORY API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));

        const data = await availabilityService.getOsaDetailByCategory(filters);

        console.log('[RESPONSE]:', data.categories?.length, 'categories returned');
        console.log('================================================\n');

        res.json(data);
    } catch (error) {
        console.error('[ERROR] OSA Detail By Category:', error);
        res.status(500).json({ error: 'Internal Server Error', categories: [] });
    }
};

/**
 * Get Availability KPI Trends for Trends/Competition Drawer
 * Returns time-series data for OSA, DOI, Fillrate, Assortment
 */
export const getAvailabilityKpiTrends = async (req, res) => {
    try {
        const filters = {
            platform: parseFilter(req.query.platform),
            brand: parseFilter(req.query.brand),
            location: parseFilter(req.query.location),
            category: parseFilter(req.query.category),
            productCategory: parseFilter(req.query.productCategory),
            period: req.query.period || '1M',
            timeStep: req.query.timeStep || 'Daily',
            channel: req.query.channel,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            ownBrandsOnly: req.query.ownBrandsOnly,
            dimension: req.query.dimension,
            dimensionValue: req.query.dimensionValue
        };
        console.log('\n========== AVAILABILITY KPI TRENDS API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));

        const data = await availabilityService.getAvailabilityKpiTrends(filters);

        console.log('[RESPONSE]:', data.timeSeries?.length, 'trend points returned');
        console.log('==================================================\n');

        res.json(data);
    } catch (error) {
        console.error('[ERROR] Availability KPI Trends:', error);
        res.status(500).json({ error: 'Internal Server Error', points: [] });
    }
};

/**
 * Get Availability Competition Data for Competition tab
 * Returns top 10 brands with OSA, DOI, Fillrate, Assortment
 */
export const getAvailabilityCompetition = async (req, res) => {
    try {
        const filters = {
            platform: parseFilter(req.query.platform),
            location: parseFilter(req.query.location),
            category: parseFilter(req.query.category),
            brand: parseFilter(req.query.brand),
            channel: req.query.channel,
            period: req.query.period || '1M',
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            ownBrandsOnly: req.query.ownBrandsOnly
        };
        console.log('\n========== AVAILABILITY COMPETITION API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));

        const data = await availabilityService.getAvailabilityCompetitionData(filters);

        console.log('[RESPONSE] brands length:', data.brands?.length, 'skus length:', data.skus?.length);
        console.log('===================================================\n');

        res.json(data);
    } catch (error) {
        console.error('[ERROR] Availability Competition:', error);
        res.status(500).json({ error: 'Internal Server Error', brands: [], skus: [] });
    }
};

/**
 * Get Availability Competition Filter Options
 * Returns cascading filter options (locations, categories, brands, skus)
 */
export const getAvailabilityCompetitionFilterOptions = async (req, res) => {
    try {
        const { platform, location, category, brand } = req.query;
        console.log('\n========== AVAILABILITY COMPETITION FILTER OPTIONS API ==========');
        console.log('[REQUEST] platform:', platform, 'location:', location, 'category:', category, 'brand:', brand);

        const data = await availabilityService.getAvailabilityCompetitionFilterOptions({
            platform: parseFilter(platform),
            location: parseFilter(location),
            category: parseFilter(category),
            brand: parseFilter(brand)
        });

        console.log('[RESPONSE]:', data.locations?.length, 'locations,', data.categories?.length, 'categories,', data.brands?.length, 'brands');
        console.log('=================================================================\n');

        res.json(data);
    } catch (error) {
        console.error('[ERROR] Availability Competition Filter Options:', error);
        res.status(500).json({ locations: ['All India'], categories: ['All'], brands: ['All'], skus: ['All'] });
    }
};

/**
 * Get Availability Competition Brand Trends
 * Returns time-series data for comparing multiple brands
 */
export const getAvailabilityCompetitionBrandTrends = async (req, res) => {
    try {
        const { brands, location, category, period, startDate, endDate } = req.query;
        console.log('\n========== AVAILABILITY COMPETITION BRAND TRENDS API ==========');
        console.log('[REQUEST] brands:', brands, 'location:', location, 'category:', category, 'period:', period, 'startDate:', startDate, 'endDate:', endDate);

        const data = await availabilityService.getAvailabilityCompetitionBrandTrends({
            brands: parseFilter(brands || 'All'),
            location: parseFilter(location || 'All'),
            category: parseFilter(category || 'All'),
            period: period || '1M',
            startDate,
            endDate
        });

        console.log('[RESPONSE]:', Object.keys(data.timeSeries || {}).length, 'brands with trends');
        console.log('===============================================================\n');

        res.json(data);
    } catch (error) {
        console.error('[ERROR] Availability Competition Brand Trends:', error);
        res.status(500).json({ metrics: [], timeSeries: {}, brands: [] });
    }
};

/**
 * Get Signal Lab Data for Availability Analysis - ClickHouse Version
 * Formulas:
 * - OSA = sum(neno_osa) / sum(deno_osa)
 * - DOI = Inventory / (sum(Qty_Sold in 30 days) / 30)
 */
export const getSignalLabData = async (req, res) => {
    try {
        const cacheKey = generateCacheKey('signal_lab_v9', req.query);
        const data = await getCachedOrCompute(cacheKey, async () => {
            // Dynamically resolve ad-related column names (case varies across DBs)
            const cols = await getTableColumns('rb_pdp_olap');
            const adSalesCol = resolveColumn(cols, 'Ad_sales');
            const adSpendCol = resolveColumn(cols, 'Ad_Spend');
            const adClicksCol = resolveColumn(cols, 'Ad_Clicks');
            const adImpressionsCol = resolveColumn(cols, 'Ad_Impressions');

            const {
                platform,
                brand,
                location,
                category,
                startDate,
                endDate,
                compareStartDate,
                compareEndDate,
                type: metricType = 'availability',
                page = 1,
                limit = 5,
                signalType = 'drainer',
                keyword = 'All',
                groupBy = 'sku'
            } = req.query;

            const isBrandGroup = groupBy === 'brand';
            const groupCol = isBrandGroup ? 'Brand' : 'Web_Pid';

            const pageNum = Number(page) || 1;
            const limitNum = Number(limit) || 5;
            const offsetNum = (pageNum - 1) * limitNum;

            const end = endDate || dayjs().format('YYYY-MM-DD');
            const start = startDate || dayjs(end).subtract(30, 'day').format('YYYY-MM-DD');

            // Comparison Dates
            const compEnd = compareEndDate || dayjs(start).subtract(1, 'day').format('YYYY-MM-DD');
            const compStart = compareStartDate || dayjs(compEnd).subtract(dayjs(end).diff(dayjs(start), 'day'), 'day').format('YYYY-MM-DD');

            const daysInPeriod = dayjs(end).diff(dayjs(start), 'day') + 1;

            /* ================= 1. FILTER LOGIC (MULTI-SELECT) ================= */
            const processFilter = (val) => {
                if (!val || val === 'All') return null;
                if (typeof val === 'string' && val.includes(',')) {
                    return val.split(',').map(v => v.trim());
                }
                return val;
            };

            const platformFilter = processFilter(platform);
            const locationFilter = processFilter(location);
            const brandFilter = processFilter(brand);
            const categoryFilter = processFilter(category);
            const keywordFilter = processFilter(keyword);

            // Build WHERE clause for ClickHouse
            const buildWhereClause = (includeCompDates = false, ignoreBrand = false) => {
                const conditions = [];

                if (includeCompDates) {
                    conditions.push(`(toDate(DATE) BETWEEN '${start}' AND '${end}' OR toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}')`);
                } else {
                    conditions.push(`toDate(DATE) BETWEEN '${start}' AND '${end}'`);
                }

                if (platformFilter) {
                    if (Array.isArray(platformFilter)) {
                        conditions.push(`LOWER(Platform) IN (${platformFilter.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})`);
                    } else {
                        conditions.push(`Platform ILIKE '${escapeStr(platformFilter)}'`);
                    }
                }

                if (locationFilter) {
                    if (Array.isArray(locationFilter)) {
                        conditions.push(`Location IN (${locationFilter.map(l => `'${escapeStr(l)}'`).join(', ')})`);
                    } else {
                        conditions.push(`Location = '${escapeStr(locationFilter)}'`);
                    }
                }

                // Tier 1/2 filter for all Signal Lab queries
                conditions.push(`Location IN (SELECT location FROM rb_location_darkstore WHERE tier IN ('Tier 1', 'Tier 2'))`);

                if (categoryFilter) {
                    const isMars = !['colpal', 'gcpl', 'cinthol'].includes(getCurrentDbName());
                    const catCol = isMars ? 'Category' : 'Product_type';
                    if (Array.isArray(categoryFilter)) {
                        conditions.push(`LOWER(${catCol}) IN (${categoryFilter.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`);
                    } else {
                        conditions.push(`${catCol} ILIKE '${escapeStr(categoryFilter)}'`);
                    }
                }

                if (!ignoreBrand) {
                    if (brandFilter) {
                        if (Array.isArray(brandFilter)) {
                            conditions.push(`LOWER(Brand) IN (${brandFilter.map(b => `'${escapeStr(b.toLowerCase())}'`).join(', ')})`);
                        } else {
                            conditions.push(`Brand ILIKE '%${escapeStr(brandFilter)}%'`);
                        }
                    } else {
                        // For my brand only
                        conditions.push(`(Comp_flag = 0 OR Comp_flag = '0')`);
                    }
                }

                const isAll = (val) => {
                    if (!val) return true;
                    if (Array.isArray(val)) return val.some(v => String(v).toLowerCase() === 'all');
                    return String(val).toLowerCase() === 'all';
                };

                if (keywordFilter && !isAll(keywordFilter)) {
                    if (Array.isArray(keywordFilter)) {
                        const kwConds = keywordFilter.map(k => `Product ILIKE '%${escapeStr(k)}%'`);
                        conditions.push(`(${kwConds.join(' OR ')})`);
                    } else {
                        conditions.push(`Product ILIKE '%${escapeStr(keywordFilter)}%'`);
                    }
                }

                return conditions.join(' AND ');
            };

            /* ================= 2. DEFINE METRIC & SORTING LOGIC ================= */
            const direction = 'DESC'; // Always show highest offtake first

            // Main metric for sorting and classification: OSA Increment (OSA Change)
            const mainOsaExpr = `(sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', ifNull(toFloat64OrZero(toString(neno_osa)), 0.0), 0.0)) / nullIf(sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', ifNull(toFloat64OrZero(toString(deno_osa)), 0.0), 0.0)), 0)) * 100`;
            const compOsaExpr = `(sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', ifNull(toFloat64OrZero(toString(neno_osa)), 0.0), 0.0)) / nullIf(sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', ifNull(toFloat64OrZero(toString(deno_osa)), 0.0), 0.0)), 0)) * 100`;

            // This is the OSA increment logic requested by the user
            const osaMetricExpr = `(ifNull(${mainOsaExpr}, 0) - ifNull(${compOsaExpr}, 0))`;

            // We use OSA change as the sort metric for ALL availability signal lab tabs (as per user request)
            const sortMetric = osaMetricExpr;

            const threshold = isBrandGroup ? 0.5 : 2; // Reduced threshold for brands to show more signals
            const havingClause = signalType === 'gainer'
                ? `HAVING ${sortMetric} > ${threshold}`
                : `HAVING ${sortMetric} < -${threshold}`;

            // Sorting logic: Drainers by lowest OSA, Gainers by highest metric (OSA or SOS)
            let sortExpr = `currSales`;
            let joinClause = '';

            console.log(`[SignalLab] request: type=${metricType}, signalType=${signalType}, direction=${direction}, groupBy=${groupBy}`);
            const skuQuery = `
                SELECT 
                    ${groupCol}, 
                    ${sortMetric} as sortMetric, 
                    ${mainOsaExpr} as absoluteOsa,
                    sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(Sales), 0.0)) as currSales
                FROM rb_pdp_olap
                WHERE ${buildWhereClause(true)}
                GROUP BY ${groupCol}
                ${havingClause}
                ORDER BY toFloat64(currSales) DESC
                LIMIT ${limitNum} OFFSET ${offsetNum}
            `;

            const skuRows = await queryClickHouse(skuQuery);
            console.log(`[SignalLab] skuRows (top 3):`, skuRows.slice(0, 3).map(r => ({ pid: r[groupCol], osa: r.absoluteOsa, sales: r.currSales })));

            if (!skuRows || !skuRows.length) return { skus: [], totalCount: 0 };

            // Ordered list of IDs (brand names or Item_Ids)
            const webPids = skuRows.map(r => r[groupCol]);

            /* ================= STEP 4: GET TOTAL CONTEXT SALES & COUNT ================= */
            const totalMarketSalesQuery = `
                SELECT sum(toFloat64OrZero(toString(Sales))) as totalMarketSales
                FROM rb_pdp_olap
                WHERE ${buildWhereClause(false, true)}
            `;
            const totalMarketSalesResult = await queryClickHouse(totalMarketSalesQuery);
            const totalMarketSales = Number(totalMarketSalesResult?.[0]?.totalMarketSales || 0);

            const countQuery = `
                SELECT count() as count FROM (
                    SELECT ${groupCol}
                    FROM rb_pdp_olap
                    WHERE ${buildWhereClause(true)}
                    GROUP BY ${groupCol}
                    ${havingClause}
                ) as temp
            `;

            const countResult = await queryClickHouse(countQuery);
            const totalCount = countResult?.[0]?.count || 0;

            /* ================= STEP 5: FULL AGGREGATION FOR SELECTED IDs ================= */
            const webPidsStr = webPids.map(p => `'${escapeStr(p)}'`).join(', ');
            const filterCol = isBrandGroup ? 'Brand' : 'Web_Pid';

            const aggQuery = `
                SELECT
                    ${groupCol},
                    ${isBrandGroup ? "'' as Product" : 'any(Product) as Product'},
                    any(Category) as Category,
                    any(Platform) as Platform,
                    ${isBrandGroup ? "'' as BrandCol" : "any(Brand) as Brand"},
                    any(Comp_flag) as Comp_flag,
                    sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(neno_osa), 0.0)) AS totalNeno,
                    sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(deno_osa), 0.0)) AS totalDeno,
                    sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', toFloat64(neno_osa), 0.0)) AS compNeno,
                    sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', toFloat64(deno_osa), 0.0)) AS compDeno,
                    GREATEST(0, avgIf(toFloat64(Inventory), toDate(DATE) BETWEEN '${start}' AND '${end}')) AS avgInventory,
                    GREATEST(0, sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(Qty_Sold), 0.0))) AS totalQtySold,
                    avg(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(Selling_Price), 0.0)) AS avgPrice,
                    avg(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(${adSalesCol}) / nullIf(toFloat64(${adSpendCol}), 0), 0.0)) AS avgRoas,
                    sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(${adClicksCol}), 0.0)) AS totalClicks,
                    sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(${adImpressionsCol}), 0.0)) AS totalImpressions,
                    sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(Sales), 0.0)) AS currSales,
                    sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', toFloat64(Sales), 0.0)) AS prevSales
                FROM rb_pdp_olap
                WHERE ${filterCol} IN (${webPidsStr})
                    AND (toDate(DATE) BETWEEN '${start}' AND '${end}' OR toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}')
                GROUP BY ${groupCol}
            `;

            const rows = await queryClickHouse(aggQuery);

            const sortedRows = webPids.map(pid => rows.find(r => r[groupCol] === pid)).filter(Boolean);

            /* ================= STEP 6: City level data (Current & Comparison) ================= */
            const cityAggQuery = `
                SELECT
                    ${groupCol}, Location,
                    (sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(neno_osa), 0.0)) / nullIf(sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(deno_osa), 0.0)), 0)) * 100 AS osa,
                    (sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', toFloat64(neno_osa), 0.0)) / nullIf(sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', toFloat64(deno_osa), 0.0)), 0)) * 100 AS prev_osa,
                    avg(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(${adSalesCol}) / nullIf(toFloat64(${adSpendCol}), 0), 0.0)) as roas,
                    sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(${adClicksCol}), 0.0)) as clicks,
                    sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(${adImpressionsCol}), 0.0)) as impressions,
                    GREATEST(0, avg(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(Inventory), 0.0))) as inventory,
                    sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(Qty_Sold), 0.0)) as qtySold,
                    sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(Sales), 0.0)) as citySales
                FROM rb_pdp_olap
                WHERE ${filterCol} IN (${webPidsStr})
                    AND (toDate(DATE) BETWEEN '${start}' AND '${end}' OR toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}')
                    AND Location IN (SELECT location FROM rb_location_darkstore WHERE tier = 'Tier 1')
                    AND ${buildWhereClause(true, true).replace(/Brand ILIKE.*' OR /g, '').replace(/Brand ILIKE.*' AND /g, '') /* Simple way to inject other filters but not current brand */}
                GROUP BY ${groupCol}, Location
            `;
            const cityRows = await queryClickHouse(cityAggQuery);

            /* ================= STEP 6.5: FETCH SOS FOR VISIBILITY ================= */
            let sosMap = {};
            if (metricType === 'visibility' && webPids.length > 0) {
                try {
                    const brandOwnership = {}; // { brandName: isOurs }
                    rows.forEach(r => {
                        const b = isBrandGroup ? r[groupCol] : (r.Brand || r.BrandCol);
                        if (b) brandOwnership[b.toLowerCase()] = (r.Comp_flag == 0);
                    });
                    const brandsForSOS = Object.keys(brandOwnership);

                    if (brandsForSOS.length > 0) {
                        let marketConds = [`DATE BETWEEN '${start}' AND '${end}'`];

                        if (platformFilter) {
                            const pList = Array.isArray(platformFilter) ? platformFilter : [platformFilter];
                            marketConds.push(`LOWER(platform_name) IN (${pList.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})`);
                        }
                        if (locationFilter) {
                            const lList = Array.isArray(locationFilter) ? locationFilter : [locationFilter];
                            marketConds.push(`LOWER(location_name) IN (${lList.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ')})`);
                        }

                        const sosQuery = `
                            SELECT
                                brand as brand,
                                flag,
                                sum(toInt32(overall)) as brand_overall,
                                sum(toInt32(spons)) as brand_ad,
                                sum(toInt32(organic)) as brand_organic,
                                sum(sum(toInt32(overall))) OVER () as market_overall,
                                sum(sum(toInt32(spons))) OVER () as market_ad,
                                sum(sum(toInt32(organic))) OVER () as market_organic
                            FROM rb_kw_olap
                            WHERE ${marketConds.join(' AND ')}
                            GROUP BY brand, flag
                        `;
                        const sosResults = await queryClickHouse(sosQuery);
                        console.log(`[SignalLab] sosResults length:`, sosResults.length);
                        if (sosResults.length > 0) {
                            console.log(`[SignalLab] sosResults example:`, JSON.stringify(sosResults[0]));
                        }

                        // First pass: Aggregate raw counts by brand key
                        const aggregateData = {};
                        let marketOverallCount = 0;
                        let marketAdCount = 0;
                        let marketOrganicCount = 0;

                        sosResults.forEach(r => {
                            const bLower = (r.brand || '').trim().toLowerCase();
                            if (!bLower) return;

                            if (!aggregateData[bLower]) {
                                aggregateData[bLower] = { overall: 0, ad: 0, organic: 0 };
                            }

                            aggregateData[bLower].overall += Number(r.brand_overall || 0);
                            aggregateData[bLower].ad += Number(r.brand_ad || 0);
                            aggregateData[bLower].organic += Number(r.brand_organic || 0);

                            // Market totals are the same across all rows (using OVER)
                            marketOverallCount = Number(r.market_overall || 0);
                            marketAdCount = Number(r.market_ad || 0);
                            marketOrganicCount = Number(r.market_organic || 0);
                        });

                        // Second pass: Calculate percentages and store in sosMap
                        Object.keys(aggregateData).forEach(bLower => {
                            const data = aggregateData[bLower];
                            const overall = marketOverallCount > 0 ? (data.overall / marketOverallCount) * 100 : 0;
                            const ad = marketAdCount > 0 ? (data.ad / marketAdCount) * 100 : 0;
                            const organic = marketOrganicCount > 0 ? (data.organic / marketOrganicCount) * 100 : 0;

                            sosMap[bLower] = {
                                overall: overall.toFixed(1) + '%',
                                ad: ad.toFixed(1) + '%',
                                organic: organic.toFixed(1) + '%'
                            };
                        });

                        // Fallback: If a brand is not found in sosMap by its granular name, 
                        // but we have a generic 'Mars' entry and the requested brand is ours (flag=1 in PDP),
                        // we could potentially use the 'Mars' SOS. But usually granular is better.
                    }
                } catch (e) {
                    console.error('[SignalLab] SOS Fetch Error:', e);
                }
            }

            /* ================= STEP 7: RESPONSE MAPPING ================= */
            const skus = sortedRows.map((item, i) => {
                const neno = Number(item.totalNeno || 0);
                const deno = Number(item.totalDeno || 0);
                const osa = deno ? (neno / deno) * 100 : 0;

                const cNeno = Number(item.compNeno || 0);
                const cDeno = Number(item.compDeno || 0);
                const compOsa = cDeno ? (cNeno / cDeno) * 100 : 0;
                const osaChange = osa - compOsa;

                // As per user request, the primary impact metric is always the OSA Increment
                const metricChange = osaChange;

                // Apply Scaling Fix for Mars items
                const scaledItem = scaleMarsMetrics({ ...item }, isBrandGroup ? item[groupCol] : (item.Brand || item.BrandCol));
                
                const qty = Number(scaledItem.totalQtySold || 0);
                const price = Number(scaledItem.avgPrice || 0);
                const currSalesVal = Number(scaledItem.currSales || 0);
                const revenue = currSalesVal;
                const inventory = scaledItem.avgInventory === null ? null : Number(scaledItem.avgInventory);
                const drr = qty / daysInPeriod;
                const doi = (inventory !== null && drr > 0) ? inventory / drr : (inventory === null ? null : 0);

                const offtakeShare = (totalMarketSales > 0) ? (revenue / totalMarketSales * 100) : 0;

                let kpis = {};
                if (metricType === 'sales') {
                    kpis = {
                        orders: qty > 1000 ? `${(qty / 1000).toFixed(1)}k` : qty.toString(),
                        asp: `₹${Math.round(price)}`,
                        revenueShare: totalMarketSales > 0 ? `${(revenue / totalMarketSales * 100).toFixed(1)}%` : '0.0%'
                    };
                } else if (metricType === 'availability') {
                    kpis = {
                        soh: inventory !== null ? `${Math.round(inventory)} units` : '-',
                        doi: doi !== null ? doi.toFixed(1) : '-',
                        weightedOsa: `${osa.toFixed(1)}%`
                    };
                } else if (metricType === 'inventory') {
                    const risk = doi > 30 ? 'High' : (doi > 15 ? 'Med' : 'Low');
                    kpis = {
                        drr: drr > 1000 ? `${(drr / 1000).toFixed(1)}k` : Math.round(drr).toString(),
                        doi: doi !== null ? doi.toFixed(1) : '-',
                        oos: `${(100 - osa).toFixed(0)}%`,
                        expiryRisk: risk
                    };
                } else if (metricType === 'performance') {
                    const impressions = Number(scaledItem.totalImpressions || 0);
                    const clicks = Number(scaledItem.totalClicks || 0);
                    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
                    const atc = Math.round(clicks * 0.15);
                    kpis = {
                        roas: item.avgRoas ? `${Number(item.avgRoas).toFixed(1)}x` : '0.0x',
                        ctr: `${ctr.toFixed(1)}%`,
                        clicks: clicks > 1000 ? `${(clicks / 1000).toFixed(1)}k` : clicks.toString(),
                        atc: atc > 1000 ? `${(atc / 1000).toFixed(1)}k` : atc.toString()
                    };
                } else if (metricType === 'visibility') {
                    const brandKey = (isBrandGroup ? item[groupCol] : item.Brand || item.BrandCol || '').toString().trim().toLowerCase();

                    // Improved matching for SOS: exact first, then partial
                    let sosData = sosMap[brandKey];
                    if (!sosData) {
                        // Try finding a key that contains the brandKey (e.g. "mars - galaxy" contains "galaxy")
                        const partialKey = Object.keys(sosMap).find(k => k.includes(brandKey) || brandKey.includes(k));
                        sosData = sosMap[partialKey] || { overall: '0.0%', ad: '0.0%', organic: '0.0%' };
                    }

                    kpis = {
                        adSos: sosData.ad,
                        organicSos: sosData.organic,
                        overallSos: sosData.overall,
                        weightedOsa: `${osa.toFixed(1)}%`
                    };
                }

                const podCities = cityRows.filter(c => c[groupCol] === item[groupCol]);
                const sortedByImpact = podCities
                    .filter(c => {
                        const diff = Number(c.osa || 0) - Number(c.prev_osa || 0);
                        return signalType === 'drainer' ? diff < 0 : diff > 0;
                    })
                    .sort((a, b) => {
                        const diffA = Number(a.osa || 0) - Number(a.prev_osa || 0);
                        const diffB = Number(b.osa || 0) - Number(b.prev_osa || 0);
                        return signalType === 'drainer' ? diffA - diffB : diffB - diffA;
                    });

                const topCities = sortedByImpact.slice(0, 10).map((c, idx) => {
                    const cityOsaNow = Number(c.osa || 0);
                    const cityOsaWas = Number(c.prev_osa || 0);
                    const cityOsaChange = cityOsaNow - cityOsaWas;
                    const impactSign = cityOsaChange >= 0 ? '+' : '';

                    const citySales = Number(c.citySales || 0);
                    const salesWeightage = currSalesVal > 0 ? (citySales / currSalesVal) * 100 : 0;

                    if (metricType === 'inventory') {
                        const cityQty = Number(c.qtySold || 0);
                        const cityInventory = Number(c.inventory || 0);
                        const cityDrr = cityQty / daysInPeriod;
                        const cityDoi = cityDrr > 0 ? cityInventory / cityDrr : 0;
                        return {
                            city: c.Location,
                            metric: idx === 0 ? `DOI ${cityDoi.toFixed(1)}` : `DRR ${Math.round(cityDrr)}`,
                            change: `${impactSign}${cityOsaChange.toFixed(1)}%`,
                            weightage: salesWeightage.toFixed(1) + '%'
                        };
                    }

                    if (metricType === 'performance') {
                        const cityClicks = Number(c.clicks || 0);
                        return {
                            city: c.Location,
                            metric: idx === 0 ? `ROAS ${Number(c.roas || 0).toFixed(1)}x` : `Clicks ${cityClicks > 1000 ? (cityClicks / 1000).toFixed(1) + 'k' : cityClicks}`,
                            change: `${impactSign}${cityOsaChange.toFixed(1)}%`,
                            weightage: salesWeightage.toFixed(1) + '%'
                        };
                    }

                    return {
                        city: c.Location,
                        metric: `OSA ${cityOsaNow.toFixed(1)}%`,
                        change: `${impactSign}${cityOsaChange.toFixed(1)}%`,
                        weightage: salesWeightage.toFixed(1) + '%'
                    };
                });

                // When grouping by brand, skuName = brand name, skuCode = '-', packSize = '-'
                const displayName = isBrandGroup ? item[groupCol] : item.Product;
                const displayCode = isBrandGroup ? '-' : (item.Web_Pid || item.web_pid || '-');

                return {
                    id: `${metricType.substring(0, 3).toUpperCase()}-${(pageNum - 1) * limitNum + i + 1}`,
                    skuCode: displayCode,
                    skuName: displayName,
                    packSize: '-',
                    platform: item.Platform,
                    categoryTag: item.Category,
                    groupBy: groupBy,
                    type: signalType,
                    metricType,
                    offtakeValue: metricType === 'inventory' ? doi.toFixed(1) : `₹${(revenue / 100000).toFixed(1)} lac`,
                    offtakeShare: totalMarketSales > 0 ? ((revenue / totalMarketSales) * 100).toFixed(2) + '%' : '0.00%',
                    impact: `${metricChange >= 0 ? '+' : ''}${metricChange.toFixed(1)}%`,
                    kpis,
                    topCities
                };
            });

            return { skus, totalCount: Number(totalCount) };
        }, CACHE_TTL.METRICS);

        res.json({
            ...data,
            filters: req.query
        });
    } catch (err) {
        console.error('🔥 SIGNAL LAB SQL ERROR:', err);
        res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
};


/**
 * Get City Details for a Specific Product in Signal Lab - ClickHouse Version
 */
export const getCityDetailsForProduct = async (req, res) => {
    try {
        const cacheKey = generateCacheKey('signal_lab_city_details_v5', req.query);

        const data = await getCachedOrCompute(cacheKey, async () => {
            const { webPid, startDate, endDate, compareStartDate, compareEndDate, type: metricType = 'availability', signalType = 'gainer', groupBy = 'sku' } = req.query;

            if (!webPid) throw new Error('webPid is required');

            const isBrandGroup = groupBy === 'brand';
            const filterCol = isBrandGroup ? 'Brand' : 'Web_Pid';

            const end = endDate || dayjs().format('YYYY-MM-DD');
            const start = startDate || dayjs(end).subtract(30, 'day').format('YYYY-MM-DD');
            const compEnd = compareEndDate || dayjs(start).subtract(1, 'day').format('YYYY-MM-DD');
            const compStart = compareStartDate || dayjs(compEnd).subtract(dayjs(end).diff(dayjs(start), 'day'), 'day').format('YYYY-MM-DD');

            const processFilter = (val) => {
                if (!val || val === 'All') return null;
                if (typeof val === 'string' && val.includes(',')) return val.split(',').map(v => v.trim());
                return val;
            };

            const platformFilter = processFilter(req.query.platform);
            const brandFilter = processFilter(req.query.brand);
            const locationFilter = processFilter(req.query.location);
            const categoryFilter = processFilter(req.query.category);

            const buildConditions = (includeCompDates = false) => {
                const conds = [`${filterCol} = '${escapeStr(webPid)}'`];

                // Tier 1/2 filter for all Signal Lab queries
                conds.push(`Location IN (SELECT location FROM rb_location_darkstore WHERE tier IN ('Tier 1', 'Tier 2'))`);

                if (includeCompDates) {
                    conds.push(`(toDate(DATE) BETWEEN '${start}' AND '${end}' OR toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}')`);
                } else {
                    conds.push(`toDate(DATE) BETWEEN '${start}' AND '${end}'`);
                }

                if (platformFilter) {
                    if (Array.isArray(platformFilter)) conds.push(`LOWER(Platform) IN (${platformFilter.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})`);
                    else conds.push(`Platform ILIKE '${escapeStr(platformFilter)}'`);
                }
                if (locationFilter) {
                    if (Array.isArray(locationFilter)) conds.push(`Location IN (${locationFilter.map(l => `'${escapeStr(l)}'`).join(', ')})`);
                    else conds.push(`Location = '${escapeStr(locationFilter)}'`);
                }
                if (brandFilter) {
                    if (Array.isArray(brandFilter)) conds.push(`LOWER(Brand) IN (${brandFilter.map(b => `'${escapeStr(b.toLowerCase())}'`).join(', ')})`);
                    else conds.push(`Brand ILIKE '%${escapeStr(brandFilter)}%'`);
                }
                if (categoryFilter) {
                    const isMars = !['colpal', 'gcpl', 'cinthol'].includes(getCurrentDbName());
                    const catCol = isMars ? 'Category' : 'Product_type';
                    if (Array.isArray(categoryFilter)) conds.push(`LOWER(${catCol}) IN (${categoryFilter.map(c => `'${escapeStr(c.toLowerCase())}'`).join(', ')})`);
                    else conds.push(`${catCol} ILIKE '${escapeStr(categoryFilter)}'`);
                }
                return conds.join(' AND ');
            };

            // Main query with all metrics - Aggregating by city and date first to get correct city-level SOH
            const query = `
                WITH daily_city_stats AS (
                    SELECT 
                        Location,
                        DATE,
                        any(Brand) as brand_name,
                        any(Comp_flag) as comp_flag,
                        sum(toFloat64OrNull(toString(Inventory))) as daily_inventory,
                        GREATEST(0, sum(ifNull(toFloat64OrZero(toString(Qty_Sold)), 0.0))) as daily_qty_sold,
                        sum(ifNull(toFloat64OrZero(toString(neno_osa)), 0.0)) as daily_neno,
                        sum(ifNull(toFloat64OrZero(toString(deno_osa)), 0.0)) as daily_deno,
                        sum(ifNull(toFloat64OrZero(toString(Sales)), 0.0)) as daily_sales,
                        sum(ifNull(toFloat64OrZero(toString(MRP)), 0.0)) as daily_mrp,
                        sum(ifNull(toFloat64OrZero(toString(Selling_Price)), 0.0)) as daily_sp,
                        sum(ifNull(toFloat64OrZero(toString(Ad_sales)), 0.0)) as daily_ad_sales,
                        sum(ifNull(toFloat64OrZero(toString(Ad_Spend)), 0.0)) as daily_ad_spend,
                        sum(ifNull(toFloat64OrZero(toString(Ad_Clicks)), 0.0)) as daily_clicks,
                        sum(ifNull(toFloat64OrZero(toString(Ad_Impressions)), 0.0)) as daily_impressions,
                        countIf(toFloat64(deno_osa) > 0) as listed_count,
                        count() as total_rows
                    FROM rb_pdp_olap
                    WHERE ${buildConditions(true)}
                    GROUP BY Location, DATE
                )
                SELECT
                    Location as city,
                    any(brand_name) as brand_name,
                    any(comp_flag) as comp_flag,
                    -- OSA metrics
                    (sumIf(daily_neno, toDate(DATE) BETWEEN '${start}' AND '${end}') / nullIf(sumIf(daily_deno, toDate(DATE) BETWEEN '${start}' AND '${end}'), 0)) * 100 AS osa,
                    (sumIf(daily_neno, toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}') / nullIf(sumIf(daily_deno, toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}'), 0)) * 100 AS compOsa,
                    -- Sales metrics
                    sumIf(daily_sales, toDate(DATE) BETWEEN '${start}' AND '${end}') AS offtake,
                    sumIf(daily_sales, toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}') AS compOfftake,
                    -- Inventory metrics (Latest daily city-total inventory, picking latest non-null available)
                    argMax(daily_inventory, if(daily_inventory > 0, toUnixTimestamp(DATE), 0)) AS soh,
                    sumIf(daily_qty_sold, toDate(DATE) BETWEEN '${start}' AND '${end}') AS qty_sold,
                    sumIf(daily_ad_sales, toDate(DATE) BETWEEN '${start}' AND '${end}') AS ad_sales,
                    sumIf(daily_ad_spend, toDate(DATE) BETWEEN '${start}' AND '${end}') AS ad_spend,
                    sumIf(daily_clicks, toDate(DATE) BETWEEN '${start}' AND '${end}') AS clicks,
                    sumIf(daily_impressions, toDate(DATE) BETWEEN '${start}' AND '${end}') AS impressions,
                    -- Listing %
                    (sumIf(listed_count, toDate(DATE) BETWEEN '${start}' AND '${end}') / nullIf(sumIf(total_rows, toDate(DATE) BETWEEN '${start}' AND '${end}'), 0)) * 100 AS listing_pct,
                    -- Discount (Average weighted by total count if needed, but simple avg on daily sums is usually fine)
                    avgIf((daily_mrp - daily_sp) / nullIf(daily_mrp, 0) * 100, toDate(DATE) BETWEEN '${start}' AND '${end}' AND daily_mrp > 0) AS discount
                FROM daily_city_stats
                GROUP BY Location
                HAVING ${signalType === 'gainer' ? '(osa - compOsa) > 0' : '(osa - compOsa) < 0'}
                ORDER BY abs(osa - compOsa) DESC
            `;

            const rows = await queryClickHouse(query);

            const startD = dayjs(start);
            const endD = dayjs(end);
            const daysInPeriod = Math.max(1, endD.diff(startD, 'day') + 1);

            const cities = rows.map(row => {
                // Apply Scaling Fix for Mars items
                const scaledRow = scaleMarsMetrics({ ...row }, isBrandGroup ? webPid : row.brand_name);
                
                const osa = Number(scaledRow.osa || 0);
                const compOsa = Number(scaledRow.compOsa || 0);
                const osaChange = osa - compOsa;

                const offtake = Number(scaledRow.offtake || 0);
                const compOfftake = Number(scaledRow.compOfftake || 0);
                const offtakeChange = compOfftake > 0 ? ((offtake - compOfftake) / compOfftake) * 100 : 0;

                const discount = Number(scaledRow.discount || 0);
                const listingPct = Number(scaledRow.listing_pct || 0);

                const soh = (scaledRow.soh === null || scaledRow.soh === undefined) ? null : Number(scaledRow.soh);
                const qtySold = Number(scaledRow.qty_sold || 0);
                const drr = qtySold / daysInPeriod;
                const doi = (soh !== null && drr > 0) ? soh / drr : (soh === null ? null : 0);

                const adSales = Number(scaledRow.ad_sales || 0);
                const adSpend = Number(scaledRow.ad_spend || 0);
                const clicks = Number(scaledRow.clicks || 0);
                const impressions = Number(scaledRow.impressions || 0);

                return {
                    city: row.city,
                    brand_name: row.brand_name,
                    comp_flag: row.comp_flag,
                    listingPct: listingPct,
                    estOfftake: offtake,
                    estOfftakeChange: offtakeChange,
                    orders: Math.round(qtySold),
                    asp: qtySold > 0 ? (offtake / qtySold) : 0,
                    roas: adSpend > 0 ? (adSales / adSpend) : 0,
                    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
                    clicks: clicks,
                    wtOsa: osa,
                    wtOsaChange: osaChange,
                    overallSos: 0,
                    adSos: 0,
                    organicSos: 0,
                    wtDisc: discount,
                    soh: soh,
                    doi: doi,
                    drr: drr
                };
            });

            // FIXED: Use same threshold as card view (0.5 for brands, 2 for SKUs)
            const dynamicThreshold = isBrandGroup ? 0.5 : 2;

            let finalCities = cities
                .filter(c => signalType === 'drainer' ? c.wtOsaChange < -dynamicThreshold : c.wtOsaChange > dynamicThreshold)
                .sort((a, b) => signalType === 'drainer' ? a.wtOsaChange - b.wtOsaChange : b.wtOsaChange - a.wtOsaChange);

            // Fetch SOS metrics from rb_kw_olap for these cities
            if (finalCities.length > 0) {
                const uniqueCities = [...new Set(finalCities.map(c => c.city))];
                const citiesStr = uniqueCities.map(c => `'${escapeStr(c)}'`).join(', ');

                // Check ownership - if most are ours, we use flag=1
                const isOurs = finalCities[0]?.comp_flag == 0;
                const mainBrand = isBrandGroup ? webPid : finalCities[0]?.brand_name;

                if (mainBrand) {
                    let marketConds = [
                        `DATE BETWEEN '${start}' AND '${end}'`,
                        `location_name IN (${citiesStr})`
                    ];

                    if (platformFilter) {
                        const pList = Array.isArray(platformFilter) ? platformFilter : [platformFilter];
                        marketConds.push(`LOWER(platform_name) IN (${pList.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})`);
                    }

                    // Query to get brand counts and city market totals
                    const sosQuery = `
                        SELECT
                            location_name as city,
                            brand_name_th as brand,
                            flag,
                            sum(toInt32(overall)) as brand_overall,
                            sum(toInt32(spons)) as brand_ad,
                            sum(toInt32(organic)) as brand_organic,
                            sum(sum(toInt32(overall))) OVER (PARTITION BY location_name) as city_market_overall,
                            sum(sum(toInt32(spons))) OVER (PARTITION BY location_name) as city_market_ad,
                            sum(sum(toInt32(organic))) OVER (PARTITION BY location_name) as city_market_organic
                        FROM rb_kw_olap
                        WHERE ${marketConds.join(' AND ')}
                        GROUP BY location_name, brand_name_th, flag
                    `;

                    try {
                        const sosResults = await queryClickHouse(sosQuery);
                        const targetBrandLower = mainBrand.toLowerCase();
                        const sosLookup = {};

                        sosResults.forEach(r => {
                            const cKey = r.city.toLowerCase();
                            if (!sosLookup[cKey]) sosLookup[cKey] = { brand_overall: 0, brand_ad: 0, brand_organic: 0, market_overall: r.city_market_overall, market_ad: r.city_market_ad, market_organic: r.city_market_organic };

                            const match = isOurs ? (r.flag == 1) : (r.brand.toLowerCase() === targetBrandLower);
                            if (match) {
                                sosLookup[cKey].brand_overall += Number(r.brand_overall || 0);
                                sosLookup[cKey].brand_ad += Number(r.brand_ad || 0);
                                sosLookup[cKey].brand_organic += Number(r.brand_organic || 0);
                            }
                        });

                        finalCities = finalCities.map(c => {
                            const data = sosLookup[c.city.toLowerCase()];
                            if (data) {
                                const overallSos = data.market_overall > 0 ? (data.brand_overall / data.market_overall) * 100 : 0;
                                const adSos = data.market_ad > 0 ? (data.brand_ad / data.market_ad) * 100 : 0;
                                const organicSos = data.market_organic > 0 ? (data.brand_organic / data.market_organic) * 100 : 0;

                                return {
                                    ...c,
                                    overallSos: parseFloat(overallSos.toFixed(1)),
                                    adSos: parseFloat(adSos.toFixed(1)),
                                    organicSos: parseFloat(organicSos.toFixed(1))
                                };
                            }
                            return c;
                        });
                    } catch (e) {
                        console.error('[CityDetails] SOS fetching error:', e);
                    }
                }
            }

            return { cities: finalCities, totalCities: finalCities.length };
        }, CACHE_TTL.METRICS);

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
};

// ==========================================
// Brand → SKU → City Day-Level ECP
// ==========================================
export const getBrandSkuCityDayLevel = async (req, res) => {
    try {
        const filters = {
            dayRange: parseInt(req.query.dayRange) || 7,
            platform: parseFilter(req.query.platform),
            brand: parseFilter(req.query.brand),
            cities: parseFilter(req.query.cities),
            categories: parseFilter(req.query.categories),
            zones: parseFilter(req.query.zones),
            metroFlag: parseFilter(req.query.metroFlag),
            months: parseFilter(req.query.months),
            ownBrandsOnly: req.query.ownBrandsOnly
        };
        console.log('[Controller] getBrandSkuCityDayLevel filters:', filters);

        const result = await availabilityService.getBrandSkuCityDayLevel(filters);
        res.json(result);
    } catch (error) {
        console.error('[Controller] getBrandSkuCityDayLevel error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};