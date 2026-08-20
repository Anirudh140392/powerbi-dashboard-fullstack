import * as pricingAnalysisService from '../services/pricingAnalysisService.js';

import ecpByBrandService from '../services/ecpByBrandService.js';
import discountTrendService from '../services/discountTrendService.js';
import brandPriceOverviewService from '../services/brandPriceOverviewService.js';
import brandDiscountTrendService from '../services/brandDiscountTrendService.js';
import ecpByCityService from '../services/ecpByCityService.js';


/**
 * Get ECP and Discount data grouped by City and Brand
 * Endpoint: GET /api/pricing-analysis/ecp-by-city
 * Query params: platform, startDate, endDate, city, brand
 */
export const getEcpByCity = async (req, res) => {
    try {
        const filters = {
            platform: req.query.platform,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            city: req.query.city,
            brand: req.query.brand,
            sapCode: req.query.sapCode || req.query['sapCode[]'],
            skuCode: req.query.skuCode || req.query['skuCode[]'] || req.query.sapCode || req.query['sapCode[]'],
            msl: req.query.msl
        };

        console.log("[PricingAnalysisController] getEcpByCity called with filters:", filters);

        const result = await ecpByCityService.getEcpByCity(filters);

        res.json(result);
    } catch (error) {
        console.error('[PricingAnalysisController] Error in getEcpByCity:', error);
        res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: error.message
        });
    }
};

/**
 * Get Pricing KPIs
 * Endpoint: GET /api/pricing-analysis/kpis
 */
export const getPricingKpis = async (req, res) => {
    try {
        const filters = {
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            compareStartDate: req.query.compareStartDate,
            compareEndDate: req.query.compareEndDate,
            platform: req.query.platform,
            location: req.query.location,
            brand: req.query.brand,
            category: req.query.category,
            channel: req.query.channel,
            sku: req.query.sku,
            sapCode: req.query.sapCode || req.query['sapCode[]'],
            skuCode: req.query.skuCode || req.query['skuCode[]'] || req.query.sapCode || req.query['sapCode[]'],
            msl: req.query.msl
        };

        console.log("[PricingAnalysisController] getPricingKpis called with filters:", filters);

        const result = await pricingAnalysisService.getPricingKpis(filters);

        res.json(result);
    } catch (error) {
        console.error('[PricingAnalysisController] Error in getPricingKpis:', error);
        res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: error.message
        });
    }
};

/**
 * Get Pricing Insights
 * Endpoint: GET /api/pricing-analysis/insights
 */
export const getPricingInsights = async (req, res) => {
    try {
        const filters = {
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            compareStartDate: req.query.compareStartDate,
            compareEndDate: req.query.compareEndDate,
            platform: req.query.platform,
            location: req.query.location,
            brand: req.query.brand,
            category: req.query.category,
            channel: req.query.channel,
            sku: req.query.sku,
            sapCode: req.query.sapCode || req.query['sapCode[]'],
            skuCode: req.query.skuCode || req.query['skuCode[]'] || req.query.sapCode || req.query['sapCode[]'],
            msl: req.query.msl
        };

        console.log("[PricingAnalysisController] getPricingInsights called with filters:", filters);

        const result = await pricingAnalysisService.getPricingInsights(filters);

        res.json(result);
    } catch (error) {
        console.error('[PricingAnalysisController] Error in getPricingInsights:', error);
        res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: error.message
        });
    }
};

/**
 * Get Pricing Dimension Overview
 * Endpoint: GET /api/pricing-analysis/dimension-overview
 */
export const getDimensionOverview = async (req, res) => {
    try {
        const filters = {
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            compareStartDate: req.query.compareStartDate,
            compareEndDate: req.query.compareEndDate,
            platform: req.query.platform,
            location: req.query.location,
            brand: req.query.brand,
            category: req.query.category,
            channel: req.query.channel,
            dimension: req.query.dimension,
            sku: req.query.sku,
            sapCode: req.query.sapCode || req.query['sapCode[]'],
            skuCode: req.query.skuCode || req.query['skuCode[]'],
            msl: req.query.msl,
            grammage: req.query.grammage
        };

        console.log("[PricingAnalysisController] getDimensionOverview called with filters:", filters);

        const result = await pricingAnalysisService.getDimensionOverview(filters);

        res.json(result);
    } catch (error) {
        console.error('[PricingAnalysisController] Error in getDimensionOverview:', error);
        res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: error.message
        });
    }
};

/**
 * Get ECP Comparison between two time periods
 * Endpoint: GET /api/pricing-analysis/ecp-comparison
 * Query params: platform, location, startDate, endDate, compareStartDate, compareEndDate
 */
