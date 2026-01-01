import {
    VisibilityWorkspace,
    getVisibilityOverview,
    getVisibilityPlatformKpiMatrix,
    getVisibilityKeywordsAtGlance,
    getVisibilityTopSearchTerms
} from '../controllers/visibilityAnalysisController.js';

export default (app) => {
    /**
     * @swagger
     * /api/visibility-analysis:
     *   get:
     *     summary: Get Visibility Analysis metrics (legacy)
     *     description: Retrieve metrics for Visibility Analysis.
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
    app.get('/api/visibility-analysis', VisibilityWorkspace);

    // ==================== Visibility Analysis APIs ====================

    /**
     * @swagger
     * /api/visibility-analysis/visibility-overview:
     *   get:
     *     summary: Get Visibility Overview KPI cards
     *     description: Retrieve SOS metrics cards (Overall, Sponsored, Organic, Display)
     *     parameters:
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *         description: Filter by platform
     *       - in: query
     *         name: brand
     *         schema:
     *           type: string
     *         description: Filter by brand
     *       - in: query
     *         name: location
     *         schema:
     *           type: string
     *         description: Filter by location
     *       - in: query
     *         name: keyword
     *         schema:
     *           type: string
     *         description: Filter by keyword
     *     responses:
     *       200:
     *         description: Successful response with cards array
     */
    app.get('/api/visibility-analysis/visibility-overview', getVisibilityOverview);

    /**
     * @swagger
     * /api/visibility-analysis/platform-kpi-matrix:
     *   get:
     *     summary: Get Platform KPI Matrix
     *     description: Retrieve Platform/Format/City breakdown with SOS metrics
     *     parameters:
     *       - in: query
     *         name: viewMode
     *         schema:
     *           type: string
     *           enum: [Platform, Format, City]
     *         description: View mode for matrix
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *         description: Filter by platform
     *       - in: query
     *         name: brand
     *         schema:
     *           type: string
     *         description: Filter by brand
     *     responses:
     *       200:
     *         description: Successful response with platform, format, city data
     */
    app.get('/api/visibility-analysis/platform-kpi-matrix', getVisibilityPlatformKpiMatrix);

    /**
     * @swagger
     * /api/visibility-analysis/keywords-at-glance:
     *   get:
     *     summary: Get Keywords at a Glance
     *     description: Retrieve hierarchical keyword/SKU drill data
     *     parameters:
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *         description: Filter by platform
     *       - in: query
     *         name: view
     *         schema:
     *           type: string
     *           enum: [keywords, skus, platforms]
     *         description: View mode for hierarchy
     *     responses:
     *       200:
     *         description: Successful response with hierarchy array
     */
    app.get('/api/visibility-analysis/keywords-at-glance', getVisibilityKeywordsAtGlance);

    /**
     * @swagger
     * /api/visibility-analysis/top-search-terms:
     *   get:
     *     summary: Get Top Search Terms
     *     description: Retrieve search terms with SOS metrics
     *     parameters:
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *         description: Filter by platform
     *       - in: query
     *         name: filter
     *         schema:
     *           type: string
     *           enum: [All, Branded, Competitor, Generic]
     *         description: Filter by term type
     *     responses:
     *       200:
     *         description: Successful response with terms array
     */
    app.get('/api/visibility-analysis/top-search-terms', getVisibilityTopSearchTerms);
};
