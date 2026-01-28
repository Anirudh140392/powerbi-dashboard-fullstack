import {
    GetInventoryOverview,
    GetInventoryPlatforms,
    GetInventoryBrands,
    GetInventoryLocations,
    GetInventoryMatrix,
    GetCitySkuMatrix
} from '../controllers/inventoryAnalysisController.js';

/**
 * Inventory Analysis Routes
 * @swagger
 * /api/inventory-analysis:
 *   Provides endpoints for inventory metrics including DOH, DRR, and replenishment data
 */
export default function inventoryAnalysisRoutes(app) {
    /**
     * @swagger
     * /api/inventory-analysis/overview:
     *   get:
     *     summary: Get inventory overview with DOH, DRR, and Total Boxes Required
     *     parameters:
     *       - name: platform
     *         in: query
     *         description: Platform filter (comma-separated)
     *       - name: brand
     *         in: query
     *         description: Brand filter (comma-separated)
     *       - name: location
     *         in: query
     *         description: Location filter (comma-separated)
     *       - name: startDate
     *         in: query
     *         description: Start date (YYYY-MM-DD)
     *       - name: endDate
     *         in: query
     *         description: End date (YYYY-MM-DD)
     */
    app.get('/api/inventory-analysis/overview', GetInventoryOverview);

    /**
     * @swagger
     * /api/inventory-analysis/platforms:
     *   get:
     *     summary: Get available platforms for filters
     */
    app.get('/api/inventory-analysis/platforms', GetInventoryPlatforms);

    /**
     * @swagger
     * /api/inventory-analysis/brands:
     *   get:
     *     summary: Get available brands for filters
     *     parameters:
     *       - name: platform
     *         in: query
     *         description: Filter brands by platform
     */
    app.get('/api/inventory-analysis/brands', GetInventoryBrands);

    /**
     * @swagger
     * /api/inventory-analysis/locations:
     *   get:
     *     summary: Get available locations for filters
     *     parameters:
     *       - name: platform
     *         in: query
     *         description: Filter locations by platform
     *       - name: brand
     *         in: query
     *         description: Filter locations by brand
     */
    app.get('/api/inventory-analysis/locations', GetInventoryLocations);

    /**
     * @swagger
     * /api/inventory-analysis/matrix:
     *   get:
     *     summary: Get inventory matrix (SKU x City)
     */
    app.get('/api/inventory-analysis/matrix', GetInventoryMatrix);
    /**
     * @swagger
     * /api/inventory-analysis/city-sku-matrix:
     *   get:
     *     summary: Get inventory matrix with full metrics (City x SKU)
     */
    app.get('/api/inventory-analysis/city-sku-matrix', GetCitySkuMatrix);
}
