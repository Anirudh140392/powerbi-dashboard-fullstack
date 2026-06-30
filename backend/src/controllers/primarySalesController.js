// src/controllers/primarySalesController.js
// Controller for PRIMARY SUMMARY segment APIs on Business Overview page

import {
    getPrimaryMOM,
    getPrimaryQuarterly,
    getPrimaryPivotTable,
    getPrimaryFilterOptions,
} from '../services/primarySalesService.js';
import { generateCacheKey, getCachedOrCompute, CACHE_TTL } from '../utils/cacheHelper.js';

/**
 * Extract common filters from request query params
 */
const extractFilters = (query) => ({
    location: query.location || 'All',
    brandName: query.brandName || query.brand || 'All',
    channel: query.channel || 'All',
    platform: query.platform || 'All',
    retailerName: query.retailerName || 'All',
    product: query.product || 'All',
    division: query.division || 'All',
    zone: query.zone || 'All',
    xAxis: query.xAxis || 'Retailer Name',
});



/**
 * GET /api/primary-sales/mom
 * Returns Month-over-Month bar chart data (PRIMARY MOM)
 */
export const getPrimaryMOMHandler = async (req, res) => {
    try {
        const filters = extractFilters(req.query);
        const metricType = req.query.metricType || 'MRP';
        console.log('[getPrimaryMOM] Filters:', filters, '| metricType:', metricType);

        const data = await getPrimaryMOM(filters, metricType);
        res.json({ success: true, data });
    } catch (error) {
        console.error('[getPrimaryMOM] Error:', error.message);
        console.error('[getPrimaryMOM] Stack:', error.stack);
        res.status(500).json({ success: false, error: 'Internal Server Error', details: error.message });
    }
};


/**
 * GET /api/primary-sales/quarterly
 * Returns Quarter-wise bar chart data (QUARTER WISE PRIMARY DATA)
 * Financial Year Quarters: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
 */
export const getPrimaryQuarterlyHandler = async (req, res) => {
    try {
        const filters = extractFilters(req.query);
        const metricType = req.query.metricType || 'MRP';
        console.log('[getPrimaryQuarterly] Filters:', filters, '| metricType:', metricType);

        const data = await getPrimaryQuarterly(filters, metricType);
        res.json({ success: true, data });
    } catch (error) {
        console.error('[getPrimaryQuarterly] Error:', error.message);
        console.error('[getPrimaryQuarterly] Stack:', error.stack);
        res.status(500).json({ success: false, error: 'Internal Server Error', details: error.message });
    }
};


/**
 * GET /api/primary-sales/pivot-table
 * Returns the pivot table data (BRAND WISE PRIMARY / dynamic X-axis)
 * Query param: xAxis = 'Retailer Name' | 'Brand Name' | 'Product' | 'Division' | 'Zone'
 */
export const getPrimaryPivotTableHandler = async (req, res) => {
    try {
        const filters = extractFilters(req.query);
        const xAxis = req.query.xAxis || 'Retailer Name';
        const metricType = req.query.metricType || 'MRP';
        console.log('[getPrimaryPivotTable] Filters:', filters, '| xAxis:', xAxis, '| metricType:', metricType);

        const data = await getPrimaryPivotTable(filters, xAxis, metricType);
        res.json({ success: true, data });
    } catch (error) {
        console.error('[getPrimaryPivotTable] Error:', error.message);
        console.error('[getPrimaryPivotTable] Stack:', error.stack);
        res.status(500).json({ success: false, error: 'Internal Server Error', details: error.message });
    }
};


/**
 * GET /api/primary-sales/filters
 * Returns distinct filter options for all dropdowns
 */
export const getPrimaryFiltersHandler = async (req, res) => {
    try {
        const filters = extractFilters(req.query);
        console.log('[getPrimaryFilters] Fetching filter options with:', filters);

        const data = await getPrimaryFilterOptions(filters);
        res.json({ success: true, data });
    } catch (error) {
        console.error('[getPrimaryFilters] Error:', error.message);
        console.error('[getPrimaryFilters] Stack:', error.stack);
        res.status(500).json({ success: false, error: 'Internal Server Error', details: error.message });
    }
};


/**
 * GET /api/primary-sales/all
 * Combined endpoint: Returns MOM, Quarterly, and Pivot Table data in a single call
 * to reduce number of API calls from the frontend
 */
export const getPrimaryAllHandler = async (req, res) => {
    try {
        const filters = extractFilters(req.query);
        const xAxis = req.query.xAxis || 'Retailer Name';
        const metricType = req.query.metricType || 'MRP';
        console.log('[getPrimaryAll] Filters:', filters, '| xAxis:', xAxis, '| metricType:', metricType);

        const [mom, quarterly, pivotTable] = await Promise.all([
            getPrimaryMOM(filters, metricType),
            getPrimaryQuarterly(filters, metricType),
            getPrimaryPivotTable(filters, xAxis, metricType),
        ]);

        res.json({
            success: true,
            data: { mom, quarterly, pivotTable }
        });
    } catch (error) {
        console.error('[getPrimaryAll] Error:', error.message);
        console.error('[getPrimaryAll] Stack:', error.stack);
        res.status(500).json({ success: false, error: 'Internal Server Error', details: error.message });
    }
};
