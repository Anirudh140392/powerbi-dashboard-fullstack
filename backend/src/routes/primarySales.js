// src/routes/primarySales.js
// Route definitions for PRIMARY SUMMARY segment APIs

import {
    getPrimaryMOMHandler,
    getPrimaryQuarterlyHandler,
    getPrimaryPivotTableHandler,
    getPrimaryFiltersHandler,
    getPrimaryAllHandler,
} from '../controllers/primarySalesController.js';

export default (app) => {
    // Middleware/logger for primary sales endpoints
    app.use('/api/primary-sales', (req, res, next) => {
        console.log(`[Primary Sales API] Called: ${req.method} ${req.originalUrl}`);
        next();
    });

    /**
     * @swagger
     * /api/primary-sales/mom:
     *   get:
     *     summary: Get Primary MOM (Month-over-Month) chart data
     *     description: Returns SUM(amount_inr) grouped by month from rb_primary_olap
     *     parameters:
     *       - in: query
     *         name: location
     *         schema: { type: string }
     *       - in: query
     *         name: brandName
     *         schema: { type: string }
     *       - in: query
     *         name: channel
     *         schema: { type: string }
     *       - in: query
     *         name: platform
     *         schema: { type: string }
     *       - in: query
     *         name: retailerName
     *         schema: { type: string }
     *       - in: query
     *         name: product
     *         schema: { type: string }
     *       - in: query
     *         name: division
     *         schema: { type: string }
     *       - in: query
     *         name: zone
     *         schema: { type: string }
     */
    app.get('/api/primary-sales/mom', getPrimaryMOMHandler);

    /**
     * @swagger
     * /api/primary-sales/quarterly:
     *   get:
     *     summary: Get Quarter Wise Primary Data chart
     *     description: Returns SUM(amount_inr) grouped by financial year quarters (Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar)
     *     parameters:
     *       - in: query
     *         name: location
     *         schema: { type: string }
     *       - in: query
     *         name: brandName
     *         schema: { type: string }
     *       - in: query
     *         name: channel
     *         schema: { type: string }
     *       - in: query
     *         name: platform
     *         schema: { type: string }
     *       - in: query
     *         name: retailerName
     *         schema: { type: string }
     *       - in: query
     *         name: product
     *         schema: { type: string }
     *       - in: query
     *         name: division
     *         schema: { type: string }
     *       - in: query
     *         name: zone
     *         schema: { type: string }
     */
    app.get('/api/primary-sales/quarterly', getPrimaryQuarterlyHandler);

    /**
     * @swagger
     * /api/primary-sales/pivot-table:
     *   get:
     *     summary: Get Brand Wise Primary pivot table data
     *     description: Returns monthly SUM(amount_inr) pivoted by the selected X-axis dimension
     *     parameters:
     *       - in: query
     *         name: xAxis
     *         schema: { type: string, enum: ['Retailer Name', 'Brand Name', 'Product', 'Division', 'Zone'] }
     *       - in: query
     *         name: location
     *         schema: { type: string }
     *       - in: query
     *         name: brandName
     *         schema: { type: string }
     *       - in: query
     *         name: channel
     *         schema: { type: string }
     *       - in: query
     *         name: platform
     *         schema: { type: string }
     *       - in: query
     *         name: retailerName
     *         schema: { type: string }
     *       - in: query
     *         name: product
     *         schema: { type: string }
     *       - in: query
     *         name: division
     *         schema: { type: string }
     *       - in: query
     *         name: zone
     *         schema: { type: string }
     */
    app.get('/api/primary-sales/pivot-table', getPrimaryPivotTableHandler);

    /**
     * @swagger
     * /api/primary-sales/filters:
     *   get:
     *     summary: Get filter options for Primary Sales dropdowns
     *     description: Returns distinct values for all filter dimensions
     */
    app.get('/api/primary-sales/filters', getPrimaryFiltersHandler);

    /**
     * @swagger
     * /api/primary-sales/all:
     *   get:
     *     summary: Get all Primary Summary data in a single call
     *     description: Returns MOM, Quarterly, and Pivot Table data together to reduce API calls
     *     parameters:
     *       - in: query
     *         name: xAxis
     *         schema: { type: string }
     *       - in: query
     *         name: location
     *         schema: { type: string }
     *       - in: query
     *         name: brandName
     *         schema: { type: string }
     *       - in: query
     *         name: channel
     *         schema: { type: string }
     *       - in: query
     *         name: platform
     *         schema: { type: string }
     *       - in: query
     *         name: retailerName
     *         schema: { type: string }
     *       - in: query
     *         name: product
     *         schema: { type: string }
     *       - in: query
     *         name: division
     *         schema: { type: string }
     *       - in: query
     *         name: zone
     *         schema: { type: string }
     */
    app.get('/api/primary-sales/all', getPrimaryAllHandler);
};
