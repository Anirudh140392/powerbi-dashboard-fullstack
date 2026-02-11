import watchTowerService from '../services/watchTowerService.js';

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
            channel: req.query.channel,
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
        // Metric keys are no longer used with ClickHouse - return empty array
        // If metric keys are needed in the future, migrate keyMetricsService to ClickHouse
        res.json([]);
    } catch (error) {
        console.error('Error fetching metrics:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


export const debugAvailability = async (req, res) => {
    // Debug endpoint deprecated - system now uses ClickHouse only
    // To debug, use ClickHouse client directly or create a new ClickHouse-based debug endpoint
    res.json({
        message: 'Debug endpoint disabled - system migrated to ClickHouse',
        suggestion: 'Use ClickHouse client or create a ClickHouse-based debug query'
    });
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
            channel: req.query.channel,
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
            brand: req.query.brand || 'All',
            sku: req.query.sku || 'All',
            channel: req.query.channel,
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
        const { platform, location, category, brand } = req.query;
        console.log('[getCompetitionFilterOptions] API call with:', { platform, location, category, brand });
        const data = await watchTowerService.getCompetitionFilterOptions({
            platform: platform || 'All',
            location: location || 'All',
            category: category || 'All',
            brand: brand || 'All'
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

/**
 * Get Dark Store Count from rb_location_darkstore table
 * GET /api/watchtower/dark-store-count
 */
export const getDarkStoreCount = async (req, res) => {
    try {
        const filters = {
            platform: req.query.platform || 'All',
            location: req.query.location || 'All',
            channel: req.query.channel,
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };

        console.log('[getDarkStoreCount] Request:', filters);
        const data = await watchTowerService.getDarkStoreCount(filters);
        res.json(data);
    } catch (error) {
        console.error('[getDarkStoreCount] Error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};
/**
 * Get Top Actions counts (Store count and SKU count)
 * GET /api/watchtower/top-actions
 */
export const getTopActions = async (req, res) => {
    try {
        const filters = {
            platform: req.query.platform || 'All',
            location: req.query.location || 'All',
            channel: req.query.channel,
            endDate: req.query.endDate
        };

        console.log('[getTopActions] Request:', filters);
        const data = await watchTowerService.getTopActions(filters);
        res.json(data);
    } catch (error) {
        console.error('[getTopActions] Error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};/**
 * Get OSA Deep Dive table data
 * GET /api/watchtower/osa-deep-dive
 */
export const getOsaDeepDive = async (req, res) => {
    try {
        const filters = {
            platform: req.query.platform || 'All',
            location: req.query.location || 'All',
            channel: req.query.channel,
            endDate: req.query.endDate
        };

        console.log('[getOsaDeepDive] Request:', filters);
        const data = await watchTowerService.getOsaDeepDive(filters);
        res.json(data);
    } catch (error) {
        console.error('[getOsaDeepDive] Error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};

/**
 * Get SKU Overview for Performance Matrix
 * GET /api/watchtower/sku-overview
 */
export const getSkuOverview = async (req, res) => {
    try {
        const filters = req.query;
        console.log('[getSkuOverview] API call received with filters:', filters);
        const data = await watchTowerService.getSkuOverview(filters);
        res.json(data);
    } catch (error) {
        console.error('[getSkuOverview] Error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};

/**
 * Get City Overview for Performance Matrix
 * GET /api/watchtower/city-overview
 */
export const getCityOverview = async (req, res) => {
    try {
        const filters = req.query;
        console.log('[getCityOverview] API call received with filters:', filters);
        const data = await watchTowerService.getCityOverview(filters);
        res.json(data);
    } catch (error) {
        console.error('[getCityOverview] Error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};
