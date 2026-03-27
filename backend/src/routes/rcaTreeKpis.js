import watchTowerService from '../services/watchTowerService.js';

export default (app) => {
    /**
     * GET /api/rca-tree-kpis
     * Returns all KPI data needed to populate the RCA tree cards.
     * Wraps getEcomOfftake — no duplicated logic.
     * Query params: platform, category, brand, sku, startDate, endDate, compareStartDate, compareEndDate
     */
    app.get('/api/rca-tree-kpis', async (req, res) => {
        try {
            const filters = req.query;
            console.log('[rca-tree-kpis] Request received:', JSON.stringify(filters));
            const data = await watchTowerService.getEcomOfftake(filters);
            console.log('[rca-tree-kpis] Returning data. currFormatted:', data?.currFormatted, 'brands:', data?.brandMetrics?.length);
            res.json(data);
        } catch (error) {
            console.error('[rca-tree-kpis] Error:', error.message);
            res.status(500).json({ error: 'Internal Server Error', message: error.message });
        }
    });
};
