import { getInsightsData } from '../services/insightsService.js';

export const getInsights = async (req, res) => {
    try {
        const filters = {
            platform: req.query.platform || 'All platforms',
            city: req.query.city || 'All cities',
            category: req.query.category || 'All categories',
            signal: req.query.signal || 'All signals',
            brand: req.query.brand || 'All',
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };

        const result = await getInsightsData(filters);
        
        res.status(200).json({
            success: true,
            data: result
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