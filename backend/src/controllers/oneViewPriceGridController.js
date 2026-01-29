/**
 * One View Price Grid Controller
 * Handles API requests for date-wise product pricing data
 */

import oneViewPriceGridService from '../services/oneViewPriceGridService.js';

/**
 * Get One View Price Grid data
 * Endpoint: GET /api/pricing-analysis/one-view-price-grid
 * Query params: startDate, endDate, platform, brand, product, skuType, format, ml
 */
export const getOneViewPriceGrid = async (req, res) => {
    try {
        const filters = {
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            platform: req.query.platform,
            brand: req.query.brand,
            product: req.query.product,
            skuType: req.query.skuType,
            format: req.query.format,
            ml: req.query.ml
        };

        console.log("[OneViewPriceGridController] getOneViewPriceGrid called with filters:", filters);

        const result = await oneViewPriceGridService.getOneViewPriceGrid(filters);

        res.json(result);
    } catch (error) {
        console.error('[OneViewPriceGridController] Error in getOneViewPriceGrid:', error);
        res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: error.message
        });
    }
};
