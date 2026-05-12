import watchTowerService from '../services/watchTowerService.js';


export const watchTowerOverview = async (req, res) => {
    try {
        const filters = { ...req.query };
        delete filters.location;
        delete filters.cities;
        console.log("watch tower api call received", filters);
        const data = await watchTowerService.getSummaryMetrics(filters);
        res.json(data);
    } catch (error) {
        console.error('Error fetching summary metrics:', error.message, error.stack);
        // Return safe default data on database error to prevent frontend crash
        res.json({
            topMetrics: [
                { name: "Offtake", label: "₹0", subtitle: "No data", trend: "0%", trendType: "neutral", chart: [] },
                { name: "Availability", label: "0%", subtitle: "No data", trend: "0%", trendType: "neutral", chart: [] },
                { name: "Share of Search", label: "0%", subtitle: "No data", trend: "0%", trendType: "neutral", chart: [] },
                { name: "Market Share", label: "0%", subtitle: "No data", trend: "0%", trendType: "neutral", chart: [] },
                { name: "Promo", label: "0%", subtitle: "No data", trend: "+0.0%", trendType: "neutral", chart: [] },
            ],
            summaryMetrics: {
                offtakes: "₹0",
                offtakesTrend: "0%",
                shareOfSearch: "0%",
                shareOfSearchTrend: "0%",
                stockAvailability: "0%",
                stockAvailabilityTrend: "0%",
                marketShare: "0%",
                promo: "0%",
                promoTrend: "+0.0%",
            },
            skuTable: [],
            platformOverview: []
        });
    }
}

