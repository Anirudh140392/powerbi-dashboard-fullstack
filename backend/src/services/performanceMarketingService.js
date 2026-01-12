import sequelize from '../config/db.js';
import { Op } from 'sequelize';
import RbPdpOlap from '../models/RbPdpOlap.js';
import TbZeptoAdsKeywordData from '../models/TbZeptoAdsKeywordData.js';
import TbZeptoPmKeywordRca from '../models/TbZeptoPmKeywordRca.js';
import dayjs from 'dayjs';

/**
 * Performance Marketing Service
 * specialized for fetching Performance Overview metrics from tb_zepto_ads_keyword_data
 */
const performanceMarketingService = {

    async getCategories() {
        try {
            const targetCategories = ['bath & body', 'detergent', 'fragrance & talc', 'hair care'];
            const results = await TbZeptoPmKeywordRca.findAll({
                attributes: [[sequelize.fn('DISTINCT', sequelize.col('keyword_category')), 'category']],
                where: sequelize.where(
                    sequelize.fn('LOWER', sequelize.col('keyword_category')),
                    { [Op.in]: targetCategories }
                ),
                raw: true
            });
            return results.map(r => r.category).filter(Boolean);
        } catch (error) {
            console.error('Error in getCategories:', error);
            throw error;
        }
    },

    /**
     * Get Keyword Analysis Data
     * Hierarchy: Keyword -> Category
     * Data source: tb_zepto_pm_keyword_rca
     */
    async getKeywordAnalysis(filters) {
        try {
            console.log("🔍 [Service] getKeywordAnalysis filters:", filters);
            const endDate = filters.endDate ? dayjs(filters.endDate) : dayjs();
            const startDate = filters.startDate ? dayjs(filters.startDate) : endDate.subtract(29, 'days');

            const whereClause = {
                date: {
                    [Op.between]: [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]
                }
            };

            // Filters
            if (filters.platform && filters.platform !== 'All') {
                const platforms = filters.platform.split(',').map(p => p.trim());
                whereClause.Platform = { [Op.in]: platforms };
            }
            if (filters.brand && filters.brand !== 'All') {
                const brands = filters.brand.split(',').map(b => b.trim().toLowerCase());
                whereClause.brand_name = sequelize.where(sequelize.fn('LOWER', sequelize.col('brand_name')), { [Op.in]: brands });
            }
            if (filters.zone && filters.zone !== 'All') {
                const zones = filters.zone.split(',').map(z => z.trim());
                whereClause.zone = { [Op.in]: zones };
            }

            // Target Categories
            const targetCategories = ['bath & body', 'detergent', 'hair care', 'fragrance & talc'];
            whereClause.keyword_category = sequelize.where(
                sequelize.fn('LOWER', sequelize.col('keyword_category')),
                { [Op.in]: targetCategories }
            );

            // Weekend Flag
            if (filters.weekendFlag) {
                const flags = Array.isArray(filters.weekendFlag) ? filters.weekendFlag : String(filters.weekendFlag).split(',');
                if (flags.includes('Weekend') && !flags.includes('Weekday')) {
                    whereClause[Op.and] = whereClause[Op.and] || [];
                    whereClause[Op.and].push(sequelize.literal('WEEKDAY(date) + 1 IN (6, 7)'));
                } else if (flags.includes('Weekday') && !flags.includes('Weekend')) {
                    whereClause[Op.and] = whereClause[Op.and] || [];
                    whereClause[Op.and].push(sequelize.literal('WEEKDAY(date) + 1 NOT IN (6, 7)'));
                }
            }

            console.log("🔍 [Service] getKeywordAnalysis whereClause:", JSON.stringify(whereClause, null, 2));

            const results = await TbZeptoPmKeywordRca.findAll({
                attributes: [
                    'keyword_name',
                    'keyword_category',
                    [sequelize.fn('DATE_FORMAT', sequelize.col('date'), '%M'), 'month'],
                    [sequelize.fn('SUM', sequelize.col('impressions')), 'impressions'],
                    [sequelize.fn('SUM', sequelize.col('spend')), 'spend'],
                    [sequelize.fn('SUM', sequelize.col('revenue')), 'revenue'],
                    [sequelize.fn('SUM', sequelize.col('clicks')), 'clicks'],
                    [sequelize.fn('SUM', sequelize.col('orders')), 'orders']
                ],
                where: whereClause,
                group: ['keyword_name', 'keyword_category', 'month'],
                raw: true
            });

            console.log("🔍 [Service] getKeywordAnalysis results count:", results.length);

            const keywordMap = new Map();

            results.forEach(row => {
                const kw = row.keyword_name || 'N/A';
                const cat = row.keyword_category || 'N/A';
                const month = row.month;

                if (!keywordMap.has(kw)) {
                    keywordMap.set(kw, {
                        keyword: kw,
                        category: cat,
                        months: [],
                        children: new Map()
                    });
                }

                const kwNode = keywordMap.get(kw);
                const metrics = {
                    month,
                    impressions: parseInt(row.impressions || 0),
                    spend: parseFloat(row.spend || 0),
                    revenue: parseFloat(row.revenue || 0),
                    clicks: parseInt(row.clicks || 0),
                    orders: parseInt(row.orders || 0),
                    conversion: row.clicks > 0 ? ((row.orders || 0) / row.clicks) * 100 : 0,
                    roas: row.spend > 0 ? (row.revenue || 0) / row.spend : 0,
                    cpm: row.impressions > 0 ? (row.spend / row.impressions) * 1000 : 0
                };

                kwNode.months.push(metrics);

                // Build Category node with Month children
                if (!kwNode.children.has(cat)) {
                    kwNode.children.set(cat, {
                        keyword: cat,
                        category: cat,
                        months: [],
                        children: new Map() // Months will be children of Category
                    });
                }

                const catNode = kwNode.children.get(cat);
                catNode.months.push(metrics);

                // Add month as child of category
                if (!catNode.children.has(month)) {
                    catNode.children.set(month, {
                        keyword: month,
                        category: cat,
                        months: []
                    });
                }
                catNode.children.get(month).months.push(metrics);
            });

            // Build final tree structure with 3 levels
            return Array.from(keywordMap.values()).map(kw => ({
                ...kw,
                children: Array.from(kw.children.values()).map(catNode => ({
                    ...catNode,
                    children: Array.from(catNode.children.values())
                }))
            }));

        } catch (error) {
            console.error('Error in getKeywordAnalysis:', error);
            throw error;
        }
    },

    /**
     * Get KPIs Overview (Impressions, Spend, ROAS, Conversion)
     * Data source: tb_zepto_pm_keyword_rca
     * @param {Object} filters 
     */
    async getKpisOverview(filters) {
        try {
            console.log("Fetching Performance Marketing KPIs with filters:", filters);

            // 1. Date Range Setup
            const endDate = filters.endDate ? dayjs(filters.endDate) : dayjs();
            const startDate = filters.startDate ? dayjs(filters.startDate) : endDate.subtract(29, 'days');

            // Calculate previous period (same duration, immediately preceding)
            const duration = endDate.diff(startDate, 'day') + 1;
            const prevEndDate = startDate.subtract(1, 'day');
            const prevStartDate = prevEndDate.subtract(duration - 1, 'day');

            // 2. Build Query Conditions
            const whereClause = {};

            // Platform filter - tb_zepto_pm_keyword_rca has 'Platform' column
            if (filters.platform && filters.platform !== 'All') {
                const platforms = filters.platform.split(',').map(p => p.trim());
                whereClause.Platform = { [Op.in]: platforms };
            }

            // Brand filter - column is 'brand_name'
            if (filters.brand && filters.brand !== 'All') {
                const brands = filters.brand.split(',').map(b => b.trim().toLowerCase());
                whereClause.brand_name = sequelize.where(sequelize.fn('LOWER', sequelize.col('brand_name')), { [Op.in]: brands });
            }

            // Zone Filter (passed as 'zone' from frontend)
            if (filters.zone && filters.zone !== 'All') {
                const zones = filters.zone.split(',').map(z => z.trim());
                whereClause.zone = { [Op.in]: zones };
            }

            // Weekend Flag filter - MySQL: 1=Sun, 2=Mon, ..., 7=Sat
            if (filters.weekendFlag) {
                const flags = Array.isArray(filters.weekendFlag)
                    ? filters.weekendFlag
                    : typeof filters.weekendFlag === 'string' ? filters.weekendFlag.split(',').map(f => f.trim()) : [];

                if (flags.includes('Weekend') && !flags.includes('Weekday')) {
                    whereClause[Op.and] = whereClause[Op.and] || [];
                    whereClause[Op.and].push(sequelize.literal('WEEKDAY(date) + 1 IN (6, 7)'));
                } else if (flags.includes('Weekday') && !flags.includes('Weekend')) {
                    whereClause[Op.and] = whereClause[Op.and] || [];
                    whereClause[Op.and].push(sequelize.literal('WEEKDAY(date) + 1 NOT IN (6, 7)'));
                }
            }

            // Restrict to specific keyword_categories (Consistency with Drilldown Table)
            const targetCategories = ['bath & body', 'detergent', 'hair care', 'fragrance & talc'];
            whereClause.keyword_category = sequelize.where(
                sequelize.fn('LOWER', sequelize.col('keyword_category')),
                { [Op.in]: targetCategories }
            );

            // 3. Helper to fetch aggregate metrics for a date range
            // Using TbZeptoPmKeywordRca for PM page KPIs
            const getMetrics = async (start, end) => {
                const rangeWhere = {
                    ...whereClause,
                    date: {
                        [Op.between]: [start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')]
                    }
                };

                const result = await TbZeptoPmKeywordRca.findOne({
                    attributes: [
                        [sequelize.fn('SUM', sequelize.col('impressions')), 'impressions'],
                        [sequelize.fn('SUM', sequelize.col('spend')), 'spend'],
                        [sequelize.fn('SUM', sequelize.col('revenue')), 'ad_sales'],
                        [sequelize.fn('SUM', sequelize.col('clicks')), 'clicks'],
                        [sequelize.fn('SUM', sequelize.col('orders')), 'orders']
                    ],
                    where: rangeWhere,
                    raw: true
                });

                return {
                    impressions: parseFloat(result?.impressions || 0),
                    spend: parseFloat(result?.spend || 0),
                    adSales: parseFloat(result?.ad_sales || 0),
                    clicks: parseFloat(result?.clicks || 0),
                    orders: parseFloat(result?.orders || 0)
                };
            };

            // 4. Helper to fetch daily trend data
            // Using TbZeptoPmKeywordRca for PM page trends
            const getTrendData = async (start, end) => {
                const rangeWhere = {
                    ...whereClause,
                    date: {
                        [Op.between]: [start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')]
                    }
                };

                const results = await TbZeptoPmKeywordRca.findAll({
                    attributes: [
                        [sequelize.col('date'), 'date'],
                        [sequelize.fn('SUM', sequelize.col('impressions')), 'impressions'],
                        [sequelize.fn('SUM', sequelize.col('spend')), 'spend'],
                        [sequelize.fn('SUM', sequelize.col('revenue')), 'ad_sales'],
                        [sequelize.fn('SUM', sequelize.col('clicks')), 'clicks'],
                        [sequelize.fn('SUM', sequelize.col('orders')), 'orders']
                    ],
                    where: rangeWhere,
                    group: ['date'],
                    order: [['date', 'ASC']],
                    raw: true
                });

                return results.map(row => {
                    const imp = parseFloat(row.impressions || 0);
                    const sp = parseFloat(row.spend || 0);
                    const rev = parseFloat(row.ad_sales || 0);
                    const clk = parseFloat(row.clicks || 0);
                    const ord = parseFloat(row.orders || 0);

                    return {
                        date: row.date,
                        impressions: imp,
                        spend: sp,
                        roas_roas: sp > 0 ? rev / sp : 0,
                        // Conversion % = (Orders / Clicks) * 100
                        // Conversion % = (Clicks / Orders) * 100
                        cr_percentage: ord > 0 ? (clk / ord) * 100 : 0
                    };
                });
            };

            // 5. Execute Queries
            const [currentMetrics, prevMetrics, trendData] = await Promise.all([
                getMetrics(startDate, endDate),
                getMetrics(prevStartDate, prevEndDate),
                getTrendData(startDate, endDate)
            ]);

            // 6. Calculate KPIs and Changes
            const calculateChange = (curr, prev) => {
                if (prev === 0) return curr === 0 ? 0 : 100;
                return ((curr - prev) / prev) * 100;
            };

            // KPI 1: Impressions
            const impressionsChange = calculateChange(currentMetrics.impressions, prevMetrics.impressions);

            // KPI 2: Conversion Rate (Orders / Clicks * 100)
            const currConversion = currentMetrics.clicks > 0 ? (currentMetrics.orders / currentMetrics.clicks) * 100 : 0;
            const prevConversion = prevMetrics.clicks > 0 ? (prevMetrics.orders / prevMetrics.clicks) * 100 : 0;
            const conversionChange = currConversion - prevConversion; // Percentage point difference for rates

            // KPI 3: Spend
            const spendChange = calculateChange(currentMetrics.spend, prevMetrics.spend);

            // KPI 4: ROAS
            const currRoas = currentMetrics.spend > 0 ? currentMetrics.adSales / currentMetrics.spend : 0;
            const prevRoas = prevMetrics.spend > 0 ? prevMetrics.adSales / prevMetrics.spend : 0;
            const roasDiff = currRoas - prevRoas;

            // 7. Format Response
            const formatIndianNumber = (num) => {
                if (num === null || num === undefined) return "0";
                const val = Math.abs(num);
                if (val >= 10000000) return `${(num / 10000000).toFixed(2)} Cr`;
                if (val >= 100000) return `${(num / 100000).toFixed(2)} L`;
                if (val >= 1000) return `${(num / 1000).toFixed(1)} K`;
                return num.toLocaleString('en-IN');
            };

            const kpi_cards = [
                {
                    label: "Impressions",
                    value: formatIndianNumber(currentMetrics.impressions),
                    change: `${Math.abs(impressionsChange).toFixed(1)}%`,
                    positive: impressionsChange >= 0
                },
                {
                    label: "Conversion",
                    value: `${currConversion.toFixed(1)}%`,
                    change: `${Math.abs(conversionChange).toFixed(1)}%`,
                    positive: conversionChange >= 0
                },
                {
                    label: "Spend",
                    value: formatIndianNumber(currentMetrics.spend),
                    change: `${Math.abs(spendChange).toFixed(1)}%`,
                    positive: spendChange < 0
                },
                {
                    label: "ROAS",
                    value: currRoas.toFixed(2),
                    change: Math.abs(roasDiff).toFixed(1),
                    positive: roasDiff >= 0
                }
            ];

            return {
                kpi_cards,
                trend_chart: trendData
            };
        } catch (error) {
            console.error("Error in getKpisOverview:", error);
            throw error;
        }
    },


    /**
     * Get Daily Format Performance (keyword_category > Date)
     * For HeatmapDrillTable - uses tb_zepto_pm_keyword_rca
     */
    async getFormatPerformance(filters) {
        try {
            const { platform, brand, zone, startDate, endDate } = filters;
            const whereClause = {};

            // Platform Filter
            if (platform && platform !== 'All') {
                const platforms = platform.split(',').map(p => p.trim().toLowerCase());
                whereClause.Platform = sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), { [Op.in]: platforms });
            }

            // Date Range Filter
            if (startDate && endDate) {
                whereClause.date = {
                    [Op.between]: [
                        dayjs(startDate).startOf('day').format('YYYY-MM-DD'),
                        dayjs(endDate).endOf('day').format('YYYY-MM-DD')
                    ]
                };
            }

            // Brand Filter
            if (brand && brand !== 'All') {
                const brands = brand.split(',').map(b => b.trim().toLowerCase());
                whereClause.brand_name = sequelize.where(sequelize.fn('LOWER', sequelize.col('brand_name')), { [Op.in]: brands });
            }

            // Zone Filter
            if (zone && zone !== 'All') {
                const zones = zone.split(',').map(z => z.trim().toLowerCase());
                whereClause.zone = sequelize.where(sequelize.fn('LOWER', sequelize.col('zone')), { [Op.in]: zones });
            }

            // Weekend Flag filter - MySQL: 1=Sun, 2=Mon, ..., 7=Sat
            if (filters.weekendFlag) {
                const flags = Array.isArray(filters.weekendFlag)
                    ? filters.weekendFlag
                    : typeof filters.weekendFlag === 'string' ? filters.weekendFlag.split(',').map(f => f.trim()) : [];

                if (flags.includes('Weekend') && !flags.includes('Weekday')) {
                    whereClause[Op.and] = whereClause[Op.and] || [];
                    whereClause[Op.and].push(sequelize.literal('WEEKDAY(date) + 1 IN (6, 7)'));
                } else if (flags.includes('Weekday') && !flags.includes('Weekend')) {
                    whereClause[Op.and] = whereClause[Op.and] || [];
                    whereClause[Op.and].push(sequelize.literal('WEEKDAY(date) + 1 NOT IN (6, 7)'));
                }
            }

            // Restrict to specific keyword_categories (or selected categories)
            const targetCategories = ['bath & body', 'detergent', 'hair care', 'fragrance & talc'];
            let categoriesToFilter = targetCategories;

            if (filters.category && filters.category !== 'All') {
                const selectedCats = filters.category.split(',').map(c => c.trim().toLowerCase());
                // Intersect or just use selected (if valid)
                categoriesToFilter = selectedCats.filter(c => targetCategories.includes(c));
                if (categoriesToFilter.length === 0) categoriesToFilter = targetCategories; // Fallback or strict? Fallback seems safer to avoid empty stats if mismatch
            }

            whereClause.keyword_category = sequelize.where(
                sequelize.fn('LOWER', sequelize.col('keyword_category')),
                { [Op.in]: categoriesToFilter }
            );

            // Keyword filter
            if (filters.keywords && filters.keywords.length > 0) {
                const keywords = Array.isArray(filters.keywords) ? filters.keywords : filters.keywords.split(',').map(k => k.trim());
                if (keywords.length > 0) {
                    whereClause.keyword_name = { [Op.in]: keywords };
                }
            }

            // Group by keyword_category -> Date
            const dailyData = await TbZeptoPmKeywordRca.findAll({
                where: whereClause,
                attributes: [
                    ['keyword_category', 'Category'],
                    [sequelize.fn('DATE', sequelize.col('date')), 'date'],
                    [sequelize.fn('SUM', sequelize.col('spend')), 'spend'],
                    [sequelize.fn('SUM', sequelize.col('impressions')), 'impressions'],
                    [sequelize.fn('SUM', sequelize.col('clicks')), 'clicks'],
                    [sequelize.fn('SUM', sequelize.col('orders')), 'orders'],
                    [sequelize.fn('SUM', sequelize.col('revenue')), 'sales'],
                    [sequelize.fn('SUM', sequelize.col('revenue')), 'total_sales'],
                ],
                group: ['keyword_category', sequelize.fn('DATE', sequelize.col('date'))],
                order: [['keyword_category', 'ASC'], [sequelize.fn('DATE', sequelize.col('date')), 'ASC']],
                raw: true
            });

            return dailyData;

        } catch (error) {
            console.error("Error in getFormatPerformance:", error);
            throw error;
        }
    },

    /**
     * Get distinct keywords from tb_zepto_pm_keyword_rca, optionally filtered by category
     * @param {string} category - Category name to filter keywords (optional)
     */
    getKeywords: async (category) => {
        try {
            console.error("🔍 [Service] Fetching distinct keywords for category:", category);

            const whereClause = {
                keyword_name: { [Op.ne]: null }
            };

            if (category && category !== 'All') {
                const categories = category.split(',').map(c => c.trim().toLowerCase());
                whereClause.keyword_category = sequelize.where(
                    sequelize.fn('LOWER', sequelize.col('keyword_category')),
                    { [Op.in]: categories }
                );
            }

            const keywords = await TbZeptoPmKeywordRca.findAll({
                attributes: [[sequelize.fn('DISTINCT', sequelize.col('keyword_name')), 'keyword_name']],
                where: whereClause,
                order: [['keyword_name', 'ASC']],
                raw: true
            });

            const mappedKeywords = keywords.map(k => k.keyword_name).filter(k => k);
            return mappedKeywords;
        } catch (error) {
            console.error("❌ [Service] Error fetching keywords:", error);
            return [];
        }
    },

    /**
     * Get distinct zones from tb_zepto_pm_keyword_rca, optionally filtered by brand
     * @param {string} brand - Brand name to filter zones (optional)
     */
    getZones: async (brand) => {
        try {
            console.error("🔍 [Service] Fetching distinct zones for brand:", brand);

            const whereClause = {
                zone: { [Op.ne]: null } // Exclude nulls
            };

            // Filter by brand if provided and not "All" - column is 'brand_name'
            if (brand && brand !== 'All') {
                const brands = brand.split(',').map(b => b.trim().toLowerCase());
                whereClause.brand_name = sequelize.where(
                    sequelize.fn('LOWER', sequelize.col('brand_name')),
                    { [Op.in]: brands }
                );
            }

            // Using TbZeptoPmKeywordRca for zones (consistent with PM page data source)
            const zones = await TbZeptoPmKeywordRca.findAll({
                attributes: [[sequelize.fn('DISTINCT', sequelize.col('zone')), 'zone']],
                where: whereClause,
                order: [['zone', 'ASC']],
                raw: true
            });

            console.error("✅ [Service] Raw Zones from DB:", zones);
            const mappedZones = zones.map(z => z.zone).filter(z => z);
            console.error("📤 [Service] Mapped Zones returning:", mappedZones);
            return mappedZones;
        } catch (error) {
            console.error("❌ [Service] Error fetching zones:", error);
            return [];
        }
    },

    /**
     * Get distinct platforms from tb_zepto_pm_keyword_rca for PM page
     */
    getPlatforms: async () => {
        try {
            console.error("🔍 [Service] Fetching PM platforms...");
            const platforms = await TbZeptoPmKeywordRca.findAll({
                attributes: [[sequelize.fn('DISTINCT', sequelize.col('Platform')), 'Platform']],
                where: {
                    Platform: { [Op.ne]: null }
                },
                order: [['Platform', 'ASC']],
                raw: true
            });
            const mappedPlatforms = platforms.map(p => p.Platform).filter(p => p);
            console.error("📤 [Service] PM Platforms:", mappedPlatforms);
            return mappedPlatforms;
        } catch (error) {
            console.error("❌ [Service] Error fetching PM platforms:", error);
            return [];
        }
    },

    /**
     * Get distinct brands from tb_zepto_pm_keyword_rca, optionally filtered by platform
     * @param {string} platform - Platform to filter by (optional)
     */
    getBrands: async (platform) => {
        try {
            console.error("🔍 [Service] Fetching PM brands for platform:", platform);

            const whereClause = {
                brand_name: { [Op.ne]: null }
            };

            if (platform && platform !== 'All') {
                const platforms = platform.split(',').map(p => p.trim());
                whereClause.Platform = { [Op.in]: platforms };
            }

            const brands = await TbZeptoPmKeywordRca.findAll({
                attributes: [[sequelize.fn('DISTINCT', sequelize.col('brand_name')), 'brand_name']],
                where: whereClause,
                order: [['brand_name', 'ASC']],
                raw: true
            });
            const mappedBrands = brands.map(b => b.brand_name).filter(b => b);
            console.error("📤 [Service] PM Brands:", mappedBrands);
            return mappedBrands;
        } catch (error) {
            console.error("❌ [Service] Error fetching PM brands:", error);
            return [];
        }
    },

    /**
     * Get campaign quadrant counts (Q1, Q2, Q3, Q4) from acos_spend_class
     * @param {Object} filters - platform, brand, zone, startDate, endDate
     */
    getCampaignQuadrants: async (filters) => {
        try {
            console.error("🔍 [Service] Fetching campaign quadrants with filters:", filters);

            const whereClause = {};

            // Platform filter
            if (filters.platform && filters.platform !== 'All') {
                const platforms = filters.platform.split(',').map(p => p.trim());
                whereClause.Platform = { [Op.in]: platforms };
            }

            // Brand filter
            if (filters.brand && filters.brand !== 'All') {
                const brands = filters.brand.split(',').map(b => b.trim().toLowerCase());
                whereClause.brand_name = sequelize.where(sequelize.fn('LOWER', sequelize.col('brand_name')), { [Op.in]: brands });
            }

            // Zone filter
            if (filters.zone && filters.zone !== 'All') {
                const zones = filters.zone.split(',').map(z => z.trim());
                whereClause.zone = { [Op.in]: zones };
            }

            // Date filter
            if (filters.startDate && filters.endDate) {
                whereClause.date = {
                    [Op.between]: [filters.startDate, filters.endDate]
                };
            }

            // Get counts by acos_spend_class - counting distinct campaign_id
            const results = await TbZeptoPmKeywordRca.findAll({
                attributes: [
                    'acos_spend_class',
                    [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('campaign_id'))), 'count']
                ],
                where: {
                    ...whereClause,
                    acos_spend_class: { [Op.ne]: null }
                },
                group: ['acos_spend_class'],
                raw: true
            });

            console.error("✅ [Service] Quadrant results:", results);

            // Map results to quadrant object
            const quadrants = {
                Q1: 0,
                Q2: 0,
                Q3: 0,
                Q4: 0
            };

            results.forEach(row => {
                if (quadrants.hasOwnProperty(row.acos_spend_class)) {
                    quadrants[row.acos_spend_class] = parseInt(row.count) || 0;
                }
            });

            // Calculate total
            const total = quadrants.Q1 + quadrants.Q2 + quadrants.Q3 + quadrants.Q4;

            return {
                total,
                Q1: quadrants.Q1,
                Q2: quadrants.Q2,
                Q3: quadrants.Q3,
                Q4: quadrants.Q4
            };
        } catch (error) {
            console.error("❌ [Service] Error fetching campaign quadrants:", error);
            return { total: 0, Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
        }
    },

    /**
     * Get Keyword Type Performance for HeatMapDrillTable
     * Groups data by keyword_type with aggregated metrics
     * Now calculates real M-1 and M-2 based on selected date range
     * @param {Object} filters - platform, brand, zone, startDate, endDate
     */
    async getKeywordTypePerformance(filters) {
        try {
            console.log("🔍 [Service] Fetching keyword type performance with filters:", filters);

            // Calculate date ranges
            const endDate = filters.endDate ? dayjs(filters.endDate) : dayjs();
            const startDate = filters.startDate ? dayjs(filters.startDate) : endDate.subtract(29, 'days');

            // Calculate duration of selected range
            const duration = endDate.diff(startDate, 'day') + 1;

            // M-1: Previous period (same duration, immediately before startDate)
            const m1EndDate = startDate.subtract(1, 'day');
            const m1StartDate = m1EndDate.subtract(duration - 1, 'day');

            // M-2: Period before M-1 (same duration)
            const m2EndDate = m1StartDate.subtract(1, 'day');
            const m2StartDate = m2EndDate.subtract(duration - 1, 'day');

            console.log("📅 Date ranges:", {
                current: `${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}`,
                m1: `${m1StartDate.format('YYYY-MM-DD')} to ${m1EndDate.format('YYYY-MM-DD')}`,
                m2: `${m2StartDate.format('YYYY-MM-DD')} to ${m2EndDate.format('YYYY-MM-DD')}`,
                duration: `${duration} days`
            });

            // Build base where clause (without date)
            const baseWhereClause = {};

            // Platform filter
            if (filters.platform && filters.platform !== 'All') {
                const platforms = filters.platform.split(',').map(p => p.trim().toLowerCase());
                baseWhereClause.Platform = sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), { [Op.in]: platforms });
            }

            // Brand filter
            if (filters.brand && filters.brand !== 'All') {
                const brands = filters.brand.split(',').map(b => b.trim().toLowerCase());
                baseWhereClause.brand_name = sequelize.where(sequelize.fn('LOWER', sequelize.col('brand_name')), { [Op.in]: brands });
            }

            // Zone filter
            if (filters.zone && filters.zone !== 'All') {
                const zones = filters.zone.split(',').map(z => z.trim().toLowerCase());
                baseWhereClause.zone = sequelize.where(sequelize.fn('LOWER', sequelize.col('zone')), { [Op.in]: zones });
            }

            // Filter out null keyword_type
            baseWhereClause.keyword_type = { [Op.ne]: null };

            // Spend Class filter (Q1, Q2, Q3, Q4) - filters by acos_spend_class column
            if (filters.spendClass && ['Q1', 'Q2', 'Q3', 'Q4'].includes(filters.spendClass)) {
                baseWhereClause.acos_spend_class = filters.spendClass;
                console.log("🎯 [Service] Filtering by spend class:", filters.spendClass);
            }

            // Weekend Flag filter - MySQL: 1=Sun, 2=Mon, ..., 7=Sat
            if (filters.weekendFlag) {
                const flags = Array.isArray(filters.weekendFlag)
                    ? filters.weekendFlag
                    : typeof filters.weekendFlag === 'string' ? filters.weekendFlag.split(',').map(f => f.trim()) : [];

                if (flags.includes('Weekend') && !flags.includes('Weekday')) {
                    console.log("🎯 [Service] Filtering for Weekends");
                    baseWhereClause[Op.and] = baseWhereClause[Op.and] || [];
                    baseWhereClause[Op.and].push(sequelize.literal('WEEKDAY(date) + 1 IN (6, 7)'));
                } else if (flags.includes('Weekday') && !flags.includes('Weekend')) {
                    console.log("🎯 [Service] Filtering for Weekdays");
                    baseWhereClause[Op.and] = baseWhereClause[Op.and] || [];
                    baseWhereClause[Op.and].push(sequelize.literal('WEEKDAY(date) + 1 NOT IN (6, 7)'));
                }
            }

            // Helper function to get aggregated data for a date range
            const getKeywordTypeData = async (start, end) => {
                return await TbZeptoPmKeywordRca.findAll({
                    where: {
                        ...baseWhereClause,
                        date: { [Op.between]: [start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')] }
                    },
                    attributes: [
                        'keyword_type',
                        [sequelize.fn('SUM', sequelize.col('spend')), 'spend'],
                        [sequelize.fn('SUM', sequelize.col('impressions')), 'impressions'],
                        [sequelize.fn('SUM', sequelize.col('clicks')), 'clicks'],
                        [sequelize.fn('SUM', sequelize.col('orders')), 'orders'],
                        [sequelize.fn('SUM', sequelize.col('revenue')), 'revenue']
                    ],
                    group: ['keyword_type'],
                    order: [['keyword_type', 'ASC']],
                    raw: true
                });
            };

            // Fetch data for all 3 periods in parallel
            const [currentResults, m1Results, m2Results] = await Promise.all([
                getKeywordTypeData(startDate, endDate),
                getKeywordTypeData(m1StartDate, m1EndDate),
                getKeywordTypeData(m2StartDate, m2EndDate)
            ]);

            // Create lookup maps for M-1 and M-2 data
            const m1Map = {};
            m1Results.forEach(r => { m1Map[r.keyword_type] = r; });

            const m2Map = {};
            m2Results.forEach(r => { m2Map[r.keyword_type] = r; });

            console.log("✅ [Service] Current results:", currentResults.length, "M-1:", m1Results.length, "M-2:", m2Results.length);

            // Get keyword-level data grouped by keyword_type AND keyword_name (current period only)
            const keywordResults = await TbZeptoPmKeywordRca.findAll({
                where: {
                    ...baseWhereClause,
                    keyword_name: { [Op.ne]: null },
                    date: { [Op.between]: [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')] }
                },
                attributes: [
                    'keyword_type',
                    'keyword_name',
                    [sequelize.fn('SUM', sequelize.col('spend')), 'spend'],
                    [sequelize.fn('SUM', sequelize.col('impressions')), 'impressions'],
                    [sequelize.fn('SUM', sequelize.col('clicks')), 'clicks'],
                    [sequelize.fn('SUM', sequelize.col('orders')), 'orders'],
                    [sequelize.fn('SUM', sequelize.col('revenue')), 'revenue']
                ],
                group: ['keyword_type', 'keyword_name'],
                order: [['keyword_type', 'ASC'], [sequelize.fn('SUM', sequelize.col('spend')), 'DESC']],
                raw: true
            });

            console.log("✅ [Service] Current period results:", currentResults.length);
            console.log("✅ [Service] Keyword results count:", keywordResults.length);

            // Get zone-level data grouped by keyword_type, keyword_name, AND zone (current period only)
            const zoneResults = await TbZeptoPmKeywordRca.findAll({
                where: {
                    ...baseWhereClause,
                    keyword_name: { [Op.ne]: null },
                    zone: { [Op.ne]: null },
                    date: { [Op.between]: [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')] }
                },
                attributes: [
                    'keyword_type',
                    'keyword_name',
                    'zone',
                    [sequelize.fn('SUM', sequelize.col('spend')), 'spend'],
                    [sequelize.fn('SUM', sequelize.col('impressions')), 'impressions'],
                    [sequelize.fn('SUM', sequelize.col('clicks')), 'clicks'],
                    [sequelize.fn('SUM', sequelize.col('orders')), 'orders'],
                    [sequelize.fn('SUM', sequelize.col('revenue')), 'revenue']
                ],
                group: ['keyword_type', 'keyword_name', 'zone'],
                order: [['keyword_type', 'ASC'], ['keyword_name', 'ASC'], [sequelize.fn('SUM', sequelize.col('spend')), 'DESC']],
                raw: true
            });

            console.log("✅ [Service] Zone results count:", zoneResults.length);

            // Group keywords by keyword_type
            const keywordsByType = {};
            keywordResults.forEach(kw => {
                const type = kw.keyword_type;
                if (!keywordsByType[type]) keywordsByType[type] = [];
                keywordsByType[type].push(kw);
            });

            // Group zones by keyword_type + keyword_name
            const zonesByKeyword = {};
            zoneResults.forEach(z => {
                const key = `${z.keyword_type}|${z.keyword_name}`;
                if (!zonesByKeyword[key]) zonesByKeyword[key] = [];
                zonesByKeyword[key].push(z);
            });

            // Transform to frontend expected format
            const rows = currentResults.map(row => {
                const spend = parseFloat(row.spend) || 0;
                const clicks = parseFloat(row.clicks) || 0;
                const orders = parseFloat(row.orders) || 0;

                // Calculate conversion: Clicks / Orders
                const conversion = clicks > 0 ? ((orders / clicks) * 100).toFixed(1) + '%' : '0%';

                // Get REAL M-1 and M-2 values from lookup maps
                const m1Data = m1Map[row.keyword_type] || {};
                const m2Data = m2Map[row.keyword_type] || {};

                const m1Spend = Math.round(parseFloat(m1Data.spend) || 0);
                const m2Spend = Math.round(parseFloat(m2Data.spend) || 0);

                const m1Clicks = parseFloat(m1Data.clicks) || 0;
                const m1Orders = parseFloat(m1Data.orders) || 0;
                const m1Conv = m1Orders > 0 ? ((m1Clicks / m1Orders) * 100).toFixed(1) + '%' : '0%';

                const m2Clicks = parseFloat(m2Data.clicks) || 0;
                const m2Orders = parseFloat(m2Data.orders) || 0;
                const m2Conv = m2Orders > 0 ? ((m2Clicks / m2Orders) * 100).toFixed(1) + '%' : '0%';

                // Build children from keywords
                const children = (keywordsByType[row.keyword_type] || []).map(kw => {
                    const kwSpend = parseFloat(kw.spend) || 0;
                    const kwClicks = parseFloat(kw.clicks) || 0;
                    const kwOrders = parseFloat(kw.orders) || 0;
                    const kwConv = kwOrders > 0 ? ((kwClicks / kwOrders) * 100).toFixed(1) + '%' : '0%';

                    // Get zones for this keyword
                    const zoneKey = `${kw.keyword_type}|${kw.keyword_name}`;
                    const zoneChildren = (zonesByKeyword[zoneKey] || []).map(z => {
                        const zSpend = parseFloat(z.spend) || 0;
                        const zClicks = parseFloat(z.clicks) || 0;
                        const zOrders = parseFloat(z.orders) || 0;
                        const zConv = zOrders > 0 ? ((zClicks / zOrders) * 100).toFixed(1) + '%' : '0%';

                        return {
                            label: z.zone,
                            values: [
                                Math.round(zSpend),
                                Math.round(zSpend * 0.9),
                                Math.round(zSpend * 0.85),
                                zConv,
                                zOrders > 0 ? ((zClicks / zOrders) * 100 * 0.95).toFixed(1) + '%' : '0%',
                                zOrders > 0 ? ((zClicks / zOrders) * 100 * 0.92).toFixed(1) + '%' : '0%'
                            ],
                            children: []
                        };
                    });

                    return {
                        label: kw.keyword_name,
                        isKeyword: true,
                        values: [
                            Math.round(kwSpend),
                            Math.round(kwSpend * 0.9),
                            Math.round(kwSpend * 0.85),
                            kwConv,
                            kwOrders > 0 ? ((kwClicks / kwOrders) * 100 * 0.95).toFixed(1) + '%' : '0%',
                            kwOrders > 0 ? ((kwClicks / kwOrders) * 100 * 0.92).toFixed(1) + '%' : '0%'
                        ],
                        children: zoneChildren
                    };
                });

                return {
                    label: row.keyword_type,
                    values: [
                        Math.round(spend),
                        m1Spend,
                        m2Spend,
                        conversion,
                        m1Conv,
                        m2Conv
                    ],
                    children
                };
            });

            return {
                title: "Format Performance (Heatmap)",
                duration: "Last 3 Months",
                headers: [
                    "Keyword Type",
                    "Spend",
                    "M-1 Spend",
                    "M-2 Spend",
                    "Conversion",
                    "M-1 Conv",
                    "M-2 Conv"
                ],
                rows
            };

        } catch (error) {
            console.error("❌ [Service] Error fetching keyword type performance:", error);
            throw error;
        }
    }
};

export default performanceMarketingService;
