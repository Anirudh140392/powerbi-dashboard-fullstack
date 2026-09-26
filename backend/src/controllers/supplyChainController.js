import supplyChainService from '../services/supplyChainService.js';

/**
 * Get aggregated Prioritize PO list with computed PSL and Priority
 */
export const getPrioritizePO = async (req, res) => {
    try {
        const filters = { ...req.query };
        console.log('[SupplyChainController] Fetching prioritize POs with filters:', filters);
        const data = await supplyChainService.getPrioritizePOData(filters);
        res.json(data);
    } catch (error) {
        console.error('[SupplyChainController] Error fetching Prioritize PO data:', error.message, error.stack);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
};

/**
 * Get detailed SKU information for a specific PO
 */
export const getPODetail = async (req, res) => {
    try {
        const { poNumber, facilityName, ...filters } = req.query;
        console.log(`[SupplyChainController] Fetching PO detail for: ${poNumber}, facility: ${facilityName}, filters:`, filters);
        const data = await supplyChainService.getPODetailData(poNumber, facilityName, filters);
        res.json(data);
    } catch (error) {
        console.error('[SupplyChainController] Error fetching PO detail:', error.message, error.stack);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
};

/**
 * Get filter options for PO Prioritization
 */
export const getPOFilters = async (req, res) => {
    try {
        console.log('[SupplyChainController] Fetching PO filters');
        const data = await supplyChainService.getPOFilterOptions();
        res.json(data);
    } catch (error) {
        console.error('[SupplyChainController] Error fetching PO filters:', error.message, error.stack);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
};

/**
 * Get SKU trend data (daily KPI time-series)
 */
export const getSKUTrend = async (req, res) => {
    try {
        const { webPid, timeStep } = req.query;
        console.log(`[SupplyChainController] Fetching SKU trend for webPid: ${webPid}, timeStep: ${timeStep}`);
        const data = await supplyChainService.getSKUTrendData(webPid, timeStep || 'daily');
        res.json(data);
    } catch (error) {
        console.error('[SupplyChainController] Error fetching SKU trend:', error.message, error.stack);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
};

/**
 * Get aggregated Manage Surplus list
 */
export const getManageSurplus = async (req, res) => {
    try {
        const filters = { ...req.query };
        console.log('[SupplyChainController] Fetching manage surplus with filters:', filters);
        const data = await supplyChainService.getManageSurplusData(filters);
        res.json(data);
    } catch (error) {
        console.error('[SupplyChainController] Error fetching Manage Surplus data:', error.message, error.stack);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
};

/**
 * Get aggregated Stock Transfer list with computed KPIs
 */
export const getStockTransfer = async (req, res) => {
    try {
        const filters = { ...req.query };
        console.log('[SupplyChainController] Fetching stock transfer with filters:', filters);
        const data = await supplyChainService.getStockTransferData(filters);
        res.json(data);
    } catch (error) {
        console.error('[SupplyChainController] Error fetching Stock Transfer data:', error.message, error.stack);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
};
