import TbZeptoBrandSalesAnalytics from '../models/TbZeptoBrandSalesAnalytics.js';
import ZeptoMarketShare from '../models/ZeptoMarketShare.js';
import { Op, Sequelize } from 'sequelize';
import dayjs from 'dayjs';

const getSummaryMetrics = async (filters) => {
    try {
        console.log("Processing Watch Tower request for Zepto with filters:", filters);

        const { months = 1 } = filters;
        const monthsBack = parseInt(months, 10) || 1;

        // Calculate date range
        const endDate = dayjs();
        const startDate = endDate.subtract(monthsBack, 'month');

        console.log(`Date Range: ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}`);

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

        // 1. Total Offtake (GMV) & Chart Data
        const offtakeData = await TbZeptoBrandSalesAnalytics.findAll({
            attributes: [
                [Sequelize.fn('DATE_FORMAT', Sequelize.col('sales_date'), '%Y-%m-01'), 'month_date'],
                [Sequelize.fn('SUM', Sequelize.col('gmv')), 'total_gmv']
            ],
            where: {
                sales_date: {
                    [Op.between]: [startDate.toDate(), endDate.toDate()]
                }
            },
            group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('sales_date'), '%Y-%m-01')],
            raw: true
        });

        // Map Offtake to Buckets
        const offtakeChart = monthBuckets.map(bucket => {
            const match = offtakeData.find(d => dayjs(d.month_date).isSame(dayjs(bucket.date), 'month'));
            return match ? parseFloat(match.total_gmv) / 10000000 : 0; // Convert to Cr
        });

        const totalOfftake = offtakeData.reduce((sum, d) => sum + parseFloat(d.total_gmv), 0);
        const formattedOfftake = (totalOfftake / 10000000).toFixed(2) + " Cr";

        // 2. Total Market Share & Chart Data
        const marketShareData = await ZeptoMarketShare.findAll({
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
        });

        // Map Market Share to Buckets
        const marketShareChart = monthBuckets.map(bucket => {
            const match = marketShareData.find(d => dayjs(d.month_date).isSame(dayjs(bucket.date), 'month'));
            return match ? parseFloat(match.avg_market_share) : 0;
        });

        // Calculate overall average from the monthly averages (weighted by days would be better but simple average of months is likely expected or average of all rows)
        // Actually, to get true average over the period, we should query without group by, OR average the monthly averages if that's the intent. 
        // But usually "Average Market Share" for a period is the average of all data points in that period.

        // Let's do a separate query for the total average to be precise, or just average the rows if we want average of daily/granular data.
        // The previous implementation for total was:
        /*
        const totalMarketShareResult = await ZeptoMarketShare.findOne({
            attributes: [
                [Sequelize.fn('SUM', Sequelize.col('market_share')), 'total_market_share']
            ],
            ...
        */
        // I will change that one too.

        const totalMarketShareResult = await ZeptoMarketShare.findOne({
            attributes: [
                [Sequelize.fn('AVG', Sequelize.col('market_share')), 'avg_market_share']
            ],
            where: {
                created_on: {
                    [Op.between]: [startDate.toDate(), endDate.toDate()]
                }
            },
            raw: true
        });

        const totalMarketShare = totalMarketShareResult?.avg_market_share || 0;
        const formattedMarketShare = parseFloat(totalMarketShare).toFixed(1) + "%";

        // 3. Top SKUs by GMV
        const topSkus = await TbZeptoBrandSalesAnalytics.findAll({
            attributes: [
                'sku_name',
                [Sequelize.fn('SUM', Sequelize.col('gmv')), 'sku_gmv']
            ],
            where: {
                sales_date: {
                    [Op.between]: [startDate.toDate(), endDate.toDate()]
                }
            },
            group: ['sku_name'],
            order: [[Sequelize.literal('sku_gmv'), 'DESC']],
            limit: 10,
            raw: true
        });

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
                stockAvailability: "0%", // Placeholder
                stockAvailabilityTrend: "0%", // Placeholder
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
                    label: "0%",
                    subtitle: "MTD Coverage",
                    trend: "0%",
                    trendType: "neutral",
                    comparison: "vs Previous Month",
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

export default {
    getSummaryMetrics,
};
