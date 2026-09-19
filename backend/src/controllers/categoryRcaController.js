import watchTowerService from '../services/watchTowerService.js';

export const Categories = async (req, res) => {
    try {
        const filters = req.query;
        console.log("Categories api request received", filters);

        const data = await watchTowerService.getRcaData(filters);

        console.log("Sending RCA data response");
        res.json(data);
    } catch (error) {
        console.error('Error in Category RCA:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};
