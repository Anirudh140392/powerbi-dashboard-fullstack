import { getPrioritizePO, getPODetail, getPOFilters, getSKUTrend, getManageSurplus, getStockTransfer } from '../controllers/supplyChainController.js';

export default (app) => {
    // Middleware/logger for supply chain endpoints
    app.use('/api/supply-chain', (req, res, next) => {
        console.log(`[Supply Chain API] Called: ${req.method} ${req.originalUrl}`);
        next();
    });

    /**
     * @swagger
     * /api/supply-chain/prioritize-po:
     *   get:
     *     summary: Get prioritized PO list
     *     description: Retrieves PO data with computed PSL and Priority levels from rb_po_olap.
     */
    app.get('/api/supply-chain/prioritize-po', getPrioritizePO);

    /**
     * @swagger
     * /api/supply-chain/po-detail:
     *   get:
     *     summary: Get PO SKU details
     *     description: Retrieves SKU list for a specific PO number.
     */
    app.get('/api/supply-chain/po-detail', getPODetail);

    /**
     * @swagger
     * /api/supply-chain/po-filters:
     *   get:
     *     summary: Get PO filters
     *     description: Retrieves distinct filter values from rb_po_olap.
     */
    app.get('/api/supply-chain/po-filters', getPOFilters);

    /**
     * @swagger
     * /api/supply-chain/sku-trend:
     *   get:
     *     summary: Get SKU trend data
     *     description: Daily KPI time-series (OSA, Offtake, DRR, Price, Promo%, DOI) for a specific SKU by Web_Pid.
     */
    app.get('/api/supply-chain/sku-trend', getSKUTrend);

    /**
     * @swagger
     * /api/supply-chain/manage-surplus:
     *   get:
     *     summary: Get managed surplus inventory list
     *     description: Retrieves surplus SKU data with computed DOI and City OSA metrics from rb_po_olap.
     */
    app.get('/api/supply-chain/manage-surplus', getManageSurplus);

    /**
     * @swagger
     * /api/supply-chain/stock-transfer:
     *   get:
     *     summary: Get stock transfer actions
     *     description: Retrieves SKU-level stock transfer data with computed KPIs (City OSA%, DOI, SOH, CPD, PSL Recovery) from rb_po_olap.
     */
    app.get('/api/supply-chain/stock-transfer', getStockTransfer);
};
