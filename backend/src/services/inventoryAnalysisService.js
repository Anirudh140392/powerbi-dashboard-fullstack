import { Op } from 'sequelize';
import sequelize from '../config/db.js';
import RbPdpOlap from '../models/RbPdpOlap.js';
import dayjs from 'dayjs';

const THRESHOLD_DOH = 8; // Default threshold for DOH
const UNITS_PER_BOX = 24; // Units per box for replenishment calculation
const RESTRICTED_CATEGORIES = ['Bath & Body', 'Detergent', 'Hair Care', 'Fragrance & talc'];

const getFilterMetadata = async (whereClause) => {
    // Optimization: Grouping by all target columns to get unique combinations
    const results = await RbPdpOlap.findAll({
        attributes: [
            ['Platform', 'platform'],
            ['Brand', 'brand'],
            ['Category', 'category'],
            ['Product', 'sku'],
            ['Location', 'city']
        ],
        where: whereClause,
        group: ['Platform', 'Brand', 'Category', 'Product', 'Location'],
        raw: true
    });

    return {
        platforms: [...new Set(results.map(r => r.platform))].filter(Boolean).sort(),
        brands: [...new Set(results.map(r => r.brand))].filter(Boolean).sort(),
        categories: [...new Set(results.map(r => r.category))].filter(Boolean).sort(),
        skus: [...new Set(results.map(r => r.sku))].filter(Boolean).sort(),
        cities: [...new Set(results.map(r => r.city))].filter(Boolean).sort()
    };
};

/**
 * Helper to get the actual latest date available in the database
 */
