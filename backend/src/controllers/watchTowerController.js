import watchTowerService from '../services/watchTowerService.js';
import RbPdpOlap from '../models/RbPdpOlap.js';
import TbZeptoInventoryData from '../models/TbZeptoInventoryData.js';
import { Op } from 'sequelize';
import sequelize from '../config/db.js';

export const watchTowerOverview = async (req, res) => {
    {
        try {
            const filters = req.query;
            console.log("watch tower api call received", filters);
            const data = await watchTowerService.getSummaryMetrics(filters);
            res.json(data);
        } catch (error) {
            console.error('Error fetching summary metrics:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}

export const getTrendData = async (req, res) => {
    try {
        // UPDATED: Extract all 4 filter keys with default values
        const filters = {
            platform: req.query.platform || "All",
            location: req.query.location || "All",
            brand: req.query.brand || "All",
            category: req.query.category || "All",
            period: req.query.period,
            timeStep: req.query.timeStep,
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };
        console.log("trend data api call received", filters);
        const data = await watchTowerService.getTrendData(filters);
        res.json(data);
    } catch (error) {
        console.error('Error fetching trend data:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getLatestAvailableMonth = async (req, res) => {
    try {
        const filters = req.query;
        const latest = await watchTowerService.getLatestAvailableMonth(filters);

        if (!latest?.available) {
            return res.status(404).json({
                available: false,
                message: 'No data months available for the provided filters'
            });
        }

        res.json(latest);
    } catch (error) {
        console.error('Error fetching latest available month:', error);
        res.status(500).json({ available: false, error: 'Internal Server Error' });
    }
};

export const getPlatforms = async (req, res) => {
    try {
        const platforms = await watchTowerService.getPlatforms();
        res.json(platforms);
    } catch (error) {
        console.error('Error fetching platforms:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getBrands = async (req, res) => {
    try {
        const { platform, includeCompetitors } = req.query;
        // Convert string 'true' to boolean true
        const shouldIncludeCompetitors = includeCompetitors === 'true';
        const brands = await watchTowerService.getBrands(platform, shouldIncludeCompetitors);
        res.json(brands);
    } catch (error) {
        console.error('Error fetching brands:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getKeywords = async (req, res) => {
    try {
        const { brand } = req.query;
        const keywords = await watchTowerService.getKeywords(brand);
        res.json(keywords);
    } catch (error) {
        console.error('Error fetching keywords:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getLocations = async (req, res) => {
    try {
        const { platform, brand, includeCompetitors } = req.query;
        // Convert string 'true' to boolean true
        const shouldIncludeCompetitors = includeCompetitors === 'true';
        const locations = await watchTowerService.getLocations(platform, brand, shouldIncludeCompetitors);
        res.json(locations);
    } catch (error) {
        console.error('Error fetching locations:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getBrandCategories = async (req, res) => {
    try {
        const { platform } = req.query;
        const categories = await watchTowerService.getBrandCategories(platform);
        res.json(categories);
    } catch (error) {
        console.error('Error fetching brand categories:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getMetrics = async (req, res) => {
    try {
        const { getAllMetricKeys } = await import('../services/keyMetricsService.js');
        const metrics = await getAllMetricKeys();
        res.json(metrics);
    } catch (error) {
        console.error('Error fetching metrics:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


export const debugAvailability = async (req, res) => {
    try {
        const { brand, location, platform, startDate, endDate } = req.query;

        const results = {};

        // 1. Check Brand Matches
        if (brand) {
            results.brandExact = await RbPdpOlap.count({ where: { Brand: brand } });
            results.brandLike = await RbPdpOlap.count({ where: { Brand: { [Op.like]: `%${brand}%` } } });
            results.brandSamples = await RbPdpOlap.findAll({
                attributes: [[sequelize.fn('DISTINCT', sequelize.col('Brand')), 'Brand']],
                where: { Brand: { [Op.like]: `%${brand}%` } },
                raw: true
            });
        }

        // 2. Check Location Matches
        if (location) {
            results.locationExact = await RbPdpOlap.count({ where: { Location: location } });
            results.locationLike = await RbPdpOlap.count({ where: { Location: { [Op.like]: `%${location}%` } } });
            results.locationSamples = await RbPdpOlap.findAll({
                attributes: [[sequelize.fn('DISTINCT', sequelize.col('Location')), 'Location']],
                where: { Location: { [Op.like]: `%${location}%` } },
                raw: true
            });
        }

        // 3. Check Platform Matches
        if (platform) {
            results.platformExact = await RbPdpOlap.count({ where: { Platform: platform } });
        }
        results.platformSamples = await RbPdpOlap.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('Platform')), 'Platform']],
            raw: true
        });

        // 4. Combined Check
        const where = {};
        if (brand) where.Brand = { [Op.like]: `%${brand}%` };
        if (location) where.Location = { [Op.like]: `%${location}%` }; // Try loose match for location too
        if (platform) where.Platform = platform;

        results.combinedCount = await RbPdpOlap.count({ where });

        // 5. Data with Date
        if (startDate && endDate) {
            where.DATE = { [Op.between]: [new Date(startDate), new Date(endDate)] };
            results.combinedWithDateCount = await RbPdpOlap.count({ where });

            // Get a sample record
            results.sampleRecord = await RbPdpOlap.findOne({ where, raw: true });
        }

        // 6. Get All Distinct Brands and Locations (Limit 10) - REMOVED
        // results.allBrands = ...
        // results.allLocations = ...

        // 7. Check TbZeptoInventoryData
        if (brand && location) {
            results.zeptoInventoryCount = await TbZeptoInventoryData.count({
                where: {
                    brand_name: brand,
                    city: location
                }
            });
            results.zeptoInventorySample = await TbZeptoInventoryData.findOne({
                where: {
                    brand_name: brand,
                    city: location
                },
                raw: true
            });
        }

        res.json(results);
    } catch (error) {
        console.error('Debug Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ==================== NEW: Dedicated Section Endpoints ====================

/**
 * Get Overview Data (topMetrics, summaryMetrics, performanceMetricsKpis)
 */
export const getOverview = async (req, res) => {
    try {
        const filters = req.query;
        console.log('[getOverview] API call received with filters:', filters);
        const data = await watchTowerService.getOverview(filters);
        res.json(data);
    } catch (error) {
        console.error('Error fetching overview:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Get Performance Metrics KPIs (Share of Search, ROAS, Conversion, etc.)
 */
export const getPerformanceMetrics = async (req, res) => {
    try {
        const filters = req.query;
        console.log('[getPerformanceMetrics] API call received with filters:', filters);
        const data = await watchTowerService.getPerformanceMetrics(filters);
        res.json(data);
    } catch (error) {
        console.error('Error fetching performance metrics:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Get Platform Overview Data
 */
export const getPlatformOverview = async (req, res) => {
    try {
        const filters = req.query;
        console.log('[getPlatformOverview] API call received with filters:', filters);
        const data = await watchTowerService.getPlatformOverview(filters);
        res.json(data);
    } catch (error) {
        console.error('Error fetching platform overview:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Get Month Overview Data
 */
export const getMonthOverview = async (req, res) => {
    try {
        const filters = req.query;
        console.log('[getMonthOverview] API call received with filters:', filters);
        const data = await watchTowerService.getMonthOverview(filters);
        res.json(data);
    } catch (error) {
        console.error('Error fetching month overview:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Get Category Overview Data
 */
export const getCategoryOverview = async (req, res) => {
    try {
        const filters = req.query;
        console.log('[getCategoryOverview] API call received with filters:', filters);
        const data = await watchTowerService.getCategoryOverview(filters);
        res.json(data);
    } catch (error) {
        console.error('Error fetching category overview:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Get Brands Overview Data
 */
export const getBrandsOverview = async (req, res) => {
    try {
        const filters = req.query;
        console.log('[getBrandsOverview] API call received with filters:', filters);
        const data = await watchTowerService.getBrandsOverview(filters);
        res.json(data);
    } catch (error) {
        console.error('Error fetching brands overview:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Get KPI Trends Data for Performance Metrics
 */
export const getKpiTrends = async (req, res) => {
    try {
        // UPDATED: Extract all 4 filter keys with default values
        const filters = {
            platform: req.query.platform || "All",
            location: req.query.location || "All",
            brand: req.query.brand || "All",
            category: req.query.category || "All",
            period: req.query.period,
            timeStep: req.query.timeStep,
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };
        console.log('[getKpiTrends] API call received with filters:', filters);
        const data = await watchTowerService.getKpiTrends(filters);
        res.json(data);
    } catch (error) {
        console.error('Error fetching KPI trends:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Get dynamic filter options for trends drawer
 */
export const getTrendsFilterOptions = async (req, res) => {
    try {
        const { filterType, platform, brand } = req.query;
        console.log('[getTrendsFilterOptions] API call for:', { filterType, platform, brand });
        const data = await watchTowerService.getTrendsFilterOptions({ filterType, platform, brand });
        res.json(data);
    } catch (error) {
        console.error('[getTrendsFilterOptions] Error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};

/**
 * Get competition brand data
 * GET /api/watchtower/competition
 * Query params: platform, location, category, period
 */
export const getCompetition = async (req, res) => {
    try {
        const filters = {
            platform: req.query.platform || 'All',
            location: req.query.location || 'All',
            category: req.query.category || 'All',
            brand: req.query.brand || 'All',  // FIXED: Added missing brand parameter
            sku: req.query.sku || 'All',      // FIXED: Added missing sku parameter
            period: req.query.period || '1M'
        };

        console.log('[getCompetition] Request:', filters);

        const data = await watchTowerService.getCompetitionData(filters);
        res.json(data);
    } catch (error) {
        console.error('[getCompetition] Error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};

/**
 * Get competition filter options (locations and categories)
 * GET /api/watchtower/competition-filter-options
 */
export const getCompetitionFilterOptions = async (req, res) => {
    try {
        const { location, category, brand } = req.query;
        console.log('[getCompetitionFilterOptions] API call with:', { location, category, brand });

        const data = await watchTowerService.getCompetitionFilterOptions({
            location,
            category,
            brand
        });

        res.json(data);
    } catch (error) {
        console.error('[getCompetitionFilterOptions] Error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};

/**
 * Get multi-brand KPI trends for Competition page
 * GET /api/watchtower/competition-brand-trends
 */
export const getCompetitionBrandTrends = async (req, res) => {
    try {
        const { brands, location, category, period } = req.query;
        console.log('[getCompetitionBrandTrends] Request:', { brands, location, category, period });

        const data = await watchTowerService.getCompetitionBrandTrends({
            brands,
            location,
            category,
            period
        });

        res.json(data);
    } catch (error) {
        console.error('[getCompetitionBrandTrends] Error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};

