import { getContentAnalysisStats, getContentAnalysisOverviewStats, getContentAnalysisPlatformBreakdown, getContentAnalysisPlatforms, getContentAnalysisTrends } from '../services/contentAnalysisService.js';

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

export const ContentAnalysisOverview = async (req, res) => {
    try {
        const filters = req.query;
        console.log("Content Analysis Overview API request received", filters);

        // Fetch current period stats
        const currentData = await getContentAnalysisOverviewStats(filters, false);
        
        // Fetch previous period stats
        const prevData = await getContentAnalysisOverviewStats(filters, true);

        // Calculate deltas
        const calculateDelta = (curr, prev) => {
            if (!prev) return 0;
            return curr - prev;
        };

        const responseData = {
            current: currentData,
            previous: prevData,
            deltas: {
                titleScore: calculateDelta(currentData.titleScore, prevData.titleScore),
                imageScore: calculateDelta(currentData.imageScore, prevData.imageScore),
                siScore: calculateDelta(currentData.siScore, prevData.siScore),
                descScore: calculateDelta(currentData.descScore, prevData.descScore),
                ratingScore: calculateDelta(currentData.ratingScore, prevData.ratingScore),
                overallScore: calculateDelta(currentData.overallScore, prevData.overallScore)
            }
        };

        res.json(responseData);
    } catch (error) {
        console.error('Error in Content Analysis Overview:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const ContentAnalysisPlatformBreakdownController = async (req, res) => {
    try {
        const filters = req.query;
        console.log("Content Analysis Platform Breakdown API request received", filters);

        const currentMap = await getContentAnalysisPlatformBreakdown(filters, false);
        const prevMap = await getContentAnalysisPlatformBreakdown(filters, true);

        // Build per-platform response with deltas
        const allPlatforms = [...new Set([...Object.keys(currentMap), ...Object.keys(prevMap)])];
        const calcDelta = (c, p) => (c || 0) - (p || 0);

        const platforms = allPlatforms.map(plat => {
            const curr = currentMap[plat] || { titleScore: 0, imageScore: 0, siScore: 0, descScore: 0, ratingScore: 0, overallScore: 0 };
            const prev = prevMap[plat] || { titleScore: 0, imageScore: 0, siScore: 0, descScore: 0, ratingScore: 0, overallScore: 0 };
            return {
                platform: plat,
                current: curr,
                deltas: {
                    titleScore: calcDelta(curr.titleScore, prev.titleScore),
                    imageScore: calcDelta(curr.imageScore, prev.imageScore),
                    siScore: calcDelta(curr.siScore, prev.siScore),
                    descScore: calcDelta(curr.descScore, prev.descScore),
                    ratingScore: calcDelta(curr.ratingScore, prev.ratingScore),
                    overallScore: calcDelta(curr.overallScore, prev.overallScore)
                }
            };
        });

        // Sort by overall score descending
        platforms.sort((a, b) => b.current.overallScore - a.current.overallScore);

        // Compute "Overall" row (average across all platforms from the overview)
        const overallCurrent = await getContentAnalysisOverviewStats(filters, false);
        const overallPrev = await getContentAnalysisOverviewStats(filters, true);

        res.json({
            overall: {
                current: overallCurrent,
                deltas: {
                    titleScore: calcDelta(overallCurrent.titleScore, overallPrev.titleScore),
                    imageScore: calcDelta(overallCurrent.imageScore, overallPrev.imageScore),
                    siScore: calcDelta(overallCurrent.siScore, overallPrev.siScore),
                    descScore: calcDelta(overallCurrent.descScore, overallPrev.descScore),
                    ratingScore: calcDelta(overallCurrent.ratingScore, overallPrev.ratingScore),
                    overallScore: calcDelta(overallCurrent.overallScore, overallPrev.overallScore)
                }
            },
            platforms
        });
    } catch (error) {
        console.error('Error in Content Analysis Platform Breakdown:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const ContentAnalysisPlatformsController = async (req, res) => {
    try {
        const platforms = await getContentAnalysisPlatforms();
        res.json(platforms);
    } catch (error) {
        console.error('Error in Content Analysis Platforms:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const ContentAnalysisTrendsController = async (req, res) => {
    try {
        const filters = req.query;
        console.log("Content Analysis Trends API request received", filters);

        const data = await getContentAnalysisTrends(filters);

        res.json(data);
    } catch (error) {
        console.error('Error in Content Analysis Trends:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
