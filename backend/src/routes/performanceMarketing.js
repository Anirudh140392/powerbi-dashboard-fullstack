import { KpisOverview, GetZones, GetPlatforms, GetBrands, GetCampaignQuadrants, GetFormatPerformance, GetKeywordTypePerformance, GetCategories, GetKeywordAnalysis, GetKeywords } from '../controllers/performanceMarketingController.js';

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

    // Route for Keyword Type Performance (HeatMapDrillTable data)
    app.get('/api/performance-marketing/keyword-type-performance', GetKeywordTypePerformance);

    // Route for Categories
    app.get('/api/performance-marketing/categories', GetCategories);

    // Route for Keywords (filtered by Category)
    app.get('/api/performance-marketing/keywords', GetKeywords);

    // Route for Keyword Analysis (Dynamic Data)
    app.get('/api/performance-marketing/keyword-analysis', GetKeywordAnalysis);
};
