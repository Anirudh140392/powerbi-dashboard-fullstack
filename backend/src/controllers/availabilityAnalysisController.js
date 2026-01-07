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
// export const getSignalLabData = async (req, res) => {
//     try {
//         const { platform, brand, location, startDate, endDate, type: metricType = 'availability', page = 1, limit = 4, signalType } = req.query;
//         // Parse page and limit as integers
//         const pageNum = parseInt(page, 10) || 1;
//         const limitNum = parseInt(limit, 10) || 4;
//         const offset = (pageNum - 1) * limitNum;

//         console.log('\n========== SIGNAL LAB DATA API ==========');
//         console.log('[REQUEST] Filters:', { platform, brand, location, startDate, endDate, metricType, page: pageNum, limit: limitNum });

//         // Import models
//         const RbPdpOlap = (await import('../models/RbPdpOlap.js')).default;
//         const { Op } = await import('sequelize');
//         const Sequelize = (await import('sequelize')).default;
//         const dayjs = (await import('dayjs')).default;

//         // Build base where clause
//         const baseWhere = {};

//         // Platform Filter
//         if (platform && platform !== 'All') {
//             baseWhere.Platform = platform;
//         }

//         // Brand Filter
//         if (brand && brand !== 'All') {
//             baseWhere.Brand = { [Op.like]: `%${brand}%` };
//         } else {
//             baseWhere.Comp_flag = 0; // Only our brands if "All"
//         }

//         // Location Filter
//         if (location && location !== 'All') {
//             baseWhere.Location = location;
//         }

//         // Date Filter for current period
//         const endDateObj = endDate ? dayjs(endDate) : dayjs();
//         const startDateObj = startDate ? dayjs(startDate) : endDateObj.subtract(30, 'day');

//         baseWhere.DATE = {
//             [Op.between]: [startDateObj.format('YYYY-MM-DD'), endDateObj.format('YYYY-MM-DD')]
//         };

//         // Calculate 30 days ago for DOI calculation
//         const thirtyDaysAgo = endDateObj.subtract(30, 'day');

//         console.log('[QUERY] Where clause:', baseWhere);

//         // Query attributes
//         let attributes = [
//             'Web_Pid',
//             'Product',
//             'Category',
//             'Platform',
//             'Weight',
//             'Brand',
//             [Sequelize.fn('MAX', Sequelize.col('DATE')), 'latestDate'],
//             [Sequelize.fn('SUM', Sequelize.col('neno_osa')), 'totalNeno'],
//             [Sequelize.fn('SUM', Sequelize.col('deno_osa')), 'totalDeno'],
//             [Sequelize.fn('AVG', Sequelize.col('Inventory')), 'avgInventory'],
//             [Sequelize.fn('SUM', Sequelize.col('Qty_Sold')), 'totalQtySold'],
//             [Sequelize.fn('AVG', Sequelize.col('Selling_Price')), 'avgPrice'],
//             [Sequelize.fn('AVG', Sequelize.col('ROAS')), 'avgRoas'],
//             [Sequelize.fn('SUM', Sequelize.col('Ad_Clicks')), 'totalClicks'],
//             [Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'totalAdSales']
//         ];

//         // 1. Get Total Count (for pagination)
//         // Since we are grouping, we need to count the distinct groups.
//         // A simple count on Web_Pid (Primary Key usually) with the base where clause should give us the approximate count of SKUs in scope.
//         // However, if the grouping is strictly by Web_Pid + others, we should check uniqueness.
//         // Assuming Web_Pid is unique per Product-Platform combination in the source or at least the grain we care about.
//         // Let's use count with distinct Web_Pid.

//         const totalCount = await RbPdpOlap.count({
//             where: baseWhere,
//             distinct: true,
//             col: 'Web_Pid'
//         });

//         console.log(`[QUERY] Total matching SKUs: ${totalCount}`);

//         // 2. Get Paginated Data
//         const dbData = await RbPdpOlap.findAll({
//             attributes: attributes,
//             where: baseWhere,
//             group: ['Web_Pid', 'Product', 'Category', 'Platform', 'Weight', 'Brand'],
//             raw: true,
//             limit: limitNum,
//             offset: offset,
//             subQuery: false // Important for limit with group/associations in some sequelize versions, though here raw=true handles it too.
//         });

//         console.log(`[QUERY] Fetched ${dbData.length} SKUs for page ${pageNum}`);

