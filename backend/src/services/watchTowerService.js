import TbZeptoBrandSalesAnalytics from '../models/TbZeptoBrandSalesAnalytics.js';
import RbPdpOlap from '../models/RbPdpOlap.js';
import RbKw from '../models/RbKw.js';
import ZeptoMarketShare from '../models/ZeptoMarketShare.js';
import { Op, Sequelize } from 'sequelize';
import dayjs from 'dayjs';

const getSummaryMetrics = async (filters) => {
    try {
        console.log("Processing Watch Tower request for Zepto with filters:", filters);

        const { months = 1, startDate: qStartDate, endDate: qEndDate, brand } = filters;
        const monthsBack = parseInt(months, 10) || 1;

        // Calculate date range
        let endDate = dayjs();
        let startDate = endDate.subtract(monthsBack, 'month');

        if (qStartDate && qEndDate) {
            startDate = dayjs(qStartDate);
            endDate = dayjs(qEndDate);
        }

        console.log(`Date Range: ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}`);

        // Build Where Clause for TbZeptoBrandSalesAnalytics
        const whereClause = {
            sales_date: {
                [Op.between]: [startDate.toDate(), endDate.toDate()]
            }
        };

        if (brand) {
            whereClause.brand_name = brand;
        }

        // Helper to generate month buckets
        const generateMonthBuckets = (start, end) => {
            const buckets = [];
            let current = start.clone().startOf('month');
            const endMonth = end.clone().endOf('month');
            while (current.isBefore(endMonth)) {
                buckets.push({
                    label: current.format('MMM'),
                    date: current.toDate(),
                    value: 0
                });
                current = current.add(1, 'month');
            }
            return buckets;
        };

        const monthBuckets = generateMonthBuckets(startDate, endDate);

        // Build Where Clause for RbPdpOlap
        const offtakeWhereClause = {
            DATE: {
                [Op.between]: [startDate.toDate(), endDate.toDate()]
            }
        };

        if (brand) {
            offtakeWhereClause.Brand = brand;
        }

        // Default to Zepto if no platform is selected, or use the selected platform
        const selectedPlatform = filters.platform || 'Zepto';
        offtakeWhereClause.Platform = selectedPlatform;

        // 3. Availability Calculation Helper
        const getAvailability = async (start, end, brandFilter, platformFilter) => {
            const where = {
                DATE: {
                    [Op.between]: [start.toDate(), end.toDate()]
                }
            };
            if (brandFilter) where.Brand = brandFilter;
            if (platformFilter) where.Platform = platformFilter;

            const result = await RbPdpOlap.findOne({
                attributes: [
                    [Sequelize.fn('SUM', Sequelize.col('neno_osa')), 'total_neno'],
                    [Sequelize.fn('SUM', Sequelize.col('deno_osa')), 'total_deno']
                ],
                where: where,
                raw: true
            });

            const totalNeno = parseFloat(result?.total_neno || 0);
            const totalDeno = parseFloat(result?.total_deno || 0);

            return totalDeno > 0 ? (totalNeno / totalDeno) * 100 : 0;
        };

        // Execute queries concurrently
        const [
            offtakeData,
            marketShareData,
            totalMarketShareResult,
            topSkus,
            currentAvailability,
            prevAvailability
        ] = await Promise.all([
            // 1. Total Offtake (Sales) & Chart Data from RbPdpOlap
            RbPdpOlap.findAll({
                attributes: [
                    [Sequelize.fn('DATE_FORMAT', Sequelize.col('DATE'), '%Y-%m-01'), 'month_date'],
                    [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales']
                ],
                where: offtakeWhereClause,
                group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('DATE'), '%Y-%m-01')],
                raw: true
            }),
            // 2. Total Market Share & Chart Data
            ZeptoMarketShare.findAll({
                attributes: [
                    [Sequelize.fn('DATE_FORMAT', Sequelize.col('created_on'), '%Y-%m-01'), 'month_date'],
                    [Sequelize.fn('AVG', Sequelize.col('market_share')), 'avg_market_share']
                ],
                where: {
                    created_on: {
                        [Op.between]: [startDate.toDate(), endDate.toDate()]
                    }
                },
                group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('created_on'), '%Y-%m-01')],
                raw: true
            }),
            // Total Market Share Average
            ZeptoMarketShare.findOne({
                attributes: [
                    [Sequelize.fn('AVG', Sequelize.col('market_share')), 'avg_market_share']
                ],
                where: {
                    created_on: {
                        [Op.between]: [startDate.toDate(), endDate.toDate()]
                    }
                },
                raw: true
            }),
            // 3. Top SKUs by GMV
            TbZeptoBrandSalesAnalytics.findAll({
                attributes: [
                    'sku_name',
                    [Sequelize.fn('SUM', Sequelize.col('gmv')), 'sku_gmv']
                ],
                where: whereClause,
                group: ['sku_name'],
                order: [[Sequelize.literal('sku_gmv'), 'DESC']],
                limit: 10,
                raw: true
            }),
            // 4. Current Availability
            getAvailability(startDate, endDate, brand, selectedPlatform),
            // 5. Previous Availability (if compare dates exist)
            (filters.compareStartDate && filters.compareEndDate)
                ? getAvailability(dayjs(filters.compareStartDate), dayjs(filters.compareEndDate), brand, selectedPlatform)
                : Promise.resolve(0)
        ]);

        // Process Offtake Data
        const offtakeChart = monthBuckets.map(bucket => {
            const match = offtakeData.find(d => dayjs(d.month_date).isSame(dayjs(bucket.date), 'month'));
            return match ? parseFloat(match.total_sales) / 10000000 : 0; // Convert to Cr
        });

        const totalOfftake = offtakeData.reduce((sum, d) => sum + parseFloat(d.total_sales), 0);
        const formattedOfftake = (totalOfftake / 10000000).toFixed(2) + " Cr";

        // Process Market Share Data
        const marketShareChart = monthBuckets.map(bucket => {
            const match = marketShareData.find(d => dayjs(d.month_date).isSame(dayjs(bucket.date), 'month'));
            return match ? parseFloat(match.avg_market_share) : 0;
        });

        const totalMarketShare = totalMarketShareResult?.avg_market_share || 0;
        const formattedMarketShare = parseFloat(totalMarketShare).toFixed(1) + "%";

        // Process Availability Data
        const formattedAvailability = currentAvailability.toFixed(1) + "%";

        // Calculate Previous Availability for Trend
        let availabilityTrend = "0%";
        let availabilityTrendType = "neutral";

        if (filters.compareStartDate && filters.compareEndDate) {
            const diff = currentAvailability - prevAvailability;
            const sign = diff >= 0 ? "+" : "";
            availabilityTrend = `${sign}${diff.toFixed(1)}%`;
            availabilityTrendType = diff >= 0 ? "up" : "down";
        }

        // Map SKUs to frontend format
        const skuTableData = topSkus.map(sku => ({
            sku: sku.sku_name,
            all: { offtake: `₹${(sku.sku_gmv / 100000).toFixed(1)} lac`, trend: "0%" }, // Mock trend for now
            blinkit: { offtake: "NA", trend: "NA" },
            zepto: { offtake: `₹${(sku.sku_gmv / 100000).toFixed(1)} lac`, trend: "0%" },
            instamart: { offtake: "NA", trend: "NA" }
        }));

        // Construct Response
        return {
            summaryMetrics: {
                offtakes: `₹${formattedOfftake}`,
                offtakesTrend: "+0.0%", // Placeholder
                shareOfSearch: "0%", // Placeholder
                shareOfSearchTrend: "0%", // Placeholder
                stockAvailability: formattedAvailability,
                stockAvailabilityTrend: availabilityTrend,
                marketShare: formattedMarketShare,
            },
            topMetrics: [
                {
                    name: "Offtake",
                    label: `₹${formattedOfftake}`,
                    subtitle: `last ${monthsBack} months`,
                    trend: "+0.0%",
                    trendType: "neutral",
                    comparison: "vs Previous Period",
                    units: "",
                    unitsTrend: "",
                    chart: offtakeChart,
                },
                {
                    name: "Availability",
                    label: formattedAvailability,
                    subtitle: "MTD Coverage",
                    trend: availabilityTrend,
                    trendType: availabilityTrendType,
                    comparison: "vs Previous Period",
                    units: "",
                    unitsTrend: "",
                    chart: [],
                },
                {
                    name: "Share of Search",
                    label: "0%",
                    subtitle: "for MTD",
                    trend: "0%",
                    trendType: "neutral",
                    comparison: "vs Previous Month",
                    units: "",
                    unitsTrend: "",
                    chart: [],
                },
                {
                    name: "Market Share",
                    label: formattedMarketShare,
                    subtitle: `last ${monthsBack} months`,
                    trend: "0%",
                    trendType: "neutral",
                    comparison: "vs Previous Period",
                    units: "",
                    unitsTrend: "",
                    chart: marketShareChart,
                },
            ],
            skuTable: skuTableData,
        };

    } catch (error) {
        console.error("Error in watchTowerService:", error);
        throw error;
    }
};

const getBrands = async (platform) => {
    try {
        const where = {};
        if (platform) {
            where.platform_name = platform;
        }

        const brands = await RbKw.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_name')), 'brand_name']],
            where: where,
            raw: true
        });
        return brands.map(b => b.brand_name).filter(Boolean).sort();
    } catch (error) {
        console.error("Error fetching brands:", error);
        throw error;
    }
};

const getKeywords = async (brand) => {
    try {
        const where = {};
        if (brand) {
            where.brand_name = brand;
        }

        const keywords = await RbKw.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('keyword')), 'keyword']],
            where: where,
            raw: true
        });
        return keywords.map(k => k.keyword).filter(Boolean).sort();
    } catch (error) {
        console.error("Error fetching keywords:", error);
        throw error;
    }
};

const getLocations = async (brand) => {
    try {
        const where = {};
        if (brand) {
            where.brand_name = brand;
        }

        const locations = await RbKw.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('location_name')), 'location_name']],
            where: where,
            raw: true
        });
        return locations.map(l => l.location_name).filter(Boolean).sort();
    } catch (error) {
        console.error("Error fetching locations:", error);
        throw error;
    }
};

export default {
    getSummaryMetrics,
    getBrands,
    getKeywords,
    getLocations
};
