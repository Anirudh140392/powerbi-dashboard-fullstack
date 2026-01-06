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
        const { platform, brand, location, startDate, endDate } = req.query;
        console.log('\n========== SIGNAL LAB DATA API ==========');
        console.log('[REQUEST] Filters:', { platform, brand, location, startDate, endDate });

        // Import models
        const RbPdpOlap = (await import('../models/RbPdpOlap.js')).default;
        const { Op } = await import('sequelize');
        const Sequelize = (await import('sequelize')).default;
        const dayjs = (await import('dayjs')).default;

        // Build base where clause
        const baseWhere = {};

        // Platform Filter
        if (platform && platform !== 'All') {
            baseWhere.Platform = platform;
        }

        // Brand Filter
        if (brand && brand !== 'All') {
            baseWhere.Brand = { [Op.like]: `%${brand}%` };
        } else {
            baseWhere.Comp_flag = 0; // Only our brands if "All"
        }

        // Location Filter
        if (location && location !== 'All') {
            baseWhere.Location = location;
        }

        // Date Filter for current period
        const endDateObj = endDate ? dayjs(endDate) : dayjs();
        const startDateObj = startDate ? dayjs(startDate) : endDateObj.subtract(30, 'day');

        baseWhere.DATE = {
            [Op.between]: [startDateObj.format('YYYY-MM-DD'), endDateObj.format('YYYY-MM-DD')]
        };

        // Calculate 30 days ago for DOI calculation
        const thirtyDaysAgo = endDateObj.subtract(30, 'day');

        console.log('[QUERY] Where clause:', baseWhere);

        // Query for OSA and current inventory (grouped by SKU)
        const osaData = await RbPdpOlap.findAll({
            attributes: [
                'Web_Pid',
                'Product',
                'Category',
                'Platform',
                'Weight',
                'Brand',
                [Sequelize.fn('SUM', Sequelize.col('neno_osa')), 'totalNeno'],
                [Sequelize.fn('SUM', Sequelize.col('deno_osa')), 'totalDeno'],
                [Sequelize.fn('AVG', Sequelize.col('Inventory')), 'avgInventory'],
                [Sequelize.fn('MAX', Sequelize.col('DATE')), 'latestDate']
            ],
            where: baseWhere,
            group: ['Web_Pid', 'Product', 'Category', 'Platform', 'Weight', 'Brand'],
            raw: true
        });

        console.log(`[QUERY] Found ${osaData.length} SKUs`);

        // For DOI calculation, we need to query last 30 days of sales
        const skuList = osaData.map(item => item.Web_Pid);

        let doiMap = {};
        if (skuList.length > 0) {
            const doiWhere = { ...baseWhere };
            doiWhere.Web_Pid = { [Op.in]: skuList };
            doiWhere.DATE = {
                [Op.between]: [thirtyDaysAgo.format('YYYY-MM-DD'), endDateObj.format('YYYY-MM-DD')]
            };

            const doiData = await RbPdpOlap.findAll({
                attributes: [
                    'Web_Pid',
                    [Sequelize.fn('SUM', Sequelize.col('Qty_Sold')), 'totalQtySold']
                ],
                where: doiWhere,
                group: ['Web_Pid'],
                raw: true
            });

            doiData.forEach(item => {
                doiMap[item.Web_Pid] = parseFloat(item.totalQtySold || 0);
            });
        }

        // Process results and calculate metrics
        const skus = osaData.map((item, index) => {
            const neno = parseFloat(item.totalNeno || 0);
            const deno = parseFloat(item.totalDeno || 0);

            // OSA Formula: sum(neno_osa) / sum(deno_osa)
            const osa = deno > 0 ? ((neno / deno) * 100) : 0;

            const inventory = parseFloat(item.avgInventory || 0);
            const qtySold30Days = doiMap[item.Web_Pid] || 0;
            const avgDailySales = qtySold30Days / 30;

            // DOI Formula: Inventory / (sum(Qty_Sold in 30 days) / 30)
            const doi = avgDailySales > 0 ? (inventory / avgDailySales) : 0;

            // SOH (Stock on Hand) Formula: Inventory - Quantity_Sold
            const qtySold = qtySold30Days || 0;
            const sohValue = inventory - qtySold;
            const soh = sohValue > 0 ? `${Math.round(sohValue)} units` : '0 units';

            // Determine if gainer or drainer based on OSA threshold
            const type = osa >= 90 ? 'gainer' : 'drainer';

            // Return complete card structure matching sample data format
            return {
                id: `AVL-${index + 1}`,
                type: type,
                metricType: 'availability',
                // skuCode: item.Web_Pid || `SKU-${index + 1}`,
                skuCode: '-',
                skuName: item.Product || 'Unknown Product',
                packSize: item.Weight || 'N/A',
                platform: item.Platform || platform || 'All',
                categoryTag: item.Category || 'N/A',
                offtakeValue: '₹ 0 lac', // Placeholder - can be calculated from Sales if needed
                impact: type === 'gainer' ? '+0%' : '-0%', // Placeholder - needs period comparison
                kpis: {
                    soh: soh, // Stock on Hand: Inventory - Quantity_Sold
                    doi: doi.toFixed(1),
                    weightedOsa: `${osa.toFixed(1)}%`
                },
                topCities: [] // Placeholder - can be populated with city-level data
            };
        });

        console.log(`[RESPONSE] Returning ${skus.length} SKUs`);
        console.log('==========================================\n');

        res.json({
            skus,
            total: skus.length,
            filters: { platform, brand, location, startDate, endDate }
        });
    } catch (error) {
        console.error('[ERROR] Signal Lab Data:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};