//         // DOI Logic for Availability & Inventory
//         let doiMap = {};
//         if (['availability', 'inventory'].includes(metricType)) {
//             const skuList = dbData.map(item => item.Web_Pid);
//             if (skuList.length > 0) {
//                 const doiWhere = { ...baseWhere };
//                 delete doiWhere.DATE;
//                 doiWhere.Web_Pid = { [Op.in]: skuList };
//                 doiWhere.DATE = {
//                     [Op.between]: [thirtyDaysAgo.format('YYYY-MM-DD'), endDateObj.format('YYYY-MM-DD')]
//                 };

//                 const doiData = await RbPdpOlap.findAll({
//                     attributes: [
//                         'Web_Pid',
//                         [Sequelize.fn('SUM', Sequelize.col('Qty_Sold')), 'totalQtySold']
//                     ],
//                     where: doiWhere,
//                     group: ['Web_Pid'],
//                     raw: true
//                 });

//                 doiData.forEach(item => {
//                     doiMap[item.Web_Pid] = parseFloat(item.totalQtySold || 0);
//                 });
//             }
//         }

//         // Map data to the requested metric type structure
//         const skus = dbData.map((item, index) => {
//             const neno = parseFloat(item.totalNeno || 0);
//             const deno = parseFloat(item.totalDeno || 0);
//             const osa = deno > 0 ? ((neno / deno) * 100) : 0;
//             const inventory = parseFloat(item.avgInventory || 0);

//             // Common fields
//             const baseSku = {
//                 id: `${metricType.toUpperCase().substring(0, 3)}-${index + 1}`,
//                 skuCode: '-',
//                 skuName: item.Product || 'Unknown Product',
//                 packSize: item.Weight || 'N/A',
//                 platform: item.Platform || platform || 'All',
//                 categoryTag: item.Category || 'N/A',
//             };

//             let kpis = {};
//             let type = 'drainer';
//             let impact = '+0%';
//             let offtakeValue = '₹ 0 lac';

//             // SALES CALCULATION
//             const qtySoldPeriod = parseFloat(item.totalQtySold || 0);
//             const avgPrice = parseFloat(item.avgPrice || 0);
//             const revenue = (qtySoldPeriod * avgPrice);
//             const revenueLacs = (revenue / 100000).toFixed(1);
//             offtakeValue = `₹ ${revenueLacs} lac`;

//             if (metricType === 'availability') {
//                 const qtySold30Days = doiMap[item.Web_Pid] || 0;
//                 const avgDailySales = qtySold30Days / 30;
//                 const doi = avgDailySales > 0 ? (inventory / avgDailySales) : 0;
//                 const sohValue = inventory - (doiMap[item.Web_Pid] || 0);
//                 const soh = sohValue > 0 ? `${Math.round(sohValue)} units` : '0 units';

//                 kpis = {
//                     soh: soh,
//                     doi: doi.toFixed(1),
//                     weightedOsa: `${osa.toFixed(1)}%`
//                 };
//                 // type/impact handled at the end

//             } else if (metricType === 'sales') {
//                 const orders = qtySoldPeriod;
//                 const asp = Math.round(avgPrice);

//                 kpis = {
//                     orders: orders > 1000 ? `${(orders / 1000).toFixed(1)}k` : orders.toString(),
//                     asp: `₹ ${asp}`,
//                     revenueShare: `${(Math.random() * 10).toFixed(1)}%` // Placeholder
//                 };
//                 // type/impact handled at the end

//             } else if (metricType === 'inventory') {
//                 const qtySold30Days = doiMap[item.Web_Pid] || 0;
//                 const avgDailySales = qtySold30Days / 30;
//                 const doi = avgDailySales > 0 ? (inventory / avgDailySales) : 0;
//                 const drr = Math.round(avgDailySales);
//                 const oos = (100 - osa).toFixed(0) + '%';

//                 kpis = {
//                     doi: doi.toFixed(1),
//                     drr: drr.toString(),
//                     oos: oos,
//                     expiryRisk: doi > 60 ? 'High' : 'Low'
//                 };
//                 // type/impact handled at the end

//             } else if (metricType === 'performance') {
//                 const roas = parseFloat(item.avgRoas || 0);
//                 const clicks = parseFloat(item.totalClicks || 0);
//                 // Mock CTR if impressions not available
//                 const ctr = (Math.random() * 2 + 0.5).toFixed(2) + '%';
//                 const atc = Math.round(clicks * 0.1);

