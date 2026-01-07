import { KpisOverview, GetZones, GetPlatforms, GetBrands, GetCampaignQuadrants, GetFormatPerformance } from '../controllers/performanceMarketingController.js';

export default (app) => {
    /**
     * @swagger
     * /api/performance-marketing:
     *   get:
     *     summary: Get Performance Marketing metrics
     *     description: Retrieve metrics for Performance Marketing (KPIs Overview).
     *     parameters:
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *         description: Filter by platform
     *     responses:
     *       200:
     *         description: Successful response
     */
    app.get('/api/performance-marketing', KpisOverview);

    // Route for Zones
    app.get('/api/performance-marketing/zones', GetZones);

    // Route for PM-specific Platforms
    app.get('/api/performance-marketing/platforms', GetPlatforms);

    // Route for PM-specific Brands
    app.get('/api/performance-marketing/brands', GetBrands);

    // Route for Campaign Quadrants (Q1-Q4)
    app.get('/api/performance-marketing/quadrants', GetCampaignQuadrants);

    // Route for Format Performance (Category data from RCA table)
    app.get('/api/performance-marketing/format-performance', GetFormatPerformance);
};
