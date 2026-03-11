import { getCategorySize, getSubCategoryKpi, getMarketLeaderSales, getMarsWrigleySales, getCrossPlatformOverview, getMarketShareTrends, getMarketShareCompetition, getMarketShareCompetitionFilterOptions, getMarketShareCompetitionTrends, getMarketShareDrilldown } from '../services/marketShareHelper.js';
import dayjs from 'dayjs';

export const Platform = async (req, res) => {
    try {
        const { platform, category, location, startDate, endDate } = req.query;
        console.log("Market Share API request received:", req.query);

        // Use provided dates or default to last 30 days
        const start = startDate ? dayjs(startDate) : dayjs().subtract(30, 'day');
        const end = endDate ? dayjs(endDate) : dayjs();

        // Fetch all KPIs in parallel
        const [categorySize, leaderData, marsData] = await Promise.all([
            getCategorySize(start, end, platform, category, location),
            getMarketLeaderSales(start, end, platform, category, location),
            getMarsWrigleySales(start, end, platform, category, location)
        ]);

        const response = {
            message: "Market Share API called successfully",
            filters: req.query,
            categorySize,
            marketLeader: leaderData,
            marsWrigley: marsData
        };
        console.log("Sending response:", response);

        res.json(response);
    } catch (error) {
        console.error('Error in Market Share:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const SubCategoryKpi = async (req, res) => {
    try {
        const { platform, category, location, startDate, endDate, subCategory } = req.query;
        console.log("Sub-Category KPI request received:", req.query);

        const start = startDate ? dayjs(startDate) : dayjs().subtract(30, 'day');
        const end = endDate ? dayjs(endDate) : dayjs();

        const result = await getSubCategoryKpi(start, end, platform, category, location, subCategory);

        res.json({
            message: "Sub-Category KPI fetched successfully",
            ...result
        });
    } catch (error) {
        console.error('Error in Sub-Category KPI:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const CrossPlatformOverview = async (req, res) => {
    try {
        const { platform, category, location, brand, startDate, endDate } = req.query;
        console.log("Cross Platform Overview request received:", req.query);

        const start = startDate ? dayjs(startDate) : dayjs().subtract(30, 'day');
        const end = endDate ? dayjs(endDate) : dayjs();

        const result = await getCrossPlatformOverview(start, end, platform, category, location, brand);

        res.json({
            message: "Cross Platform Overview fetched successfully",
            platforms: result
        });
    } catch (error) {
        console.error('Error in Cross Platform Overview:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const MarketShareTrends = async (req, res) => {
    try {
        const { period, timeStep, dimension, dimensionValue, startDate, endDate, platform, category, location, brand } = req.query;
        console.log("Market Share Trends request received:", req.query);

        const result = await getMarketShareTrends(
            period, timeStep, dimension, dimensionValue, startDate, endDate,
            platform, category, location, brand
        );

        res.json({
            message: "Market Share Trends fetched successfully",
            ...result
        });
    } catch (error) {
        console.error('Error in Market Share Trends:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const MarketShareCompetition = async (req, res) => {
    try {
        const { period, startDate, endDate, platform, category, location, brand } = req.query;
        console.log("Market Share Competition request received:", req.query);

        const result = await getMarketShareCompetition(
            period, startDate, endDate, platform, category, location, brand
        );

        res.json({
            message: "Market Share Competition fetched successfully",
            ...result
        });
    } catch (error) {
        console.error('Error in Market Share Competition:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const MarketShareCompetitionFilterOptions = async (req, res) => {
    try {
        const { platform, location, category, brand } = req.query;
        console.log("Market Share Filter Options request received:", req.query);

        const result = await getMarketShareCompetitionFilterOptions(platform, location, category, brand);

        res.json({
            message: "Filter options fetched successfully",
            ...result
        });
    } catch (error) {
        console.error('Error fetching market share filter options:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const MarketShareCompetitionTrends = async (req, res) => {
    try {
        const { mode, targets, period, startDate, endDate, platform, category, location } = req.query;
        console.log("Market Share Competition Trends request received:", req.query);

        const result = await getMarketShareCompetitionTrends(
            mode, targets, period, startDate, endDate, platform, category, location
        );

        res.json({
            message: "Market Share Competition Trends fetched successfully",
            ...result
        });
    } catch (error) {
        console.error('Error in Market Share Competition Trends:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const MarketShareDrilldown = async (req, res) => {
    try {
        const { platform, category, location, startDate, endDate } = req.query;
        console.log("Market Share Drilldown request received:", { platform, category, location, startDate, endDate });

        const start = startDate ? dayjs(startDate) : dayjs().subtract(30, 'day');
        const end = endDate ? dayjs(endDate) : dayjs();

        const result = await getMarketShareDrilldown(start, end, platform, category, location);

        console.log(`Market Share Drilldown result items: ${result.length}`);

        res.json({
            message: "Market Share Drilldown fetched successfully",
            drilldownData: result
        });
    } catch (error) {
        console.error('Error in Market Share Drilldown:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};



