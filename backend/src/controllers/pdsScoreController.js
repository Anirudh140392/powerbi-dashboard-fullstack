import { getPdsScoreData } from '../services/pdsScoreService.js';

export async function getPdsScoreOverview(req, res) {
    try {
        const filters = {
            client: req.query.db_name || req.query.client || req.dbName || 'mars',
            platform: req.query.platform || 'Blinkit',
            year: req.query.year || '2026',
            period: req.query.period || 'Period 11',
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };

        const result = await getPdsScoreData(filters);
        return res.json(result);
    } catch (err) {
        console.error('[getPdsScoreOverview] Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error calculating PDS Score',
            error: err.message
        });
    }
}

export async function getPdsScoreTable(req, res) {
    try {
        const filters = {
            client: req.query.db_name || req.query.client || req.dbName || 'mars',
            platform: req.query.platform || 'Blinkit',
            year: req.query.year || '2026',
            period: req.query.period || 'Period 11',
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };

        const result = await getPdsScoreData(filters);
        if (result && result.success && result.data) {
            return res.json({
                success: true,
                data: result.data.levers,
                achievement: result.data.achievement,
                target: result.data.target
            });
        }
        return res.json(result);
    } catch (err) {
        console.error('[getPdsScoreTable] Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error calculating PDS Score table',
            error: err.message
        });
    }
}

