/**
 * Map Intellect Controller
 * Handles API requests for the Map Intellect (Geo Intelligence) page.
 */

import mapIntellectService from '../services/mapIntellectService.js';

/**
 * GET /api/map-intellect/data
 * Returns city-level KPI data for the map
 */
export const getMapIntellectData = async (req, res) => {
    try {
        const filters = req.query;
        console.log('[MapIntellect Controller] API call received with filters:', filters);
        const data = await mapIntellectService.getMapIntellectData(filters);
        res.json(data);
    } catch (error) {
        console.error('[MapIntellect Controller] Error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};
