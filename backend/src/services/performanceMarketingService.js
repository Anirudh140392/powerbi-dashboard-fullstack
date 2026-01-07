import sequelize from '../config/db.js';
import { Op } from 'sequelize';
import RbPdpOlap from '../models/RbPdpOlap.js';
import TbZeptoAdsKeywordData from '../models/TbZeptoAdsKeywordData.js';
import dayjs from 'dayjs';

/**
 * Performance Marketing Service
 * specialized for fetching Performance Overview metrics from tb_zepto_ads_keyword_data
 */
const performanceMarketingService = {

    /**
     * Get KPIs Overview (Impressions, Spend, ROAS, Conversion)
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

            // Note: tb_zepto_ads_keyword_data does NOT have a 'platform' column
            // Platform filtering is not applicable for this table

            // Brand filter - column is 'brand_name' not 'brand'
            if (filters.brand && filters.brand !== 'All') {
                const brands = filters.brand.split(',').map(b => b.trim().toLowerCase());
                whereClause.brand_name = sequelize.where(sequelize.fn('LOWER', sequelize.col('brand_name')), { [Op.in]: brands });
            }

            // Zone Filter (passed as 'zone' from frontend)
            if (filters.zone && filters.zone !== 'All') {
                const zones = filters.zone.split(',').map(z => z.trim());
                whereClause.zone = { [Op.in]: zones };
            }

            // 3. Helper to fetch aggregate metrics for a date range
            const getMetrics = async (start, end) => {
                const rangeWhere = {
                    ...whereClause,
                    date: {
                        [Op.between]: [start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')]
                    }
                };

                const result = await TbZeptoAdsKeywordData.findOne({
                    attributes: [
                        [sequelize.fn('SUM', sequelize.col('impressions')), 'impressions'],
                        [sequelize.fn('SUM', sequelize.col('spend')), 'spend'],
                        [sequelize.fn('SUM', sequelize.col('revenue')), 'ad_sales'],
                        [sequelize.fn('SUM', sequelize.col('clicks')), 'clicks'],
                        [sequelize.fn('SUM', sequelize.col('orders')), 'orders'] // Add orders
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
            const getTrendData = async (start, end) => {
                const rangeWhere = {
                    ...whereClause,
                    date: {
                        [Op.between]: [start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')]
                    }
                };

                const results = await TbZeptoAdsKeywordData.findAll({
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
                        cr_percentage: clk > 0 ? (ord / clk) * 100 : 0
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
     * Get Daily Format Performance (Category > Date)
     * For HeatmapDrillTable
     */
    async getFormatPerformance(filters) {
        try {
            const { platform, brand, location, startDate, endDate } = filters;
            const whereClause = {};

            // Basic Filters
            if (platform && platform !== 'All') {
                whereClause.Platform = sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), platform.toLowerCase());
            }
            if (startDate && endDate) {
                whereClause.DATE = {
                    [Op.between]: [
                        dayjs(startDate).startOf('day').toDate(),
                        dayjs(endDate).endOf('day').toDate()
                    ]
                };
            }

            // Global Filters (Brand/Location)
            if (brand && brand !== 'All') {
                const brands = brand.split(',').map(b => b.trim().toLowerCase());
                whereClause.Brand = sequelize.where(sequelize.fn('LOWER', sequelize.col('Brand')), { [Op.in]: brands });
            }
            if (location && location !== 'All') {
                const locations = location.split(',').map(l => l.trim().toLowerCase());
                whereClause.Location = sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), { [Op.in]: locations });
            }

            // RESTRICT TO SPECIFIC CATEGORIES (User Request)
            const targetCategories = ['bath & body', 'detergent', 'hair care', 'fragrance & talc'];
            whereClause.Category = sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), { [Op.in]: targetCategories });


            // Group by Category -> Date
            const dailyData = await RbPdpOlap.findAll({
                where: whereClause,
                attributes: [
                    'Category',
                    [sequelize.fn('DATE', sequelize.col('DATE')), 'date'],
                    [sequelize.fn('SUM', sequelize.col('Ad_Spend')), 'spend'],
                    [sequelize.fn('SUM', sequelize.col('Ad_Impressions')), 'impressions'],
                    [sequelize.fn('SUM', sequelize.col('Ad_Clicks')), 'clicks'],
                    [sequelize.fn('SUM', sequelize.col('Ad_sales')), 'sales'],
                    [sequelize.fn('SUM', sequelize.col('Sales')), 'total_sales'], // Sales (Organic + Ad)
                ],
                group: ['Category', sequelize.fn('DATE', sequelize.col('DATE'))],
                order: [['Category', 'ASC'], [sequelize.fn('DATE', sequelize.col('DATE')), 'ASC']],
                raw: true
            });

            return dailyData;

        } catch (error) {
            console.error("Error in getFormatPerformance:", error);
            throw error;
        }
    },

    /**
     * Get distinct zones, optionally filtered by brand
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

            const zones = await TbZeptoAdsKeywordData.findAll({
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
    }
};

export default performanceMarketingService;
