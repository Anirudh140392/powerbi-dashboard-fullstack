// src/controllers/secondarySalesController.js
// Controller for SECONDARY SUMMARY segment APIs

import {
    getSecondaryFilterOptions,
    getSecondaryLatestDate,
    getSecondarySellerWise,
    getSecondaryQuarterWise,
    getSecondaryTopBrands,
    getSecondarySalesTimeline,
} from '../services/secondarySalesService.js';

const extractFilters = (query) => ({
    seller: query.seller || 'All',
    platformName: query.platformName || query.platform || 'All',
    brand: query.brand || query.brandName || 'All',
    subBrand: query.subBrand || 'All',
    sku: query.sku || 'All',
    sapCode: query.sapCode || 'All',
    fiscalYear: query.fiscalYear || query.fy || 'All',
    quarter: query.quarter || query.qtr || 'All',
    startDate: query.startDate,
    endDate: query.endDate,
});

/**
 * GET /api/secondary-sales/filters
 */
export const getSecondaryFiltersHandler = async (req, res) => {
    try {
        const filters = extractFilters(req.query);
        const data = await getSecondaryFilterOptions(filters);
        res.json({ success: true, data });
    } catch (error) {
        console.error('[getSecondaryFiltersHandler] Error:', error.message);
        res.status(500).json({ success: false, error: 'Internal Server Error', details: error.message });
    }
};

/**
 * GET /api/secondary-sales/latest-date
 */
export const getSecondaryLatestDateHandler = async (req, res) => {
    try {
        const data = await getSecondaryLatestDate();
        res.json({ success: true, ...data });
    } catch (error) {
        console.error('[getSecondaryLatestDateHandler] Error:', error.message);
        res.status(500).json({ success: false, error: 'Internal Server Error', details: error.message });
    }
};

/**
 * GET /api/secondary-sales/seller-wise
 * Query params: seller, platformName, brand, subBrand, sku, sapCode, fiscalYear, quarter, startDate, endDate, metricType
 */
export const getSecondarySellerWiseHandler = async (req, res) => {
    try {
        const filters = extractFilters(req.query);
        const metricType = req.query.metricType || 'MRP';
        const data = await getSecondarySellerWise(filters, metricType);
        res.json({ success: true, data });
    } catch (error) {
        console.error('[getSecondarySellerWiseHandler] Error:', error.message);
        res.status(500).json({ success: false, error: 'Internal Server Error', details: error.message });
    }
};

/**
 * GET /api/secondary-sales/quarter-wise
 */
export const getSecondaryQuarterWiseHandler = async (req, res) => {
    try {
        const filters = extractFilters(req.query);
        const metricType = req.query.metricType || 'MRP';
        const data = await getSecondaryQuarterWise(filters, metricType);
        res.json({ success: true, data });
    } catch (error) {
        console.error('[getSecondaryQuarterWiseHandler] Error:', error.message);
        res.status(500).json({ success: false, error: 'Internal Server Error', details: error.message });
    }
};

/**
 * GET /api/secondary-sales/top-brands
 */
export const getSecondaryTopBrandsHandler = async (req, res) => {
    try {
        const filters = extractFilters(req.query);
        const metricType = req.query.metricType || 'MRP';
        const data = await getSecondaryTopBrands(filters, metricType);
        res.json({ success: true, data });
    } catch (error) {
        console.error('[getSecondaryTopBrandsHandler] Error:', error.message);
        res.status(500).json({ success: false, error: 'Internal Server Error', details: error.message });
    }
};

/**
 * GET /api/secondary-sales/sales-timeline
 */
export const getSecondarySalesTimelineHandler = async (req, res) => {
    try {
        const filters = extractFilters(req.query);
        const metricType = req.query.metricType || 'MRP';
        const granularity = req.query.granularity || 'monthly';
        const data = await getSecondarySalesTimeline(filters, metricType, granularity);
        res.json({ success: true, data });
    } catch (error) {
        console.error('[getSecondarySalesTimelineHandler] Error:', error.message);
        res.status(500).json({ success: false, error: 'Internal Server Error', details: error.message });
    }
};
