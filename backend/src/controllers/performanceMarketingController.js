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
