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
 * Get available channels for inventory analysis filters
 */
export const GetInventoryChannels = async (req, res) => {
    try {
        const channels = await inventoryAnalysisService.getChannels();
        res.json(channels);
    } catch (error) {
        console.error('Error fetching inventory channels:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Get available platforms for inventory analysis filters
 */
export const GetInventoryPlatforms = async (req, res) => {
    try {
        const { channel } = req.query;
        const platforms = await inventoryAnalysisService.getPlatforms(channel);
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
        const { channel, platform, category } = req.query;
        const brands = await inventoryAnalysisService.getBrands(channel, platform, category);
        res.json(brands);
    } catch (error) {
        console.error('Error fetching inventory brands:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Get available categories for inventory analysis filters
 */
export const GetInventoryCategories = async (req, res) => {
    try {
        const { channel, platform } = req.query;
        const categories = await inventoryAnalysisService.getCategories(channel, platform);
        res.json(categories);
    } catch (error) {
        console.error('Error fetching inventory categories:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Get available locations for inventory analysis filters
 */
export const GetInventoryLocations = async (req, res) => {
    try {
        const { channel, platform, brand, category } = req.query;
        const locations = await inventoryAnalysisService.getLocations(channel, platform, brand, category);
        res.json(locations);
    } catch (error) {
        console.error('Error fetching inventory locations:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Get available MSL values for inventory analysis filters
 */
export const GetInventoryMsls = async (req, res) => {
    try {
        const { channel, platform, category, brand, location } = req.query;
        const msls = await inventoryAnalysisService.getMsls(channel, platform, category, brand, location);
        res.json(msls);
    } catch (error) {
        console.error('Error fetching inventory MSL values:', error);
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
