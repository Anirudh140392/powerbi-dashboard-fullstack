/**
 * Compare SKU Controller
 * Handles API requests for the Compare SKU feature.
 */
import compareSkuService from '../services/compareSkuService.js';

export const getCompareSkuDateRange = async (req, res) => {
    try {
        const data = await compareSkuService.getCompareSkuDateRange();
        res.json(data);
    } catch (error) {
        console.error('[getCompareSkuDateRange] Error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};

export const getCompareSkuFilters = async (req, res) => {
    try {
        const data = await compareSkuService.getCompareSkuFilters();
        res.json(data);
    } catch (error) {
        console.error('[getCompareSkuFilters] Error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};

export const getCompareSkuProducts = async (req, res) => {
    try {
        const filters = {
            platform: req.query.platform || req.query['platform[]'],
            brand: req.query.brand || req.query['brand[]'],
            category: req.query.category || req.query['category[]'],
            search: req.query.search,
            page: req.query.page || 1,
            limit: req.query.limit || 60,
            minAsp: req.query.minAsp,
            maxAsp: req.query.maxAsp,
            location: req.query.location || req.query['location[]'],
            locations: req.query.locations || req.query['locations[]']
        };
        const data = await compareSkuService.getCompareSkuProducts(filters);
        res.json(data);
    } catch (error) {
        console.error('[getCompareSkuProducts] Error:', error);
        res.json({ products: [], total: 0, page: 1, limit: 60 });
    }
};

export const getCompareSkuMetrics = async (req, res) => {
    try {
        const filters = {
            skuNames: req.query.skuNames || req.query['skuNames[]'],
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            months: req.query.months || 1,
            platforms: req.query.platforms || req.query['platforms[]'],
            brands: req.query.brands || req.query['brands[]'],
            categories: req.query.categories || req.query['categories[]'],
            locations: req.query.locations || req.query['locations[]'],
        };
        const data = await compareSkuService.getCompareSkuMetrics(filters);
        res.json(data);
    } catch (error) {
        console.error('[getCompareSkuMetrics] Error:', error);
        res.json({ skus: [] });
    }
};

export const getCompareSkuTrend = async (req, res) => {
    try {
        const filters = {
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            metricId: req.query.metricId,
            skuNames: req.query.skuNames || req.query['skuNames[]'],
            platforms: req.query.platforms || req.query['platforms[]'],
            brands: req.query.brands || req.query['brands[]'],
            categories: req.query.categories || req.query['categories[]'],
            locations: req.query.locations || req.query['locations[]'],
        };
        const data = await compareSkuService.getCompareSkuTrend(filters);
        res.json(data);
    } catch (error) {
        console.error('[getCompareSkuTrend] Error:', error);
        res.json({ trendData: [], brands: [], summary: {} });
    }
};
