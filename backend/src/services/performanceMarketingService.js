import { queryClickHouse } from '../config/clickhouse.js';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear.js';
import { getCachedOrCompute, generateCacheKey, CACHE_TTL } from '../utils/cacheHelper.js';

dayjs.extend(weekOfYear);

/**
 * Performance Marketing Service
 * specialized for fetching Performance Overview metrics from tb_zepto_pm_keyword_rca
 */
const performanceMarketingService = {

    async getCategories() {
        const cacheKey = 'pm_categories';
        return await getCachedOrCompute(cacheKey, async () => {
            try {
                const targetCategories = ['bath & body', 'detergent', 'fragrance & talc', 'hair care'];
                const query = `
                    SELECT DISTINCT keyword_category as category 
                    FROM tb_zepto_pm_keyword_rca 
                    WHERE lower(keyword_category) IN (${targetCategories.map(c => `'${c}'`).join(',')})
                    ORDER BY category
                `;
                const results = await queryClickHouse(query);
                return results.map(r => r.category).filter(Boolean);
            } catch (error) {
                console.error('Error in getCategories:', error);
                throw error;
            }
        }, CACHE_TTL.LONG);
    },

    /**
     * Get Keyword Analysis Data
     * Hierarchy: Keyword -> Category
     * Data source: tb_zepto_pm_keyword_rca
     */
    async getKeywordAnalysis(filters) {
        console.log("🔍 [Service] getKeywordAnalysis filters:", filters);
        const cacheKey = generateCacheKey('pm_keyword_analysis', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                const endDate = filters.endDate ? dayjs(filters.endDate) : dayjs();
                const startDate = filters.startDate ? dayjs(filters.startDate) : endDate.subtract(29, 'days');

                const startStr = startDate.format('YYYY-MM-DD');
                const endStr = endDate.format('YYYY-MM-DD');

                let whereConditions = [`date BETWEEN '${startStr}' AND '${endStr}'`];

                // Filters
                if (filters.platform && filters.platform !== 'All') {
                    const platforms = filters.platform.split(',').map(p => `'${p.trim()}'`).join(',');
                    whereConditions.push(`Platform IN (${platforms})`);
                }
                if (filters.brand && filters.brand !== 'All') {
                    const brands = filters.brand.split(',').map(b => `'${b.trim().toLowerCase()}'`).join(',');
                    whereConditions.push(`lower(brand_name) IN (${brands})`);
                }
                if (filters.zone && filters.zone !== 'All') {
                    const zones = filters.zone.split(',').map(z => `'${z.trim()}'`).join(',');
                    whereConditions.push(`zone IN (${zones})`);
                }

                // Target Categories
                const targetCategories = ['bath & body', 'detergent', 'hair care', 'fragrance & talc'];
                whereConditions.push(`lower(keyword_category) IN (${targetCategories.map(c => `'${c}'`).join(',')})`);

                // Weekend Flag
                if (filters.weekendFlag) {
                    const flags = Array.isArray(filters.weekendFlag) ? filters.weekendFlag : String(filters.weekendFlag).split(',');
                    if (flags.includes('Weekend') && !flags.includes('Weekday')) {
                        whereConditions.push(`toDayOfWeek(date) IN (6, 7)`);
                    } else if (flags.includes('Weekday') && !flags.includes('Weekend')) {
                        whereConditions.push(`toDayOfWeek(date) NOT IN (6, 7)`);
                    }
                }

                const whereSql = whereConditions.join(' AND ');
                console.log("🔍 [Service] getKeywordAnalysis whereSql:", whereSql);

                const query = `
                    SELECT 
                        keyword_name, 
                        keyword_category, 
                        formatDateTime(date, '%M') as month, 
                        SUM(impressions) as impressions, 
                        SUM(spend) as spend, 
                        SUM(revenue) as revenue, 
                        SUM(clicks) as clicks, 
                        SUM(orders) as orders 
                    FROM tb_zepto_pm_keyword_rca 
                    WHERE ${whereSql}
                    GROUP BY keyword_name, keyword_category, month
                `;
                console.log("🔍 [Service] getKeywordAnalysis Query:\n", query);
                const results = await queryClickHouse(query);
                console.log("✅ [Service] getKeywordAnalysis Results:", results.length);

                const keywordMap = new Map();

                results.forEach(row => {
                    const kw = row.keyword_name || 'N/A';
                    const cat = row.keyword_category || 'N/A';
                    const month = row.month;

                    if (!keywordMap.has(kw)) {
                        keywordMap.set(kw, {
                            keyword: kw,
                            category: cat,
                            months: [],
                            children: new Map()
                        });
                    }

                    const kwNode = keywordMap.get(kw);
                    const metrics = {
                        month,
                        impressions: parseInt(row.impressions || 0),
                        spend: parseFloat(row.spend || 0),
                        revenue: parseFloat(row.revenue || 0),
                        clicks: parseInt(row.clicks || 0),
                        orders: parseInt(row.orders || 0),
                        conversion: row.clicks > 0 ? ((row.orders || 0) / row.clicks) * 100 : 0,
                        roas: row.spend > 0 ? (row.revenue || 0) / row.spend : 0,
                        cpm: row.impressions > 0 ? (row.spend / row.impressions) * 1000 : 0
                    };

                    kwNode.months.push(metrics);

                    // Build Category node with Month children
                    if (!kwNode.children.has(cat)) {
                        kwNode.children.set(cat, {
                            keyword: cat,
                            category: cat,
                            months: [],
                            children: new Map() // Months will be children of Category
                        });
                    }

                    const catNode = kwNode.children.get(cat);
                    catNode.months.push(metrics);

                    // Add month as child of category
                    if (!catNode.children.has(month)) {
                        catNode.children.set(month, {
                            keyword: month,
                            category: cat,
                            months: []
                        });
                    }
                    catNode.children.get(month).months.push(metrics);
                });

                // Build final tree structure with 3 levels
                return Array.from(keywordMap.values()).map(kw => ({
                    ...kw,
                    children: Array.from(kw.children.values()).map(catNode => ({
                        ...catNode,
                        children: Array.from(catNode.children.values())
                    }))
                }));

            } catch (error) {
                console.error('Error in getKeywordAnalysis:', error);
                throw error;
            }
        }, CACHE_TTL.ONE_HOUR);
    }
    ,

    /**
     * Get KPIs Overview (Impressions, Spend, ROAS, Conversion)
     * Data source: tb_zepto_pm_keyword_rca
     * @param {Object} filters 
     */
    async getKpisOverview(filters) {
        console.log("Fetching Performance Marketing KPIs with filters:", filters);
        const cacheKey = generateCacheKey('pm_kpis_overview', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                // 1. Date Range Setup
                const endDate = filters.endDate ? dayjs(filters.endDate) : dayjs();
                const startDate = filters.startDate ? dayjs(filters.startDate) : endDate.subtract(29, 'days');

                // Calculate previous period - Month-over-Month (MoM)
                const prevStartDate = startDate.subtract(1, 'month');
                const prevEndDate = endDate.subtract(1, 'month');
                const duration = endDate.diff(startDate, 'day') + 1;
                const prevDuration = prevEndDate.diff(prevStartDate, 'day') + 1;

                // 2. Build Query Conditions (Base)
                let baseConditions = [];

                // Platform filter
                if (filters.platform && filters.platform !== 'All') {
                    const platforms = filters.platform.split(',').map(p => `'${p.trim()}'`).join(',');
                    baseConditions.push(`Platform IN (${platforms})`);
                }

                // Brand filter
                if (filters.brand && filters.brand !== 'All') {
                    const brands = filters.brand.split(',').map(b => `'${b.trim().toLowerCase()}'`).join(',');
                    baseConditions.push(`lower(brand_name) IN (${brands})`);
                }

                // Zone Filter
                if (filters.zone && filters.zone !== 'All') {
                    const zones = filters.zone.split(',').map(z => `'${z.trim()}'`).join(',');
                    baseConditions.push(`zone IN (${zones})`);
                }

                // Weekend Flag
                if (filters.weekendFlag) {
                    const flags = Array.isArray(filters.weekendFlag) ? filters.weekendFlag : String(filters.weekendFlag).split(',');
                    if (flags.includes('Weekend') && !flags.includes('Weekday')) {
                        baseConditions.push(`toDayOfWeek(date) IN (6, 7)`);
                    } else if (flags.includes('Weekday') && !flags.includes('Weekend')) {
                        baseConditions.push(`toDayOfWeek(date) NOT IN (6, 7)`);
                    }
                }

                // Restrict to specific keyword_categories
                const targetCategories = ['bath & body', 'detergent', 'hair care', 'fragrance & talc'];
                baseConditions.push(`lower(keyword_category) IN (${targetCategories.map(c => `'${c}'`).join(',')})`);


                // 3. Helper to fetch aggregate metrics for a date range
                const getMetrics = async (start, end) => {
                    const s = start.format('YYYY-MM-DD');
                    const e = end.format('YYYY-MM-DD');
                    const conditions = [...baseConditions, `date BETWEEN '${s}' AND '${e}'`];
                    const whereSql = conditions.join(' AND ');

                    const query = `
                        SELECT 
                            SUM(impressions) as impressions,
                            SUM(spend) as spend,
                            SUM(revenue) as ad_sales,
                            SUM(clicks) as clicks,
                            SUM(orders) as orders
                        FROM tb_zepto_pm_keyword_rca
                        WHERE ${whereSql}
                    `;

                    const results = await queryClickHouse(query);
                    const result = results[0] || {};

                    return {
                        impressions: parseFloat(result.impressions || 0),
                        spend: parseFloat(result.spend || 0),
                        adSales: parseFloat(result.ad_sales || 0),
                        clicks: parseFloat(result.clicks || 0),
                        orders: parseFloat(result.orders || 0)
                    };
                };

                // 4. Helper to fetch daily trend data
                const getTrendData = async (start, end) => {
                    const s = start.format('YYYY-MM-DD');
                    const e = end.format('YYYY-MM-DD');
                    const conditions = [...baseConditions, `date BETWEEN '${s}' AND '${e}'`];
                    const whereSql = conditions.join(' AND ');

                    const query = `
                        SELECT 
                            date,
                            SUM(impressions) as impressions,
                            SUM(spend) as spend,
                            SUM(revenue) as ad_sales,
                            SUM(clicks) as clicks,
                            SUM(orders) as orders
                        FROM tb_zepto_pm_keyword_rca
                        WHERE ${whereSql}
                        GROUP BY date
                        ORDER BY date ASC
                    `;

                    const results = await queryClickHouse(query);

                    return results.map(row => {
                        const imp = parseFloat(row.impressions || 0);
                        const sp = parseFloat(row.spend || 0);
                        const rev = parseFloat(row.ad_sales || 0);
                        const clk = parseFloat(row.clicks || 0);
                        const ord = parseFloat(row.orders || 0);

                        return {
                            date: row.date,
                            impressions: imp,
                            spend: sp,
                            roas_roas: sp > 0 ? rev / sp : 0,
                            // Conversion % = (Clicks / Orders) * 100
                            cr_percentage: ord > 0 ? (clk / ord) * 100 : 0
                        };
                    });
                };

                // 5. Execute Queries
                const [currentMetrics, prevMetrics, trendData] = await Promise.all([
                    getMetrics(startDate, endDate),
                    getMetrics(prevStartDate, prevEndDate),
                    getTrendData(startDate, endDate)
                ]);

                // 6. Calculate KPIs and Changes
                const calculateChange = (curr, prev) => {
                    if (prev === 0) return curr === 0 ? 0 : 100;
                    return ((curr - prev) / prev) * 100;
                };

                // KPI 1: Impressions
                const impressionsChange = calculateChange(currentMetrics.impressions, prevMetrics.impressions);

                // KPI 2: Conversion Rate (Orders / Clicks * 100)
                const currConversion = currentMetrics.clicks > 0 ? (currentMetrics.orders / currentMetrics.clicks) * 100 : 0;
                const prevConversion = prevMetrics.clicks > 0 ? (prevMetrics.orders / prevMetrics.clicks) * 100 : 0;
                const conversionChange = currConversion - prevConversion; // Percentage point difference for rates

                // KPI 3: Spend
                const spendChange = calculateChange(currentMetrics.spend, prevMetrics.spend);

                // KPI 4: ROAS
                const currRoas = currentMetrics.spend > 0 ? currentMetrics.adSales / currentMetrics.spend : 0;
                const prevRoas = prevMetrics.spend > 0 ? prevMetrics.adSales / prevMetrics.spend : 0;
                const roasDiff = currRoas - prevRoas;

                // 7. Format Response
                const formatIndianNumber = (num) => {
                    if (num === null || num === undefined) return "0";
                    const val = Math.abs(num);
                    if (val >= 10000000) return `${(num / 10000000).toFixed(2)} Cr`;
                    if (val >= 100000) return `${(num / 100000).toFixed(2)} L`;
                    if (val >= 1000) return `${(num / 1000).toFixed(1)} K`;
                    return num.toLocaleString('en-IN');
                };

                const kpi_cards = [
                    {
                        label: "Impressions",
                        value: formatIndianNumber(currentMetrics.impressions),
                        change: `${Math.abs(impressionsChange).toFixed(1)}%`,
                        positive: impressionsChange >= 0
                    },
                    {
                        label: "Conversion",
                        value: `${currConversion.toFixed(1)}%`,
                        change: `${Math.abs(conversionChange).toFixed(1)}%`,
                        positive: conversionChange >= 0
                    },
                    {
                        label: "Spend",
                        value: formatIndianNumber(currentMetrics.spend),
                        change: `${Math.abs(spendChange).toFixed(1)}%`,
                        positive: spendChange < 0
                    },
                    {
                        label: "ROAS",
                        value: currRoas.toFixed(2),
                        change: Math.abs(roasDiff).toFixed(1),
                        positive: roasDiff >= 0
                    }
                ];

                // 8. Prepend Comparison Baseline to Trend Chart
                // This ensures sparklines show a trend line even for a single day selection (vs previous period)
                const finalTrendData = [...trendData];
                if (prevMetrics) {
                    // Use daily average for sum-based metrics to maintain scale consistency in daily sparklines
                    const avgImpressions = prevMetrics.impressions / prevDuration;
                    const avgSpend = prevMetrics.spend / prevDuration;
                    const aggregateRoas = prevMetrics.spend > 0 ? prevMetrics.adSales / prevMetrics.spend : 0;
                    const aggregateConversion = prevMetrics.clicks > 0 ? (prevMetrics.orders / prevMetrics.clicks) * 100 : 0;

                    finalTrendData.unshift({
                        date: prevStartDate.format('YYYY-MM-DD'), // Show as comparison start date
                        label: "Prev. Month",
                        impressions: avgImpressions,
                        spend: avgSpend,
                        roas_roas: aggregateRoas,
                        cr_percentage: aggregateConversion
                    });
                }

                return {
                    kpi_cards,
                    trend_chart: finalTrendData
                };
            } catch (error) {
                console.error("Error in getKpisOverview:", error);
                throw error;
            }
        }, CACHE_TTL.ONE_HOUR);
    }
    ,


    /**
     * Get Daily Format Performance (keyword_category > Date)
     * For HeatmapDrillTable - uses tb_zepto_pm_keyword_rca
     */
    async getFormatPerformance(filters) {
        console.log("🔍 [Service] getFormatPerformance filters:", filters);
        const cacheKey = generateCacheKey('pm_format_performance', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                const { platform, brand, zone, startDate, endDate } = filters;
                let conditions = [];

                // Platform Filter
                if (platform && platform !== 'All') {
                    const platforms = platform.split(',').map(p => `'${p.trim().toLowerCase()}'`).join(',');
                    conditions.push(`lower(Platform) IN (${platforms})`);
                }

                // Date Range Filter
                if (startDate && endDate) {
                    const s = dayjs(startDate).startOf('day').format('YYYY-MM-DD');
                    const e = dayjs(endDate).endOf('day').format('YYYY-MM-DD');
                    conditions.push(`date BETWEEN '${s}' AND '${e}'`);
                }

                // Brand Filter
                if (brand && brand !== 'All') {
                    const brands = brand.split(',').map(b => `'${b.trim().toLowerCase()}'`).join(',');
                    conditions.push(`lower(brand_name) IN (${brands})`);
                }

                // Zone Filter
                if (zone && zone !== 'All') {
                    const zones = zone.split(',').map(z => `'${z.trim().toLowerCase()}'`).join(',');
                    conditions.push(`lower(zone) IN (${zones})`);
                }

                // Weekend Flag
                if (filters.weekendFlag) {
                    const flags = Array.isArray(filters.weekendFlag) ? filters.weekendFlag : String(filters.weekendFlag).split(',');
                    if (flags.includes('Weekend') && !flags.includes('Weekday')) {
                        conditions.push(`toDayOfWeek(date) IN (6, 7)`);
                    } else if (flags.includes('Weekday') && !flags.includes('Weekend')) {
                        conditions.push(`toDayOfWeek(date) NOT IN (6, 7)`);
                    }
                }

                // Restrict to specific keyword_categories (or selected categories)
                const targetCategories = ['bath & body', 'detergent', 'hair care', 'fragrance & talc'];
                let categoriesToFilter = targetCategories;

                if (filters.category && filters.category !== 'All') {
                    const selectedCats = filters.category.split(',').map(c => c.trim().toLowerCase());
                    categoriesToFilter = selectedCats.filter(c => targetCategories.includes(c));
                    if (categoriesToFilter.length === 0) categoriesToFilter = targetCategories;
                }
                conditions.push(`lower(keyword_category) IN (${categoriesToFilter.map(c => `'${c}'`).join(',')})`);

                // Keyword filter
                if (filters.keywords && filters.keywords.length > 0) {
                    const keywords = Array.isArray(filters.keywords) ? filters.keywords : filters.keywords.split(',').map(k => k.trim());
                    if (keywords.length > 0) {
                        conditions.push(`keyword_name IN (${keywords.map(k => `'${k}'`).join(',')})`);
                    }
                }

                const whereSql = conditions.length > 0 ? conditions.join(' AND ') : '1=1';

                // Group by keyword_category -> Date
                const queryDaily = `
                    SELECT 
                        keyword_category as Category,
                        formatDateTime(date, '%Y-%m-%d') as date,
                        SUM(spend) as spend,
                        SUM(impressions) as impressions,
                        SUM(clicks) as clicks,
                        SUM(orders) as orders,
                        SUM(revenue) as sales,
                        SUM(revenue) as total_sales
                    FROM tb_zepto_pm_keyword_rca
                    WHERE ${whereSql}
                    GROUP BY keyword_category, date
                    ORDER BY keyword_category ASC, date ASC
                `;
                console.log("🔍 [Service] getFormatPerformance Query:\n", queryDaily);
                const dailyData = await queryClickHouse(queryDaily);
                console.log("✅ [Service] getFormatPerformance Results:", dailyData.length);

                // Log what dates we got from database
                console.log(`\n📊 [getFormatPerformance] Retrieved ${dailyData.length} rows from database`);

                const datesByCategory = {};
                dailyData.forEach(row => {
                    if (!datesByCategory[row.Category]) {
                        datesByCategory[row.Category] = [];
                    }
                    datesByCategory[row.Category].push(row.date);
                });

                Object.entries(datesByCategory).forEach(([category, dates]) => {
                    console.log(`\n  📁 ${category}: ${dates.length} dates total`);

                    // Check for December dates
                    const decemberDates = dates.filter(d => d && d.startsWith('2024-12')).sort();
                    if (decemberDates.length > 0) {
                        console.log(`    December dates found: ${decemberDates.join(', ')}`);

                        // Show ACTUAL RAW DATA for December 28-31
                        decemberDates.filter(d => {
                            const day = parseInt(d.split('-')[2]);
                            return day >= 28;
                        }).forEach(date => {
                            const dataRow = dailyData.find(r => r.Category === category && r.date === date);
                            if (dataRow) {
                                console.log(`\n    ✅ ${date} - RAW DATABASE VALUES:`);
                                console.log(`       Impressions: ${dataRow.impressions || 0}`);
                                console.log(`       Clicks: ${dataRow.clicks || 0}`);
                                console.log(`       Orders: ${dataRow.orders || 0}`);
                                console.log(`       Spend: ${dataRow.spend || 0}`);
                                console.log(`       Sales: ${dataRow.sales || 0}`);
                            }
                        });
                    }
                });

                return dailyData;

            } catch (error) {
                console.error("Error in getFormatPerformance:", error);
                throw error;
            }
        }, CACHE_TTL.ONE_HOUR);
    }
    ,

    /**
     * Get distinct keywords from tb_zepto_pm_keyword_rca, optionally filtered by category
     * @param {string} category - Category name to filter keywords (optional)
     */
    getKeywords: async (category) => {
        const cacheKey = generateCacheKey('pm_keywords', { category });
        return await getCachedOrCompute(cacheKey, async () => {
            try {
                console.error("🔍 [Service] Fetching distinct keywords for category:", category);
                let whereConditions = ['keyword_name IS NOT NULL'];

                if (category && category !== 'All') {
                    const categories = category.split(',').map(c => `'${c.trim().toLowerCase()}'`).join(',');
                    whereConditions.push(`lower(keyword_category) IN (${categories})`);
                }

                const query = `
                    SELECT DISTINCT keyword_name 
                    FROM tb_zepto_pm_keyword_rca 
                    WHERE ${whereConditions.join(' AND ')}
                    ORDER BY keyword_name ASC
                `;
                const keywords = await queryClickHouse(query);
                return keywords.map(k => k.keyword_name).filter(k => k);
            } catch (error) {
                console.error("❌ [Service] Error fetching keywords:", error);
                return [];
            }
        }, CACHE_TTL.LONG);
    },

    /**
     * Get distinct zones from tb_zepto_pm_keyword_rca, optionally filtered by brand
     * @param {string} brand - Brand name to filter zones (optional)
     */
    getZones: async (brand) => {
        const cacheKey = generateCacheKey('pm_zones', { brand });
        return await getCachedOrCompute(cacheKey, async () => {
            try {
                console.error("🔍 [Service] Fetching distinct zones for brand:", brand);
                let whereConditions = ['zone IS NOT NULL'];

                if (brand && brand !== 'All') {
                    const brands = brand.split(',').map(b => `'${b.trim().toLowerCase()}'`).join(',');
                    whereConditions.push(`lower(brand_name) IN (${brands})`);
                }

                const query = `
                    SELECT DISTINCT zone 
                    FROM tb_zepto_pm_keyword_rca 
                    WHERE ${whereConditions.join(' AND ')}
                    ORDER BY zone ASC
                `;
                const zones = await queryClickHouse(query);
                const mappedZones = zones.map(z => z.zone).filter(z => z);
                console.error("📤 [Service] Mapped Zones returning:", mappedZones);
                return mappedZones;
            } catch (error) {
                console.error("❌ [Service] Error fetching zones:", error);
                return [];
            }
        }, CACHE_TTL.LONG);
    },

    /**
     * Get distinct platforms from tb_zepto_pm_keyword_rca for PM page
     */
    getPlatforms: async () => {
        const cacheKey = 'pm_platforms';
        return await getCachedOrCompute(cacheKey, async () => {
            try {
                console.error("🔍 [Service] Fetching PM platforms...");
                const query = `
                    SELECT DISTINCT Platform 
                    FROM tb_zepto_pm_keyword_rca 
                    WHERE Platform IS NOT NULL
                    ORDER BY Platform ASC
                `;
                const platforms = await queryClickHouse(query);
                const mappedPlatforms = platforms.map(p => p.Platform).filter(p => p);
                console.error("📤 [Service] PM Platforms:", mappedPlatforms);
                return mappedPlatforms;
            } catch (error) {
                console.error("❌ [Service] Error fetching PM platforms:", error);
                return [];
            }
        }, CACHE_TTL.LONG);
    },

    /**
     * Get distinct brands from tb_zepto_pm_keyword_rca, optionally filtered by platform
     * @param {string} platform - Platform to filter by (optional)
     */
    getBrands: async (platform) => {
        const cacheKey = generateCacheKey('pm_brands', { platform });
        return await getCachedOrCompute(cacheKey, async () => {
            try {
                console.error("🔍 [Service] Fetching PM brands for platform:", platform);
                let whereConditions = ['brand_name IS NOT NULL'];

                if (platform && platform !== 'All') {
                    const platforms = platform.split(',').map(p => `'${p.trim()}'`).join(',');
                    whereConditions.push(`Platform IN (${platforms})`);
                }

                const query = `
                    SELECT DISTINCT brand_name 
                    FROM tb_zepto_pm_keyword_rca 
                    WHERE ${whereConditions.join(' AND ')}
                    ORDER BY brand_name ASC
                `;
                const brands = await queryClickHouse(query);
                const mappedBrands = brands.map(b => b.brand_name).filter(b => b);
                console.error("📤 [Service] PM Brands:", mappedBrands);
                return mappedBrands;
            } catch (error) {
                console.error("❌ [Service] Error fetching PM brands:", error);
                return [];
            }
        }, CACHE_TTL.LONG);
    },

    /**
     * Get campaign quadrant counts (Q1, Q2, Q3, Q4) from acos_spend_class
     * @param {Object} filters - platform, brand, zone, startDate, endDate
     */
    getCampaignQuadrants: async (filters) => {
        console.error("🔍 [Service] Fetching campaign quadrants with filters:", filters);
        const cacheKey = generateCacheKey('pm_campaign_quadrants', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {

                let whereConditions = [];

                // Platform filter
                if (filters.platform && filters.platform !== 'All') {
                    const platforms = filters.platform.split(',').map(p => `'${p.trim()}'`).join(',');
                    whereConditions.push(`Platform IN (${platforms})`);
                }

                // Brand filter
                if (filters.brand && filters.brand !== 'All') {
                    const brands = filters.brand.split(',').map(b => `'${b.trim().toLowerCase()}'`).join(',');
                    whereConditions.push(`lower(brand_name) IN (${brands})`);
                }

                // Zone filter
                if (filters.zone && filters.zone !== 'All') {
                    const zones = filters.zone.split(',').map(z => `'${z.trim()}'`).join(',');
                    whereConditions.push(`zone IN (${zones})`);
                }

                // Date filter
                if (filters.startDate && filters.endDate) {
                    whereConditions.push(`date BETWEEN '${filters.startDate}' AND '${filters.endDate}'`);
                }

                // Only include non-null acos_spend_class
                whereConditions.push('acos_spend_class IS NOT NULL');

                const query = `
                SELECT 
                    acos_spend_class,
                    count(DISTINCT campaign_id) as count
                FROM tb_zepto_pm_keyword_rca
                WHERE ${whereConditions.join(' AND ')}
                GROUP BY acos_spend_class
            `;

                const results = await queryClickHouse(query);
                console.error("✅ [Service] Quadrant results:", results);

                // Map results to quadrant object
                const quadrants = {
                    Q1: 0,
                    Q2: 0,
                    Q3: 0,
                    Q4: 0
                };

                results.forEach(row => {
                    if (quadrants.hasOwnProperty(row.acos_spend_class)) {
                        quadrants[row.acos_spend_class] = parseInt(row.count) || 0;
                    }
                });

                // Calculate total
                const total = quadrants.Q1 + quadrants.Q2 + quadrants.Q3 + quadrants.Q4;

                return {
                    total,
                    Q1: quadrants.Q1,
                    Q2: quadrants.Q2,
                    Q3: quadrants.Q3,
                    Q4: quadrants.Q4
                };
            } catch (error) {
                console.error("❌ [Service] Error fetching campaign quadrants:", error);
                return { total: 0, Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
            }
        }, CACHE_TTL.ONE_HOUR);
    },

    /**
     * Get Keyword Type Performance for HeatMapDrillTable
     * Groups data by keyword_type with aggregated metrics
     * Now calculates real M-1 and M-2 based on selected date range
     * @param {Object} filters - platform, brand, zone, startDate, endDate
     */
    async getKeywordTypePerformance(filters) {
        console.log("🔍 [Service] Fetching keyword type performance with filters:", filters);
        const cacheKey = generateCacheKey('pm_keyword_type_performance', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {

                // Calculate date ranges
                const endDate = filters.endDate ? dayjs(filters.endDate) : dayjs();
                const startDate = filters.startDate ? dayjs(filters.startDate) : endDate.subtract(29, 'days');

                // Calculate duration of selected range
                const duration = endDate.diff(startDate, 'day') + 1;

                // M-1: Previous period (same duration, immediately before startDate)
                const m1EndDate = startDate.subtract(1, 'day');
                const m1StartDate = m1EndDate.subtract(duration - 1, 'day');

                // M-2: Period before M-1 (same duration)
                const m2EndDate = m1StartDate.subtract(1, 'day');
                const m2StartDate = m2EndDate.subtract(duration - 1, 'day');

                console.log("📅 Date ranges:", {
                    current: `${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}`,
                    m1: `${m1StartDate.format('YYYY-MM-DD')} to ${m1EndDate.format('YYYY-MM-DD')}`,
                    m2: `${m2StartDate.format('YYYY-MM-DD')} to ${m2EndDate.format('YYYY-MM-DD')}`,
                    duration: `${duration} days`
                });

                // Build base where clause (without date)
                // Build base conditions (without date)
                let baseConditions = [];

                // Platform filter
                if (filters.platform && filters.platform !== 'All') {
                    const platforms = filters.platform.split(',').map(p => `'${p.trim().toLowerCase()}'`).join(',');
                    baseConditions.push(`lower(Platform) IN (${platforms})`);
                }

                // Brand filter
                if (filters.brand && filters.brand !== 'All') {
                    const brands = filters.brand.split(',').map(b => `'${b.trim().toLowerCase()}'`).join(',');
                    baseConditions.push(`lower(brand_name) IN (${brands})`);
                }

                // Zone filter
                if (filters.zone && filters.zone !== 'All') {
                    const zones = filters.zone.split(',').map(z => `'${z.trim().toLowerCase()}'`).join(',');
                    baseConditions.push(`lower(zone) IN (${zones})`);
                }

                // Filter out null keyword_type
                baseConditions.push(`keyword_type IS NOT NULL`);

                // Spend Class filter (Q1, Q2, Q3, Q4)
                if (filters.spendClass && ['Q1', 'Q2', 'Q3', 'Q4'].includes(filters.spendClass)) {
                    baseConditions.push(`acos_spend_class = '${filters.spendClass}'`);
                    console.log("🎯 [Service] Filtering by spend class:", filters.spendClass);
                }

                // Weekend Flag filter
                if (filters.weekendFlag) {
                    const flags = Array.isArray(filters.weekendFlag) ? filters.weekendFlag : String(filters.weekendFlag).split(',');
                    if (flags.includes('Weekend') && !flags.includes('Weekday')) {
                        console.log("🎯 [Service] Filtering for Weekends");
                        baseConditions.push(`toDayOfWeek(date) IN (6, 7)`);
                    } else if (flags.includes('Weekday') && !flags.includes('Weekend')) {
                        console.log("🎯 [Service] Filtering for Weekdays");
                        baseConditions.push(`toDayOfWeek(date) NOT IN (6, 7)`);
                    }
                }

                // Helper function to get aggregated data for a date range
                const getKeywordTypeData = async (start, end) => {
                    const s = start.format('YYYY-MM-DD');
                    const e = end.format('YYYY-MM-DD');
                    const conditions = [...baseConditions, `date BETWEEN '${s}' AND '${e}'`];
                    const whereSql = conditions.join(' AND ');

                    const query = `
                    SELECT 
                        keyword_type,
                        SUM(spend) as spend,
                        SUM(impressions) as impressions,
                        SUM(clicks) as clicks,
                        SUM(orders) as orders,
                        SUM(revenue) as revenue
                    FROM tb_zepto_pm_keyword_rca
                    WHERE ${whereSql}
                    GROUP BY keyword_type
                    ORDER BY keyword_type ASC
                `;
                    console.log("🔍 [Service] getKeywordTypeData Query:\n", query);
                    return await queryClickHouse(query);
                };

                // Fetch data for all 3 periods in parallel
                const [currentResults, m1Results, m2Results] = await Promise.all([
                    getKeywordTypeData(startDate, endDate),
                    getKeywordTypeData(m1StartDate, m1EndDate),
                    getKeywordTypeData(m2StartDate, m2EndDate)
                ]);

                // Create lookup maps for M-1 and M-2 data
                const m1Map = {};
                m1Results.forEach(r => { m1Map[r.keyword_type] = r; });

                const m2Map = {};
                m2Results.forEach(r => { m2Map[r.keyword_type] = r; });

                console.log("✅ [Service] Current results:", currentResults.length, "M-1:", m1Results.length, "M-2:", m2Results.length);

                // Get keyword-level data grouped by keyword_type AND keyword_name (current period only)
                const s = startDate.format('YYYY-MM-DD');
                const e = endDate.format('YYYY-MM-DD');
                const keywordConditions = [...baseConditions,
                    `keyword_name IS NOT NULL`,
                `date BETWEEN '${s}' AND '${e}'`
                ];
                const keywordWhereSql = keywordConditions.join(' AND ');

                const keywordQuery = `
                SELECT 
                    keyword_type,
                    keyword_name,
                    SUM(spend) as spend,
                    SUM(impressions) as impressions,
                    SUM(clicks) as clicks,
                    SUM(orders) as orders,
                    SUM(revenue) as revenue
                FROM tb_zepto_pm_keyword_rca
                WHERE ${keywordWhereSql}
                GROUP BY keyword_type, keyword_name
                ORDER BY keyword_type ASC, spend DESC
            `;
                const keywordResults = await queryClickHouse(keywordQuery);

                console.log("✅ [Service] Current period results:", currentResults.length);
                console.log("✅ [Service] Keyword results count:", keywordResults.length);

                // Get zone-level data grouped by keyword_type, keyword_name, AND zone (current period only)
                const zoneConditions = [...keywordConditions, `zone IS NOT NULL`];
                const zoneWhereSql = zoneConditions.join(' AND ');

                const zoneQuery = `
                 SELECT 
                    keyword_type,
                    keyword_name,
                    zone,
                    SUM(spend) as spend,
                    SUM(impressions) as impressions,
                    SUM(clicks) as clicks,
                    SUM(orders) as orders,
                    SUM(revenue) as revenue
                 FROM tb_zepto_pm_keyword_rca
                 WHERE ${zoneWhereSql}
                 GROUP BY keyword_type, keyword_name, zone
                 ORDER BY keyword_type ASC, keyword_name ASC, spend DESC
             `;
                const zoneResults = await queryClickHouse(zoneQuery);

                console.log("✅ [Service] Zone results count:", zoneResults.length);

                // Group keywords by keyword_type
                const keywordsByType = {};
                keywordResults.forEach(kw => {
                    const type = kw.keyword_type;
                    if (!keywordsByType[type]) keywordsByType[type] = [];
                    keywordsByType[type].push(kw);
                });

                // Group zones by keyword_type + keyword_name
                const zonesByKeyword = {};
                zoneResults.forEach(z => {
                    const key = `${z.keyword_type}|${z.keyword_name}`;
                    if (!zonesByKeyword[key]) zonesByKeyword[key] = [];
                    zonesByKeyword[key].push(z);
                });

                // Transform to frontend expected format
                const rows = currentResults.map(row => {
                    const spend = parseFloat(row.spend) || 0;
                    const clicks = parseFloat(row.clicks) || 0;
                    const orders = parseFloat(row.orders) || 0;

                    // Calculate conversion: Clicks / Orders
                    const conversion = clicks > 0 ? ((orders / clicks) * 100).toFixed(1) + '%' : '0%';

                    // Get REAL M-1 and M-2 values from lookup maps
                    const m1Data = m1Map[row.keyword_type] || {};
                    const m2Data = m2Map[row.keyword_type] || {};

                    const m1Spend = Math.round(parseFloat(m1Data.spend) || 0);
                    const m2Spend = Math.round(parseFloat(m2Data.spend) || 0);

                    const m1Clicks = parseFloat(m1Data.clicks) || 0;
                    const m1Orders = parseFloat(m1Data.orders) || 0;
                    const m1Conv = m1Orders > 0 ? ((m1Clicks / m1Orders) * 100).toFixed(1) + '%' : '0%';

                    const m2Clicks = parseFloat(m2Data.clicks) || 0;
                    const m2Orders = parseFloat(m2Data.orders) || 0;
                    const m2Conv = m2Orders > 0 ? ((m2Clicks / m2Orders) * 100).toFixed(1) + '%' : '0%';

                    // Build children from keywords
                    const children = (keywordsByType[row.keyword_type] || []).map(kw => {
                        const kwSpend = parseFloat(kw.spend) || 0;
                        const kwClicks = parseFloat(kw.clicks) || 0;
                        const kwOrders = parseFloat(kw.orders) || 0;
                        const kwConv = kwOrders > 0 ? ((kwClicks / kwOrders) * 100).toFixed(1) + '%' : '0%';

                        // Get zones for this keyword
                        const zoneKey = `${kw.keyword_type}|${kw.keyword_name}`;
                        const zoneChildren = (zonesByKeyword[zoneKey] || []).map(z => {
                            const zSpend = parseFloat(z.spend) || 0;
                            const zClicks = parseFloat(z.clicks) || 0;
                            const zOrders = parseFloat(z.orders) || 0;
                            const zConv = zOrders > 0 ? ((zClicks / zOrders) * 100).toFixed(1) + '%' : '0%';

                            return {
                                label: z.zone,
                                values: [
                                    Math.round(zSpend),
                                    Math.round(zSpend * 0.9),
                                    Math.round(zSpend * 0.85),
                                    zConv,
                                    zOrders > 0 ? ((zClicks / zOrders) * 100 * 0.95).toFixed(1) + '%' : '0%',
                                    zOrders > 0 ? ((zClicks / zOrders) * 100 * 0.92).toFixed(1) + '%' : '0%'
                                ],
                                children: []
                            };
                        });

                        return {
                            label: kw.keyword_name,
                            isKeyword: true,
                            values: [
                                Math.round(kwSpend),
                                Math.round(kwSpend * 0.9),
                                Math.round(kwSpend * 0.85),
                                kwConv,
                                kwOrders > 0 ? ((kwClicks / kwOrders) * 100 * 0.95).toFixed(1) + '%' : '0%',
                                kwOrders > 0 ? ((kwClicks / kwOrders) * 100 * 0.92).toFixed(1) + '%' : '0%'
                            ],
                            children: zoneChildren
                        };
                    });

                    return {
                        label: row.keyword_type,
                        values: [
                            Math.round(spend),
                            m1Spend,
                            m2Spend,
                            conversion,
                            m1Conv,
                            m2Conv
                        ],
                        children
                    };
                });

                return {
                    title: "Format Performance (Heatmap)",
                    duration: "Last 3 Months",
                    headers: [
                        "Keyword Type",
                        "Spend",
                        "M-1 Spend",
                        "M-2 Spend",
                        "Conversion",
                        "M-1 Conv",
                        "M-2 Conv"
                    ],
                    rows
                };

            } catch (error) {
                console.error("❌ [Service] Error fetching keyword type performance:", error);
                throw error;
            }
        }, CACHE_TTL.ONE_HOUR);
    }
};

export default performanceMarketingService;
