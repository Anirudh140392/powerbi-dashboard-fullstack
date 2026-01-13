/**
 * Sales Signal Lab Controller
 * Handles visibility signal endpoints for the Sales page
 */

import salesSignalLabService from '../services/salesSignalLabService.js';

/**
 * Get Visibility Signals for Keyword & SKU (Drainers/Gainers)
 * Returns: Signals with impact metrics, KPIs, and city-level data
 */
export const getSalesVisibilitySignals = async (req, res) => {
    const startTime = Date.now();
    try {
        const filters = {
            level: req.query.level || 'keyword',  // 'keyword' or 'sku'
            signalType: req.query.signalType || 'drainer',  // 'drainer' or 'gainer'
            platform: req.query.platform || 'All',
            location: req.query.location || 'All',
            startDate: req.query.startDate || null,
            endDate: req.query.endDate || null,
            compareStartDate: req.query.compareStartDate || null,
            compareEndDate: req.query.compareEndDate || null
        };
        console.log('\n========== SALES VISIBILITY SIGNALS API ==========');
        console.log('[REQUEST] Filters:', JSON.stringify(filters, null, 2));
        console.log('[TIMING] Request received at:', new Date().toISOString());

        const data = await salesSignalLabService.getVisibilitySignals(filters);

        const duration = Date.now() - startTime;
        console.log('[RESPONSE]: Signals count:', data.signals?.length);
        console.log('[RESPONSE]: Summary -', JSON.stringify(data.summary, null, 2));
        console.log('[TIMING] Response time:', duration, 'ms');
        console.log('===================================================\n');

        res.json({
            success: true,
            ...data,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[ERROR] Sales Visibility Signals:', error);
        console.error('[TIMING] Failed after:', Date.now() - startTime, 'ms');
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sales visibility signals',
            message: error.message,
            signals: []
        });
    }
};

/**
 * Get city-level KPI details for a specific keyword or SKU visibility signal
 * Returns: City-level metrics from rb_kw table
 */
export const getSalesVisibilitySignalCityDetails = async (req, res) => {
    const startTime = Date.now();
    try {
        const params = {
            keyword: req.query.keyword || null,
            skuName: req.query.skuName || null,
            level: req.query.level || 'keyword',
            platform: req.query.platform || 'All',
            startDate: req.query.startDate || null,
            endDate: req.query.endDate || null
        };
        console.log('\n========== SALES VISIBILITY SIGNAL CITY DETAILS API ==========');
        console.log('[REQUEST] Params:', JSON.stringify(params, null, 2));
        console.log('[TIMING] Request received at:', new Date().toISOString());

        const data = await salesSignalLabService.getVisibilitySignalCityDetails(params);

        const duration = Date.now() - startTime;
        console.log('[RESPONSE]: Cities count:', data.cities?.length);
        console.log('[TIMING] Response time:', duration, 'ms');
        console.log('==============================================================\n');

        res.json({
            success: true,
            ...data,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[ERROR] Sales Visibility Signal City Details:', error);
        console.error('[TIMING] Failed after:', Date.now() - startTime, 'ms');
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sales visibility signal city details',
            message: error.message,
            cities: []
        });
    }
};
