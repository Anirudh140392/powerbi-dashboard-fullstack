import availabilityService from '../services/availabilityService.js';
import { generateCacheKey, getCachedOrCompute, CACHE_TTL } from '../utils/cacheHelper.js';
import { queryClickHouse } from '../config/clickhouse.js';
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
            zones: parseFilter(req.query.zones),
            metroFlags: parseFilter(req.query.metroFlags),
            pincodes: parseFilter(req.query.pincodes)
        };
        console.log('\n========== AVAILABILITY OVERVIEW API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));

        const data = await availabilityService.getAbsoluteOsaOverview(filters);

        console.log('[RESPONSE]:', JSON.stringify(data, null, 2));
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
            zones: parseFilter(req.query.zones),
            metroFlags: parseFilter(req.query.metroFlags),
            pincodes: parseFilter(req.query.pincodes)
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
            zones: parseFilter(req.query.zones),
            metroFlags: parseFilter(req.query.metroFlags),
            pincodes: parseFilter(req.query.pincodes)
        };
        console.log('\n========== OSA PERCENTAGE DETAIL API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));

        const data = await availabilityService.getAbsoluteOsaPercentageDetail(filters);

        console.log('[RESPONSE]:', JSON.stringify(data, null, 2));
        console.log('================================================\n');

        res.json(data);
    } catch (error) {
        console.error('[ERROR] OSA Percentage Detail:', error);
        res.status(500).json({ error: 'Internal Server Error' });
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
            zones: parseFilter(req.query.zones),
            metroFlags: parseFilter(req.query.metroFlags),
            pincodes: parseFilter(req.query.pincodes)
        };
        console.log('\n========== DOI (DAYS OF INVENTORY) API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));

        const data = await availabilityService.getDOI(filters);

        console.log('[RESPONSE]:', JSON.stringify(data, null, 2));
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
            zones: parseFilter(req.query.zones),
            metroFlags: parseFilter(req.query.metroFlags),
            pincodes: parseFilter(req.query.pincodes)
        };
        console.log('\n========== METRO CITY STOCK AVAILABILITY API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));

        const data = await availabilityService.getMetroCityStockAvailability(filters);

        console.log('[RESPONSE]:', JSON.stringify(data, null, 2));
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
        const { filterType, platform, brand, category, format, city, months, metroFlag } = req.query;
        console.log('\n========== AVAILABILITY FILTER OPTIONS API ==========');
        console.log('[REQUEST] filterType:', filterType, 'platform:', platform, 'brand:', brand, 'category:', category, 'format:', format, 'city:', city, 'months:', months, 'metroFlag:', metroFlag);

        const data = await availabilityService.getAvailabilityFilterOptions({
            filterType: filterType || 'platforms',
            platform: parseFilter(platform),
            brand: parseFilter(brand),
            category: parseFilter(category || format),
            city: parseFilter(city),
            months: parseFilter(months),
            metroFlag: parseFilter(metroFlag)
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
            zones: parseFilter(req.query.zones),
            metroFlags: parseFilter(req.query.metroFlags),
            pincodes: parseFilter(req.query.pincodes),
            kpis: parseFilter(req.query.kpis)
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
            platform: req.query.platform || 'All',
            brand: req.query.brand || 'All',
            location: req.query.location || 'All',
            category: req.query.category || 'All',
            period: req.query.period || '1M',
            timeStep: req.query.timeStep || 'Daily',
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
            platform: req.query.platform || 'All',
            location: req.query.location || 'All',
            category: req.query.category || 'All',
            brand: req.query.brand || 'All',
            period: req.query.period || '1M',
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };
        console.log('\n========== AVAILABILITY COMPETITION API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));

        const data = await availabilityService.getAvailabilityCompetitionData(filters);

        console.log('[RESPONSE]:', data.brands?.length, 'brands returned');
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
            platform: platform || 'All',
            location: location || 'All',
            category: category || 'All',
            brand: brand || 'All'
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
            brands: brands || 'All',
            location: location || 'All',
            category: category || 'All',
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
        const cacheKey = generateCacheKey('signal_lab', req.query);

        const data = await getCachedOrCompute(cacheKey, async () => {
            const {
                platform,
                brand,
                location,
                startDate,
                endDate,
                compareStartDate,
                compareEndDate,
                type: metricType = 'availability',
                page = 1,
                limit = 4,
                signalType = 'drainer'
            } = req.query;

            const pageNum = Number(page) || 1;
            const limitNum = Number(limit) || 4;
            const offsetNum = (pageNum - 1) * limitNum;

            const end = endDate || dayjs().format('YYYY-MM-DD');
            const start = startDate || dayjs(end).subtract(30, 'day').format('YYYY-MM-DD');

            // Comparison Dates
            const compEnd = compareEndDate || dayjs(start).subtract(1, 'day').format('YYYY-MM-DD');
            const compStart = compareStartDate || dayjs(compEnd).subtract(dayjs(end).diff(dayjs(start), 'day'), 'day').format('YYYY-MM-DD');

            const daysInPeriod = dayjs(end).diff(dayjs(start), 'day') + 1;

            /* ================= 1. FILTER LOGIC (MULTI-SELECT) ================= */
            // Helper to escape strings for SQL
            const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

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

            // Build WHERE clause for ClickHouse
            const buildWhereClause = (includeCompDates = false) => {
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

                if (brandFilter) {
                    if (Array.isArray(brandFilter)) {
                        conditions.push(`Brand IN (${brandFilter.map(b => `'${escapeStr(b)}'`).join(', ')})`);
                    } else {
                        conditions.push(`Brand LIKE '%${escapeStr(brandFilter)}%'`);
                    }
                } else {
                    conditions.push(`toString(Comp_flag) = '0'`);
                }

                return conditions.join(' AND ');
            };

            /* ================= 2. DEFINE METRIC & SORTING LOGIC ================= */
            const direction = signalType === 'gainer' ? 'DESC' : 'ASC';

            let mainMetricExpr = '';
            let metricExpr = '';
            let havingClause = '';

            if (metricType === 'availability') {
                // OSA columns are Int64 - use toFloat64() with 0.0 as else value for type matching
                mainMetricExpr = `(sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(neno_osa), 0.0)) / nullIf(sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(deno_osa), 0.0)), 0)) * 100`;
                const compMetricExpr = `(sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', toFloat64(neno_osa), 0.0)) / nullIf(sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', toFloat64(deno_osa), 0.0)), 0)) * 100`;
                metricExpr = `(ifNull(${mainMetricExpr}, 0) - ifNull(${compMetricExpr}, 0))`;

                havingClause = signalType === 'gainer'
                    ? `HAVING ${metricExpr} > 0`
                    : `HAVING ${metricExpr} < 0`;
            } else {
                const baseField = 'Sales';
                mainMetricExpr = `sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(${baseField}), 0.0))`;
                const compMetricExprVal = `sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', toFloat64(${baseField}), 0.0))`;
                metricExpr = `((ifNull(${mainMetricExpr}, 0) - ifNull(${compMetricExprVal}, 0)) / nullIf(ifNull(${compMetricExprVal}, 0), 0)) * 100`;

                if (signalType === 'gainer') {
                    havingClause = `HAVING (${metricExpr} > 0 OR (${compMetricExprVal} = 0 AND ${mainMetricExpr} > 0))`;
                } else {
                    havingClause = `HAVING ${metricExpr} < 0`;
                }
            }

            /* ================= STEP 3: GET SORTED IDs (True Top N) ================= */
            const skuQuery = `
                SELECT Web_Pid, ${metricExpr} as sortMetric
                FROM rb_pdp_olap
                WHERE ${buildWhereClause(true)}
                GROUP BY Web_Pid
                ${havingClause}
                ORDER BY sortMetric ${direction}
                LIMIT ${limitNum} OFFSET ${offsetNum}
            `;

            const skuRows = await queryClickHouse(skuQuery);

            if (!skuRows || !skuRows.length) return { skus: [], totalCount: 0 };

            // Ordered list of PIDs
            const webPids = skuRows.map(r => r.Web_Pid);

            /* ================= STEP 4: GET TOTAL COUNT ================= */
            const countQuery = `
                SELECT count() as count FROM (
                    SELECT Web_Pid
                    FROM rb_pdp_olap
                    WHERE ${buildWhereClause(true)}
                    GROUP BY Web_Pid
                    ${havingClause}
                ) as temp
            `;

            const countResult = await queryClickHouse(countQuery);
            const totalCount = countResult?.[0]?.count || 0;

            /* ================= STEP 5: FULL AGGREGATION FOR SELECTED IDs ================= */
            const webPidsStr = webPids.map(p => `'${escapeStr(p)}'`).join(', ');

            const aggQuery = `
                SELECT
                    Web_Pid, 
                    any(Product) as Product, 
                    any(Category) as Category, 
                    any(Platform) as Platform, 
                    any(Weight) as Weight, 
                    any(Brand) as Brand,
                    sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(neno_osa), 0.0)) AS totalNeno,
                    sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(deno_osa), 0.0)) AS totalDeno,
                    sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', toFloat64(neno_osa), 0.0)) AS compNeno,
                    sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', toFloat64(deno_osa), 0.0)) AS compDeno,
                    avg(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(Inventory), 0.0)) AS avgInventory,
                    sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(Qty_Sold), 0.0)) AS totalQtySold,
                    avg(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(Selling_Price), 0.0)) AS avgPrice,
                    avg(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(ROAS), 0.0)) AS avgRoas,
                    sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(Ad_Clicks), 0.0)) AS totalClicks,
                    sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(Ad_Impressions), 0.0)) AS totalImpressions,
                    sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(Sales), 0.0)) AS currSales,
                    sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', toFloat64(Sales), 0.0)) AS prevSales
                FROM rb_pdp_olap
                WHERE Web_Pid IN (${webPidsStr})
                    AND (toDate(DATE) BETWEEN '${start}' AND '${end}' OR toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}')
                GROUP BY Web_Pid
            `;

            const rows = await queryClickHouse(aggQuery);

            const sortedRows = webPids.map(pid => rows.find(r => r.Web_Pid === pid)).filter(Boolean);

            /* ================= STEP 6: City level data ================= */
            const cityAggQuery = `
                SELECT
                    Web_Pid, Location,
                    (sum(toFloat64(neno_osa)) / nullIf(sum(toFloat64(deno_osa)), 0)) * 100 AS osa,
                    avg(toFloat64(ROAS)) as roas,
                    sum(toFloat64(Ad_Clicks)) as clicks,
                    sum(toFloat64(Ad_Impressions)) as impressions,
                    avg(toFloat64(Inventory)) as inventory,
                    sum(toFloat64(Qty_Sold)) as qtySold
                FROM rb_pdp_olap
                WHERE Web_Pid IN (${webPidsStr})
                    AND toDate(DATE) BETWEEN '${start}' AND '${end}'
                GROUP BY Web_Pid, Location
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

                let metricChange = osaChange;
                if (metricType === 'sales' || metricType === 'performance' || metricType === 'inventory') {
                    const curr = Number(item.currSales || 0);
                    const prev = Number(item.prevSales || 0);
                    metricChange = prev > 0 ? ((curr - prev) / prev) * 100 : (curr > 0 ? 100 : 0);
                }

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

                const podCities = cityRows.filter(c => c.Web_Pid === item.Web_Pid);
                const sortedByImpact = podCities.sort((a, b) =>
                    signalType === 'drainer' ? Number(a.osa) - Number(b.osa) : Number(b.osa) - Number(a.osa)
                );

                const topCities = sortedByImpact.slice(0, 2).map((c, idx) => {
                    const dummyChange = (Math.random() * 2).toFixed(1);
                    const impactSign = signalType === 'drainer' ? '-' : '+';

                    if (metricType === 'inventory') {
                        const cityQty = Number(c.qtySold || 0);
                        const cityInventory = Number(c.inventory || 0);
                        const cityDrr = cityQty / daysInPeriod;
                        const cityDoi = cityDrr > 0 ? cityInventory / cityDrr : 0;
                        return {
                            city: c.Location,
                            metric: idx === 0 ? `DOI ${cityDoi.toFixed(1)}` : `DRR ${Math.round(cityDrr)}`,
                            change: idx === 0 ? `${impactSign}${dummyChange}` : `${impactSign}${Math.round(Math.random() * 5)}`
                        };
                    }

                    if (metricType === 'performance') {
                        const cityClicks = Number(c.clicks || 0);
                        return {
                            city: c.Location,
                            metric: idx === 0 ? `ROAS ${Number(c.roas || 0).toFixed(1)}x` : `Clicks ${cityClicks > 1000 ? (cityClicks / 1000).toFixed(1) + 'k' : cityClicks}`,
                            change: idx === 0 ? `${impactSign}${dummyChange}x` : `${impactSign}${Math.round(Math.random() * 500)}`
                        };
                    }

                    return {
                        city: c.Location,
                        metric: `OSA ${Number(c.osa).toFixed(1)}%`,
                        change: `${impactSign}${dummyChange}%`
                    };
                });

                return {
                    id: `${metricType.substring(0, 3).toUpperCase()}-${(pageNum - 1) * limitNum + i + 1}`,
                    webPid: item.Web_Pid,
                    skuCode: '-',
                    skuName: item.Product,
                    packSize: item.Weight,
                    platform: item.Platform,
                    categoryTag: item.Category,
                    type: signalType,
                    metricType,
                    offtakeValue: metricType === 'inventory' ? doi.toFixed(1) : `₹${(revenue / 100000).toFixed(1)} lac`,
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
        const cacheKey = generateCacheKey('signal_lab_city_details', req.query);

        const data = await getCachedOrCompute(cacheKey, async () => {
            const { webPid, startDate, endDate, compareStartDate, compareEndDate, type: metricType = 'availability' } = req.query;

            if (!webPid) throw new Error('webPid is required');

            const start = startDate || '2025-12-01';
            const end = endDate || '2025-12-31';
            const compStart = compareStartDate || '2025-11-01';
            const compEnd = compareEndDate || '2025-11-30';

            // Helper to escape strings
            const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

            // First get the category of this product for category share calculation
            const categoryQuery = `
                SELECT any(Category) as category FROM rb_pdp_olap WHERE Web_Pid = '${escapeStr(webPid)}'
            `;
            const catResult = await queryClickHouse(categoryQuery);
            const productCategory = catResult[0]?.category || '';

            // Main query with all metrics
            const query = `
                SELECT
                    Location as city,
                    -- OSA metrics
                    (sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(neno_osa), 0.0)) / nullIf(sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64(deno_osa), 0.0)), 0)) * 100 AS osa,
                    (sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', toFloat64(neno_osa), 0.0)) / nullIf(sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', toFloat64(deno_osa), 0.0)), 0)) * 100 AS compOsa,
                    -- Sales/Offtake metrics
                    sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', toFloat64OrZero(Sales), 0.0)) AS offtake,
                    sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', toFloat64OrZero(Sales), 0.0)) AS compOfftake,
                    -- Discount calculation: (MRP - Selling_Price) / MRP * 100
                    avg(if(toDate(DATE) BETWEEN '${start}' AND '${end}' AND toFloat64OrZero(MRP) > 0, 
                        (toFloat64OrZero(MRP) - toFloat64OrZero(Selling_Price)) / toFloat64OrZero(MRP) * 100, 0.0)) AS discount,
                    -- For category share - we need total sales for this location
                    count() as rowCount
                FROM rb_pdp_olap
                WHERE Web_Pid = '${escapeStr(webPid)}'
                  AND (toDate(DATE) BETWEEN '${start}' AND '${end}' OR toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}')
                GROUP BY Location
                ORDER BY offtake DESC
            `;

            const rows = await queryClickHouse(query);

            // Get category total sales per location for category share calculation
            let catShareData = {};
            if (productCategory) {
                const catShareQuery = `
                    SELECT
                        Location,
                        sum(toFloat64OrZero(Sales)) AS catTotal
                    FROM rb_pdp_olap
                    WHERE Category = '${escapeStr(productCategory)}'
                      AND toDate(DATE) BETWEEN '${start}' AND '${end}'
                      AND toString(Comp_flag) = '0'
                    GROUP BY Location
                `;
                const catShareRows = await queryClickHouse(catShareQuery);
                catShareRows.forEach(r => {
                    catShareData[r.Location] = Number(r.catTotal || 0);
                });
            }

            const cities = rows.map(row => {
                const osa = Number(row.osa || 0);
                const compOsa = Number(row.compOsa || 0);
                const osaChange = osa - compOsa;

                const offtake = Number(row.offtake || 0);
                const compOfftake = Number(row.compOfftake || 0);
                const offtakeChange = compOfftake > 0 ? ((offtake - compOfftake) / compOfftake) * 100 : 0;

                // Category share: product sales / category total sales * 100
                const catTotal = catShareData[row.city] || 0;
                const catShare = catTotal > 0 ? (offtake / catTotal) * 100 : 0;

                const discount = Number(row.discount || 0);

                return {
                    city: row.city,
                    estOfftake: offtake / 100000, // Convert to lacs
                    estOfftakeChange: offtakeChange,
                    estCatShare: catShare,
                    estCatShareChange: 0, // Would need comparison period calc
                    wtOsa: osa,
                    wtOsaChange: osaChange,
                    overallSos: 0, // SOS requires rb_kw table, not in rb_pdp_olap
                    adSos: 0, // SOS requires rb_kw table
                    wtDisc: discount
                };
            });

            return { cities, totalCities: cities.length };
        }, CACHE_TTL.METRICS);

        res.json(data);
    } catch (err) {
        console.error('🔥 CITY DETAILS ERROR:', err);
        res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
};

