import { getContentAnalysisStats } from '../services/contentAnalysisService.js';

export const ContentAnalysis = async (req, res) => {
    try {
        const filters = req.query;
        console.log("Content Analysis api request received", filters);

        const data = await getContentAnalysisStats(filters);

        console.log(`Sending response with ${data.length} records`);
        res.json(data);
    } catch (error) {
        console.error('Error in Content Analysis:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