const getLatestAvailableDate = async (categoryRestricted = true) => {
    const where = {};
    if (categoryRestricted) {
        where.Category = { [Op.in]: RESTRICTED_CATEGORIES };
    }
    const result = await RbPdpOlap.findOne({
        attributes: [[sequelize.fn('MAX', sequelize.col('DATE')), 'maxDate']],
        where,
        raw: true
    });
    return result?.maxDate ? dayjs(result.maxDate) : dayjs();
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
        try {
            console.log("🔍 [InventoryAnalysis] Fetching overview with filters:", filters);

            const endDate = filters.endDate ? dayjs(filters.endDate) : dayjs();
            const startDate = filters.startDate ? dayjs(filters.startDate) : endDate.subtract(6, 'days');

            // Calculate date range duration
            const duration = endDate.diff(startDate, 'day') + 1;

            // Comparison period (previous period of same duration)
            const compareEndDate = filters.compareEndDate
                ? dayjs(filters.compareEndDate)
                : startDate.subtract(1, 'day');
            const compareStartDate = filters.compareStartDate
                ? dayjs(filters.compareStartDate)
                : compareEndDate.subtract(duration - 1, 'day');

            // Build base where clause
            const buildWhereClause = (start, end) => {
                const whereClause = {
                    DATE: {
                        [Op.between]: [
                            start.startOf('day').format('YYYY-MM-DD HH:mm:ss'),
                            end.endOf('day').format('YYYY-MM-DD HH:mm:ss')
                        ]
                    }
                };

                // Platform filter
                if (filters.platform && filters.platform !== 'All') {
                    const platforms = filters.platform.split(',').map(p => p.trim());
                    whereClause.Platform = { [Op.in]: platforms };
                }

                // Brand filter
                if (filters.brand && filters.brand !== 'All') {
                    const brands = filters.brand.split(',').map(b => b.trim());
                    whereClause.Brand = { [Op.in]: brands };
                }

                // Location filter
                if (filters.location && filters.location !== 'All') {
                    const locations = filters.location.split(',').map(l => l.trim());
                    whereClause.Location = { [Op.in]: locations };
                }

                // Global Category Restriction
                if (filters.category && filters.category !== 'All') {
                    const requested = filters.category.split(',').map(c => c.trim());
                    whereClause.Category = { [Op.in]: requested.filter(c => RESTRICTED_CATEGORIES.includes(c)) };
                } else {
                    whereClause.Category = { [Op.in]: RESTRICTED_CATEGORIES };
                }

                return whereClause;
            };

            // Smart Fallback Detection
            const initialCount = await RbPdpOlap.count({ where: buildWhereClause(startDate, endDate) });

            if (initialCount === 0) {
                console.log("⚠️ [InventoryAnalysis] No data found for overview range, falling back to latest.");
                const latestDate = await getLatestAvailableDate();
                const searchEnd = latestDate;
                const searchStart = latestDate.subtract(duration - 1, 'day');

                // Adjust comparison period too
                const newCompareEnd = searchStart.subtract(1, 'day');
                const newCompareStart = newCompareEnd.subtract(duration - 1, 'day');

                return this.getInventoryOverview({
                    ...filters,
                    startDate: searchStart.format('YYYY-MM-DD'),
                    endDate: searchEnd.format('YYYY-MM-DD'),
                    compareStartDate: newCompareStart.format('YYYY-MM-DD'),
                    compareEndDate: newCompareEnd.format('YYYY-MM-DD')
                });
            }

            // Fetch aggregated metrics for a period (aggregating per SKU-City)
            const getMetrics = async (start, end) => {
                const whereClause = buildWhereClause(start, end);
                const periodDays = end.diff(start, 'day') + 1;

                // 1. Get sales and days per SKU-City
                const salesResults = await RbPdpOlap.findAll({
                    attributes: [
                        ['Product', 'sku'],
                        ['Location', 'city'],
                        [sequelize.fn('SUM', sequelize.col('Qty_Sold')), 'totalQtySold'],
                        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.fn('DATE', sequelize.col('DATE')))), 'distinctDays']
                    ],
                    where: whereClause,
                    group: ['Product', 'Location'],
                    raw: true
                });

                // 2. Get latest inventory per SKU-City (summing platforms)
                const latestInventoryResults = await RbPdpOlap.findAll({
                    attributes: [
                        ['Product', 'sku'],
                        ['Location', 'city'],
                        ['Platform', 'platform'],
                        ['inventory', 'inventory']
                    ],
                    where: whereClause,
                    order: [['DATE', 'DESC']],
                    raw: true
                });

                // Map latest inventory by platforms
                const platformLatestMap = new Map();
                latestInventoryResults.forEach(r => {
                    const key = `${r.sku}|${r.city}|${r.platform}`;
                    if (!platformLatestMap.has(key)) platformLatestMap.set(key, parseFloat(r.inventory || 0));
                });

                // Sum inventory by SKU-City
                const skuCityInventory = new Map();
                platformLatestMap.forEach((inv, key) => {
                    const [sku, city] = key.split('|');
                    const k = `${sku}|${city}`;
                    skuCityInventory.set(k, (skuCityInventory.get(k) || 0) + inv);
                });

                // 3. Calculate per-SKU metrics and aggregate
                let totalPoQty = 0;
                let totalCurrentInventory = 0;
                let totalDrrSum = 0;
                let pairCount = 0;

                salesResults.forEach(r => {
                    const key = `${r.sku}|${r.city}`;
                    const inventory = skuCityInventory.get(key) || 0;
                    const sales = parseFloat(r.totalQtySold || 0);
                    const days = parseInt(r.distinctDays || periodDays);

                    const drr = days > 0 ? sales / days : 0;
                    const doh = drr > 0 ? inventory / drr : 0;
                    const poQty = Math.max(0, (THRESHOLD_DOH - doh) * drr);

                    totalPoQty += poQty;
                    totalCurrentInventory += inventory;
                    totalDrrSum += drr;
                    pairCount++;
                });

                const totalBoxesRequired = Math.round(totalPoQty / UNITS_PER_BOX);
                const globalDoh = totalDrrSum > 0 ? totalCurrentInventory / totalDrrSum : 0;

                return {
                    totalInventory: totalCurrentInventory,
                    drr: totalDrrSum,
                    doh: globalDoh,
                    poQty: totalPoQty,
                    totalBoxesRequired,
                    periodDays: periodDays
                };
            };

            // Fetch trend data for sparklines (Calculating replenishment per day)
            const getTrendData = async (start, end) => {
                const whereClause = buildWhereClause(start, end);

                // Get daily data per SKU-City-Platform
                const results = await RbPdpOlap.findAll({
                    attributes: [
                        [sequelize.fn('DATE', sequelize.col('DATE')), 'date'],
                        ['Product', 'sku'],
                        ['Location', 'city'],
                        ['Platform', 'platform'],
                        ['inventory', 'inventory'],
                        ['Qty_Sold', 'qtySold']
                    ],
                    where: whereClause,
                    order: [[sequelize.fn('DATE', sequelize.col('DATE')), 'ASC']],
                    raw: true
                });

                // Group by date, then sum SKU-City PO Qty
                const dailyData = new Map();
                results.forEach(r => {
                    const d = r.date;
                    if (!dailyData.has(d)) dailyData.set(d, new Map());
                    const m = dailyData.get(d);
                    const k = `${r.sku}|${r.city}`;
                    if (!m.has(k)) m.set(k, { inventory: 0, qtySold: 0 });
                    const entry = m.get(k);
                    entry.inventory += parseFloat(r.inventory || 0);
                    entry.qtySold += parseFloat(r.qtySold || 0);
                });

                const finalTrend = [];
                dailyData.forEach((skus, date) => {
                    let dayPoQty = 0;
                    let dayInventory = 0;
                    let dayQtySold = 0;

                    skus.forEach(v => {
                        dayInventory += v.inventory;
                        dayQtySold += v.qtySold;
                        const drr = v.qtySold; // Local daily DRR proxy
                        const doh = drr > 0 ? v.inventory / drr : (v.inventory > 0 ? 99 : 0);
                        dayPoQty += Math.max(0, (THRESHOLD_DOH - doh) * drr);
                    });

                    finalTrend.push({
                        date,
                        inventory: dayInventory,
                        qtySold: dayQtySold,
                        poQty: dayPoQty
                    });
                });

                return finalTrend.sort((a, b) => dayjs(a.date).diff(dayjs(b.date)));
            };

            // Execute queries in parallel
            const [currentMetrics, compareMetrics, trendData] = await Promise.all([
                getMetrics(startDate, endDate),
                getMetrics(compareStartDate, compareEndDate),
                getTrendData(startDate, endDate)
            ]);

            console.log("✅ [InventoryAnalysis] Current metrics:", currentMetrics);
            console.log("✅ [InventoryAnalysis] Compare metrics:", compareMetrics);

            // Calculate changes
            const calculateChange = (current, previous) => {
                if (previous === 0) return current === 0 ? 0 : 100;
                return ((current - previous) / previous) * 100;
            };

            const dohChange = calculateChange(currentMetrics.doh, compareMetrics.doh);
            const drrChange = calculateChange(currentMetrics.drr, compareMetrics.drr);
            const boxesChange = calculateChange(currentMetrics.totalBoxesRequired, compareMetrics.totalBoxesRequired);

            // Build sparkline data from trend
            const dohSparkline = trendData.map(d => {
                const dailyDrr = d.qtySold || 1;
                return d.inventory / dailyDrr;
            });

            const drrSparkline = trendData.map(d => d.qtySold);

            // Calculate rolling boxes required for sparkline
            const boxesSparkline = trendData.map(d => {
                return Math.ceil(d.poQty / UNITS_PER_BOX);
            });

            const trendLabels = trendData.map(d => dayjs(d.date).format('MMM DD'));

            // Format response
            const formatNumber = (num) => {
                if (num >= 10000000) return `${(num / 10000000).toFixed(2)} Cr`;
                if (num >= 100000) return `${(num / 100000).toFixed(2)} L`;
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
                        value: Math.round(currentMetrics.drr),
                        previousValue: Math.round(compareMetrics.drr),
                        change: drrChange.toFixed(1),
                        isPositive: drrChange >= 0,
                        sparkline: drrSparkline.length > 0 ? drrSparkline : [0],
                        labels: trendLabels.length > 0 ? trendLabels : [startDate.format('MMM DD')]
                    },
                    totalBoxesRequired: {
                        value: formatNumber(currentMetrics.totalBoxesRequired),
                        rawValue: currentMetrics.totalBoxesRequired,
                        previousValue: compareMetrics.totalBoxesRequired,
                        change: boxesChange.toFixed(1),
                        changePoints: (currentMetrics.totalBoxesRequired - compareMetrics.totalBoxesRequired).toFixed(1),
                        isPositive: boxesChange <= 0, // Lower is better for boxes required
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
    },

    /**
     * Get available platforms for filter dropdown
     */
    async getPlatforms() {
        try {
            const platforms = await RbPdpOlap.findAll({
                attributes: [[sequelize.fn('DISTINCT', sequelize.col('Platform')), 'Platform']],
                where: { Platform: { [Op.ne]: null } },
                order: [['Platform', 'ASC']],
                raw: true
            });
            return platforms.map(p => p.Platform).filter(p => p);
        } catch (error) {
            console.error("❌ [InventoryAnalysis] Error fetching platforms:", error);
            return [];
        }
    },

    /**
     * Get available brands for filter dropdown
     */
    async getBrands(platform) {
        try {
            const whereClause = { Brand: { [Op.ne]: null } };
            if (platform && platform !== 'All') {
                whereClause.Platform = { [Op.in]: platform.split(',').map(p => p.trim()) };
            }

            const brands = await RbPdpOlap.findAll({
                attributes: [[sequelize.fn('DISTINCT', sequelize.col('Brand')), 'Brand']],
                where: whereClause,
                order: [['Brand', 'ASC']],
                raw: true
            });
            return brands.map(b => b.Brand).filter(b => b);
        } catch (error) {
            console.error("❌ [InventoryAnalysis] Error fetching brands:", error);
            return [];
        }
    },

    /**
     * Get available locations for filter dropdown
     */
    async getLocations(platform, brand) {
        try {
            const whereClause = { Location: { [Op.ne]: null } };

            if (platform && platform !== 'All') {
                whereClause.Platform = { [Op.in]: platform.split(',').map(p => p.trim()) };
            }
            if (brand && brand !== 'All') {
                whereClause.Brand = { [Op.in]: brand.split(',').map(b => b.trim()) };
            }

            const locations = await RbPdpOlap.findAll({
                attributes: [[sequelize.fn('DISTINCT', sequelize.col('Location')), 'Location']],
                where: whereClause,
                order: [['Location', 'ASC']],
                raw: true
            });
            return locations.map(l => l.Location).filter(l => l);
        } catch (error) {
            console.error("❌ [InventoryAnalysis] Error fetching locations:", error);
            return [];
        }
    },

    /**
     * Get Inventory Matrix (SKU x City) with basic inventory totals
     */
    async getInventoryMatrix(filters) {
        try {
            console.log("🔍 [InventoryAnalysis] Fetching basic matrix with filters:", filters);

            const endDate = filters.endDate ? dayjs(filters.endDate) : dayjs();
            const startDate = filters.startDate ? dayjs(filters.startDate) : endDate.subtract(6, 'days');

            const buildWhereClause = (start, end) => {
                const whereClause = {
                    DATE: {
                        [Op.between]: [
                            start.startOf('day').format('YYYY-MM-DD HH:mm:ss'),
                            end.endOf('day').format('YYYY-MM-DD HH:mm:ss')
                        ]
                    }
                };

                if (filters.platform && filters.platform !== 'All' && filters.platform !== '') {
                    const platforms = filters.platform.split(',').map(p => p.trim()).filter(p => p);
                    if (platforms.length > 0) whereClause.Platform = { [Op.in]: platforms };
                }
                if (filters.brand && filters.brand !== 'All' && filters.brand !== '') {
                    const brands = filters.brand.split(',').map(b => b.trim()).filter(b => b);
                    if (brands.length > 0) whereClause.Brand = { [Op.in]: brands };
                }
                if (filters.location && filters.location !== 'All' && filters.location !== '') {
                    const locations = filters.location.split(',').map(l => l.trim()).filter(l => l);
                    if (locations.length > 0) whereClause.Location = { [Op.in]: locations };
                }

                // Global Category Restriction
                if (filters.category && filters.category !== 'All' && filters.category !== '') {
                    const requested = filters.category.split(',').map(c => c.trim()).filter(c => c);
                    const filtered = requested.filter(c => RESTRICTED_CATEGORIES.includes(c));
                    if (filtered.length > 0) {
                        whereClause.Category = { [Op.in]: filtered };
                    } else {
                        whereClause.Category = { [Op.in]: RESTRICTED_CATEGORIES };
                    }
                } else {
                    whereClause.Category = { [Op.in]: RESTRICTED_CATEGORIES };
                }
                return whereClause;
            };

            let whereClause = buildWhereClause(startDate, endDate);

            // Check if results exist for this range
            const count = await RbPdpOlap.count({ where: whereClause });
            if (count === 0) {
                console.log("⚠️ [InventoryAnalysis] No data found for requested range, falling back to latest available data.");
                const latestDate = await getLatestAvailableDate();
                const fallbackStart = latestDate.subtract(6, 'days');
                const fallbackEnd = latestDate;
                whereClause = buildWhereClause(fallbackStart, fallbackEnd);
                console.log(`🔄 [InventoryAnalysis] Fallback range: ${fallbackStart.format('YYYY-MM-DD')} to ${fallbackEnd.format('YYYY-MM-DD')}`);
            }

            // Metadata for dynamic filters (independent of specific filters except date/category)
            const metadataWhere = {
                DATE: whereClause.DATE,
                Category: { [Op.in]: RESTRICTED_CATEGORIES }
            };
            const metadata = await getFilterMetadata(metadataWhere);

            // Fetch latest inventory snapshot per City-SKU-Platform
            const results = await RbPdpOlap.findAll({
                attributes: [
                    ['Product', 'sku'],
                    ['Location', 'city'],
                    ['Brand', 'brand'],
                    ['Platform', 'platform'],
                    ['Category', 'category'],
                    ['inventory', 'inventory'],
                    ['DATE', 'date']
                ],
                where: whereClause,
                order: [['DATE', 'DESC']],
                raw: true
            });

            // For each unique (city, sku, platform), pick the first (latest) record
            // Then sum them up by (city, sku)
            const latestPlatformMap = new Map(); // key: city|sku|platform
            results.forEach(r => {
                const key = `${r.city}|${r.sku}|${r.platform}`;
                if (!latestPlatformMap.has(key)) {
                    latestPlatformMap.set(key, r);
                }
            });

            const finalMap = new Map(); // key: city|sku
            latestPlatformMap.forEach(r => {
                const key = `${r.city}|${r.sku}`;
                if (!finalMap.has(key)) {
                    finalMap.set(key, {
                        sku: r.sku,
                        city: r.city,
                        brand: r.brand,
                        category: r.category,
                        inventory: 0
                    });
                }
                const entry = finalMap.get(key);
                entry.inventory += parseFloat(r.inventory || 0);
            });

            return {
                data: Array.from(finalMap.values()),
                metadata
            };

        } catch (error) {
            console.error("❌ [InventoryAnalysis] Error fetching matrix:", error);
            throw error;
        }
    },

    /**
     * Get Inventory Matrix (SKU x City) with full metrics for drilldown
     */
    async getCitySkuMatrix(filters) {
        try {
            console.log("🔍 [InventoryAnalysis] Fetching city-sku matrix with filters:", filters);

            const endDate = filters.endDate ? dayjs(filters.endDate) : dayjs();
            const startDate = filters.startDate ? dayjs(filters.startDate) : endDate.subtract(6, 'days');
            const periodDays = endDate.diff(startDate, 'day') + 1;

            const buildWhereClause = (start, end) => {
                const whereClause = {
                    DATE: {
                        [Op.between]: [
                            start.startOf('day').format('YYYY-MM-DD HH:mm:ss'),
                            end.endOf('day').format('YYYY-MM-DD HH:mm:ss')
                        ]
                    }
                };

                if (filters.platform && filters.platform !== 'All' && filters.platform !== '') {
                    const platforms = filters.platform.split(',').map(p => p.trim()).filter(p => p);
                    if (platforms.length > 0) whereClause.Platform = { [Op.in]: platforms };
                }
                if (filters.brand && filters.brand !== 'All' && filters.brand !== '') {
                    const brands = filters.brand.split(',').map(b => b.trim()).filter(b => b);
                    if (brands.length > 0) whereClause.Brand = { [Op.in]: brands };
                }
                if (filters.location && filters.location !== 'All' && filters.location !== '') {
                    const locations = filters.location.split(',').map(l => l.trim()).filter(l => l);
                    if (locations.length > 0) whereClause.Location = { [Op.in]: locations };
                }

                // Global Category Restriction
                if (filters.category && filters.category !== 'All' && filters.category !== '') {
                    const requested = filters.category.split(',').map(c => c.trim()).filter(c => c);
                    const filtered = requested.filter(c => RESTRICTED_CATEGORIES.includes(c));
                    if (filtered.length > 0) {
                        whereClause.Category = { [Op.in]: filtered };
                    } else {
                        whereClause.Category = { [Op.in]: RESTRICTED_CATEGORIES };
                    }
                } else {
                    whereClause.Category = { [Op.in]: RESTRICTED_CATEGORIES };
                }
                return whereClause;
            };

            let whereClause = buildWhereClause(startDate, endDate);

            // Check if results exist for this range
            const count = await RbPdpOlap.count({ where: whereClause });
            if (count === 0) {
                console.log("⚠️ [InventoryAnalysis] No data found for city-sku range, falling back to latest available data.");
                const latestDate = await getLatestAvailableDate();
                const fallbackStart = latestDate.subtract(6, 'days');
                const fallbackEnd = latestDate;
                whereClause = buildWhereClause(fallbackStart, fallbackEnd);
            }

            // Metadata for dynamic filters
            const metadataWhere = {
                DATE: whereClause.DATE,
                Category: { [Op.in]: RESTRICTED_CATEGORIES }
            };
            const metadata = await getFilterMetadata(metadataWhere);

            // 1. Get total Qty_Sold and distinct days per Product/Location for DRR (Aggregated across platforms)
            const aggResults = await RbPdpOlap.findAll({
                attributes: [
                    ['Product', 'sku'],
                    ['Location', 'city'],
                    ['Category', 'category'],
                    ['Brand', 'brand'],
                    [sequelize.fn('SUM', sequelize.col('Qty_Sold')), 'totalQtySold'],
                    [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.fn('DATE', sequelize.col('DATE')))), 'distinctDays']
                ],
                where: buildWhereClause(startDate, endDate),
                group: ['Product', 'Location', 'Category', 'Brand'],
                raw: true
            });

            // 2. Get latest inventory per Product/Location/Platform for summation
            const latestInventoryResults = await RbPdpOlap.findAll({
                attributes: [
                    ['Product', 'sku'],
                    ['Location', 'city'],
                    ['Platform', 'platform'],
                    ['inventory', 'latestInventory'],
                    ['DATE', 'date']
                ],
                where: whereClause,
                order: [['DATE', 'DESC']],
                raw: true
            });

            // Map to store latest inventory by City-SKU-Platform
            const latestPlatformMap = new Map();
            latestInventoryResults.forEach(r => {
                const key = `${r.city}|${r.sku}|${r.platform}`;
                if (!latestPlatformMap.has(key)) {
                    latestPlatformMap.set(key, parseFloat(r.latestInventory || 0));
                }
            });

            // Aggregate inventory by City-SKU (sum across platforms)
            const latestInventoryMap = new Map();
            latestPlatformMap.forEach((inventory, key) => {
                const [city, sku] = key.split('|');
                const mainKey = `${city}|${sku}`;
                latestInventoryMap.set(mainKey, (latestInventoryMap.get(mainKey) || 0) + inventory);
            });

            const data = aggResults.map(row => {
                const totalQtySold = parseFloat(row.totalQtySold || 0);
                const distinctDays = parseInt(row.distinctDays || periodDays);
                const key = `${row.city}|${row.sku}`;
                const currentInventory = latestInventoryMap.get(key) || 0;

                const drr = distinctDays > 0 ? totalQtySold / distinctDays : 0;
                const doh = drr > 0 ? currentInventory / drr : 0;
                const poQty = Math.max(0, (THRESHOLD_DOH - doh) * drr);
                const reqBoxes = Math.round(poQty / UNITS_PER_BOX);

                return {
                    city: row.city,
                    category: row.category,
                    brand: row.brand,
                    sku: row.sku,
                    drrQty: Math.round(drr),
                    currentDoh: parseFloat(doh.toFixed(2)),
                    reqPoQty: Math.round(poQty),
                    reqBoxes: reqBoxes,
                    thresholdDoh: THRESHOLD_DOH
                };
            });

            return { data, metadata };

        } catch (error) {
            console.error("❌ [InventoryAnalysis] Error fetching city-sku matrix:", error);
            throw error;
        }
    },
};

export default inventoryAnalysisService;
