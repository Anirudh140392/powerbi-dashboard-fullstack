import pricingAnalysisService from '../services/pricingAnalysisService.js';
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
            brand: req.query.brand
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
 * Get Price and Discount Intelligence metrics
 */
export const PriceAndDiscountIntelligence = async (req, res) => {
    try {
        const filters = req.query;
        console.log("Price & Discount Intelligence api request received", filters);

        const response = {
            message: "Pricing Analysis API called successfully",
            filters: filters
        };
        console.log("Sending response:", response);

        // Mock response for now
        res.json(response);
    } catch (error) {
        console.error('Error in Pricing Analysis:', error);
        res.status(500).json({ error: 'Internal Server Error' });
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
            compareEndDate: req.query.compareEndDate
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
            endDate: req.query.endDate
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
            city: req.query.city
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
            city: req.query.city
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
            brand: req.query.brand
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
            platform: req.query.platform
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
            platform: req.query.platform
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
