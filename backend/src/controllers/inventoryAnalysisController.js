import inventoryAnalysisService from '../services/inventoryAnalysisService.js';

/**
 * Get Inventory Overview with DOH, DRR, and Total Boxes Required
 */
export const GetInventoryOverview = async (req, res) => {
    try {
        const filters = req.query;
        const data = await inventoryAnalysisService.getInventoryOverview(filters);
        res.json(data);
    } catch (error) {
        console.error('Error fetching inventory overview:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Get available platforms for inventory analysis filters
 */
export const GetInventoryPlatforms = async (req, res) => {
    try {
        const platforms = await inventoryAnalysisService.getPlatforms();
        res.json(platforms);
    } catch (error) {
        console.error('Error fetching inventory platforms:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Get available brands for inventory analysis filters
 */
export const GetInventoryBrands = async (req, res) => {
    try {
        const { platform } = req.query;
        const brands = await inventoryAnalysisService.getBrands(platform);
        res.json(brands);
    } catch (error) {
        console.error('Error fetching inventory brands:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Get available locations for inventory analysis filters
 */
export const GetInventoryLocations = async (req, res) => {
    try {
        const { platform, brand } = req.query;
        const locations = await inventoryAnalysisService.getLocations(platform, brand);
        res.json(locations);
    } catch (error) {
        console.error('Error fetching inventory locations:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Get Inventory Matrix data
 */
export const GetInventoryMatrix = async (req, res) => {
    try {
        const filters = req.query;
        const data = await inventoryAnalysisService.getInventoryMatrix(filters);
        res.json(data);
    } catch (error) {
        console.error('Error fetching inventory matrix:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
/**
 * Get City-SKU Inventory Matrix for drilldown
 */
export const GetCitySkuMatrix = async (req, res) => {
    try {
        const filters = req.query;
        const data = await inventoryAnalysisService.getCitySkuMatrix(filters);
        res.json(data);
    } catch (error) {
        console.error('Error fetching city-sku inventory matrix:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
