import KeyMetrics from '../models/KeyMetrics.js';
import { getCachedOrCompute, CACHE_TTL } from '../utils/cacheHelper.js';

/**
 * Get a specific metric value by key
 * @param {string} key - The metric key
 * @returns {Promise<string|null>} The metric value or null if not found
 */
export async function getMetric(key) {
    const cacheKey = `metric:${key}`;
    return getCachedOrCompute(cacheKey, async () => {
        try {
            const metric = await KeyMetrics.findOne({
                where: { key }
            });
            return metric ? metric.value : null;
        } catch (error) {
            console.error(`Error fetching metric ${key}:`, error);
            return null;
        }
    }, CACHE_TTL.STATIC); // 24 hours - individual metrics rarely change
}

/**
 * Get all metrics as a key-value object
 */
export async function getAllMetrics() {
    return getCachedOrCompute('all_metrics', async () => {
        try {
            const metrics = await KeyMetrics.findAll();
            const result = {};
            metrics.forEach(metric => {
                result[metric.key] = metric.value;
            });
            return result;
        } catch (error) {
            console.error('Error fetching all metrics:', error);
            return {};
        }
    }, CACHE_TTL.STATIC); // 24 hours - metrics rarely change
}

/**
 * Set or update a metric value
 * @param {string} key - The metric key
 * @param {string} value - The metric value
 * @returns {Promise<boolean>} Success status
 */
export async function setMetric(key, value) {
    try {
        await KeyMetrics.upsert({ key, value });
        return true;
    } catch (error) {
        console.error(`Error setting metric ${key}:`, error);
        return false;
    }
}

/**
 * Delete a metric by key
 * @param {string} key - The metric key
 * @returns {Promise<boolean>} Success status
 */
export async function deleteMetric(key) {
    try {
        const deleted = await KeyMetrics.destroy({
            where: { key }
        });
        return deleted > 0;
    } catch (error) {
        console.error(`Error deleting metric ${key}:`, error);
        return false;
    }
}

/**
 * Get all metric keys (for dropdowns)
 * @returns {Promise<Array<string>>} Array of metric keys
 */
export async function getAllMetricKeys() {
    return getCachedOrCompute('metric_keys', async () => {
        try {
            const metrics = await KeyMetrics.findAll({
                attributes: ['key', 'value'],
                order: [['key', 'ASC']]
            });
            return metrics.map(m => ({
                key: m.key,
                value: m.value
            }));
        } catch (error) {
            console.error('Error fetching metric keys:', error);
            return []; // Return empty array instead of throwing
        }
    }, CACHE_TTL.STATIC); // Cache for 24 hours - metric keys rarely change
}

export default {
    getMetric,
    getAllMetrics,
    setMetric,
    deleteMetric,
    getAllMetricKeys
};
