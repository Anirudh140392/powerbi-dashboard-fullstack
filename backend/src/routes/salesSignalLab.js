/**
 * Sales Signal Lab Routes
 * API endpoints for visibility signals on the Sales page
 */

import {
    getSalesVisibilitySignals,
    getSalesVisibilitySignalCityDetails
} from '../controllers/salesSignalLabController.js';

export default (app) => {
    /**
     * @swagger
     * /api/sales/visibility-signals:
     *   get:
     *     summary: Get Visibility Signals for Keyword & SKU (Drainers/Gainers) - Sales Page
     *     description: Retrieve signals with impact metrics, SOS KPIs, and city-level data from rb_kw table
     *     parameters:
     *       - in: query
     *         name: level
     *         schema:
     *           type: string
     *           enum: [keyword, sku]
     *           default: keyword
     *         description: Level to analyze - keyword or sku
     *       - in: query
     *         name: signalType
     *         schema:
     *           type: string
     *           enum: [drainer, gainer]
     *           default: drainer
     *         description: Type of signal - drainer (declining) or gainer (improving)
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *         description: Filter by platform
     *       - in: query
     *         name: location
     *         schema:
     *           type: string
     *         description: Filter by location
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *           format: date
     *         description: Start date (YYYY-MM-DD)
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *           format: date
     *         description: End date (YYYY-MM-DD)
     *     responses:
     *       200:
     *         description: Successful response with signals array and summary
     */
    app.get('/api/sales/visibility-signals', getSalesVisibilitySignals);

    /**
     * @swagger
     * /api/sales/visibility-signals/city-details:
     *   get:
     *     summary: Get city-level KPI details for a visibility signal - Sales Page
     *     description: Retrieve city-level metrics from rb_kw for a specific keyword or SKU
     *     parameters:
     *       - in: query
     *         name: keyword
     *         schema:
     *           type: string
     *         description: Keyword to get city details for (when level=keyword)
     *       - in: query
     *         name: skuName
     *         schema:
     *           type: string
     *         description: SKU name to get city details for (when level=sku)
     *       - in: query
     *         name: level
     *         schema:
     *           type: string
     *           enum: [keyword, sku]
     *         description: Level of the signal (keyword or sku)
     *       - in: query
     *         name: platform
     *         schema:
     *           type: string
     *         description: Filter by platform
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *           format: date
     *         description: Start date (YYYY-MM-DD)
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *           format: date
     *         description: End date (YYYY-MM-DD)
     *     responses:
     *       200:
     *         description: Successful response with cities array containing KPIs
     */
    app.get('/api/sales/visibility-signals/city-details', getSalesVisibilitySignalCityDetails);
};
