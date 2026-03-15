import availabilityService from '../services/availabilityService.js';
import { generateCacheKey, getCachedOrCompute, CACHE_TTL } from '../utils/cacheHelper.js';
import { queryClickHouse, getCurrentDbName } from '../config/clickhouse.js';
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
            compareEndDate: req.query.compareEndDate
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
            compareEndDate: req.query.compareEndDate
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
            compareEndDate: req.query.compareEndDate
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
            compareEndDate: req.query.compareEndDate
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
            compareEndDate: req.query.compareEndDate
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
            endDate: req.query.endDate
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
            endDate: req.query.endDate
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
        const cacheKey = generateCacheKey('signal_lab_v7', req.query);
        const data = await getCachedOrCompute(cacheKey, async () => {
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
                keyword = 'All'
            } = req.query;

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
                        conditions.push(`Platform IN (${platformFilter.map(p => `'${escapeStr(p)}'`).join(', ')})`);
                    } else {
                        conditions.push(`Platform = '${escapeStr(platformFilter)}'`);
                    }
                }

                if (locationFilter) {
                    if (Array.isArray(locationFilter)) {
                        conditions.push(`Location IN (${locationFilter.map(l => `'${escapeStr(l)}'`).join(', ')})`);
                    } else {
                        conditions.push(`Location = '${escapeStr(locationFilter)}'`);
                    }
                }

                if (categoryFilter) {
                    const isMars = getCurrentDbName() === 'mars';
                    const catCol = isMars ? 'Category' : 'Product_type';
                    if (Array.isArray(categoryFilter)) {
                        conditions.push(`${catCol} IN (${categoryFilter.map(c => `'${escapeStr(c)}'`).join(', ')})`);
                    } else {
                        conditions.push(`${catCol} = '${escapeStr(categoryFilter)}'`);
                    }
                }

                if (!ignoreBrand) {
                    if (brandFilter) {
                        if (Array.isArray(brandFilter)) {
                            conditions.push(`Brand IN (${brandFilter.map(b => `'${escapeStr(b)}'`).join(', ')})`);
                        } else {
                            conditions.push(`Brand LIKE '%${escapeStr(brandFilter)}%'`);
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
            const direction = signalType === 'gainer' ? 'DESC' : 'ASC';

            // Main metric for sorting and classification: OSA Increment (OSA Change)
            const mainOsaExpr = `(sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', ifNull(toFloat64OrZero(toString(neno_osa)), 0.0), 0.0)) / nullIf(sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', ifNull(toFloat64OrZero(toString(deno_osa)), 0.0), 0.0)), 0)) * 100`;
            const compOsaExpr = `(sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', ifNull(toFloat64OrZero(toString(neno_osa)), 0.0), 0.0)) / nullIf(sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', ifNull(toFloat64OrZero(toString(deno_osa)), 0.0), 0.0)), 0)) * 100`;

            // This is the OSA increment logic requested by the user
            const osaMetricExpr = `(ifNull(${mainOsaExpr}, 0) - ifNull(${compOsaExpr}, 0))`;

            // We use OSA change as the sort metric for ALL availability signal lab tabs (as per user request)
            const sortMetric = osaMetricExpr;

            const threshold = 2; // Reduced threshold to show more signals
            const havingClause = signalType === 'gainer'
                ? `HAVING ${sortMetric} > ${threshold}`
                : `HAVING ${sortMetric} < -${threshold}`;

            console.log(`[SignalLab] request: type=${metricType}, signalType=${signalType}, direction=${direction}`);
            const skuQuery = `
                SELECT Item_Id, ${sortMetric} as sortMetric, ${mainOsaExpr} as absoluteOsa
                FROM rb_pdp_olap
                WHERE ${buildWhereClause(true)}
                GROUP BY Item_Id
                ${havingClause}
                ORDER BY absoluteOsa ${direction}
                LIMIT ${limitNum} OFFSET ${offsetNum}
            `;

            const skuRows = await queryClickHouse(skuQuery);
            console.log(`[SignalLab] skuRows (top 3):`, skuRows.slice(0, 3).map(r => ({ pid: r.Item_Id, osa: r.absoluteOsa })));

            if (!skuRows || !skuRows.length) return { skus: [], totalCount: 0 };

            // Ordered list of PIDs
            const webPids = skuRows.map(r => r.Item_Id);

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
                    SELECT Item_Id
                    FROM rb_pdp_olap
                    WHERE ${buildWhereClause(true)}
                    GROUP BY Item_Id
                    ${havingClause}
                ) as temp
            `;

            const countResult = await queryClickHouse(countQuery);
            const totalCount = countResult?.[0]?.count || 0;

            /* ================= STEP 5: FULL AGGREGATION FOR SELECTED IDs ================= */
            const webPidsStr = webPids.map(p => `'${escapeStr(p)}'`).join(', ');

            const aggQuery = `
                SELECT
                    Item_Id,  
                    any(Product) as Product, 
                    any(Category) as Category, 
                    any(Platform) as Platform,
                    '' as Weight, 
                    any(Brand) as Brand,
                    sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(neno_osa), 0.0)) AS totalNeno,
                    sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(deno_osa), 0.0)) AS totalDeno,
                    sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', toFloat64(neno_osa), 0.0)) AS compNeno,
                    sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', toFloat64(deno_osa), 0.0)) AS compDeno,
                    avg(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(Inventory), 0.0)) AS avgInventory,
                    sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(Qty_Sold), 0.0)) AS totalQtySold,
                    avg(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(Selling_Price), 0.0)) AS avgPrice,
                    avg(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(Ad_sales) / nullIf(toFloat64(Ad_Spend), 0), 0.0)) AS avgRoas,
                    sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(Ad_Clicks), 0.0)) AS totalClicks,
                    sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(Ad_Impressions), 0.0)) AS totalImpressions,
                    sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(Sales), 0.0)) AS currSales,
                    sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', toFloat64(Sales), 0.0)) AS prevSales
                FROM rb_pdp_olap
                WHERE Item_Id IN (${webPidsStr})
                    AND (toDate(DATE) BETWEEN '${start}' AND '${end}' OR toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}')
                GROUP BY Item_Id
            `;

            const rows = await queryClickHouse(aggQuery);

            const sortedRows = webPids.map(pid => rows.find(r => r.Item_Id === pid)).filter(Boolean);

            /* ================= STEP 6: City level data (Current & Comparison) ================= */
            const cityAggQuery = `
                SELECT
                    Item_Id, Location,
                    (sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(neno_osa), 0.0)) / nullIf(sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(deno_osa), 0.0)), 0)) * 100 AS osa,
                    (sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', toFloat64(neno_osa), 0.0)) / nullIf(sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', toFloat64(deno_osa), 0.0)), 0)) * 100 AS prev_osa,
                    avg(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(Ad_sales) / nullIf(toFloat64(Ad_Spend), 0), 0.0)) as roas,
                    sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(Ad_Clicks), 0.0)) as clicks,
                    sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(Ad_Impressions), 0.0)) as impressions,
                    avg(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(Inventory), 0.0)) as inventory,
                    sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(Qty_Sold), 0.0)) as qtySold,
                    sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(Sales), 0.0)) as citySales
                FROM rb_pdp_olap
                WHERE Item_Id IN (${webPidsStr})
                    AND (toDate(DATE) BETWEEN '${start}' AND '${end}' OR toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}')
                GROUP BY Item_Id, Location
            `;

            const cityRows = await queryClickHouse(cityAggQuery);

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

                const qty = Number(item.totalQtySold || 0);
                const price = Number(item.avgPrice || 0);
                const currSalesVal = Number(item.currSales || 0);
                const revenue = currSalesVal; // Use actual sales, not qty * price
                const inventory = Number(item.avgInventory || 0);
                const drr = qty / daysInPeriod;
                const doi = drr > 0 ? inventory / drr : 0;


                let kpis = {};
                if (metricType === 'sales') {
                    kpis = {
                        orders: qty > 1000 ? `${(qty / 1000).toFixed(1)}k` : qty.toString(),
                        asp: `₹${Math.round(price)}`,
                        revenueShare: `${(Math.random() * 10).toFixed(1)}%`
                    };
                } else if (metricType === 'availability') {
                    kpis = {
                        soh: `${Math.round(inventory)} units`,
                        doi: doi.toFixed(1),
                        weightedOsa: `${osa.toFixed(1)}%`
                    };
                } else if (metricType === 'inventory') {
                    const risk = doi > 30 ? 'High' : (doi > 15 ? 'Med' : 'Low');
                    kpis = {
                        drr: drr > 1000 ? `${(drr / 1000).toFixed(1)}k` : Math.round(drr).toString(),
                        oos: `${(100 - osa).toFixed(0)}%`,
                        expiryRisk: risk
                    };
                } else if (metricType === 'performance') {
                    const impressions = Number(item.totalImpressions || 0);
                    const clicks = Number(item.totalClicks || 0);
                    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
                    const atc = Math.round(clicks * 0.15);
                    kpis = {
                        roas: item.avgRoas ? `${Number(item.avgRoas).toFixed(1)}x` : '0.0x',
                        ctr: `${ctr.toFixed(1)}%`,
                        clicks: clicks > 1000 ? `${(clicks / 1000).toFixed(1)}k` : clicks.toString(),
                        atc: atc > 1000 ? `${(atc / 1000).toFixed(1)}k` : atc.toString()
                    };
                } else if (metricType === 'visibility') {
                    kpis = {
                        adPosition: Math.floor(Math.random() * 10) + 1,
                        adSos: (Math.random() * 30).toFixed(1) + '%',
                        organicPosition: Math.floor(Math.random() * 30) + 1,
                        overallSos: (Math.random() * 20).toFixed(1) + '%',
                        volumeShare: (Math.random() * 15).toFixed(1) + '%',
                        organicSos: (Math.random() * 10).toFixed(1) + '%'
                    };
                }

                const podCities = cityRows.filter(c => c.Item_Id === item.Item_Id);
                const sortedByImpact = podCities.sort((a, b) => {
                    const diffA = Number(a.osa || 0) - Number(a.prev_osa || 0);
                    const diffB = Number(b.osa || 0) - Number(b.prev_osa || 0);
                    return signalType === 'drainer' ? diffA - diffB : diffB - diffA;
                });

                // Get top contributing cities (increased to 10 to support "More cities" drilldown)
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

                return {
                    id: `${metricType.substring(0, 3).toUpperCase()}-${(pageNum - 1) * limitNum + i + 1}`,
                    skuCode: item.Item_Id || '-',
                    skuName: item.Product,
                    packSize: item.Weight,
                    platform: item.Platform,
                    categoryTag: item.Category,
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
        const cacheKey = generateCacheKey('signal_lab_city_details_v3', req.query);

        const data = await getCachedOrCompute(cacheKey, async () => {
            const { webPid, startDate, endDate, compareStartDate, compareEndDate, type: metricType = 'availability', signalType = 'gainer' } = req.query;

            if (!webPid) throw new Error('webPid is required');

            const start = startDate || '2025-12-01';
            const end = endDate || '2025-12-31';
            const compStart = compareStartDate || '2025-11-01';
            const compEnd = compareEndDate || '2025-11-30';

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
                // ADD TIER 1 FILTER USING SUBQUERY
                const conds = [`Item_Id = '${escapeStr(webPid)}'`, `Location IN (SELECT location FROM rb_location_darkstore WHERE tier IN ('Tier 1', 'Tier 2'))`];
                if (includeCompDates) {
                    conds.push(`(toDate(DATE) BETWEEN '${start}' AND '${end}' OR toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}')`);
                } else {
                    conds.push(`toDate(DATE) BETWEEN '${start}' AND '${end}'`);
                }

                if (platformFilter) {
                    if (Array.isArray(platformFilter)) conds.push(`Platform IN (${platformFilter.map(p => `'${escapeStr(p)}'`).join(', ')})`);
                    else conds.push(`Platform = '${escapeStr(platformFilter)}'`);
                }
                if (locationFilter) {
                    if (Array.isArray(locationFilter)) conds.push(`Location IN (${locationFilter.map(l => `'${escapeStr(l)}'`).join(', ')})`);
                    else conds.push(`Location = '${escapeStr(locationFilter)}'`);
                }
                if (brandFilter) {
                    if (Array.isArray(brandFilter)) conds.push(`Brand IN (${brandFilter.map(b => `'${escapeStr(b)}'`).join(', ')})`);
                    else conds.push(`Brand LIKE '%${escapeStr(brandFilter)}%'`);
                }
                if (categoryFilter) {
                    const isMars = getCurrentDbName() === 'mars';
                    const catCol = isMars ? 'Product_type' : 'Category';
                    if (Array.isArray(categoryFilter)) conds.push(`${catCol} IN (${categoryFilter.map(c => `'${escapeStr(c)}'`).join(', ')})`);
                    else conds.push(`${catCol} = '${escapeStr(categoryFilter)}'`);
                }
                return conds.join(' AND ');
            };

            // Main query with all metrics
            const query = `
                SELECT
                    Location as city,
                    any(Brand) as brand_name,
                    -- OSA metrics
                    (sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(neno_osa), 0.0)) / nullIf(sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(deno_osa), 0.0)), 0)) * 100 AS osa,
                    (sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', toFloat64(neno_osa), 0.0)) / nullIf(sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', toFloat64(deno_osa), 0.0)), 0)) * 100 AS compOsa,
                    -- Sales/Offtake metrics
                    sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(Sales), 0.0)) AS offtake,
                    sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', toFloat64(Sales), 0.0)) AS compOfftake,
                    -- Listing %
                    (sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}' AND toFloat64(deno_osa) > 0, 1, 0)) / nullIf(count(if(toDate(DATE) BETWEEN '${start}' AND '${end}', 1, null)), 0)) * 100 AS listing_pct,
                    -- Discount calculation
                    avg(if(toDate(DATE) BETWEEN '${start}' AND '${end}' AND toFloat64(MRP) > 0, 
                        (toFloat64(MRP) - toFloat64(Selling_Price)) / toFloat64(MRP) * 100, 0.0)) AS discount,
                    -- Category share info
                    count() as rowCount
                FROM rb_pdp_olap
                WHERE ${buildConditions(true)}
                GROUP BY Location
                ORDER BY abs(osa - compOsa) DESC
            `;

            console.log(`[CityDetails] webPid=${webPid} query=`, query.replace(/\s+/g, ' '));

            const rows = await queryClickHouse(query);

            const cities = rows.map(row => {
                const osa = Number(row.osa || 0);
                const compOsa = Number(row.compOsa || 0);
                const osaChange = osa - compOsa;

                const offtake = Number(row.offtake || 0);
                const compOfftake = Number(row.compOfftake || 0);
                const offtakeChange = compOfftake > 0 ? ((offtake - compOfftake) / compOfftake) * 100 : 0;

                const discount = Number(row.discount || 0);
                const listingPct = Number(row.listing_pct || 0);

                return {
                    city: row.city,
                    brand_name: row.brand_name,
                    listingPct: listingPct,
                    estOfftake: offtake / 100000, // Convert to lacs
                    estOfftakeChange: offtakeChange,
                    wtOsa: osa,
                    wtOsaChange: osaChange,
                    overallSos: 0, // Placeholder, will fill below
                    adSos: 0, // Placeholder, will fill below
                    wtDisc: discount,
                    brand_name: row.brand_name
                };
            })
                // Filter by 5% OSA threshold: drainers show cities with OSA drop > 5%, gainers show cities with OSA rise > 5%
                .filter(c => signalType === 'drainer' ? c.wtOsaChange < -5 : c.wtOsaChange > 5)
            // Sort: drainers by biggest drop first, gainers by biggest rise first
            let finalCities = cities
                .filter(c => signalType === 'drainer' ? c.wtOsaChange < -5 : c.wtOsaChange > 5)
                .sort((a, b) => signalType === 'drainer' ? a.wtOsaChange - b.wtOsaChange : b.wtOsaChange - a.wtOsaChange);

            // Fetch SOS metrics from rb_kw_olap for these cities
            if (finalCities.length > 0) {
                const uniqueCities = [...new Set(finalCities.map(c => c.city))];
                const citiesStr = uniqueCities.map(c => `'${escapeStr(c)}'`).join(', ');

                // Extract brand from the first row (assuming all rows belong to the same SKU/brand)
                const mainBrand = finalCities[0]?.brand_name;

                if (mainBrand) {
                    const sosQuery = `
                        SELECT
                            location_name as city,
                            (countIf(brand_name = '${escapeStr(mainBrand)}') / nullIf(count(), 0)) * 100 AS overall_sos,
                            (countIf(brand_name = '${escapeStr(mainBrand)}' AND spons_flag = 1) / nullIf(countIf(spons_flag = 1), 0)) * 100 AS ad_sos
                        FROM rb_kw_olap
                        WHERE kw_crawl_date BETWEEN '${start}' AND '${end}'
                          AND location_name IN (${citiesStr})
                        GROUP BY location_name
                    `;

                    try {
                        const sosRows = await queryClickHouse(sosQuery);
                        const sosMap = {};
                        sosRows.forEach(row => {
                            sosMap[row.city] = {
                                overallSos: Number(row.overall_sos || 0),
                                adSos: Number(row.ad_sos || 0)
                            };
                        });

                        finalCities = finalCities.map(c => ({
                            ...c,
                            overallSos: sosMap[c.city]?.overallSos || 0,
                            adSos: sosMap[c.city]?.adSos || 0
                        }));
                    } catch (e) {
                        console.error('[CityDetails] SOS fetching error:', e);
                    }
                }
            }

            return { cities: finalCities, totalCities: finalCities.length };
        }, CACHE_TTL.METRICS);

        res.json(data);
    } catch (err) {
        console.error('🔥 CITY DETAILS ERROR:', err);
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