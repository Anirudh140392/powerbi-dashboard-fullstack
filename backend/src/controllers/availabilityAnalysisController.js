import availabilityService from '../services/availabilityService.js';

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
            platform: req.query.platform || 'All',
            brand: req.query.brand || 'All',
            location: req.query.location || 'All',
            startDate: req.query.startDate,
            endDate: req.query.endDate
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
            platform: req.query.platform || 'All',
            brand: req.query.brand || 'All',
            location: req.query.location || 'All',
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };
        console.log('\n========== PLATFORM KPI MATRIX API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));

        const data = await availabilityService.getAbsoluteOsaPlatformKpiMatrix(filters);

        console.log('[RESPONSE]:', JSON.stringify(data, null, 2));
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
            platform: req.query.platform || 'All',
            brand: req.query.brand || 'All',
            location: req.query.location || 'All',
            startDate: req.query.startDate,
            endDate: req.query.endDate
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
            platform: req.query.platform || 'All',
            brand: req.query.brand || 'All',
            location: req.query.location || 'All',
            startDate: req.query.startDate,
            endDate: req.query.endDate
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
            platform: req.query.platform || 'All',
            brand: req.query.brand || 'All',
            location: req.query.location || 'All',
            startDate: req.query.startDate,
            endDate: req.query.endDate
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
        const { filterType, platform, brand, category, city } = req.query;
        console.log('\n========== AVAILABILITY FILTER OPTIONS API ==========');
        console.log('[REQUEST] filterType:', filterType, 'platform:', platform, 'brand:', brand, 'category:', category, 'city:', city);

        const data = await availabilityService.getAvailabilityFilterOptions({
            filterType: filterType || 'platforms',
            platform: platform || 'All',
            brand: brand || 'All',
            category: category || 'All',
            city: city || 'All'
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
            platform: req.query.platform || 'All',
            brand: req.query.brand || 'All',
            location: req.query.location || 'All',
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            // New filter params from OSA Detail View filter panel
            dates: req.query.dates ? req.query.dates.split(',') : null,
            months: req.query.months ? req.query.months.split(',') : null,
            cities: req.query.cities ? req.query.cities.split(',') : null,
            categories: req.query.categories ? req.query.categories.split(',') : null,
            kpis: req.query.kpis ? req.query.kpis.split(',') : null
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

        console.log('[RESPONSE]:', data.points?.length, 'trend points returned');
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
            period: req.query.period || '1M'
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
        const { location, category, brand } = req.query;
        console.log('\n========== AVAILABILITY COMPETITION FILTER OPTIONS API ==========');
        console.log('[REQUEST] location:', location, 'category:', category, 'brand:', brand);

        const data = await availabilityService.getAvailabilityCompetitionFilterOptions({
            location: location || null,
            category: category || null,
            brand: brand || null
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
        const { brands, location, category, period } = req.query;
        console.log('\n========== AVAILABILITY COMPETITION BRAND TRENDS API ==========');
        console.log('[REQUEST] brands:', brands, 'location:', location, 'category:', category, 'period:', period);

        const data = await availabilityService.getAvailabilityCompetitionBrandTrends({
            brands: brands || 'All',
            location: location || 'All',
            category: category || 'All',
            period: period || '1M'
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
 * Get Signal Lab Data for Availability Analysis
 * Formulas:
 * - OSA = sum(neno_osa) / sum(deno_osa)
 * - DOI = Inventory / (sum(Qty_Sold in 30 days) / 30)
 */
export const getSignalLabData = async (req, res) => {
    try {
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

        // Dynamically Import Model
        const RbPdpOlap = (await import('../models/RbPdpOlap.js')).default;
        const sequelize = RbPdpOlap.sequelize;
        const dayjs = (await import('dayjs')).default;

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

        const replacements = { start, end };
        let whereClause = `DATE BETWEEN :start AND :end`;

        if (platformFilter) {
            if (Array.isArray(platformFilter)) {
                whereClause += ` AND Platform IN (:platform)`;
            } else {
                whereClause += ` AND Platform = :platform`;
            }
            replacements.platform = platformFilter;
        }

        if (locationFilter) {
            if (Array.isArray(locationFilter)) {
                whereClause += ` AND Location IN (:location)`;
            } else {
                whereClause += ` AND Location = :location`;
            }
            replacements.location = locationFilter;
        }

        if (brandFilter) {
            if (Array.isArray(brandFilter)) {
                whereClause += ` AND Brand IN (:brand)`;
                replacements.brand = brandFilter;
            } else {
                whereClause += ` AND Brand LIKE :brand`;
                replacements.brand = `%${brandFilter}%`;
            }
        } else {
            whereClause += ` AND Comp_flag = 0`;
        }

        /* ================= 2. DEFINE METRIC & SORTING LOGIC ================= */

        // Expressions for SQL aggregation
        let metricExpr = '';
        let havingClause = '';
        let sortOrder = '';

        // GAINER: High -> Low (DESC)
        // DRAINER: Low -> High (ASC)
        const direction = signalType === 'gainer' ? 'DESC' : 'ASC';

        let mainMetricExpr = '';
        if (metricType === 'availability') {
            mainMetricExpr = `(SUM(CASE WHEN DATE BETWEEN :start AND :end THEN neno_osa ELSE 0 END) / NULLIF(SUM(CASE WHEN DATE BETWEEN :start AND :end THEN deno_osa ELSE 0 END), 0)) * 100`;
            const compMetricExpr = `(SUM(CASE WHEN DATE BETWEEN :compStart AND :compEnd THEN neno_osa ELSE 0 END) / NULLIF(SUM(CASE WHEN DATE BETWEEN :compStart AND :compEnd THEN deno_osa ELSE 0 END), 0)) * 100`;
            metricExpr = `(COALESCE(${mainMetricExpr}, 0) - COALESCE(${compMetricExpr}, 0))`;

            // Relaxed filtering: focus on OSA change regardless of zero inventory/sales
            havingClause = `HAVING `;
            if (signalType === 'gainer') {
                havingClause += ` ${metricExpr} > 0`;
            } else {
                havingClause += ` ${metricExpr} < 0`;
            }
        } else {
            // Support for Sales, Performance, Inventory
            let baseField = 'Sales';
            if (metricType === 'performance') baseField = 'Sales'; // User requested offtake change for %
            if (metricType === 'inventory') baseField = 'Sales';   // User requested offtake (Sales) change for %

            mainMetricExpr = `SUM(CASE WHEN DATE BETWEEN :start AND :end THEN ${baseField} ELSE 0 END)`;
            const compMetricExpr = `SUM(CASE WHEN DATE BETWEEN :compStart AND :compEnd THEN ${baseField} ELSE 0 END)`;

            // Percentage change: (curr - prev) / prev * 100
            // If prev is 0, we can't show percentage properly, so we use absolute change or handle NULL
            metricExpr = `((COALESCE(${mainMetricExpr}, 0) - COALESCE(${compMetricExpr}, 0)) / NULLIF(COALESCE(${compMetricExpr}, 0), 0)) * 100`;

            havingClause = `HAVING `;
            if (signalType === 'gainer') {
                havingClause += ` (${metricExpr} > 0 OR (${compMetricExpr} = 0 AND ${mainMetricExpr} > 0))`;
            } else {
                havingClause += ` ${metricExpr} < 0`;
            }
        }

        // Default sorting by the metric
        sortOrder = `ORDER BY sortMetric ${direction}`;

        /* ================= STEP 3: GET SORTED IDs (True Top N) ================= */

        const skuQuery = `
      SELECT Web_Pid, ${metricExpr} as sortMetric
      FROM ${RbPdpOlap.getTableName()}
      WHERE (DATE BETWEEN :start AND :end OR DATE BETWEEN :compStart AND :compEnd)
        ${platformFilter ? (Array.isArray(platformFilter) ? ' AND Platform IN (:platform)' : ' AND Platform = :platform') : ''}
        ${locationFilter ? (Array.isArray(locationFilter) ? ' AND Location IN (:location)' : ' AND Location = :location') : ''}
        ${brandFilter ? (Array.isArray(brandFilter) ? ' AND Brand IN (:brand)' : ' AND Brand LIKE :brand') : ' AND Comp_flag = 0'}
      GROUP BY Web_Pid
      ${havingClause}
      ${sortOrder}
      LIMIT ${limitNum} OFFSET ${offsetNum}
    `;

        console.log(`[SignalLab] Query Params: metricType=${metricType}, signalType=${signalType}, platform=${platform}, brand=${brand}, location=${location}`);
        console.log(`[SignalLab] Date Ranges: Current[${start} to ${end}], Comp[${compStart} to ${compEnd}]`);
        console.log(`[SignalLab] Filters: Platform=${platformFilter}, Brand=${brandFilter}, Location=${locationFilter}`);

        const [skuRows] = await sequelize.query(skuQuery, {
            replacements: { ...replacements, compStart, compEnd }
        });

        console.log(`[SignalLab] SKUs found after filtering: ${skuRows.length}`);

        if (!skuRows.length) {
            // Check if ANY records exist for these dates without filters
            const [rawCount] = await sequelize.query(`SELECT COUNT(*) as count FROM ${RbPdpOlap.getTableName()} WHERE (DATE BETWEEN :start AND :end OR DATE BETWEEN :compStart AND :compEnd)`, {
                replacements: { start, end, compStart, compEnd }
            });
            console.log(`[SignalLab] Total raw records in database for these dates: ${rawCount[0]?.count}`);

            return res.json({ skus: [], totalCount: 0, debug: { rawCount: rawCount[0]?.count, dates: { start, end, compStart, compEnd } } });
        }

        // Ordered list of PIDs
        const webPids = skuRows.map(r => r.Web_Pid);


        /* ================= STEP 4: GET TOTAL COUNT (Approximate) ================= */
        // Using a simpler count check for speed

        const countQuery = `
      SELECT COUNT(*) as count FROM (
          SELECT Web_Pid
          FROM ${RbPdpOlap.getTableName()}
          WHERE (DATE BETWEEN :start AND :end OR DATE BETWEEN :compStart AND :compEnd)
            ${platformFilter ? (Array.isArray(platformFilter) ? ' AND Platform IN (:platform)' : ' AND Platform = :platform') : ''}
            ${locationFilter ? (Array.isArray(locationFilter) ? ' AND Location IN (:location)' : ' AND Location = :location') : ''}
            ${brandFilter ? (Array.isArray(brandFilter) ? ' AND Brand IN (:brand)' : ' AND Brand LIKE :brand') : ' AND Comp_flag = 0'}
          GROUP BY Web_Pid
          ${havingClause}
      ) as temp
    `;

        const [countResult] = await sequelize.query(countQuery, {
            replacements: { ...replacements, compStart, compEnd }
        });
        const totalCount = countResult?.[0]?.count || 0;


        /* ================= STEP 5: FULL AGGREGATION FOR SELECTED IDs ================= */

        const aggQuery = `
      SELECT
        Web_Pid, Product, Category, Platform, Weight, Brand,
        SUM(CASE WHEN DATE BETWEEN :start AND :end THEN neno_osa ELSE 0 END) AS totalNeno,
        SUM(CASE WHEN DATE BETWEEN :start AND :end THEN deno_osa ELSE 0 END) AS totalDeno,
        SUM(CASE WHEN DATE BETWEEN :compStart AND :compEnd THEN neno_osa ELSE 0 END) AS compNeno,
        SUM(CASE WHEN DATE BETWEEN :compStart AND :compEnd THEN deno_osa ELSE 0 END) AS compDeno,
        AVG(CASE WHEN DATE BETWEEN :start AND :end THEN inventory ELSE 0 END) AS avgInventory,
        SUM(CASE WHEN DATE BETWEEN :start AND :end THEN Qty_Sold ELSE 0 END) AS totalQtySold,
        AVG(CASE WHEN DATE BETWEEN :start AND :end THEN Selling_Price ELSE 0 END) AS avgPrice,
        AVG(CASE WHEN DATE BETWEEN :start AND :end THEN ROAS ELSE 0 END) AS avgRoas,
        SUM(CASE WHEN DATE BETWEEN :start AND :end THEN Ad_Clicks ELSE 0 END) AS totalClicks,
        SUM(CASE WHEN DATE BETWEEN :start AND :end THEN Ad_Impressions ELSE 0 END) AS totalImpressions,
        SUM(CASE WHEN DATE BETWEEN :start AND :end THEN Sales ELSE 0 END) AS currSales,
        SUM(CASE WHEN DATE BETWEEN :compStart AND :compEnd THEN Sales ELSE 0 END) AS prevSales
      FROM ${RbPdpOlap.getTableName()}
      WHERE Web_Pid IN (:webPids)
        AND (DATE BETWEEN :start AND :end OR DATE BETWEEN :compStart AND :compEnd)
      GROUP BY Web_Pid, Product, Category, Platform, Weight, Brand
    `;

        const [rows] = await sequelize.query(aggQuery, {
            replacements: { webPids, start, end, compStart, compEnd }
        });

        // Sort rows to match the order of webPids (which is the correct sorted order)
        const sortedRows = webPids.map(pid => rows.find(r => r.Web_Pid === pid)).filter(Boolean);

        // Step 6: Get City level data for selected SKUs
        const cityAggQuery = `
SELECT
Web_Pid,
    Location,
    (SUM(neno_osa) / NULLIF(SUM(deno_osa), 0)) * 100 AS osa,
    AVG(ROAS) as roas,
    SUM(Ad_Clicks) as clicks,
    SUM(Ad_Impressions) as impressions,
    AVG(inventory) as inventory,
    SUM(Qty_Sold) as qtySold
          FROM ${RbPdpOlap.getTableName()}
          WHERE Web_Pid IN (:webPids)
            AND DATE BETWEEN :start AND :end
          GROUP BY Web_Pid, Location
    `;

        const [cityRows] = await sequelize.query(cityAggQuery, {
            replacements: { webPids, start, end }
        });

        /* ================= STEP 7: RESPONSE MAPPING ================= */

        const skus = sortedRows.map((item, i) => {
            const neno = Number(item.totalNeno || 0);
            const deno = Number(item.totalDeno || 0);
            const osa = deno ? (neno / deno) * 100 : 0;

            const cNeno = Number(item.compNeno || 0);
            const cDeno = Number(item.compDeno || 0);
            const compOsa = cDeno ? (cNeno / cDeno) * 100 : 0;
            const osaChange = osa - compOsa;

            // Calculate impact percentage based on metric type
            let metricChange = osaChange;
            if (metricType === 'sales' || metricType === 'performance' || metricType === 'inventory') {
                const curr = Number(item.currSales || 0);
                const prev = Number(item.prevSales || 0);
                metricChange = prev > 0 ? ((curr - prev) / prev) * 100 : (curr > 0 ? 100 : 0);
            }

            const qty = Number(item.totalQtySold || 0);
            const price = Number(item.avgPrice || 0);
            const revenue = qty * price;

            const inventory = Number(item.avgInventory || 0);
            const drr = qty / daysInPeriod;
            const doi = drr > 0 ? inventory / drr : 0;

            let kpis = {};

            if (metricType === 'sales') {
                kpis = {
                    orders: qty > 1000 ? `${(qty / 1000).toFixed(1)} k` : qty.toString(),
                    asp: `₹ ${Math.round(price)} `,
                    revenueShare: `${(Math.random() * 10).toFixed(1)}% `
                };
            } else if (metricType === 'availability') {
                kpis = {
                    soh: `${Math.round(inventory)} units`,
                    doi: doi.toFixed(1),
                    weightedOsa: `${osa.toFixed(1)}% `
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

            // Find top cities for this PID
            const podCities = cityRows.filter(c => c.Web_Pid === item.Web_Pid);
            // Drainer -> Low OSA cities first, Gainer -> High OSA cities first
            const sortedByImpact = podCities.sort((a, b) =>
                signalType === 'drainer' ? a.osa - b.osa : b.osa - a.osa
            );

            const topCities = sortedByImpact.slice(0, 2).map((c, idx) => {
                const dummyChange = (Math.random() * 2).toFixed(1);
                const impactSign = signalType === 'drainer' ? '-' : '+';

                if (metricType === 'inventory') {
                    const cityQty = Number(c.qtySold || 0);
                    const cityInventory = Number(c.inventory || 0);
                    const cityDrr = cityQty / daysInPeriod;
                    const cityDoi = cityDrr > 0 ? cityInventory / cityDrr : 0;

                    if (idx === 0) {
                        return {
                            city: c.Location,
                            metric: `DOI ${cityDoi.toFixed(1)}`,
                            change: `${impactSign}${dummyChange}`
                        };
                    } else {
                        return {
                            city: c.Location,
                            metric: `DRR ${Math.round(cityDrr)}`,
                            change: `${impactSign}${Math.round(Math.random() * 5)}`
                        };
                    }
                }

                if (metricType === 'performance') {
                    if (idx === 0) {
                        return {
                            city: c.Location,
                            metric: `ROAS ${Number(c.roas || 0).toFixed(1)}x`,
                            change: `${impactSign}${dummyChange}x`
                        };
                    } else {
                        const cityClicks = Number(c.clicks || 0);
                        return {
                            city: c.Location,
                            metric: `Clicks ${cityClicks > 1000 ? (cityClicks / 1000).toFixed(1) + 'k' : cityClicks}`,
                            change: `${impactSign}${Math.round(Math.random() * 500)}`
                        };
                    }
                }

                if (idx === 0) {
                    return {
                        city: c.Location,
                        metric: `OSA ${Number(c.osa).toFixed(1)}%`,
                        change: `${impactSign}${dummyChange}%`
                    };
                } else {
                    return {
                        city: c.Location,
                        metric: `OSA ${Number(c.osa).toFixed(1)}%`,
                        change: `${impactSign}${dummyChange}%`
                    };
                }
            });

            return {
                id: `${metricType.substring(0, 3).toUpperCase()} -${(pageNum - 1) * limitNum + i + 1} `,
                webPid: item.Web_Pid,
                skuCode: '-',
                skuName: item.Product,
                packSize: item.Weight,
                platform: item.Platform,
                categoryTag: item.Category,
                type: signalType,
                metricType,
                offtakeValue: metricType === 'inventory' ? doi.toFixed(1) : `₹ ${(revenue / 100000).toFixed(1)} lac`,
                impact: `${metricChange >= 0 ? '+' : ''}${metricChange.toFixed(1)}% `,
                kpis,
                topCities
            };
        });

        res.json({
            skus,
            totalCount: Number(totalCount),
            filters: { platform, brand, location, startDate, endDate, metricType, page: pageNum, limit: limitNum, signalType }
        });

    } catch (err) {
        console.error('🔥 SIGNAL LAB SQL ERROR:', err);
        res.status(500).json({
            error: 'Internal Server Error',
            message: err.message
        });
    }
};

/**
 * Get City Details for a Specific Product in Signal Lab
 */
export const getCityDetailsForProduct = async (req, res) => {
    try {
        const { webPid, startDate, endDate, compareStartDate, compareEndDate, type: metricType = 'availability' } = req.query;

        if (!webPid) {
            return res.status(400).json({ error: 'webPid is required' });
        }

        const start = startDate || '2025-12-01';
        const end = endDate || '2025-12-31';
        const compStart = compareStartDate || '2025-11-01';
        const compEnd = compareEndDate || '2025-11-30';

        console.log(`[City Details] Fetching for Web_Pid: ${webPid}, Type: ${metricType}`);

        const { default: sequelize } = await import('../config/db.js');

        const query = `
            SELECT
                Location as city,
                (SUM(CASE WHEN DATE BETWEEN :start AND :end THEN neno_osa ELSE 0 END) / NULLIF(SUM(CASE WHEN DATE BETWEEN :start AND :end THEN deno_osa ELSE 0 END), 0)) * 100 AS osa,
                (SUM(CASE WHEN DATE BETWEEN :compStart AND :compEnd THEN neno_osa ELSE 0 END) / NULLIF(SUM(CASE WHEN DATE BETWEEN :compStart AND :compEnd THEN deno_osa ELSE 0 END), 0)) * 100 AS compOsa,
                SUM(CASE WHEN DATE BETWEEN :start AND :end THEN Sales ELSE 0 END) AS offtake,
                SUM(CASE WHEN DATE BETWEEN :compStart AND :compEnd THEN Sales ELSE 0 END) AS compOfftake
            FROM rb_pdp_olap
            WHERE Web_Pid = :webPid
              AND (DATE BETWEEN :start AND :end OR DATE BETWEEN :compStart AND :compEnd)
            GROUP BY Location
            ORDER BY offtake DESC
        `;

        const [rows] = await sequelize.query(query, {
            replacements: { webPid, start, end, compStart, compEnd }
        });

        const cities = rows.map(row => {
            const osa = Number(row.osa || 0);
            const compOsa = Number(row.compOsa || 0);
            const osaChange = osa - compOsa;

            const offtake = Number(row.offtake || 0);
            const compOfftake = Number(row.compOfftake || 0);
            const offtakeChange = compOfftake > 0 ? ((offtake - compOfftake) / compOfftake) * 100 : 0;

            return {
                city: row.city,
                estOfftake: offtake / 100000,
                estOfftakeChange: offtakeChange,
                estCatShare: 0,
                estCatShareChange: 0,
                wtOsa: osa,
                wtOsaChange: osaChange,
                overallSos: 0,
                adSos: 0,
                wtDisc: 0
            };
        });

        res.json({ cities, totalCities: cities.length });

    } catch (err) {
        console.error('🔥 CITY DETAILS ERROR:', err);
        res.status(500).json({
            error: 'Internal Server Error',
            message: err.message
        });
    }
};