export const getTrendData = async (req, res) => {
    try {
        // UPDATED: Extract all 4 filter keys with default values
        const filters = {
            platform: req.query.platform || "All",
            location: req.query.location && req.query.location !== 'All India' ? req.query.location : 'All',
            brand: req.query.brand || "All",
            category: req.query.category || "All",
            channel: req.query.channel,
            period: req.query.period,
            timeStep: req.query.timeStep,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            skuName: req.query.skuName,
            skuCode: req.query.skuCode
        };
        console.log("trend data api call received", filters);
        const data = await watchTowerService.getTrendData(filters);
        res.json(data);
    } catch (error) {
        console.error('Error fetching trend data:', error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
};

export const getLatestAvailableMonth = async (req, res) => {
    try {
        const filters = { ...req.query };
        delete filters.location;
        delete filters.cities;
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
        const { channel } = req.query;
        const platforms = await watchTowerService.getPlatforms(channel);
        res.json(platforms);
    } catch (error) {
        console.error('Error fetching platforms:', error);
        res.json([]);
    }
};

export const getPmPlatforms = async (req, res) => {
    try {
        const platforms = await watchTowerService.getPmPlatforms();
        res.json(platforms);
    } catch (error) {
        console.error('Error fetching PM platforms:', error);
        res.json([]);
    }
};

export const getPlatformChannels = async (req, res) => {
    try {
        const platformChannels = await watchTowerService.getPlatformChannels();
        res.json(platformChannels);
    } catch (error) {
        console.error('Error fetching platform channels:', error);
        res.json([]);
    }
};

export const getPlatformMetadata = async (req, res) => {
    try {
        const metadata = await watchTowerService.getPlatformMetadata();
        res.json(metadata);
    } catch (error) {
        console.error('Error fetching platform metadata:', error);
        res.json([]);
    }
};

export const getChannels = async (req, res) => {
    try {
        const channels = await watchTowerService.getChannels();
        res.json(channels);
    } catch (error) {
        console.error('Error fetching channels:', error);
        res.json([]);
    }
};

export const getPdpPlatforms = async (req, res) => {
    try {
        const platforms = await watchTowerService.getPdpPlatforms();
        res.json(platforms);
    } catch (error) {
        console.error('Error fetching PDP platforms:', error);
        res.json([]);
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
        res.json([]);
    }
};

export const getKeywords = async (req, res) => {
    try {
        const { brand } = req.query;
        const keywords = await watchTowerService.getKeywords(brand);
        res.json(keywords);
    } catch (error) {
        console.error('Error fetching keywords:', error);
        res.json([]);
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
        res.json([]);
    }
};

export const getBrandCategories = async (req, res) => {
    try {
        const { platform } = req.query;
        const categories = await watchTowerService.getBrandCategories(platform);
        res.json(categories);
    } catch (error) {
        console.error('Error fetching brand categories:', error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
};

export const getMetrics = async (req, res) => {
    try {
        // Metric keys are no longer used with ClickHouse - return empty array
        // If metric keys are needed in the future, migrate keyMetricsService to ClickHouse
        res.json([]);
    } catch (error) {
        console.error('Error fetching metrics:', error);
        res.status(500).json({ error: error.message, stack: error.stack });
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
        const filters = { ...req.query };
        delete filters.location;
        delete filters.cities;
        console.log('[getOverview] API call received with filters:', filters);
        const data = await watchTowerService.getOverview(filters);
        res.json(data);
    } catch (error) {
        console.error('Error fetching overview:', error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
};

/**
 * Get Performance Metrics KPIs (Share of Search, ROAS, Conversion, etc.)
 */
export const getPerformanceMetrics = async (req, res) => {
    try {
        const filters = { ...req.query };
        delete filters.location;
        delete filters.cities;
        console.log('[getPerformanceMetrics] API call received with filters:', filters);
        const data = await watchTowerService.getPerformanceMetrics(filters);
        res.json(data);
    } catch (error) {
        console.error('Error fetching performance metrics:', error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
};

/**
 * Get Platform Overview Data
 */
export const getPlatformOverview = async (req, res) => {
    try {
        const filters = { ...req.query };
        delete filters.location;
        delete filters.cities;
        console.log('[getPlatformOverview] API call received with filters:', filters);
        const data = await watchTowerService.getPlatformOverview(filters);
        res.json(data);
    } catch (error) {
        console.error('Error fetching platform overview:', error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
};

/**
 * Get Month Overview Data
 */
export const getMonthOverview = async (req, res) => {
    try {
        const filters = { ...req.query };
        delete filters.location;
        delete filters.cities;
        console.log('[getMonthOverview] API call received with filters:', filters);
        const data = await watchTowerService.getMonthOverview(filters);
        res.json(data);
    } catch (error) {
        console.error('Error fetching month overview:', error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
};

/**
 * Get Category Overview Data
 */
export const getCategoryOverview = async (req, res) => {
    try {
        const filters = { ...req.query };
        delete filters.location;
        delete filters.cities;
        console.log('[getCategoryOverview] API call received with filters:', filters);
        const data = await watchTowerService.getCategoryOverview(filters);
        res.json(data);
    } catch (error) {
        console.error('Error fetching category overview:', error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
};

/**
 * Get Brands Overview Data
 */
export const getBrandsOverview = async (req, res) => {
    try {
        const filters = { ...req.query };
        delete filters.location;
        delete filters.cities;
        console.log('[getBrandsOverview] API call received with filters:', filters);
        const data = await watchTowerService.getBrandsOverview(filters);
        res.json(data);
    } catch (error) {
        console.error('Error fetching brands overview:', error);
        res.status(500).json({ error: error.message, stack: error.stack });
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
            location: req.query.location && req.query.location !== 'All India' ? req.query.location : 'All',
            brand: req.query.brand || "All",
            category: req.query.category || "All",
            channel: req.query.channel,
            period: req.query.period,
            timeStep: req.query.timeStep,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            skuName: req.query.skuName,
            skuCode: req.query.skuCode
        };
        console.log('[getKpiTrends] API call received with filters:', filters);
        const data = await watchTowerService.getKpiTrends(filters);
        res.json(data);
    } catch (error) {
        console.error('Error fetching KPI trends:', error);
        res.status(500).json({ error: error.message, stack: error.stack });
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
            location: req.query.location && req.query.location !== 'All India' ? req.query.location : 'All',
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
        const filters = { ...req.query, ...req.body };
        const { platform, location, category, brand, context } = filters;
        const resolvedLocation = location && location !== 'All India' ? location : 'All';
        console.log('[getCompetitionFilterOptions] API call with:', { platform, location: resolvedLocation, category, brand, context });
        const data = await watchTowerService.getCompetitionFilterOptions({
            platform: platform || 'All',
            location: resolvedLocation,
            category: category || 'All',
            brand: brand || 'All',
            context: context || undefined
        });

        res.json(data);
    } catch (error) {
        console.error('[getCompetitionFilterOptions] Error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};

/**
 * Get multi-brand KPI trends for Competition page
 * GET/POST /api/watchtower/competition-brand-trends
 * POST body supports `skus` as an array (for SKU names containing commas)
 */
export const getCompetitionBrandTrends = async (req, res) => {
    try {
        // Merge query params and body to support both GET and POST
        const params = { ...req.query, ...req.body };
        const { brands, skus, category, period, location, platform, timeStep } = params;
        const resolvedLocation = location && location !== 'All India' ? location : 'All';
        console.log('[getCompetitionBrandTrends] Request:', { brands, skus: Array.isArray(skus) ? `[array:${skus.length}]` : skus, location: resolvedLocation, platform, category, period, timeStep });
        const data = await watchTowerService.getCompetitionBrandTrends({
            brands,
            skus,
            location: resolvedLocation,
            platform: platform || 'All',
            category,
            period,
            timeStep
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
            location: req.query.location && req.query.location !== 'All India' ? req.query.location : 'All',
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
            location: req.query.location && req.query.location !== 'All India' ? req.query.location : 'All',
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
            location: req.query.location && req.query.location !== 'All India' ? req.query.location : 'All',
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
        const filters = { ...req.query };
        delete filters.location;
        delete filters.cities;
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
        const filters = { ...req.query };
        delete filters.location;
        delete filters.cities;
        console.log('[getCityOverview] API call received with filters:', filters);
        const data = await watchTowerService.getCityOverview(filters);
        res.json(data);
    } catch (error) {
        console.error('[getCityOverview] Error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};

/**
 * Get Performance Breakdown table data
 * GET /api/watchtower/performance-breakdown
 */
export const getPerformanceBreakdown = async (req, res) => {
    try {
        const filters = { ...req.query };
        delete filters.location;
        delete filters.cities;
        console.log('[getPerformanceBreakdown] API call received with filters:', filters);
        const data = await watchTowerService.getPerformanceBreakdownData(filters);
        res.json(data);
    } catch (error) {
        console.error('[getPerformanceBreakdown] Error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};

/**
 * Get distinct Product names (SKUs) from rb_pdp_olap
 * GET /api/watchtower/products
 */
export const getProducts = async (req, res) => {
    try {
        const { platform, brand, category } = req.query;
        const products = await watchTowerService.getProducts({ platform, brand, category });
        res.json(products);
    } catch (error) {
        console.error('[getProducts] Error:', error);
        res.json([]);
    }
};

/**
 * Get distinct Product Categories from rb_pdp_olap
 * GET /api/watchtower/product-categories
 */
export const getProductCategories = async (req, res) => {
    try {
        const filters = { ...req.query };
        delete filters.location;
        delete filters.cities;
        const productCategories = await watchTowerService.getProductCategories(filters);
        res.json(productCategories);
    } catch (error) {
        console.error('[getProductCategories] Error:', error.message, error.stack);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
};
