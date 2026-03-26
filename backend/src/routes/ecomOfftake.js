import watchTowerService from '../services/watchTowerService.js';

export default (app) => {
    /**
     * GET /api/ecom-offtake
     * Returns real offtake data from rb_pdp_olap for ecommerce platforms.
     * Query params: platform, category, brand, sku, startDate, endDate, compareStartDate, compareEndDate
     */
    app.get('/api/ecom-offtake', async (req, res) => {
        try {
            const filters = req.query;
            console.log('[ecom-offtake] Request received:', filters);
            const data = await watchTowerService.getEcomOfftake(filters);
            res.json(data);
        } catch (error) {
            console.error('[ecom-offtake] Error:', error);
            res.status(500).json({ error: 'Internal Server Error', message: error.message });
        }
    });
};
