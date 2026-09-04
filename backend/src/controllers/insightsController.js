import { getInsightsData } from '../services/insightsService.js';

export const getInsights = async (req, res) => {
    try {
        const filters = {
            platform: req.query.localPlatform && req.query.localPlatform !== 'All platforms' ? req.query.localPlatform : req.query.platform || 'All platforms',
            city: req.query.localCity && req.query.localCity !== 'All cities' ? req.query.localCity : req.query.city || 'All cities',
            category: req.query.localCategory && req.query.localCategory !== 'All categories' ? req.query.localCategory : req.query.category || 'All categories',
            productLine: req.query.localProductLine && req.query.localProductLine !== 'All product lines' ? req.query.localProductLine : 'All product lines',
            signal: req.query.signal || 'All signals',
            brand: req.query.brand || 'All',
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            compareStartDate: req.query.compareStartDate,
            compareEndDate: req.query.compareEndDate
        };

        const result = await getInsightsData(filters);
        
        res.status(200).json({
            success: true,
            data: result,
            insightsKpi: req.user?.tabPermissions?.Insights?.kpi || {}
        });
    } catch (error) {
        console.error('Error in getInsights:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve insights data',
            error: error.message
        });
    }
};

export const getInsightsFilters = async (req, res) => {
    try {
        const { getInsightsFilterOptions } = await import('../services/insightsService.js');
        const options = await getInsightsFilterOptions();

        res.status(200).json({
            success: true,
            data: options
        });
    } catch (error) {
        console.error('Error fetching insight filters:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getCorrelations = async (req, res) => {
    try {
        const { getCorrelationsData } = await import('../services/insightsService.js');
        const filters = {
            platform: req.query.platform || 'All platforms',
            city: req.query.city || 'All cities',
            category: req.query.category || 'All categories',
            brand: req.query.brand || 'All',
            startDate: req.query.startDate,
            endDate: req.query.endDate,
        };
        const data = await getCorrelationsData(filters);
        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Error in getCorrelations:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve correlations data', error: error.message });
    }
};

export const getCorrelationsTrend = async (req, res) => {
    try {
        const { getCorrelationsTrend: getTrend } = await import('../services/insightsService.js');
        const filters = {
            platform: req.query.platform || '',
            category: req.query.category || '',
            brand: req.query.brand || '',
            sku: req.query.sku || '',
            location: req.query.location || '',
            startDate: req.query.startDate,
            endDate: req.query.endDate,
        };
        const data = await getTrend(filters);
        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Error in getCorrelationsTrend:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve trend data', error: error.message });
    }
};