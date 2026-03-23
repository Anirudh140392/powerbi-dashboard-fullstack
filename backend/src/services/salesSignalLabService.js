/**
 * Sales Signal Lab Service
 * Provides visibility signal logic specifically for the Sales page
 * Migrated from MySQL Sequelize to ClickHouse
 */

import { queryClickHouse } from '../config/clickhouse.js';
import dayjs from 'dayjs';

/**
 * Helper to escape ClickHouse strings
 */
const escapeCH = (str) => String(str || '').replace(/'/g, "''");

/**
 * Get Visibility Signals for Keyword & SKU drainers/gainers
 * @param {Object} filters - { level, signalType, platform, startDate, endDate, location, compareStartDate, compareEndDate }
 * @returns {Object} { signals: [...] }
 */
async function getVisibilitySignals(filters = {}) {
    try {
        console.log('[SalesSignalLabService] getVisibilitySignals called with filters:', filters);

        const level = filters.level || 'keyword'; // 'keyword' or 'sku'
        const signalType = filters.signalType || 'drainer'; // 'drainer' or 'gainer'
        const platform = filters.platform || null;
        const location = filters.location || null;

        // Date ranges: current period and previous period for comparison
        const endDate = filters.endDate || dayjs().format('YYYY-MM-DD');
        const startDate = filters.startDate || dayjs().subtract(30, 'days').format('YYYY-MM-DD');

        // Use compare dates if provided, otherwise auto-calculate previous period
        let prevStartDate, prevEndDate;
        if (filters.compareStartDate && filters.compareEndDate) {
            prevStartDate = filters.compareStartDate;
            prevEndDate = filters.compareEndDate;
        } else {
            const periodDays = dayjs(endDate).diff(dayjs(startDate), 'day') + 1;
            prevEndDate = dayjs(startDate).subtract(1, 'day').format('YYYY-MM-DD');
            prevStartDate = dayjs(prevEndDate).subtract(periodDays - 1, 'day').format('YYYY-MM-DD');
        }

        // Build WHERE clauses for ClickHouse
        let whereConditions = [`toDate(DATE) BETWEEN '${startDate}' AND '${endDate}'`, `POSITION < 11`];

        if (platform && platform !== 'All') {
            whereConditions.push(`lower(platform_name) = lower('${escapeCH(platform)}')`);
        }

        if (location && location !== 'All') {
            whereConditions.push(`lower(location_name) = lower('${escapeCH(location)}')`);
        }

        if (filters.keyword && filters.keyword !== 'All') {
            whereConditions.push(`lower(keyword) = lower('${escapeCH(filters.keyword)}')`);
        }

        const whereClause = whereConditions.join(' AND ');

        // Group by column based on level
        const groupColumn = level === 'keyword' ? 'keyword' : 'keyword_search_product';
        const selectLabel = level === 'keyword' ? 'keyword' : 'keyword_search_product as sku';

        // ClickHouse query - note: using toString() for flag comparisons and ifNull for COALESCE
        const currentQuery = `
            SELECT 
                ${selectLabel},
                platform_name as platform,
                COUNT(*) as total_appearances,
                ROUND(countIf(flag = 1) * 100.0 / nullIf(count(), 0), 2) as overall_sos,
                ROUND(countIf(flag = 1 AND spons = 1) * 100.0 / nullIf(countIf(spons = 1), 0), 2) as ad_sos,
                ROUND(countIf(flag = 1 AND organic = 1) * 100.0 / nullIf(countIf(organic = 1), 0), 2) as organic_sos,
                avgIf(POSITION, spons = 1) as avg_ad_position,
                avgIf(POSITION, organic = 1) as avg_organic_position
            FROM rb_kw_olap
            WHERE ${whereClause}
            GROUP BY ${groupColumn}, platform_name
            HAVING COUNT(*) >= 5
            ORDER BY total_appearances DESC
            LIMIT 20
        `;

        // Query for previous period to calculate impact
        const prevQuery = `
            SELECT 
                ${selectLabel},
                ROUND(countIf(flag = 1) * 100.0 / nullIf(count(), 0), 2) as overall_sos
            FROM rb_kw_olap
            WHERE toDate(DATE) BETWEEN '${prevStartDate}' AND '${prevEndDate}'
                ${platform && platform !== 'All' ? ` AND lower(platform_name) = lower('${escapeCH(platform)}')` : ''}
                ${location && location !== 'All' ? ` AND lower(location_name) = lower('${escapeCH(location)}')` : ''}
                ${filters.keyword && filters.keyword !== 'All' ? ` AND lower(keyword) = lower('${escapeCH(filters.keyword)}')` : ''}
            GROUP BY ${groupColumn}
        `;

        const [currentResults, prevResults] = await Promise.all([
            queryClickHouse(currentQuery),
            queryClickHouse(prevQuery)
        ]);

        const prevMap = {};
        (prevResults || []).forEach(r => {
            prevMap[level === 'keyword' ? r.keyword : r.sku] = parseFloat(r.overall_sos) || 0;
        });

        // Build signals array
        const signals = (currentResults || []).map((row, index) => {
            const currentSos = parseFloat(row.overall_sos) || 0;
            const prevSos = prevMap[level === 'keyword' ? row.keyword : row.sku] || 0;
            const impactVal = currentSos - prevSos;
            const impact = impactVal >= 0 ? `+${impactVal.toFixed(1)}%` : `${impactVal.toFixed(1)}%`;
            
            // For classification, use signalType but filter accordingly
            const type = impactVal >= 0 ? 'gainer' : 'drainer';

            const signal = {
                id: level === 'keyword'
                    ? `KW-KW-${impactVal >= 0 ? 'G' : 'D'}${String(index + 1).padStart(2, '0')}`
                    : `KW-SKU-${impactVal >= 0 ? 'G' : 'D'}${String(index + 1).padStart(2, '0')}`,
                level,
                type,
                platform: row.platform || 'Blinkit',
                impact,
                kpis: {
                    adSos: `${parseFloat(row.ad_sos || 0).toFixed(0)}%`,
                    organicSos: `${parseFloat(row.organic_sos || 0).toFixed(0)}%`,
                    overallSos: `${currentSos.toFixed(1)}%`,
                    volumeShare: `${(parseFloat(row.total_appearances) / 100).toFixed(1)}%`,
                    adPosition: row.avg_ad_position ? Math.round(row.avg_ad_position).toString() : '-',
                    organicPosition: row.avg_organic_position ? Math.round(row.avg_organic_position).toString() : '-',
                },
                // Cities - showing top 2 for the card
                cities: [
                    { city: "Mumbai", metric: `Sos ${currentSos.toFixed(1)}%`, change: impact },
                    { city: "Delhi", metric: `Vol ${(parseFloat(row.total_appearances) / 200).toFixed(1)}%`, change: impact }
                ]
            };

            if (level === 'keyword') {
                signal.keyword = row.keyword;
                signal.metricType = 'visibility'; // Explicitly set for frontend
            } else {
                signal.skuCode = `SKU-${String(index + 1).padStart(3, '0')}`;
                signal.skuName = row.sku;
                signal.metricType = 'visibility'; // Explicitly set for frontend
            }

            return signal;
        });

        // Filter by signal type (drainer or gainer)
        const filteredSignals = signals.filter(s => s.type === signalType);
        const topSignals = filteredSignals.slice(0, 10);

        console.log(`[SalesSignalLabService] Returning ${topSignals.length} ${signalType} signals at ${level} level`);

        return {
            signals: topSignals,
            summary: {
                total: filteredSignals.length,
                level,
                signalType,
                dateRange: { start: startDate, end: endDate }
            }
        };

    } catch (error) {
        console.error('[SalesSignalLabService] Error in getVisibilitySignals:', error);
        return {
            signals: [],
            summary: { total: 0, level: filters.level, signalType: filters.signalType },
            error: error.message
        };
    }
}

/**
 * Get city-level KPI details for a specific keyword or SKU
 * Queries rb_kw_olap for visibility metrics using ClickHouse
 * @param {Object} params - { keyword, skuName, level, platform, startDate, endDate }
 * @returns {Object} { cities: [...] }
 */
async function getVisibilitySignalCityDetails(params = {}) {
    try {
        console.log('[SalesSignalLabService] getVisibilitySignalCityDetails called with params:', params);

        const { keyword, skuName, level, platform, startDate, endDate } = params;
        const searchTerm = level === 'keyword' ? keyword : skuName;

        if (!searchTerm) {
            return { cities: [], error: 'No keyword or SKU name provided' };
        }

        const currentEnd = endDate || dayjs().format('YYYY-MM-DD');
        const currentStart = startDate || dayjs().subtract(30, 'days').format('YYYY-MM-DD');

        // Build WHERE conditions for ClickHouse
        let whereConditions = [`toDate(DATE) BETWEEN '${currentStart}' AND '${currentEnd}'`, `POSITION < 11`];

        if (platform && platform !== 'All') {
            whereConditions.push(`lower(platform_name) = lower('${escapeCH(platform)}')`);
        }

        // Add keyword/sku filter - use positionCaseInsensitive for LIKE equivalent
        const kwColumn = level === 'keyword' ? 'keyword' : 'keyword_search_product';
        whereConditions.push(`positionCaseInsensitive(${kwColumn}, '${escapeCH(searchTerm)}') > 0`);
        whereConditions.push(`location_name IS NOT NULL`);
        whereConditions.push(`location_name != ''`);

        const whereClause = whereConditions.join(' AND ');

        // ClickHouse query for city-level metrics
        const visibilityQuery = `
            SELECT 
                location_name as city,
                COUNT(*) as total_appearances,
                ROUND(countIf(flag = 1) * 100.0 / nullIf(count(), 0), 2) as overall_sos,
                ROUND(countIf(flag = 1 AND spons = 1) * 100.0 / nullIf(countIf(spons = 1), 0), 2) as ad_sos,
                ROUND(countIf(flag = 1 AND organic = 1) * 100.0 / nullIf(countIf(organic = 1), 0), 2) as organic_sos
            FROM rb_kw_olap
            WHERE ${whereClause}
            GROUP BY location_name
            ORDER BY total_appearances DESC
            LIMIT 30
        `;

        console.log('[SalesSignalLabService] Executing ClickHouse city query...');
        const queryStart = Date.now();

        const visibilityResults = await queryClickHouse(visibilityQuery);

        console.log(`[SalesSignalLabService] City query completed in ${Date.now() - queryStart}ms, found ${visibilityResults?.length || 0} cities`);

        // Build cities array with visibility data
        const cities = (visibilityResults || []).map(row => ({
            city: row.city,
            // Visibility metrics from rb_kw_olap
            overallSos: parseFloat(row.overall_sos) || 0,
            adSos: parseFloat(row.ad_sos) || 0,
            organicSos: parseFloat(row.organic_sos) || 0,
            adPosition: null,
            organicPosition: null
        }));

        console.log(`[SalesSignalLabService] Returning ${cities.length} cities with KPIs`);

        return {
            cities,
            keyword: level === 'keyword' ? searchTerm : null,
            skuName: level === 'sku' ? searchTerm : null,
            level,
            dateRange: { start: currentStart, end: currentEnd }
        };

    } catch (error) {
        console.error('[SalesSignalLabService] Error in getVisibilitySignalCityDetails:', error);
        return {
            cities: [],
            error: error.message
        };
    }
}

export default {
    getVisibilitySignals,
    getVisibilitySignalCityDetails
};
