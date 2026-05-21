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
        const { poNumber } = req.query;
        console.log(`[SupplyChainController] Fetching PO detail for: ${poNumber}`);
        const data = await supplyChainService.getPODetailData(poNumber);
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
