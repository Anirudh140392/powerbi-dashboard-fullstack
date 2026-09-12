import { queryClickHouse, getCurrentDbName } from '../config/clickhouse.js';
import dayjs from 'dayjs';
import { getCachedOrCompute, generateCacheKey, CACHE_TTL } from '../utils/cacheHelper.js';

const THRESHOLD_DOH = 8; // Default threshold for DOH
const UNITS_PER_BOX = 24; // Units per box for replenishment calculation
// const RESTRICTED_CATEGORIES = ['Bath & Body', 'Detergent', 'Hair Care', 'Fragrance & talc']; // Removed to allow all categories

const getFilterMetadata = async (whereClause, params) => {
    try {
        const dbName = getCurrentDbName();
        // Top-level Category is now always 'Category' in both Mars and Default PDP tables
        const catCol = 'Category';
        whereClause = whereClause || '1=1'; // Corrected variable name from 'where' to 'whereClause'

        const query = `
        SELECT DISTINCT
            Platform as platform,
            Brand as brand,
            ${catCol} as category,
            Product as sku,
            Location as city
        FROM rb_pdp_olap
        WHERE ${whereClause} AND Comp_flag = 0
        GROUP BY Platform, Brand, ${catCol}, Product, Location
    `;

        const results = await queryClickHouse(query, params);

        return {
            platforms: [...new Set(results.map(r => r.platform))].filter(Boolean).sort(),
            brands: [...new Set(results.map(r => r.brand))].filter(Boolean).sort(),
            categories: [...new Set(results.map(r => r.category))].filter(Boolean).sort(),
            skus: [...new Set(results.map(r => r.sku))].filter(Boolean).sort(),
            cities: [...new Set(results.map(r => r.city))].filter(Boolean).sort()
        };
    } catch (error) {
        console.error("❌ [InventoryAnalysis] Error fetching filter metadata:", error);
        throw error;
    }
};



/**
 * Inventory Analysis Service
 * Provides real data for DOH, DRR, and Total Boxes Required metrics
 */
