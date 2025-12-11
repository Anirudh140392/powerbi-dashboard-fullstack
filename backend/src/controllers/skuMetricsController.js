import { getSkuMetrics } from '../services/skuMetricsService.js';

/**
 * Get SKU metrics data
 * @route GET /api/watchtower/sku-metrics
 * @query {string} metric - The metric key to fetch (required)
 * @query {string} dateFrom - Start date (optional)
 * @query {string} dateTo - End date (optional)
 * @query {string} brand - Brand filter (optional)
 * @query {string} location - Location filter (optional)
 */
export const getSkuMetricsData = async (req, res) => {
    try {
        const { metric, dateFrom, dateTo, brand, location } = req.query;

        // Validate required parameter
        if (!metric) {
            return res.status(400).json({
                error: 'Metric parameter is required'
            });
        }

        // Build filters object
        const filters = {};
        if (dateFrom) filters.dateFrom = dateFrom;
        if (dateTo) filters.dateTo = dateTo;
        if (brand) filters.brand = brand;
        if (location) filters.location = location;

        // Fetch SKU metrics data
        const data = await getSkuMetrics(metric, filters);

        res.json(data);
    } catch (error) {
        console.error('Error in getSkuMetricsData controller:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
};

export default {
    getSkuMetricsData
};