export const getEcpComparison = async (req, res) => {
    try {
        const filters = {
            platform: req.query.platform,
            location: req.query.location,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            compareStartDate: req.query.compareStartDate,
            compareEndDate: req.query.compareEndDate,
            channel: req.query.channel,
            sapCode: req.query.sapCode || req.query['sapCode[]'],
            skuCode: req.query.skuCode || req.query['skuCode[]'] || req.query.sapCode || req.query['sapCode[]'],
            msl: req.query.msl
        };

        console.log("[PricingAnalysisController] getEcpComparison called with filters:", filters);

        const result = await pricingAnalysisService.getEcpComparison(filters);

        res.json(result);
    } catch (error) {
        console.error('[PricingAnalysisController] Error in getEcpComparison:', error);
        res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: error.message
        });
    }
};

/**
 * Get ECP by Brand data
 * Endpoint: GET /api/pricing-analysis/ecp-by-brand
 * Query params: platform, location, startDate, endDate
 */
export const getEcpByBrand = async (req, res) => {
    try {
        const filters = {
            platform: req.query.platform,
            location: req.query.location,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            sapCode: req.query.sapCode || req.query['sapCode[]'],
            skuCode: req.query.skuCode || req.query['skuCode[]'] || req.query.sapCode || req.query['sapCode[]'],
            msl: req.query.msl
        };

        console.log("[PricingAnalysisController] getEcpByBrand called with filters:", filters);

        const result = await ecpByBrandService.getEcpByBrand(filters);

        res.json(result);
    } catch (error) {
        console.error('[PricingAnalysisController] Error in getEcpByBrand:', error);
        res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: error.message
        });
    }
};

/**
 * Get average discount by Category per Platform
 * Endpoint: GET /api/pricing-analysis/discount-by-category
 * Query params: startDate, endDate
 */
export const getDiscountByCategory = async (req, res) => {
    try {
        const filters = {
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            metricType: req.query.metricType,
            platform: req.query.platform,
            brand: req.query.brand,
            category: req.query.category,
            format: req.query.format,
            city: req.query.city,
            sapCode: req.query.sapCode || req.query['sapCode[]'],
            skuCode: req.query.skuCode || req.query['skuCode[]'] || req.query.sapCode || req.query['sapCode[]'],
            msl: req.query.msl
        };

        console.log("[PricingAnalysisController] getDiscountByCategory called with filters:", filters);

        const result = await discountTrendService.getDiscountByCategory(filters);

        res.json(result);
    } catch (error) {
        console.error('[PricingAnalysisController] Error in getDiscountByCategory:', error);
        res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: error.message
        });
    }
};

/**
 * Get average discount by Brand within a Category per Platform
 * Endpoint: GET /api/pricing-analysis/discount-by-brand
 * Query params: category, startDate, endDate, metricType, platform, brand, city
 */
export const getDiscountByBrand = async (req, res) => {
    try {
        const filters = {
            category: req.query.category,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            metricType: req.query.metricType,
            platform: req.query.platform,
            brand: req.query.brand,
            city: req.query.city,
            sapCode: req.query.sapCode || req.query['sapCode[]'],
            skuCode: req.query.skuCode || req.query['skuCode[]'] || req.query.sapCode || req.query['sapCode[]'],
            msl: req.query.msl
        };

        console.log("[PricingAnalysisController] getDiscountByBrand called with filters:", filters);

        const result = await discountTrendService.getDiscountByBrand(filters);

        res.json(result);
    } catch (error) {
        console.error('[PricingAnalysisController] Error in getDiscountByBrand:', error);
        res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: error.message
        });
    }
};

/**
 * Get ECP by Brand split by Weekday vs Weekend
 * Endpoint: GET /api/pricing-analysis/ecp-weekday-weekend
 * Query params: platform, location, startDate, endDate, brand
 */
import ecpWeekdayWeekendService from '../services/ecpWeekdayWeekendService.js';

export const getEcpWeekdayWeekend = async (req, res) => {
    try {
        const filters = {
            platform: req.query.platform,
            location: req.query.location,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            brand: req.query.brand,
            msl: req.query.msl
        };

        console.log("[PricingAnalysisController] getEcpWeekdayWeekend called with filters:", filters);

        const result = await ecpWeekdayWeekendService.getEcpWeekdayWeekend(filters);

        res.json(result);
    } catch (error) {
        console.error('[PricingAnalysisController] Error in getEcpWeekdayWeekend:', error);
        res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: error.message
        });
    }
};

/**
 * Get Brand Price Overview data
 * Returns ECP grouped by Brand, Platform, and Gram Size
 * Endpoint: GET /api/pricing-analysis/brand-price-overview
 * Query params: startDate, endDate, platform
 */
