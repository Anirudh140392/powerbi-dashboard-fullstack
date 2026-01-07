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
            type: metricType = 'availability',
            page = 1,
            limit = 4,
            signalType = 'drainer'
        } = req.query;

        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 4;
        const offset = (pageNum - 1) * limitNum;

        // Dynamically Import Model
        const RbPdpOlap = (await import('../models/RbPdpOlap.js')).default;
        const sequelize = RbPdpOlap.sequelize;
        const dayjs = (await import('dayjs')).default;

        const end = endDate || dayjs().format('YYYY-MM-DD');
        const start = startDate || dayjs(end).subtract(30, 'day').format('YYYY-MM-DD');

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

        if (metricType === 'availability') {
            metricExpr = `(SUM(neno_osa) / NULLIF(SUM(deno_osa), 0)) * 100`;
            // Gainer: >= 90, Drainer: < 90
            havingClause = signalType === 'gainer'
                ? `HAVING ${metricExpr} >= 90`
                : `HAVING ${metricExpr} < 90 OR ${metricExpr} IS NULL`;

        } else if (metricType === 'sales') {
            metricExpr = `(SUM(Qty_Sold) * AVG(Selling_Price))`;
            // Gainer: > 50000, Drainer: <= 50000
            havingClause = signalType === 'gainer'
                ? `HAVING ${metricExpr} > 50000`
                : `HAVING ${metricExpr} <= 50000 OR ${metricExpr} IS NULL`;

        } else if (metricType === 'inventory') {
            // Inventory Gainers (Healthy): High OSA/Low OOS
            metricExpr = `(SUM(neno_osa) / NULLIF(SUM(deno_osa), 0)) * 100`;
            havingClause = signalType === 'gainer'
                ? `HAVING ${metricExpr} >= 90`
                : `HAVING ${metricExpr} < 90 OR ${metricExpr} IS NULL`;

        } else if (metricType === 'performance') {
            metricExpr = `AVG(ROAS)`;
            // Gainer: > 2, Drainer: <= 2
            havingClause = signalType === 'gainer'
                ? `HAVING ${metricExpr} > 2`
                : `HAVING ${metricExpr} <= 2 OR ${metricExpr} IS NULL`;

        } else if (metricType === 'visibility') {
            metricExpr = `SUM(Ad_Impressions)`;
            // Gainer: > 5000, Drainer: <= 5000
            havingClause = signalType === 'gainer'
                ? `HAVING ${metricExpr} > 5000`
                : `HAVING ${metricExpr} <= 5000 OR ${metricExpr} IS NULL`;
        }

        // Default sorting by the metric
        sortOrder = `ORDER BY sortMetric ${direction}`;

        /* ================= STEP 3: GET SORTED IDs (True Top N) ================= */

        const skuQuery = `
      SELECT Web_Pid, ${metricExpr} as sortMetric
      FROM ${RbPdpOlap.getTableName()}
      WHERE ${whereClause}
      GROUP BY Web_Pid
      ${havingClause}
      ${sortOrder}
      LIMIT ${limitNum} OFFSET ${offset}
    `;

        const [skuRows] = await sequelize.query(skuQuery, {
            replacements: replacements
        });

        if (!skuRows.length) {
            return res.json({ skus: [], total: 0 });
        }

        // Ordered list of PIDs
        const webPids = skuRows.map(r => r.Web_Pid);


        /* ================= STEP 4: GET TOTAL COUNT (Approximate) ================= */
        // Using a simpler count check for speed

        const countQuery = `
      SELECT COUNT(*) as count FROM (
          SELECT Web_Pid
          FROM ${RbPdpOlap.getTableName()}
          WHERE ${whereClause}
          GROUP BY Web_Pid
          ${havingClause}
      ) as temp
    `;

        const [countResult] = await sequelize.query(countQuery, {
            replacements: replacements
        });
        const totalCount = countResult[0]?.count || 0;


        /* ================= STEP 5: FULL AGGREGATION FOR SELECTED IDs ================= */

        const aggQuery = `
      SELECT
        Web_Pid,
        Product,
        Category,
        Platform,
        Weight,
        Brand,
        SUM(neno_osa) AS totalNeno,
        SUM(deno_osa) AS totalDeno,
        AVG(Inventory) AS avgInventory,
        SUM(Qty_Sold) AS totalQtySold,
        AVG(Selling_Price) AS avgPrice,
        AVG(ROAS) AS avgRoas,
        SUM(Ad_Clicks) AS totalClicks
      FROM ${RbPdpOlap.getTableName()}
      WHERE Web_Pid IN (:webPids)
        AND DATE BETWEEN :start AND :end
      GROUP BY Web_Pid, Product, Category, Platform, Weight, Brand
    `;

        const [rows] = await sequelize.query(aggQuery, {
            replacements: { webPids, start, end }
        });

        // Sort rows to match the order of webPids (which is the correct sorted order)
        const sortedRows = webPids.map(pid => rows.find(r => r.Web_Pid === pid)).filter(Boolean);

        /* ================= STEP 6: RESPONSE MAPPING ================= */

        const skus = sortedRows.map((item, i) => {
            const neno = Number(item.totalNeno || 0);
            const deno = Number(item.totalDeno || 0);
            const osa = deno ? (neno / deno) * 100 : 0;

            const qty = Number(item.totalQtySold || 0);
            const price = Number(item.avgPrice || 0);
            const revenue = qty * price;

            let kpis = {};

            if (metricType === 'sales') {
                kpis = {
                    orders: qty > 1000 ? `${(qty / 1000).toFixed(1)}k` : qty.toString(),
                    asp: `₹ ${Math.round(price)}`,
                    revenueShare: `${(Math.random() * 10).toFixed(1)}%`
                };
            } else if (metricType === 'availability') {
                kpis = {
                    soh: '0 units',
                    doi: '0.0',
                    weightedOsa: `${osa.toFixed(1)}%`
                };
            } else if (metricType === 'inventory') {
                kpis = {
                    doi: '0.0',
                    drr: '0',
                    oos: `${(100 - osa).toFixed(0)}%`,
                    expiryRisk: 'Low'
                };
            } else if (metricType === 'performance') {
                kpis = {
                    roas: item.avgRoas ? `${Number(item.avgRoas).toFixed(1)}x` : '0x',
                    ctr: `${(Math.random() * 2 + 0.5).toFixed(2)}%`,
                    clicks: item.totalClicks || '0',
                    atc: Math.round((item.totalClicks || 0) * 0.1).toString()
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

            return {
                id: `${metricType.substring(0, 3).toUpperCase()}-${(pageNum - 1) * limitNum + i + 1}`,
                skuCode: '-',
                skuName: item.Product,
                packSize: item.Weight,
                platform: item.Platform,
                categoryTag: item.Category,
                type: signalType,
                metricType,
                offtakeValue: `₹ ${(revenue / 100000).toFixed(1)} lac`,
                impact:
                    signalType === 'gainer'
                        ? `+${(Math.random() * 5).toFixed(1)}%`
                        : `-${(Math.random() * 5).toFixed(1)}%`,
                kpis,
                topCities: []
            };
        });

        res.json({
            skus,
            total: Number(totalCount),
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