const inventoryAnalysisService = {

    /**
     * Get Inventory Overview with DOH, DRR, and Total Boxes Required
     * @param {Object} filters - Filter parameters
     * @param {string} filters.platform - Platform filter
     * @param {string} filters.brand - Brand filter
     * @param {string} filters.location - Location/City filter
     * @param {string} filters.startDate - Start date for current period
     * @param {string} filters.endDate - End date for current period
     * @param {string} filters.compareStartDate - Start date for comparison period
     * @param {string} filters.compareEndDate - End date for comparison period
     */
    async getInventoryOverview(filters) {
        console.log("🔍 [InventoryAnalysis] Fetching overview (ClickHouse) with filters:", filters);
        const cacheKey = generateCacheKey('inventory_overview_v2', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                const endDate = filters.endDate ? dayjs(filters.endDate) : dayjs();
                const startDate = filters.startDate ? dayjs(filters.startDate) : endDate.subtract(6, 'days');
                const duration = endDate.diff(startDate, 'day') + 1;

                const compareEndDate = filters.compareEndDate ? dayjs(filters.compareEndDate) : startDate.subtract(1, 'day');
                const compareStartDate = filters.compareStartDate ? dayjs(filters.compareStartDate) : compareEndDate.subtract(duration - 1, 'day');

                const buildSqlWhere = (start, end) => {
                    let where = `toDate(DATE) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'`;
                    where += ` AND Comp_flag = 0`;
                    const params = {};

                    if (filters.channel && filters.channel !== 'All') {
                        const channels = filters.channel.split(',').map(c => c.trim());
                        where += ` AND channel IN (${channels.map(c => `'${c}'`).join(',')})`;
                    }
                    if (filters.platform && filters.platform !== 'All') {
                        const platforms = filters.platform.split(',').map(p => p.trim());
                        where += ` AND Platform IN (${platforms.map(p => `'${p}'`).join(',')})`;
                    }
                    if (filters.brand && filters.brand !== 'All') {
                        const brands = filters.brand.split(',').map(b => b.trim());
                        where += ` AND Brand IN (${brands.map(b => `'${b}'`).join(',')})`;
                    }
                    if (filters.location && filters.location !== 'All') {
                        const locations = filters.location.split(',').map(l => l.trim());
                        where += ` AND Location IN (${locations.map(l => `'${l}'`).join(',')})`;
                    }

                    // RESTRICTED_CATEGORIES logic removed to allow all categories
                    if (filters.category && filters.category !== 'All') {
                        // Category column is now standardized to 'Category'
                        const catCol = 'Category';
                        const requested = filters.category.split(',').map(c => c.trim());
                        where += ` AND ${catCol} IN (${requested.map(c => `'${c}'`).join(',')})`;
                    }

                    if (filters.msl && filters.msl !== 'All') {
                        const msls = filters.msl.split(',').map(m => m.trim());
                        if (msls.includes('1') && !msls.includes('0')) {
                            where += ` AND toString(msl) = '1'`;
                        }
                    }

                    return where;
                };

                // 2. Fetch Metrics (Per period aggregation)
                const getMetricsSql = (start, end) => {
                    const where = buildSqlWhere(start, end);
                    const periodDays = end.diff(start, 'day') + 1;
                    return `
                        SELECT
                            sum(drr) as totalDrr,
                            sum(inventory) as totalInventory,
                            sum(poQty) as totalPoQty,
                            count() as pairCount
                        FROM (
                            SELECT
                                Product,
                                Location,
                                argMax(ifNull(toFloat64OrZero(toString(Inventory)), 0), DATE) as inventory,
                                sum(ifNull(Qty_Sold, 0)) / ${periodDays} as drr,
                                if(isNaN(if(drr > 0, inventory / drr, 0)), 0, if(drr > 0, inventory / drr, 0)) as doh,
                                if(isNaN(if(${THRESHOLD_DOH} > doh, (${THRESHOLD_DOH} - doh) * drr, 0)), 0, if(${THRESHOLD_DOH} > doh, (${THRESHOLD_DOH} - doh) * drr, 0)) as poQty
                            FROM rb_pdp_olap
                            WHERE ${where}
                            GROUP BY Product, Location
                        )
                    `;
                };

                const [currentData, compareData] = await Promise.all([
                    queryClickHouse(getMetricsSql(startDate, endDate)),
                    queryClickHouse(getMetricsSql(compareStartDate, compareEndDate))
                ]);

                const currentMetrics = {
                    drr: parseFloat(currentData[0]?.totalDrr || 0),
                    totalInventory: parseFloat(currentData[0]?.totalInventory || 0),
                    totalPoQty: parseFloat(currentData[0]?.totalPoQty || 0),
                    totalBoxesRequired: Math.round(parseFloat(currentData[0]?.totalPoQty || 0) / UNITS_PER_BOX),
                    doh: parseFloat(currentData[0]?.totalDrr || 0) > 0 ? parseFloat(currentData[0]?.totalInventory || 0) / parseFloat(currentData[0]?.totalDrr || 0) : 0,
                    periodDays: duration
                };

                const compareMetrics = {
                    drr: parseFloat(compareData[0]?.totalDrr || 0),
                    totalBoxesRequired: Math.round(parseFloat(compareData[0]?.totalPoQty || 0) / UNITS_PER_BOX),
                    doh: parseFloat(compareData[0]?.totalDrr || 0) > 0 ? parseFloat(compareData[0]?.totalInventory || 0) / parseFloat(compareData[0]?.totalDrr || 0) : 0
                };

                // 3. Fetch Trend Data for Sparklines
                const trendQuery = `
                    SELECT
                        toDate(DATE) as date,
                        sum(inventory) as inventory,
                        sum(qtySold) as qtySold,
                        sum(poQty) as poQty
                    FROM (
                        SELECT
                            DATE,
                            Product,
                            Location,
                            argMax(ifNull(toFloat64OrZero(toString(Inventory)), 0), DATE) as inventory,
                            sum(ifNull(Qty_Sold, 0)) as qtySold,
                            if(isNaN(if(qtySold > 0, inventory / qtySold, (if(inventory > 0, 99, 0)))), 0, if(qtySold > 0, inventory / qtySold, (if(inventory > 0, 99, 0)))) as doh,
                            if(isNaN(if(${THRESHOLD_DOH} > doh, (${THRESHOLD_DOH} - doh) * qtySold, 0)), 0, if(${THRESHOLD_DOH} > doh, (${THRESHOLD_DOH} - doh) * qtySold, 0)) as poQty
                        FROM rb_pdp_olap
                        WHERE ${buildSqlWhere(startDate, endDate)}
                        GROUP BY DATE, Product, Location
                    )
                    GROUP BY date
                    ORDER BY date ASC
                `;

                const trendData = await queryClickHouse(trendQuery);

                const calculateChange = (current, previous) => {
                    if (previous === 0) return current === 0 ? 0 : 100;
                    return ((current - previous) / previous) * 100;
                };

                const dohChange = calculateChange(currentMetrics.doh, compareMetrics.doh);
                const drrChange = calculateChange(currentMetrics.drr, compareMetrics.drr);
                const boxesChange = calculateChange(currentMetrics.totalBoxesRequired, compareMetrics.totalBoxesRequired);

                const dohSparkline = trendData.map(d => parseFloat(d.qtySold) > 0 ? parseFloat(d.inventory) / parseFloat(d.qtySold) : (parseFloat(d.inventory) > 0 ? 99 : 0));
                const drrSparkline = trendData.map(d => parseFloat(d.qtySold));
                const boxesSparkline = trendData.map(d => Math.ceil(parseFloat(d.poQty) / UNITS_PER_BOX));
                const trendLabels = trendData.map(d => dayjs(d.date).format('MMM DD'));

                const formatNumber = (num) => {
                    if (num >= 10000000) return `${(num / 10000000).toFixed(2)} Cr`;
                    if (num >= 100000) return `${(num / 100000).toFixed(2)} Lacs`;
                    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
                    return Math.round(num).toString();
                };

                return {
                    metrics: {
                        doh: {
                            value: currentMetrics.doh.toFixed(1),
                            previousValue: compareMetrics.doh.toFixed(1),
                            change: dohChange.toFixed(1),
                            changePoints: (currentMetrics.doh - compareMetrics.doh).toFixed(1),
                            isPositive: dohChange >= 0,
                            sparkline: dohSparkline.length > 0 ? dohSparkline : [0],
                            labels: trendLabels.length > 0 ? trendLabels : [startDate.format('MMM DD')]
                        },
                        drr: {
                            value: formatNumber(currentMetrics.drr),
                            previousValue: formatNumber(compareMetrics.drr),
                            change: drrChange.toFixed(1),
                            isPositive: drrChange >= 0,
                            sparkline: drrSparkline.length > 0 ? drrSparkline : [0],
                            labels: trendLabels.length > 0 ? trendLabels : [startDate.format('MMM DD')]
                        },
                        totalBoxesRequired: {
                            value: formatNumber(currentMetrics.totalBoxesRequired),
                            rawValue: currentMetrics.totalPoQty,
                            previousValue: compareMetrics.totalBoxesRequired,
                            change: boxesChange.toFixed(1),
                            changePoints: (currentMetrics.totalBoxesRequired - compareMetrics.totalBoxesRequired).toFixed(1),
                            isPositive: boxesChange <= 0,
                            sparkline: boxesSparkline.length > 0 ? boxesSparkline : [0],
                            labels: trendLabels.length > 0 ? trendLabels : [startDate.format('MMM DD')]
                        }
                    },
                    summary: {
                        totalInventory: formatNumber(currentMetrics.totalInventory),
                        periodDays: currentMetrics.periodDays,
                        thresholdDoh: THRESHOLD_DOH
                    },
                    dateRange: {
                        start: startDate.format('YYYY-MM-DD'),
                        end: endDate.format('YYYY-MM-DD'),
                        compareStart: compareStartDate.format('YYYY-MM-DD'),
                        compareEnd: compareEndDate.format('YYYY-MM-DD')
                    }
                };
            } catch (error) {
                console.error("❌ [InventoryAnalysis] Error fetching overview:", error);
                throw error;
            }
        }, CACHE_TTL.ONE_HOUR);
    },
    /**
     * Get available channels for filter dropdown
     */
    async getChannels() {
        const cacheKey = generateCacheKey('inventory_channels_v1', {});
        return await getCachedOrCompute(cacheKey, async () => {
            try {
                const query = `SELECT DISTINCT channel as channel FROM rb_pdp_olap WHERE channel IS NOT NULL AND channel != '' AND Comp_flag = 0 ORDER BY channel ASC`;
                const results = await queryClickHouse(query);
                return results.map(c => c.channel);
            } catch (error) {
                console.error("❌ [InventoryAnalysis] Error fetching channels:", error);
                return [];
            }
        }, CACHE_TTL.LONG);
    },

    /**
     * Get available platforms for filter dropdown
     */
    async getPlatforms(channel) {
        const cacheKey = generateCacheKey('inventory_platforms_v3', { channel });
        return await getCachedOrCompute(cacheKey, async () => {
            try {
                let query = `SELECT DISTINCT Platform as platform FROM rb_pdp_olap WHERE Platform IS NOT NULL AND Platform != '' AND Comp_flag = 0`;
                if (channel && channel !== 'All') {
                    const channels = channel.split(',').map(c => c.trim());
                    query += ` AND channel IN (${channels.map(c => `'${c}'`).join(',')})`;
                }
                query += ` ORDER BY platform ASC`;
                const results = await queryClickHouse(query);
                return results.map(p => p.platform);
            } catch (error) {
                console.error("❌ [InventoryAnalysis] Error fetching platforms:", error);
                return [];
            }
        }, CACHE_TTL.LONG);
    },

    /**
     * Get available categories for filter dropdown
     */
    async getCategories(channel, platform) {
        const cacheKey = generateCacheKey('inventory_categories_v3', { channel, platform });
        return await getCachedOrCompute(cacheKey, async () => {
            try {
                let query = `SELECT DISTINCT Category as category FROM rb_pdp_olap WHERE Category IS NOT NULL AND Category != '' AND Comp_flag = 0`;
                if (channel && channel !== 'All') {
                    const channels = channel.split(',').map(c => c.trim());
                    query += ` AND channel IN (${channels.map(c => `'${c}'`).join(',')})`;
                }
                if (platform && platform !== 'All') {
                    const platforms = platform.split(',').map(p => p.trim());
                    query += ` AND Platform IN (${platforms.map(p => `'${p}'`).join(',')})`;
                }
                query += ` ORDER BY category ASC`;
                const results = await queryClickHouse(query);
                return results.map(c => c.category);
            } catch (error) {
                console.error("❌ [InventoryAnalysis] Error fetching categories:", error);
                return [];
            }
        }, CACHE_TTL.LONG);
    },

    /**
     * Get available brands for filter dropdown
     */
    async getBrands(channel, platform, category) {
        const cacheKey = generateCacheKey('inventory_brands_v4', { channel, platform, category });
        return await getCachedOrCompute(cacheKey, async () => {
            try {
                let query = `SELECT DISTINCT Brand as brand FROM rb_pdp_olap WHERE Brand IS NOT NULL AND Brand != '' AND Comp_flag = 0`;
                if (channel && channel !== 'All') {
                    const channels = channel.split(',').map(c => c.trim());
                    query += ` AND channel IN (${channels.map(c => `'${c}'`).join(',')})`;
                }
                if (platform && platform !== 'All') {
                    const platforms = platform.split(',').map(p => p.trim());
                    query += ` AND Platform IN (${platforms.map(p => `'${p}'`).join(',')})`;
                }
                if (category && category !== 'All') {
                    const categories = category.split(',').map(c => c.trim());
                    query += ` AND Category IN (${categories.map(c => `'${c}'`).join(',')})`;
                }
                query += ` ORDER BY brand ASC`;
                const results = await queryClickHouse(query);
                return results.map(b => b.brand);
            } catch (error) {
                console.error("❌ [InventoryAnalysis] Error fetching brands:", error);
                return [];
            }
        }, CACHE_TTL.LONG);
    },

    /**
     * Get available locations for filter dropdown
     */
    async getLocations(channel, platform, brand, category) {
        const cacheKey = generateCacheKey('inventory_locations_v3', { channel, platform, brand, category });
        return await getCachedOrCompute(cacheKey, async () => {
            try {
                let query = `SELECT DISTINCT Location as location FROM rb_pdp_olap WHERE Location IS NOT NULL AND Location != '' AND Comp_flag = 0`;
                if (channel && channel !== 'All') {
                    const channels = channel.split(',').map(c => c.trim());
                    query += ` AND channel IN (${channels.map(c => `'${c}'`).join(',')})`;
                }
                if (platform && platform !== 'All') {
                    const platforms = platform.split(',').map(p => p.trim());
                    query += ` AND Platform IN (${platforms.map(p => `'${p}'`).join(',')})`;
                }
                if (category && category !== 'All') {
                    const categories = category.split(',').map(c => c.trim());
                    query += ` AND Category IN (${categories.map(c => `'${c}'`).join(',')})`;
                }
                if (brand && brand !== 'All') {
                    const brands = brand.split(',').map(b => b.trim());
                    query += ` AND Brand IN (${brands.map(b => `'${b}'`).join(',')})`;
                }
                query += ` ORDER BY location ASC`;
                const results = await queryClickHouse(query);
                return results.map(l => l.location);
            } catch (error) {
                console.error("❌ [InventoryAnalysis] Error fetching locations:", error);
                return [];
            }
        }, CACHE_TTL.LONG);
    },

    /**
     * Get available MSL values for filter dropdown
     */
    async getMsls(channel, platform, category, brand, location) {
        const cacheKey = generateCacheKey('inventory_msls_v1', { channel, platform, category, brand, location });
        return await getCachedOrCompute(cacheKey, async () => {
            try {
                let query = `SELECT DISTINCT toString(msl) as msl FROM rb_pdp_olap WHERE msl IS NOT NULL AND toString(msl) != '' AND Comp_flag = 0`;
                if (channel && channel !== 'All') {
                    const channels = channel.split(',').map(c => c.trim());
                    query += ` AND channel IN (${channels.map(c => `'${c}'`).join(',')})`;
                }
                if (platform && platform !== 'All') {
                    const platforms = platform.split(',').map(p => p.trim());
                    query += ` AND Platform IN (${platforms.map(p => `'${p}'`).join(',')})`;
                }
                if (category && category !== 'All') {
                    const categories = category.split(',').map(c => c.trim());
                    query += ` AND Category IN (${categories.map(c => `'${c}'`).join(',')})`;
                }
                if (brand && brand !== 'All') {
                    const brands = brand.split(',').map(b => b.trim());
                    query += ` AND Brand IN (${brands.map(b => `'${b}'`).join(',')})`;
                }
                if (location && location !== 'All') {
                    const locations = location.split(',').map(l => l.trim());
                    query += ` AND Location IN (${locations.map(l => `'${l}'`).join(',')})`;
                }
                query += ` ORDER BY msl ASC`;
                const results = await queryClickHouse(query);
                return results.map(r => r.msl);
            } catch (error) {
                console.error("❌ [InventoryAnalysis] Error fetching MSL values:", error);
                return [];
            }
        }, CACHE_TTL.LONG);
    },

    /**
     * Get Inventory Matrix (SKU x City) with basic inventory totals
     */
    async getInventoryMatrix(filters) {
        console.log("🔍 [DEBUG_VERIFY_FIX_123] Fetching basic matrix (ClickHouse) with filters:", filters);
        const cacheKey = generateCacheKey('inventory_matrix_v3', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                const endDate = filters.endDate ? dayjs(filters.endDate) : dayjs();
                const startDate = filters.startDate ? dayjs(filters.startDate) : endDate.subtract(6, 'days');

                const buildSqlWhere = (start, end) => {
                    let where = `toDate(DATE) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'`;
                    where += ` AND Comp_flag = 0`;
                    if (filters.channel && filters.channel !== 'All') {
                        const channels = filters.channel.split(',').map(c => c.trim());
                        where += ` AND channel IN (${channels.map(c => `'${c}'`).join(',')})`;
                    }
                    if (filters.platform && filters.platform !== 'All') {
                        const platforms = filters.platform.split(',').map(p => p.trim());
                        where += ` AND Platform IN (${platforms.map(p => `'${p}'`).join(',')})`;
                    }
                    if (filters.brand && filters.brand !== 'All') {
                        const brands = filters.brand.split(',').map(b => b.trim());
                        where += ` AND Brand IN (${brands.map(b => `'${b}'`).join(',')})`;
                    }
                    if (filters.location && filters.location !== 'All') {
                        const locations = filters.location.split(',').map(l => l.trim());
                        where += ` AND Location IN (${locations.map(l => `'${l}'`).join(',')})`;
                    }

                    // RESTRICTED_CATEGORIES removed
                    if (filters.category && filters.category !== 'All') {
                        const catCol = 'Category';
                        const requested = filters.category.split(',').map(c => c.trim());
                        where += ` AND ${catCol} IN (${requested.map(c => `'${c}'`).join(',')})`;
                    }
                    if (filters.msl && filters.msl !== 'All') {
                        const msls = filters.msl.split(',').map(m => m.trim());
                        if (msls.includes('1') && !msls.includes('0')) {
                            where += ` AND toString(msl) = '1'`;
                        }
                    }
                    return where;
                };

                // Standardize category column
                const catCol = 'Category';

                let sqlWhere = buildSqlWhere(startDate, endDate);
                const metadata = await getFilterMetadata(`toDate(DATE) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`);

                const matrixQuery = `
                    SELECT 
                        Product as sku,
                        Location as city,
                        Brand as brand,
                        ${catCol} as category,
                        sum(offtakeValue) as offtake_qty,
                        argMax(inventory, DATE) as inventory
                    FROM (
                        SELECT 
                            Product, Location, Brand, ${catCol}, Platform, DATE,
                            sum(ifNull(Qty_Sold, 0)) as offtakeValue,
                            argMax(ifNull(toFloat64OrZero(toString(Inventory)), 0), DATE) as inventory
                        FROM rb_pdp_olap
                        WHERE ${sqlWhere}
                        GROUP BY Product, Location, Brand, ${catCol}, Platform, DATE
                    )
                    GROUP BY Product, Location, Brand, ${catCol}
                `;

                const results = await queryClickHouse(matrixQuery);
                return { data: results, metadata };
            } catch (error) {
                console.error("❌ [InventoryAnalysis] Error fetching matrix:", error);
                throw error;
            }
        }, CACHE_TTL.ONE_HOUR);
    },

    /**
     * Get Inventory Matrix (SKU x City) with full metrics for drilldown
     */
    async getCitySkuMatrix(filters) {
        console.log("🔍 [InventoryAnalysis] Fetching city-sku matrix (ClickHouse) with filters:", filters);
        const cacheKey = generateCacheKey('inventory_city_sku_matrix_v2', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                const endDate = filters.endDate ? dayjs(filters.endDate) : dayjs();
                const startDate = filters.startDate ? dayjs(filters.startDate) : endDate.subtract(6, 'days');
                const periodDays = endDate.diff(startDate, 'day') + 1;

                const buildSqlWhere = (start, end) => {
                    let where = `toDate(DATE) BETWEEN '${start.format('YYYY-MM-DD')}' AND '${end.format('YYYY-MM-DD')}'`;
                    where += ` AND Comp_flag = 0`;
                    if (filters.channel && filters.channel !== 'All') {
                        const channels = filters.channel.split(',').map(c => c.trim());
                        where += ` AND channel IN (${channels.map(c => `'${c}'`).join(',')})`;
                    }
                    if (filters.platform && filters.platform !== 'All') {
                        const platforms = filters.platform.split(',').map(p => p.trim());
                        where += ` AND Platform IN (${platforms.map(p => `'${p}'`).join(',')})`;
                    }
                    if (filters.brand && filters.brand !== 'All') {
                        const brands = filters.brand.split(',').map(b => b.trim());
                        where += ` AND Brand IN (${brands.map(b => `'${b}'`).join(',')})`;
                    }
                    if (filters.location && filters.location !== 'All') {
                        const locations = filters.location.split(',').map(l => l.trim());
                        where += ` AND Location IN (${locations.map(l => `'${l}'`).join(',')})`;
                    }

                    // RESTRICTED_CATEGORIES removed
                    if (filters.category && filters.category !== 'All') {
                        const catCol = 'Category';
                        const requested = filters.category.split(',').map(c => c.trim());
                        where += ` AND ${catCol} IN (${requested.map(c => `'${c}'`).join(',')})`;
                    }
                    if (filters.msl && filters.msl !== 'All') {
                        const msls = filters.msl.split(',').map(m => m.trim());
                        if (msls.includes('1') && !msls.includes('0')) {
                            where += ` AND toString(msl) = '1'`;
                        }
                    }
                    return where;
                };

                const catCol = 'Category';

                let sqlWhere = buildSqlWhere(startDate, endDate);
                const metadata = await getFilterMetadata(`toDate(DATE) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`);

                const matrixQuery = `
                    SELECT 
                        Product as sku,
                        Location as city,
                        Brand as brand,
                        ${catCol} as category,
                        ifNull(sum(drr), 0) as drr_qty,
                        ifNull(sum(latestStock), 0) as current_inventory,
                        ifNull(sum(poQty), 0) as req_po_qty
                    FROM (
                        SELECT 
                            Product, Location, Brand, ${catCol}, Platform,
                            ifNull(argMax(ifNull(toFloat64OrZero(toString(Inventory)), 0), DATE), 0) as latestStock,
                            sum(ifNull(Qty_Sold, 0)) / ${periodDays} as drr,
                            if(isNaN(if(drr > 0, latestStock / drr, 0)), 0, if(drr > 0, latestStock / drr, 0)) as doh,
                            if(isNaN(if(${THRESHOLD_DOH} > doh, (${THRESHOLD_DOH} - doh) * drr, 0)), 0, if(${THRESHOLD_DOH} > doh, (${THRESHOLD_DOH} - doh) * drr, 0)) as poQty
                        FROM rb_pdp_olap
                        WHERE ${sqlWhere}
                        GROUP BY Product, Location, Brand, ${catCol}, Platform
                    )
                    GROUP BY Product, Location, Brand, ${catCol}
                `;

                console.log("🔍 [InventoryAnalysis] Executing Matrix Query:", matrixQuery.substring(0, 500));
                const results = await queryClickHouse(matrixQuery);
                console.log("📊 [InventoryAnalysis] Raw results sample:", results.slice(0, 2));

                const data = results.map(row => {
                    const drrQty = parseFloat(row.drr_qty || 0);
                    const currentInventory = parseFloat(row.current_inventory || 0);
                    const reqPoQty = parseFloat(row.req_po_qty || 0);

                    return {
                        city: row.city,
                        category: row.category,
                        brand: row.brand,
                        sku: row.sku,
                        drr_qty: drrQty,
                        current_inventory: currentInventory,
                        current_doh: drrQty > 0 ? currentInventory / drrQty : 0,
                        req_po_qty: reqPoQty,
                        req_boxes: reqPoQty / UNITS_PER_BOX,
                        threshold_doh: THRESHOLD_DOH
                    };
                });

                return { data, metadata };
            } catch (error) {
                console.error("❌ [InventoryAnalysis] Error fetching city-sku matrix:", error);
                throw error;
            }
        }, CACHE_TTL.ONE_HOUR);
    },
};

export default inventoryAnalysisService;