export const getBrandPriceOverview = async (req, res) => {
    try {
        const filters = {
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            platform: req.query.platform,
            sapCode: req.query.sapCode || req.query['sapCode[]'],
            skuCode: req.query.skuCode || req.query['skuCode[]'] || req.query.sapCode || req.query['sapCode[]'],
            msl: req.query.msl
        };

        console.log("[PricingAnalysisController] getBrandPriceOverview called with filters:", filters);

        const result = await brandPriceOverviewService.getBrandPriceOverview(filters);

        res.json(result);
    } catch (error) {
        console.error('[PricingAnalysisController] Error in getBrandPriceOverview:', error);
        res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: error.message
        });
    }
};

/**
 * Get Brand Discount Trend data on monthly basis
 * Returns brand-wise average discount grouped by month for chart display
 * Endpoint: GET /api/pricing-analysis/brand-discount-trend
 * Query params: startDate, endDate, platform
 */
export const getBrandDiscountTrend = async (req, res) => {
    try {
        const filters = {
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            platform: req.query.platform,
            sapCode: req.query.sapCode || req.query['sapCode[]'],
            skuCode: req.query.skuCode || req.query['skuCode[]'] || req.query.sapCode || req.query['sapCode[]'],
            msl: req.query.msl
        };

        console.log("[PricingAnalysisController] getBrandDiscountTrend called with filters:", filters);

        const result = await brandDiscountTrendService.getBrandDiscountTrend(filters);

        res.json(result);
    } catch (error) {
        console.error('[PricingAnalysisController] Error in getBrandDiscountTrend:', error);
        res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: error.message
        });
    }
};
/**
 * Get Pricing Dimension Trends (time-series)
 * Endpoint: GET /api/pricing-analysis/dimension-trends
 * Query params: dimension, dimensionValue, timeStep, period, startDate, endDate, platform, brand, location, category
 */
export const getDimensionTrends = async (req, res) => {
    try {
        const filters = {
            dimension: req.query.dimension,
            dimensionValue: req.query.dimensionValue,
            timeStep: req.query.timeStep,
            period: req.query.period,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            platform: req.query.platform,
            location: req.query.location,
            brand: req.query.brand,
            category: req.query.category,
            channel: req.query.channel,
            sku: req.query.sku || req.query.skuName,
            msl: req.query.msl
        };

        console.log("[PricingAnalysisController] getDimensionTrends called with filters:", filters);

        const result = await pricingAnalysisService.getDimensionTrends(filters);
        res.json(result);
    } catch (error) {
        console.error('[PricingAnalysisController] Error in getDimensionTrends:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error', message: error.message });
    }
};

/**
 * Get Pricing Competition Trends Data
 * Endpoint: GET /api/pricing-analysis/competition-trends
 */
export const getPricingCompetitionTrends = async (req, res) => {
    try {
        const filters = {
            mode: req.query.mode,
            targets: req.query.targets,
            dimension: req.query.dimension,
            dimensionValue: req.query.dimensionValue,
            period: req.query.period,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            platform: req.query.platform,
            location: req.query.location,
            brand: req.query.brand,
            category: req.query.category,
            channel: req.query.channel,
            msl: req.query.msl
        };

        console.log("[PricingAnalysisController] getPricingCompetitionTrends called with filters:", filters);

        const result = await pricingAnalysisService.getPricingCompetitionTrends(filters);
        res.json(result);
    } catch (error) {
        console.error('[PricingAnalysisController] Error in getPricingCompetitionTrends:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error', message: error.message });
    }
};

/**
 * Get Pricing Competition Data (Brand-level and SKU-level pricing metrics)
 * Endpoint: GET /api/pricing-analysis/competition
 */
export const getPricingCompetition = async (req, res) => {
    try {
        const filters = {
            dimension: req.query.dimension,
            dimensionValue: req.query.dimensionValue,
            period: req.query.period,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            platform: req.query.platform,
            location: req.query.location,
            brand: req.query.brand,
            category: req.query.category,
            channel: req.query.channel,
            msl: req.query.msl
        };

        console.log("[PricingAnalysisController] getPricingCompetition called with filters:", filters);

        const result = await pricingAnalysisService.getPricingCompetition(filters);
        res.json(result);
    } catch (error) {
        console.error('[PricingAnalysisController] Error in getPricingCompetition:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error', message: error.message });
    }
};

export const getPricingPlatforms = async (req, res) => {
    try {
        const { channel } = req.query;
        const platforms = await pricingAnalysisService.getPricingPlatforms(channel);
        res.json(platforms);
    } catch (error) {
        console.error('Error fetching pricing platforms:', error);
        res.json([]);
    }
};

export const getPricingChannels = async (req, res) => {
    try {
        const channels = await pricingAnalysisService.getPricingChannels();
        res.json(channels);
    } catch (error) {
        console.error('Error fetching pricing channels:', error);
        res.json([]);
    }
};
