import pricingAnalysisService from '../services/pricingAnalysisService.js';
import ecpByBrandService from '../services/ecpByBrandService.js';

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
