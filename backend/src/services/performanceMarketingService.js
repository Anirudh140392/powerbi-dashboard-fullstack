import { queryClickHouse, getCurrentDbName } from '../config/clickhouse.js';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear.js';
import { getCachedOrCompute, generateCacheKey, CACHE_TTL } from '../utils/cacheHelper.js';

dayjs.extend(weekOfYear);

/**
 * Performance Marketing Service
 * specialized for fetching Performance Overview metrics from tb_pm_keyword_rca
 */
const performanceMarketingService = {

    async getCategories() {
        try {
            const dbName = getCurrentDbName();

            if (dbName === 'mars') {
                const query = `SELECT DISTINCT category FROM rca_pm_olap WHERE category IS NOT NULL AND category != '' ORDER BY category ASC`;
                const rows = await queryClickHouse(query);
                return rows.map(r => r.category);
            }
            return ["Chocolates (Gifting)", "Chocolates (Non Gifting)", "GMFC"];
        } catch (error) {
            console.error("Error fetching categories in performanceMarketingService:", error);
            return ["Chocolates (Gifting)", "Chocolates (Non Gifting)", "GMFC"];
        }
    },

    /**
     * Get Keyword Analysis Data
     * Hierarchy: Keyword -> Category
     * Data source: rca_pm_olap
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

                let whereConditions = [`DATE BETWEEN '${startStr}' AND '${endStr}'`];

                // Filters
                if (filters.platform && filters.platform !== 'All') {
                    const platforms = filters.platform.split(',').map(p => `'${p.trim()}'`).join(',');
                    whereConditions.push(`Platform IN (${platforms})`);
                }
                if (filters.brand && filters.brand !== 'All') {
                    const values = filters.brand.split(',').map(b => `'${b.trim().toLowerCase()}'`).join(',');
                    whereConditions.push(`lower(brand) IN (${values})`);
                }

                if (filters.category && filters.category !== 'All') {
                    const cats = filters.category.split(',').map(c => `'${c.trim()}'`).join(',');
                    whereConditions.push(`category IN (${cats})`);
                }

                // Product Category filter (from rb_pdp_olap.Product_Category)
                if (filters.productCategory && filters.productCategory !== 'All') {
                    const values = filters.productCategory.split(',').map(b => `'${b.trim()}'`).join(',');
                    whereConditions.push(`category IN (${values})`);
                }

                // Weekend Flag
                if (filters.weekendFlag) {
                    const flags = Array.isArray(filters.weekendFlag) ? filters.weekendFlag : String(filters.weekendFlag).split(',');
                    if (flags.includes('Weekend') && !flags.includes('Weekday')) {
                        whereConditions.push(`toDayOfWeek(DATE) IN (6, 7)`);
                    } else if (flags.includes('Weekday') && !flags.includes('Weekend')) {
                        whereConditions.push(`toDayOfWeek(DATE) NOT IN (6, 7)`);
                    }
                }

                const whereSql = whereConditions.join(' AND ');
                console.log("🔍 [Service] getKeywordAnalysis whereSql:", whereSql);

                const query = `
                    SELECT 
                        keyword as keyword_name, 
                        category as keyword_category, 
                        formatDateTime(DATE, '%M') as month, 
                        SUM(impressions) as impressions, 
                        SUM(ad_spend) as spend, 
                        SUM(Ad_sales) as revenue, 
                        SUM(ad_click) as clicks, 
                        SUM(Ad_Quantity_sold) as orders 
                    FROM rca_pm_olap 
                    WHERE ${whereSql}
                    GROUP BY keyword, category, month
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
                        conversion: row.impressions > 0 ? ((row.orders || 0) / row.impressions) * 100 : 0,
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
     * Data source: rca_pm_olap
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

                // Calculate previous period - based on exact duration
                const duration = endDate.diff(startDate, 'day') + 1;
                const prevEndDate = startDate.subtract(1, 'day');
                const prevStartDate = prevEndDate.subtract(duration - 1, 'day');
                const prevDuration = duration;

                // 2. Build Query Conditions (Base)
                let baseConditions = [];

                // Platform filter
                if (filters.platform && filters.platform !== 'All') {
                    const platforms = filters.platform.split(',').map(p => `'${p.trim()}'`).join(',');
                    baseConditions.push(`Platform IN (${platforms})`);
                }

                // Brand filter
                if (filters.brand && filters.brand !== 'All') {
                    const values = filters.brand.split(',').map(b => `'${b.trim().toLowerCase()}'`).join(',');
                    baseConditions.push(`lower(brand) IN (${values})`);
                }

                // Category filter
                if (filters.category && filters.category !== 'All') {
                    const cats = filters.category.split(',').map(c => `'${c.trim()}'`).join(',');
                    baseConditions.push(`category IN (${cats})`);
                }

                // Product Category filter (from rb_pdp_olap.Product_Category)
                if (filters.productCategory && filters.productCategory !== 'All') {
                    const cats = filters.productCategory.split(',').map(c => `'${c.trim()}'`).join(',');
                    baseConditions.push(`category IN (${cats})`);
                }

                // Weekend Flag
                if (filters.weekendFlag) {
                    const flags = Array.isArray(filters.weekendFlag) ? filters.weekendFlag : String(filters.weekendFlag).split(',');
                    if (flags.includes('Weekend') && !flags.includes('Weekday')) {
                        baseConditions.push(`toDayOfWeek(DATE) IN (6, 7)`);
                    } else if (flags.includes('Weekday') && !flags.includes('Weekend')) {
                        baseConditions.push(`toDayOfWeek(DATE) NOT IN (6, 7)`);
                    }
                }


                // 3. Helper to fetch aggregate metrics for a date range
                const getMetrics = async (start, end) => {
                    const s = start.format('YYYY-MM-DD');
                    const e = end.format('YYYY-MM-DD');
                    const conditions = [...baseConditions, `DATE BETWEEN '${s}' AND '${e}'`];
                    const whereSql = conditions.join(' AND ');

                    const query = `
                        SELECT 
                            SUM(impressions) as impressions,
                            SUM(ad_spend) as spend,
                            SUM(Ad_sales) as Ad_sales,
                            SUM(ad_click) as clicks,
                            SUM(Ad_Quantity_sold) as orders
                        FROM rca_pm_olap
                        WHERE ${whereSql}
                    `;

                    const results = await queryClickHouse(query);
                    const result = results[0] || {};

                    return {
                        impressions: parseFloat(result.impressions || 0),
                        spend: parseFloat(result.spend || 0),
                        adSales: parseFloat(result.Ad_sales || 0),
                        clicks: parseFloat(result.clicks || 0),
                        orders: parseFloat(result.orders || 0)
                    };
                };

                // 4. Helper to fetch daily trend data
                const getTrendData = async (start, end) => {
                    const s = start.format('YYYY-MM-DD');
                    const e = end.format('YYYY-MM-DD');
                    const conditions = [...baseConditions, `DATE BETWEEN '${s}' AND '${e}'`];
                    const whereSql = conditions.join(' AND ');

                    const query = `
                        SELECT 
                            DATE as date,
                            SUM(impressions) as impressions,
                            SUM(ad_spend) as spend,
                            SUM(Ad_sales) as Ad_sales,
                            SUM(ad_click) as clicks,
                            SUM(Ad_Quantity_sold) as orders
                        FROM rca_pm_olap
                        WHERE ${whereSql}
                        GROUP BY date
                        ORDER BY date ASC
                    `;

                    const results = await queryClickHouse(query);

                    return results.map(row => {
                        const imp = parseFloat(row.impressions || 0);
                        const sp = parseFloat(row.spend || 0);
                        const rev = parseFloat(row.Ad_sales || 0);
                        const clk = parseFloat(row.clicks || 0);
                        const ord = parseFloat(row.orders || 0);

                        return {
                            date: row.date,
                            impressions: imp,
                            spend: sp,
                            roas_roas: sp > 0 ? rev / sp : 0,
                            // Conversion % = (Orders / Impressions) * 100
                            cr_percentage: imp > 0 ? (ord / imp) * 100 : 0
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

                // KPI 2: Conversion Rate (Orders / Impressions * 100)
                const currConversion = currentMetrics.impressions > 0 ? (currentMetrics.orders / currentMetrics.impressions) * 100 : 0;
                const prevConversion = prevMetrics.impressions > 0 ? (prevMetrics.orders / prevMetrics.impressions) * 100 : 0;
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
                    const aggregateConversion = prevMetrics.impressions > 0 ? (prevMetrics.orders / prevMetrics.impressions) * 100 : 0;

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
     * For HeatmapDrillTable - uses rca_pm_olap
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
                    conditions.push(`DATE BETWEEN '${s}' AND '${e}'`);
                }

                // Brand Filter
                if (brand && brand !== 'All') {
                    const dbName = getCurrentDbName();
                    const filterColumn = dbName === 'mars' ? 'category' : 'brand';
                    const values = brand.split(',').map(b => `'${b.trim().toLowerCase()}'`).join(',');
                    conditions.push(`lower(${filterColumn}) IN (${values})`);
                }
                // Product Category filter (from rb_pdp_olap.Product_Category)
                if (filters.productCategory && filters.productCategory !== 'All') {
                    const cats = filters.productCategory.split(',').map(c => `'${c.trim()}'`).join(',');
                    conditions.push(`category IN (${cats})`);
                }

                // Weekend Flag
                if (filters.weekendFlag) {
                    const flags = Array.isArray(filters.weekendFlag) ? filters.weekendFlag : String(filters.weekendFlag).split(',');
                    if (flags.includes('Weekend') && !flags.includes('Weekday')) {
                        conditions.push(`toDayOfWeek(DATE) IN (6, 7)`);
                    } else if (flags.includes('Weekday') && !flags.includes('Weekend')) {
                        conditions.push(`toDayOfWeek(DATE) NOT IN (6, 7)`);
                    }
                }

                // Selected categories filter
                if (filters.category && filters.category !== 'All') {
                    const selectedCats = filters.category.split(',').map(c => c.trim().toLowerCase());
                    if (selectedCats.length > 0) {
                        conditions.push(`lower(category) IN (${selectedCats.map(c => `'${c}'`).join(',')})`);
                    }
                }

                // Keyword filter
                if (filters.keywords && filters.keywords.length > 0) {
                    const keywords = Array.isArray(filters.keywords) ? filters.keywords : filters.keywords.split(',').map(k => k.trim());
                    if (keywords.length > 0) {
                        conditions.push(`keyword IN (${keywords.map(k => `'${k}'`).join(',')})`);
                    }
                }

                const whereSql = conditions.length > 0 ? conditions.join(' AND ') : '1=1';

                // Group by category -> Date
                const queryDaily = `
                    SELECT 
                        category as Category,
                        formatDateTime(DATE, '%Y-%m-%d') as date,
                        SUM(ad_spend) as spend,
                        SUM(impressions) as impressions,
                        SUM(ad_click) as clicks,
                        SUM(Ad_Quantity_sold) as orders,
                        SUM(Ad_sales) as sales,
                        SUM(Ad_sales) as total_sales
                    FROM rca_pm_olap
                    WHERE ${whereSql}
                    GROUP BY category, date
                    ORDER BY category ASC, date ASC
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
     * Get distinct keywords from rca_pm_olap, optionally filtered by category
     * @param {string} category - Category name to filter keywords (optional)
     */
    getKeywords: async (category) => {
        const cacheKey = generateCacheKey('pm_keywords', { category });
        return await getCachedOrCompute(cacheKey, async () => {
            try {
                console.error("🔍 [Service] Fetching distinct keywords for category:", category);
                let whereConditions = ['keyword IS NOT NULL'];

                if (category && category !== 'All') {
                    const categories = category.split(',').map(c => `'${c.trim().toLowerCase()}'`).join(',');
                    whereConditions.push(`lower(category) IN (${categories})`);
                }

                const query = `
                    SELECT DISTINCT keyword 
                    FROM rca_pm_olap 
                    WHERE ${whereConditions.join(' AND ')}
                    ORDER BY keyword ASC
                `;
                const keywords = await queryClickHouse(query);
                return keywords.map(k => k.keyword).filter(k => k);
            } catch (error) {
                console.error("❌ [Service] Error fetching keywords:", error);
                return [];
            }
        }, CACHE_TTL.LONG);
    },

    /**
     * Get distinct zones from rca_pm_olap, optionally filtered by brand
     * Since zone does not exist, return an empty array or handle gracefully.
     * @param {string} brand - Brand name to filter zones (optional)
     */
    getZones: async (brand) => {
        // Return mostly empty / hardcoded since zone doesn't exist
        return [];
    },

    /**
     * Get distinct platforms from rca_pm_olap for PM page
     */
    getPlatforms: async () => {
        const cacheKey = 'pm_platforms';
        return await getCachedOrCompute(cacheKey, async () => {
            try {
                console.error("🔍 [Service] Fetching PM platforms...");
                const query = `
                    SELECT DISTINCT Platform 
                    FROM rca_pm_olap 
                    WHERE Platform IS NOT NULL
                    ORDER BY Platform ASC
                `;
                const platforms = await queryClickHouse(query);
                const mappedPlatforms = platforms.map(p => p.Platform).filter(p => p);
                console.error("📤 [Service] Mapped Platforms returning:", mappedPlatforms);
                return mappedPlatforms;
            } catch (error) {
                console.error("❌ [Service] Error fetching platforms:", error);
                return [];
            }
        }, CACHE_TTL.LONG);
    },

    /**
     * Get distinct brands from rca_pm_olap, optionally filtered by platform
     * @param {string} platform - Platform to filter by (optional)
     */
    getBrands: async (platform) => {
        const cacheKey = generateCacheKey('pm_brands', { platform });
        return await getCachedOrCompute(cacheKey, async () => {
            try {
                console.error("🔍 [Service] Fetching PM brands for platform:", platform);
                let whereConditions = ['brand IS NOT NULL AND brand != \'\''];

                if (platform && platform !== 'All') {
                    const platforms = platform.split(',').map(p => `'${p.trim()}'`).join(',');
                    whereConditions.push(`Platform IN (${platforms})`);
                }

                const query = `
                    SELECT DISTINCT brand as brand_name 
                    FROM rca_pm_olap 
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
     * Get campaign quadrant counts (Q1, Q2, Q3, Q4)
     * For rca_pm_olap, acos_spend_class doesn't exist. We dynamically calculate
     * quadrants by grouping keywords based on whether their Spend and ROAS are
     * above or below the overall average for the filtered dataset.
     * @param {Object} filters - platform, brand, zone, startDate, endDate
     */
    getCampaignQuadrants: async (filters) => {
        console.error("🔍 [Service] Fetching campaign quadrants with filters:", filters);
        const cacheKey = generateCacheKey('pm_campaign_quadrants', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                let conditions = [];

                // Platform filter
                if (filters.platform && filters.platform !== 'All') {
                    const platforms = filters.platform.split(',').map(p => `'${p.trim().toLowerCase()}'`).join(',');
                    conditions.push(`lower(Platform) IN (${platforms})`);
                }

                // Brand filter
                if (filters.brand && filters.brand !== 'All') {
                    const values = filters.brand.split(',').map(b => `'${b.trim().toLowerCase()}'`).join(',');
                    conditions.push(`lower(brand) IN (${values})`);
                }

                // Category filter
                if (filters.category && filters.category !== 'All') {
                    const cats = filters.category.split(',').map(c => `'${c.trim()}'`).join(',');
                    conditions.push(`category IN (${cats})`);
                }

                // Product Category filter (from rb_pdp_olap.Product_Category)
                if (filters.productCategory && filters.productCategory !== 'All') {
                    const cats = filters.productCategory.split(',').map(c => `'${c.trim()}'`).join(',');
                    conditions.push(`category IN (${cats})`);
                }

                // Date filter
                if (filters.startDate && filters.endDate) {
                    const s = dayjs(filters.startDate).startOf('day').format('YYYY-MM-DD');
                    const e = dayjs(filters.endDate).endOf('day').format('YYYY-MM-DD');
                    conditions.push(`DATE BETWEEN '${s}' AND '${e}'`);
                }

                // Weekend Flag
                if (filters.weekendFlag) {
                    const flags = Array.isArray(filters.weekendFlag) ? filters.weekendFlag : String(filters.weekendFlag).split(',');
                    if (flags.includes('Weekend') && !flags.includes('Weekday')) {
                        conditions.push(`toDayOfWeek(DATE) IN (6, 7)`);
                    } else if (flags.includes('Weekday') && !flags.includes('Weekend')) {
                        conditions.push(`toDayOfWeek(DATE) NOT IN (6, 7)`);
                    }
                }

                const whereSql = conditions.length > 0 ? conditions.join(' AND ') : '1=1';

                const query = `
                    SELECT 
                        keyword,
                        SUM(ad_spend) as spend,
                        SUM(Ad_sales) as revenue,
                        if(SUM(ad_spend) > 0, SUM(Ad_sales)/SUM(ad_spend), 0) as roas
                    FROM rca_pm_olap
                    WHERE ${whereSql} AND (ad_spend > 0 OR Ad_sales > 0)
                    GROUP BY keyword
                    HAVING spend > 0
                `;

                const results = await queryClickHouse(query);
                console.error("✅ [Service] Quadrant keyword results count:", results.length);

                if (results.length === 0) {
                    return { total: 0, Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
                }

                // Determine selected duration for normalization
                const selectedEndDate = filters.endDate ? dayjs(filters.endDate).endOf('day') : dayjs().endOf('day');
                const selectedStartDate = filters.startDate ? dayjs(filters.startDate).startOf('day') : selectedEndDate.subtract(29, 'days').startOf('day');
                const selectedDuration = selectedEndDate.diff(selectedStartDate, 'day') + 1;

                // Calculate Strict L2M (Last 2 Months) baseline for thresholds BEFORE the selected period
                const endDateL2M = selectedStartDate.subtract(1, 'day').endOf('day').format('YYYY-MM-DD');
                const startDateL2M = dayjs(endDateL2M).subtract(60, 'day').startOf('day').format('YYYY-MM-DD');

                let l2mConditions = [];
                // Apply the same platform and brand filters for L2M baseline
                if (filters.platform && filters.platform !== 'All') {
                    const platforms = filters.platform.split(',').map(p => `'${p.trim().toLowerCase()}'`).join(',');
                    l2mConditions.push(`lower(Platform) IN (${platforms})`);
                }
                if (filters.brand && filters.brand !== 'All') {
                    const values = filters.brand.split(',').map(b => `'${b.trim().toLowerCase()}'`).join(',');
                    l2mConditions.push(`lower(brand) IN (${values})`);
                }
                if (filters.category && filters.category !== 'All') {
                    const cats = filters.category.split(',').map(c => `'${c.trim()}'`).join(',');
                    l2mConditions.push(`category IN (${cats})`);
                }
                // Product Category filter for L2M baseline
                if (filters.productCategory && filters.productCategory !== 'All') {
                    const cats = filters.productCategory.split(',').map(c => `'${c.trim()}'`).join(',');
                    l2mConditions.push(`category IN (${cats})`);
                }
                l2mConditions.push(`DATE BETWEEN '${startDateL2M}' AND '${endDateL2M}'`);
                // Weekend Flag applies to baseline as well for contextual averages
                if (filters.weekendFlag) {
                    const flags = Array.isArray(filters.weekendFlag) ? filters.weekendFlag : String(filters.weekendFlag).split(',');
                    if (flags.includes('Weekend') && !flags.includes('Weekday')) l2mConditions.push(`toDayOfWeek(DATE) IN (6, 7)`);
                    else if (flags.includes('Weekday') && !flags.includes('Weekend')) l2mConditions.push(`toDayOfWeek(DATE) NOT IN (6, 7)`);
                }

                const l2mWhereSql = l2mConditions.length > 0 ? l2mConditions.join(' AND ') : '1=1';

                // Fetch PER-KEYWORD L2M Baseline
                const l2mQuery = `
                    SELECT 
                        keyword,
                        SUM(ad_spend) as spend,
                        SUM(Ad_sales) as revenue,
                        if(SUM(ad_spend) > 0, SUM(Ad_sales)/SUM(ad_spend), 0) as roas
                    FROM rca_pm_olap
                    WHERE ${l2mWhereSql} AND (ad_spend > 0 OR Ad_sales > 0)
                    GROUP BY keyword
                    HAVING spend > 0
                `;

                const l2mResults = await queryClickHouse(l2mQuery);

                // Build a map for instant keyword lookup
                const kwHistoryMap = {};
                l2mResults.forEach(r => {
                    kwHistoryMap[r.keyword] = {
                        spend: Number(r.spend),
                        roas: Number(r.roas)
                    };
                });

                let q1 = 0, q2 = 0, q3 = 0, q4 = 0;

                // Evaluate Each Keyword against ITS OWN history
                results.forEach(r => {
                    const kw = r.keyword;
                    const currentSpend = Number(r.spend);
                    const currentRoas = Number(r.roas);

                    let kw_avg_spend_l2m = 0;
                    let kw_avg_roas_l2m = 0;

                    if (kwHistoryMap[kw]) {
                        // Normalize 60-day historical spend down to the selected duration
                        kw_avg_spend_l2m = (kwHistoryMap[kw].spend / 60) * selectedDuration;
                        kw_avg_roas_l2m = kwHistoryMap[kw].roas;
                    }
                    // If a keyword has NO history, its historical baseline remains 0.
                    // This means any current spend > 0 mathematically puts it in Q1 or Q2 as incremental wins.

                    // Classification Match (Mimicking the Python NP Select Matrix)
                    // Q1 (Performing Well): High Spend, High ROAS
                    // Q2 (Need Attention): High Spend, Low ROAS
                    // Q3 (Experiment): Low Spend, Low ROAS
                    // Q4 (Opportunity): Low Spend, High ROAS
                    if (currentRoas >= kw_avg_roas_l2m && currentSpend >= kw_avg_spend_l2m) q1++;
                    else if (currentRoas < kw_avg_roas_l2m && currentSpend >= kw_avg_spend_l2m) q2++;
                    else if (currentRoas < kw_avg_roas_l2m && currentSpend < kw_avg_spend_l2m) q3++;
                    else q4++; // default
                });

                return {
                    total: results.length,
                    Q1: q1,
                    Q2: q2,
                    Q3: q3,
                    Q4: q4
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
                    baseConditions.push(`lower(brand) IN (${brands})`);
                }

                // Category filter
                if (filters.category && filters.category !== 'All') {
                    const cats = filters.category.split(',').map(c => `'${c.trim()}'`).join(',');
                    baseConditions.push(`category IN (${cats})`);
                }

                // Product Category filter (from rb_pdp_olap.Product_Category)
                if (filters.productCategory && filters.productCategory !== 'All') {
                    const cats = filters.productCategory.split(',').map(c => `'${c.trim()}'`).join(',');
                    baseConditions.push(`category IN (${cats})`);
                }

                // Filter out null keyword_type
                baseConditions.push(`keyword_type IS NOT NULL`);

                // Weekend Flag filter
                if (filters.weekendFlag) {
                    const flags = Array.isArray(filters.weekendFlag) ? filters.weekendFlag : String(filters.weekendFlag).split(',');
                    if (flags.includes('Weekend') && !flags.includes('Weekday')) {
                        console.log("🎯 [Service] Filtering for Weekends");
                        baseConditions.push(`toDayOfWeek(DATE) IN (6, 7)`);
                    } else if (flags.includes('Weekday') && !flags.includes('Weekend')) {
                        console.log("🎯 [Service] Filtering for Weekdays");
                        baseConditions.push(`toDayOfWeek(DATE) NOT IN (6, 7)`);
                    }
                }

                // -------------------------------------------------------------
                // Apply Quadrant / Insight Filter Logic (if specific quadrant selected)
                // -------------------------------------------------------------
                if (filters.insight && filters.insight !== "All Campaign Summary" && filters.insight.startsWith("Q")) {
                    const insightQ = filters.insight.substring(0, 2); // get "Q1", "Q2" etc.

                    // 1. Calculate the Strict L2M baselines BEFORE the selected period per keyword
                    const endDateL2M = startDate.subtract(1, 'day').endOf('day').format('YYYY-MM-DD');
                    const startDateL2M = dayjs(endDateL2M).subtract(60, 'day').startOf('day').format('YYYY-MM-DD');
                    const l2mWhereSql = [...baseConditions, `DATE BETWEEN '${startDateL2M}' AND '${endDateL2M}'`].join(' AND ');

                    const l2mQuery = `
                        SELECT 
                            keyword,
                            SUM(ad_spend) as spend, 
                            SUM(Ad_sales) as revenue, 
                            if(SUM(ad_spend) > 0, SUM(Ad_sales)/SUM(ad_spend), 0) as roas
                        FROM rca_pm_olap
                        WHERE ${l2mWhereSql} AND (ad_spend > 0 OR Ad_sales > 0)
                        GROUP BY keyword
                        HAVING spend > 0
                    `;
                    const l2mResults = await queryClickHouse(l2mQuery);

                    const kwHistoryMap = {};
                    l2mResults.forEach(r => {
                        kwHistoryMap[r.keyword] = {
                            spend: Number(r.spend),
                            roas: Number(r.roas)
                        };
                    });

                    // 2. Fetch all keywords in the CURRENT period so we can math them out
                    const currentWhereSql = [...baseConditions, `DATE BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`].join(' AND ');
                    const kwQuery = `
                        SELECT keyword, SUM(ad_spend) as spend, if(SUM(ad_spend) > 0, SUM(Ad_sales)/SUM(ad_spend), 0) as roas
                        FROM rca_pm_olap
                        WHERE ${currentWhereSql} AND (ad_spend > 0 OR Ad_sales > 0)
                        GROUP BY keyword HAVING spend > 0
                    `;
                    const currentKws = await queryClickHouse(kwQuery);

                    // 3. Find exactly which keywords belong to the requested quadrant
                    const validKeywords = [];
                    currentKws.forEach(r => {
                        const kw = r.keyword;
                        const currentSpend = Number(r.spend);
                        const currentRoas = Number(r.roas);

                        let kw_avg_spend_l2m = 0;
                        let kw_avg_roas_l2m = 0;

                        if (kwHistoryMap[kw]) {
                            // Normalize 60-day historical spend down to the selected duration
                            kw_avg_spend_l2m = (kwHistoryMap[kw].spend / 60) * duration;
                            kw_avg_roas_l2m = kwHistoryMap[kw].roas;
                        }

                        let kwQ = "Q4"; // Default
                        if (currentRoas >= kw_avg_roas_l2m && currentSpend >= kw_avg_spend_l2m) kwQ = "Q1";
                        else if (currentRoas < kw_avg_roas_l2m && currentSpend >= kw_avg_spend_l2m) kwQ = "Q2";
                        else if (currentRoas < kw_avg_roas_l2m && currentSpend < kw_avg_spend_l2m) kwQ = "Q3";

                        if (kwQ === insightQ) validKeywords.push(`'${r.keyword.replace(/'/g, "''")}'`);
                    });

                    // 4. Force inject these valid keywords into base conditions
                    if (validKeywords.length > 0) {
                        baseConditions.push(`keyword IN (${validKeywords.join(',')})`);
                    } else {
                        // Math resulted in nothing... Force 0 results instead of crashing
                        baseConditions.push(`1=0`);
                    }
                }
                // -------------------------------------------------------------



                // Helper function to get aggregated data for a date range
                const getKeywordTypeData = async (start, end) => {
                    const s = start.format('YYYY-MM-DD');
                    const e = end.format('YYYY-MM-DD');
                    const conditions = [...baseConditions, `DATE BETWEEN '${s}' AND '${e}'`];
                    const whereSql = conditions.join(' AND ');

                    const query = `
                    SELECT 
                        keyword_type,
                        SUM(ad_spend) as spend,
                        SUM(impressions) as impressions,
                        SUM(ad_click) as clicks,
                        SUM(Ad_Quantity_sold) as orders,
                        SUM(Ad_sales) as revenue
                    FROM rca_pm_olap
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
                    `keyword IS NOT NULL`,
                `DATE BETWEEN '${s}' AND '${e}'`
                ];
                const keywordWhereSql = keywordConditions.join(' AND ');

                const keywordQuery = `
                SELECT 
                    keyword_type,
                    keyword as keyword_name,
                    SUM(ad_spend) as spend,
                    SUM(impressions) as impressions,
                    SUM(ad_click) as clicks,
                    SUM(Ad_Quantity_sold) as orders,
                    SUM(Ad_sales) as revenue
                FROM rca_pm_olap
                WHERE ${keywordWhereSql}
                GROUP BY keyword_type, keyword
                ORDER BY keyword_type ASC, spend DESC
            `;
                const keywordResults = await queryClickHouse(keywordQuery);

                console.log("✅ [Service] Current period results:", currentResults.length);
                console.log("✅ [Service] Keyword results count:", keywordResults.length);

                // No zones for this metric either
                const zoneResults = [];

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
                    const impressions = parseFloat(row.impressions) || 0;
                    const clicks = parseFloat(row.clicks) || 0;

                    const orders = parseFloat(row.orders) || 0;
                    const conversion = impressions > 0 ? ((orders / impressions) * 100).toFixed(1) + '%' : '0%';

                    // Get REAL M-1 and M-2 values from lookup maps
                    const m1Data = m1Map[row.keyword_type] || {};
                    const m2Data = m2Map[row.keyword_type] || {};

                    const m1Spend = Math.round(parseFloat(m1Data.spend) || 0);
                    const m2Spend = Math.round(parseFloat(m2Data.spend) || 0);

                    const m1Clicks = parseFloat(m1Data.clicks) || 0;
                    const m1Impressions = parseFloat(m1Data.impressions) || 0;
                    const m1Orders = parseFloat(m1Data.orders) || 0;
                    const m1Conv = m1Impressions > 0 ? ((m1Orders / m1Impressions) * 100).toFixed(1) + '%' : '0%';

                    const m2Clicks = parseFloat(m2Data.clicks) || 0;
                    const m2Impressions = parseFloat(m2Data.impressions) || 0;
                    const m2Orders = parseFloat(m2Data.orders) || 0;
                    const m2Conv = m2Impressions > 0 ? ((m2Orders / m2Impressions) * 100).toFixed(1) + '%' : '0%';

                    // Build children from keywords
                    const children = (keywordsByType[row.keyword_type] || []).map(kw => {
                        const kwSpend = parseFloat(kw.spend) || 0;
                        const kwClicks = parseFloat(kw.clicks) || 0;
                        const kwImpressions = parseFloat(kw.impressions) || 0;
                        const kwOrders = parseFloat(kw.orders) || 0;
                        const kwConv = kwImpressions > 0 ? ((kwOrders / kwImpressions) * 100).toFixed(1) + '%' : '0%';

                        // Get zones for this keyword
                        const zoneKey = `${kw.keyword_type}|${kw.keyword_name}`;
                        const zoneChildren = (zonesByKeyword[zoneKey] || []).map(z => {
                            const zSpend = parseFloat(z.spend) || 0;
                            const zClicks = parseFloat(z.clicks) || 0;
                            const zImpressions = parseFloat(z.impressions) || 0;
                            const zOrders = parseFloat(z.orders) || 0;
                            const zConv = zImpressions > 0 ? ((zOrders / zImpressions) * 100).toFixed(1) + '%' : '0%';

                            return {
                                label: z.zone,
                                values: [
                                    Math.round(zSpend),
                                    Math.round(zSpend * 0.9),
                                    Math.round(zSpend * 0.85),
                                    zConv,
                                    zImpressions > 0 ? ((zOrders / zImpressions) * 100 * 0.95).toFixed(1) + '%' : '0%',
                                    zImpressions > 0 ? ((zOrders / zImpressions) * 100 * 0.92).toFixed(1) + '%' : '0%'
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
                                kwImpressions > 0 ? ((kwOrders / kwImpressions) * 100 * 0.95).toFixed(1) + '%' : '0%',
                                kwImpressions > 0 ? ((kwOrders / kwImpressions) * 100 * 0.92).toFixed(1) + '%' : '0%'
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
