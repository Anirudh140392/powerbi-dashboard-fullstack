import express from 'express';
import { getCacheStats, deleteCached } from '../utils/cacheHelper.js';

const router = express.Router();

/**
 * @swagger
 * /api/cache/stats:
 *   get:
 *     summary: Get cache statistics
 *     description: Returns statistics about the Redis cache
 *     responses:
 *       200:
 *         description: Cache statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await getCacheStats();
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/cache/clear:
 *   post:
 *     summary: Clear all cache
 *     description: Clears all cached data
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 */
router.post('/clear', async (req, res) => {
    try {
        const deletedCount = await deleteCached('watchtower:*');
        res.json({
            success: true,
            message: `Cleared ${deletedCount} cache entries`,
            deletedCount
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/cache/clear/{pattern}:
 *   delete:
 *     summary: Clear cache by pattern
 *     description: Clears cached data matching the specified pattern
 *     parameters:
 *       - in: path
 *         name: pattern
 *         required: true
 *         schema:
 *           type: string
 *         description: Cache key pattern (e.g., 'summary', 'performanceMarketing')
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 */
router.delete('/clear/:pattern', async (req, res) => {
    try {
        const { pattern } = req.params;
        const cachePattern = `watchtower:${pattern}*`;
        const deletedCount = await deleteCached(cachePattern);

        res.json({
            success: true,
            message: `Cleared ${deletedCount} cache entries matching pattern '${pattern}'`,
            deletedCount
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
