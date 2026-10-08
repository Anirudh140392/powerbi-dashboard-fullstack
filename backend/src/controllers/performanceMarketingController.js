import performanceMarketingService from '../services/performanceMarketingService.js';

export const KpisOverview = async (req, res) => {
    try {
        const filters = req.query;
        // Call the service method we implemented earlier (it was defined in previous steps but controller was mocked here)
        // Importing service to use it
        const data = await performanceMarketingService.getKpisOverview(filters);
        res.json(data);
    } catch (error) {
        console.error('Error in Performance Marketing:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const GetKeywords = async (req, res) => {
    try {
        const { category } = req.query;
        const keywords = await performanceMarketingService.getKeywords(category);
        res.json(keywords);
    } catch (error) {
        console.error('Error fetching PM keywords:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const GetZones = async (req, res) => {
    try {
        const { brand } = req.query; // Extract brand from query params
        const zones = await performanceMarketingService.getZones(brand);
        res.json(zones);
    } catch (error) {
        console.error('Error fetching zones:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const GetPlatforms = async (req, res) => {
    try {
        const platforms = await performanceMarketingService.getPlatforms();
        res.json(platforms);
    } catch (error) {
        console.error('Error fetching PM platforms:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const GetBrands = async (req, res) => {
    try {
        const { platform } = req.query;
        const brands = await performanceMarketingService.getBrands(platform);
        res.json(brands);
    } catch (error) {
        console.error('Error fetching PM brands:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const GetCampaignQuadrants = async (req, res) => {
    try {
        const filters = req.query;
        const quadrants = await performanceMarketingService.getCampaignQuadrants(filters);
        res.json(quadrants);
    } catch (error) {
        console.error('Error fetching campaign quadrants:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const GetFormatPerformance = async (req, res) => {
    try {
        const filters = req.query;
        const data = await performanceMarketingService.getFormatPerformance(filters);
        res.json(data);
    } catch (error) {
        console.error('Error fetching format performance:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const GetKeywordTypePerformance = async (req, res) => {
    try {
        const filters = req.query;
        const data = await performanceMarketingService.getKeywordTypePerformance(filters);
        res.json(data);
    } catch (error) {
        console.error('Error fetching keyword type performance:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const GetCategories = async (req, res) => {
    try {
        const categories = await performanceMarketingService.getCategories();
        res.json(categories);
    } catch (error) {
        console.error('Error fetching PM categories:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const GetKeywordAnalysis = async (req, res) => {
    try {
        const filters = req.query;
        const data = await performanceMarketingService.getKeywordAnalysis(filters);
        res.json(data);
    } catch (error) {
        console.error('Error fetching keyword analysis:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
