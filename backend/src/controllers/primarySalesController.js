// src/controllers/primarySalesController.js
// Controller for PRIMARY SUMMARY segment APIs on Business Overview page

import {
    getPrimaryMOM,
    getPrimaryQuarterly,
    getPrimaryPivotTable,
    getPrimaryFilterOptions,
    getPrimaryKpis,
    getPrimaryLatestDate,
    getPrimaryTopProducts,
    getPrimaryRetailerDailyTrend,
} from '../services/primarySalesService.js';
import { generateCacheKey, getCachedOrCompute, CACHE_TTL } from '../utils/cacheHelper.js';

/**
 * GET /api/primary-sales/retailer-daily-trend
 */
export const getPrimaryRetailerDailyTrendHandler = async (req, res) => {
    try {
        const filters = extractFilters(req.query);
        const metricType = req.query.metricType || 'MRP';
        const data = await getPrimaryRetailerDailyTrend(filters, metricType);
        res.json({ success: true, data });
    } catch (error) {
        console.error('[getPrimaryRetailerDailyTrend] Error:', error.message);
        res.status(500).json({ success: false, error: 'Internal Server Error', details: error.message });
    }
};

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
    monthYear: query.monthYear || 'All',
    fy: query.fy || 'All',
    xAxis: query.xAxis || 'Retailer Name',
    startDate: query.startDate,
    endDate: query.endDate,
});



/**
 * GET /api/primary-sales/mom
 * Returns Month-over-Month bar chart data (PRIMARY MOM)
 */
export const getPrimaryMOMHandler = async (req, res) => {
    try {
        const filters = extractFilters(req.query);
        const metricType = req.query.metricType || 'MRP';
        const granularity = req.query.granularity || 'monthly';
        console.log('[getPrimaryMOM] Filters:', filters, '| metricType:', metricType, '| granularity:', granularity);

        const data = await getPrimaryMOM(filters, metricType, granularity);
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
        const granularity = req.query.granularity || 'monthly';
        console.log('[getPrimaryAll] Filters:', filters, '| xAxis:', xAxis, '| metricType:', metricType, '| granularity:', granularity);

        const [mom, quarterly, pivotTable, kpis] = await Promise.all([
            getPrimaryMOM(filters, metricType, granularity),
            getPrimaryQuarterly(filters, metricType),
            getPrimaryPivotTable(filters, xAxis, metricType),
            getPrimaryKpis(filters),
        ]);

        res.json({
            success: true,
            data: { mom, quarterly, pivotTable, kpis }
        });
    } catch (error) {
        console.error('[getPrimaryAll] Error:', error.message);
        console.error('[getPrimaryAll] Stack:', error.stack);
        res.status(500).json({ success: false, error: 'Internal Server Error', details: error.message });
    }
};


/**
 * GET /api/primary-sales/latest-date
 * Returns max and min billing_date available in rb_primary_olap
 */
export const getPrimaryLatestDateHandler = async (req, res) => {
    try {
        const data = await getPrimaryLatestDate();
        res.json({ success: true, ...data });
    } catch (error) {
        console.error('[getPrimaryLatestDate] Error:', error.message);
        res.status(500).json({ success: false, error: 'Internal Server Error', details: error.message });
    }
};

/**
 * GET /api/primary-sales/top-products
 * Returns top products for a given entityName and xAxis
 */
export const getPrimaryTopProductsHandler = async (req, res) => {
    try {
        console.log('[getPrimaryTopProductsHandler] ========== NEW REQUEST ==========');
        console.log('[getPrimaryTopProductsHandler] Full query params:', JSON.stringify(req.query, null, 2));
        
        const filters = extractFilters(req.query);
        const entityName = req.query.entityName || '';
        const xAxis = req.query.xAxis || 'Retailer Name';
        const metricType = req.query.metricType || 'MRP';
        const targetLevel = req.query.targetLevel || '';
        const retailerName = req.query.retailerName || '';
        const zoneName = req.query.zoneName || '';
        const divisionName = req.query.divisionName || '';
        const brandName = req.query.brandName || '';

        console.log('[getPrimaryTopProductsHandler] Extracted filters:', JSON.stringify(filters, null, 2));
        console.log('[getPrimaryTopProductsHandler] Other params:', { entityName, xAxis, targetLevel, retailerName });

        const data = await getPrimaryTopProducts(
            filters,
            entityName,
            xAxis,
            metricType,
            targetLevel,
            retailerName,
            zoneName,
            divisionName,
            brandName
        );
        
        console.log('[getPrimaryTopProductsHandler] Result count:', data ? data.length : 0);
        if (data && data.length > 0) {
            console.log('[getPrimaryTopProductsHandler] Sample result:', data[0]);
        } else {
            console.log('[getPrimaryTopProductsHandler] ❌ NO DATA RETURNED');
        }
        res.json({ success: true, data });
    } catch (error) {
        console.error('[getPrimaryTopProducts] Error:', error.message);
        console.error('[getPrimaryTopProducts] Stack:', error.stack);
        res.status(500).json({ success: false, error: 'Internal Server Error', details: error.message });
    }
};
