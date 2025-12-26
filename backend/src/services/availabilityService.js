import { Op } from 'sequelize';
import dayjs from 'dayjs';
import sequelize from '../config/db.js';
import RbPdpOlap from '../models/RbPdpOlap.js';
import { getCachedOrCompute, generateCacheKey, CACHE_TTL } from '../utils/cacheHelper.js';

const getAssortment = async (filters) => {
    // Generate cache key based on filters
    const cacheKey = generateCacheKey('assortment', filters);

    return getCachedOrCompute(cacheKey, async () => {
        try {
            const { platform, months, startDate, endDate, brand, location } = filters;
            const whereClause = {};

            // Determine the target date (last date of the period)
            let targetDate;
            if (endDate) {
                targetDate = dayjs(endDate).format('YYYY-MM-DD');
            } else {
                targetDate = dayjs().format('YYYY-MM-DD');
            }

            // Update whereClause to filter by this specific date instead of a range
            whereClause.DATE = targetDate;

            // Brand Filter
            if (brand && brand !== 'All') {
                whereClause.Brand = brand;
            }

            // Location Filter
            if (location && location !== 'All') {
                whereClause.Location = location;
            }

            // Platform Filter - only apply if specific platform selected, otherwise get all for breakdown
            if (platform && platform !== 'All') {
                whereClause.Platform = platform;
            }

            const results = await RbPdpOlap.findAll({
                attributes: [
                    'Platform',
                    [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('Web_Pid'))), 'count']
                ],
                where: whereClause,
                group: ['Platform'],
                raw: true
            });

            // Convert to object { Platform: Count }
            const assortmentMap = {};
            results.forEach(r => {
                const count = parseInt(r.count, 10);
                assortmentMap[r.Platform] = count;
            });

            const totalAssortmentCount = await RbPdpOlap.count({
                distinct: true,
                col: 'Web_Pid',
                where: whereClause
            });

            return {
                breakdown: assortmentMap,
                total: totalAssortmentCount,
                date: targetDate
            };
        } catch (error) {
            console.error('Error calculating Assortment:', error);
            throw error;
        }
    }, CACHE_TTL.SHORT); // 5 minutes - assortment data is fairly static
};

export default {
    getAssortment
};
