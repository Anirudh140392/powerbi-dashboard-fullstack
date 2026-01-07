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
                whereClause.Platform = filters.platform;
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

            // KPI 2: Conversion (Orders / Clicks * 100)
            // KPI 2: Conversion (Clicks / Orders * 100) -- as per user request
            const currConversion = currentMetrics.orders > 0 ? (currentMetrics.clicks / currentMetrics.orders) * 100 : 0;
            const prevConversion = prevMetrics.orders > 0 ? (prevMetrics.clicks / prevMetrics.orders) * 100 : 0;
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
                whereClause.Platform = sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), platform.toLowerCase());
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

            // Restrict to specific keyword_categories
            const targetCategories = ['bath & body', 'detergent', 'hair care', 'fragrance & talc'];
            whereClause.keyword_category = sequelize.where(
                sequelize.fn('LOWER', sequelize.col('keyword_category')),
                { [Op.in]: targetCategories }
            );

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
                whereClause.brand_name = sequelize.where(
                    sequelize.fn('LOWER', sequelize.col('brand_name')),
                    brand.toLowerCase()
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
                whereClause.Platform = platform;
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
                whereClause.Platform = filters.platform;
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
    }
};

export default performanceMarketingService;