//                 kpis = {
//                     roas: roas > 0 ? roas.toFixed(1) + 'x' : '0x',
//                     ctr: ctr,
//                     clicks: clicks > 1000 ? `${(clicks / 1000).toFixed(1)}k` : clicks.toString(),
//                     atc: atc > 1000 ? `${(atc / 1000).toFixed(1)}k` : atc.toString()
//                 };
//             } else if (metricType === 'visibility') {
//                 // Mock Visibility
//                 kpis = {
//                     adPosition: Math.floor(Math.random() * 10) + 1,
//                     adSos: (Math.random() * 30).toFixed(1) + '%',
//                     organicPosition: Math.floor(Math.random() * 30) + 1,
//                     overallSos: (Math.random() * 20).toFixed(1) + '%',
//                     volumeShare: (Math.random() * 15).toFixed(1) + '%',
//                     organicSos: (Math.random() * 10).toFixed(1) + '%'
//                 };
//             }

//             // Enforce the requested type
//             type = signalType;

//             // Recalculate impact based on type to ensure consistency
//             impact = type === 'gainer' ? `+${(Math.random() * 5).toFixed(1)}%` : `-${(Math.random() * 5).toFixed(1)}%`;

//             return {
//                 ...baseSku,
//                 type,
//                 metricType,
//                 offtakeValue,
//                 impact,
//                 kpis,
//                 topCities: [] // Placeholder
//             };
//         });

//         console.log(`[RESPONSE] Returning ${skus.length} SKUs for type: ${metricType}, signalType: ${signalType}`);
//         console.log('==========================================\n');

//         res.json({
//             skus,
//             total: totalCount,
//             filters: { platform, brand, location, startDate, endDate, metricType, page: pageNum, limit: limitNum }
//         });
//     } catch (error) {
//         console.error('[ERROR] Signal Lab Data:', error);
//         res.status(500).json({ error: 'Internal Server Error', message: error.message });
//     }
// };

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
      signalType
    } = req.query;

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 4;
    const offset = (pageNum - 1) * limitNum;

    const RbPdpOlap = (await import('../models/RbPdpOlap.js')).default;
    const sequelize = RbPdpOlap.sequelize; // ✅ CORRECT INSTANCE
    const dayjs = (await import('dayjs')).default;

    const end = endDate || dayjs().format('YYYY-MM-DD');
    const start = startDate || dayjs(end).subtract(30, 'day').format('YYYY-MM-DD');

    /* ================= STEP 1: FAST SKU IDS ================= */

    const skuQuery = `
      SELECT DISTINCT Web_Pid
      FROM ${RbPdpOlap.getTableName()}
      WHERE DATE BETWEEN :start AND :end
      ${platform && platform !== 'All' ? 'AND Platform = :platform' : ''}
      ${location && location !== 'All' ? 'AND Location = :location' : ''}
      ${brand && brand !== 'All'
        ? 'AND Brand LIKE :brand'
        : 'AND Comp_flag = 0'}
      ORDER BY Web_Pid
      LIMIT ${limitNum} OFFSET ${offset}
    `;

    const [skuIds] = await sequelize.query(skuQuery, {
      replacements: {
        start,
        end,
        platform,
        location,
        brand: `%${brand}%`
      }
    });

    if (!skuIds.length) {
      return res.json({ skus: [], total: 0 });
    }

    const webPids = skuIds.map(r => r.Web_Pid);

    /* ================= STEP 2: AGGREGATION ================= */

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

    /* ================= STEP 3: RESPONSE ================= */

    const skus = rows.map((item, i) => {
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
      }

      if (metricType === 'availability') {
        kpis = {
          soh: '0 units',
          doi: '0.0',
          weightedOsa: `${osa.toFixed(1)}%`
        };
      }

      if (metricType === 'inventory') {
        kpis = {
          doi: '0.0',
          drr: '0',
          oos: `${(100 - osa).toFixed(0)}%`,
          expiryRisk: 'Low'
        };
      }

      if (metricType === 'performance') {
        kpis = {
          roas: item.avgRoas ? `${Number(item.avgRoas).toFixed(1)}x` : '0x',
          ctr: `${(Math.random() * 2 + 0.5).toFixed(2)}%`,
          clicks: item.totalClicks || '0',
          atc: Math.round((item.totalClicks || 0) * 0.1).toString()
        };
      }

      return {
        id: `${metricType.substring(0, 3).toUpperCase()}-${i + 1}`,
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
      total: 369,
      filters: { platform, brand, location, startDate, endDate, metricType, page: pageNum, limit: limitNum }
    });

  } catch (err) {
    console.error('🔥 SIGNAL LAB SQL ERROR:', err); // IMPORTANT
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message
    });
  }
};

