import dayjs from 'dayjs';
import { queryClickHouse } from '../config/clickhouse.js';
import { getCachedOrCompute, generateCacheKey, CACHE_TTL } from '../utils/cacheHelper.js';

const escapeCH = (str) => str ? str.replace(/'/g, "''") : '';
const EXCLUDED_PLATFORMS = ['BigBasket', 'Amazon', 'Flipkart'];

function buildCHCondition(value, column, options = {}) {
    const { isBrand = false, isCategory = false } = options;

    const isAll = (val) => {
        if (!val) return true;
        if (Array.isArray(val)) {
            return val.some(v => {
                const lower = String(v).toLowerCase();
                return lower === 'all' || lower === 'all india';
            });
        }
        const lower = String(val).toLowerCase();
        return lower === 'all' || lower === 'all india';
    };

    const isOurBrand = (val) => {
        // Rely on the generic flag='1' column in the DB to identify own-brand rows.
        // No hardcoded brand names — works for any DB.
        return false;
    };

    // If "All" brands or our main brand is selected, we want our brand's data (flag=1)
    if (isBrand && (isAll(value) || isOurBrand(value))) return "flag = '1'";
    if (isAll(value)) return "1=1";

    const list = typeof value === 'string'
        ? value.split(',').map(v => v.trim()).filter(v => !isAll(v))
        : Array.isArray(value) ? value.filter(v => !isAll(v)) : [value];

    if (list.length === 0) return isBrand ? "flag = '1'" : "1=1";

    if (isCategory) {
        return `LOWER(${column}) IN (${list.map(v => `'${escapeCH(String(v).toLowerCase())}'`).join(', ')})`;
    }
    return `${column} IN (${list.map(v => `'${escapeCH(v)}'`).join(', ')})`;
}



async function calculateAllSOS(dateFrom, dateTo, platform = null, brand = null, location = null, keyword = null, keywordType = null, category = null) {
    try {
        const platformCondition = buildCHCondition(platform, 'platform_name');
        const locationCondition = buildCHCondition(location, 'location_name');
        const brandSOSCondition = buildCHCondition(brand, 'brand', { isBrand: true });
        const keywordCondition = buildCHCondition(keyword, 'keyword');
        const keywordTypeCondition = buildCHCondition(keywordType, 'keyword_type');
        const categoryCondition = buildCHCondition(category, 'keyword_category', { isCategory: true });

        const query = `
            SELECT 
                ROUND(sumIf(toInt32(overall), flag = '1') * 100.0 / nullIf(sum(toInt32(overall)), 0), 2) AS overall_sos,
                ROUND(sumIf(toInt32(spons), flag = '1') * 100.0 / nullIf(sum(toInt32(spons)), 0), 2) AS sponsored_sos,
                ROUND(sumIf(toInt32(organic), flag = '1') * 100.0 / nullIf(sum(toInt32(organic)), 0), 2) AS organic_sos
            FROM rb_kw_olap
            WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
              AND ${platformCondition}
              AND ${locationCondition}
              AND ${keywordCondition}
              AND ${keywordTypeCondition}
              AND ${categoryCondition}
        `;

        const result = await queryClickHouse(query);

        return {
            overall: Number(result[0]?.overall_sos) || 0,
            sponsored: Number(result[0]?.sponsored_sos) || 0,
            organic: Number(result[0]?.organic_sos) || 0
        };
    } catch (error) {
        console.error('Error calculating all SOS (ClickHouse):', error);
        return { overall: 0, sponsored: 0, organic: 0 };
    }
}

/**
 * OPTIMIZED: Get ALL SOS trends in a SINGLE query
 * Returns daily trends for overall, sponsored, and organic SOS
 * @param {number} days - Number of days to include
 * @param {string|null} platform - Platform filter
 * @returns {Promise<{overall: {dates: string[], values: number[]}, sponsored: {dates: string[], values: number[]}, organic: {dates: string[], values: number[]}}>}
 */
async function getAllSOSTrends(days = 7, platform = null, brand = null, location = null, customStartDate = null, customEndDate = null, keyword = null, keywordType = null, category = null) {
    try {
        let startDate, endDate;
        if (customStartDate && customEndDate) {
            startDate = dayjs(customStartDate);
            endDate = dayjs(customEndDate);
        } else {
            endDate = dayjs();
            startDate = endDate.subtract(days - 1, 'day');
        }

        const dateFrom = startDate.format('YYYY-MM-DD');
        const dateTo = endDate.format('YYYY-MM-DD');

        const platformCondition = buildCHCondition(platform, 'platform_name');
        const locationCondition = buildCHCondition(location, 'location_name');
        const brandSOSCondition = buildCHCondition(brand, 'brand', { isBrand: true });
        const keywordCondition = buildCHCondition(keyword, 'keyword');
        const keywordTypeCondition = buildCHCondition(keywordType, 'keyword_type');
        const categoryCondition = buildCHCondition(category, 'keyword_category', { isCategory: true });

        const query = `
            SELECT 
                DATE as crawl_date,
                ROUND(sumIf(toInt32(overall), flag = '1') * 100.0 / nullIf(sum(toInt32(overall)), 0), 2) AS overall_sos,
                ROUND(sumIf(toInt32(spons), flag = '1') * 100.0 / nullIf(sum(toInt32(spons)), 0), 2) AS sponsored_sos,
                ROUND(sumIf(toInt32(organic), flag = '1') * 100.0 / nullIf(sum(toInt32(organic)), 0), 2) AS organic_sos
            FROM rb_kw_olap
            WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
              AND ${platformCondition}
              AND ${locationCondition}
              AND ${keywordCondition}
              AND ${keywordTypeCondition}
              AND ${categoryCondition}
            GROUP BY crawl_date
            ORDER BY crawl_date ASC
        `;

        const results = await queryClickHouse(query);

        const overall = { dates: [], values: [] };
        const sponsored = { dates: [], values: [] };
        const organic = { dates: [], values: [] };

        results.forEach(row => {
            const date = dayjs(row.crawl_date);
            const dateStr = date.format('MMM D');

            overall.dates.push(dateStr);
            overall.values.push(Number(row.overall_sos) || 0);

            sponsored.dates.push(dateStr);
            sponsored.values.push(Number(row.sponsored_sos) || 0);

            organic.dates.push(dateStr);
            organic.values.push(Number(row.organic_sos) || 0);
        });

        return { overall, sponsored, organic };
    } catch (error) {
        console.error('Error getting all SOS trends (ClickHouse):', error);
        return {
            overall: { dates: [], values: [] },
            sponsored: { dates: [], values: [] },
            organic: { dates: [], values: [] }
        };
    }
}

/**
 * Get date ranges for current and previous periods (MTD)
 */
function getDateRanges() {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();

    // Current period: Start of current month to today
    const currentStart = new Date(currentYear, currentMonth, 1);
    const currentEnd = today;

    // Previous period: Same day range in previous month
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const prevStart = new Date(prevYear, prevMonth, 1);
    // Get the same day in previous month, or last day if current day exceeds days in prev month
    const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
    const prevDay = Math.min(currentDay, daysInPrevMonth);
    const prevEnd = new Date(prevYear, prevMonth, prevDay);

    return {
        current: {
            start: currentStart.toISOString().split('T')[0],
            end: currentEnd.toISOString().split('T')[0]
        },
        previous: {
            start: prevStart.toISOString().split('T')[0],
            end: prevEnd.toISOString().split('T')[0]
        }
    };
}

/**
 * Format PP change string
 */
function formatPPChange(currentValue, previousValue) {
    // Ensure we have valid numbers
    const current = Number(currentValue) || 0;
    const previous = Number(previousValue) || 0;
    const diff = current - previous;
    const arrow = diff >= 0 ? '▲' : '▼';
    const absVal = Math.abs(diff).toFixed(1);
    return {
        text: `${arrow}${absVal} pts (from ${previous.toFixed(1)}%)`,
        color: diff >= 0 ? 'green' : 'red'
    };
}

/**
 * Get dynamic Visibility Overview data from database
 */
async function getVisibilityOverviewData(filters = {}) {
    try {
        const platform = filters.platform || null;

        // Use dayjs like Watch Tower for consistent date handling
        // Default to last 7 days for a "Weekly" comparison
        let endDate = dayjs();
        let startDate = endDate.subtract(6, 'day'); // 7 days inclusive

        // Override with filter dates if provided
        if (filters.startDate && filters.endDate) {
            startDate = dayjs(filters.startDate);
            endDate = dayjs(filters.endDate);
        }

        // Previous period = same range shifted back by 7 days (Weekly comparison)
        const durationDays = endDate.diff(startDate, 'day') + 1;
        const prevStart = startDate.subtract(durationDays, 'day');
        const prevEnd = startDate.subtract(1, 'day');

        const dateRanges = {
            current: {
                start: startDate.format('YYYY-MM-DD'),
                end: endDate.format('YYYY-MM-DD')
            },
            previous: {
                start: prevStart.format('YYYY-MM-DD'),
                end: prevEnd.format('YYYY-MM-DD')
            }
        };

        console.log('[VisibilityService] Calculating SOS with date ranges:', dateRanges);
        console.log('[VisibilityService] Using filters:', { platform: filters.platform, category: filters.category, startDate: filters.startDate, endDate: filters.endDate });

        // OPTIMIZED: Only 3 database queries instead of 9
        // 1. Current period SOS (all 3 types in 1 query)
        // 2. Previous period SOS (all 3 types in 1 query)
        // 3. Sparkline trends (all 3 types in 1 query)
        // OPTIMIZED: Only 3 database queries instead of 9
        // Fetch trend data for the SELECTED range to display weekly points
        const [currentSOS, prevSOS, trends] = await Promise.all([
            calculateAllSOS(dateRanges.current.start, dateRanges.current.end, platform, filters.brand, filters.location, filters.keyword, filters.keywordType, filters.category || filters.format),
            calculateAllSOS(dateRanges.previous.start, dateRanges.previous.end, platform, filters.brand, filters.location, filters.keyword, filters.keywordType, filters.category || filters.format),
            getAllSOSTrends(null, platform, filters.brand, filters.location, dateRanges.current.start, dateRanges.current.end, filters.keyword, filters.keywordType, filters.category || filters.format)
        ]);

        // Aggregate daily points into weekly points for "Weekly" aggregation
        const aggregateToWeekly = (dailyTrend) => {
            const weekly = { dates: [], values: [] };
            if (!dailyTrend || !dailyTrend.values || dailyTrend.values.length === 0) return weekly;

            // Group into weeks (7 days each)
            for (let i = 0; i < dailyTrend.values.length; i += 7) {
                const slice = dailyTrend.values.slice(i, i + 7);
                const avg = slice.reduce((a, b) => a + b, 0) / slice.length;

                // Labels W1, W2, etc. based on the chunks in the selected range
                const weekLabel = `W${Math.floor(i / 7) + 1}`;
                weekly.dates.push(weekLabel);
                weekly.values.push(Number(avg.toFixed(1)));
            }
            return weekly;
        };

        const weeklyTrends = {
            overall: aggregateToWeekly(trends.overall),
            sponsored: aggregateToWeekly(trends.sponsored),
            organic: aggregateToWeekly(trends.organic)
        };

        console.log(`[VisibilityService] Calculated SOS Metrics: Overall=${currentSOS.overall.toFixed(1)}%, Sponsored=${currentSOS.sponsored.toFixed(1)}%, Organic=${currentSOS.organic.toFixed(1)}%`);
        console.log('[VisibilityService] Trends Received:', !!trends);

        const overallChange = formatPPChange(currentSOS.overall, prevSOS.overall);
        const sponsoredChange = formatPPChange(currentSOS.sponsored, prevSOS.sponsored);
        const organicChange = formatPPChange(currentSOS.organic, prevSOS.organic);

        return {
            cards: [
                {
                    title: "Overall SOS",
                    value: `${currentSOS.overall.toFixed(1)}%`,
                    sub: "Share of shelf across all active SKUs",
                    change: overallChange.text,
                    changeColor: overallChange.color,
                    prevText: "vs Previous Period",
                    extra: "",
                    extraChange: "",
                    extraChangeColor: "green",
                    months: weeklyTrends.overall.dates,
                    sparklineData: weeklyTrends.overall.values
                },
                {
                    title: "Sponsored SOS",
                    value: `${currentSOS.sponsored.toFixed(1)}%`,
                    sub: "Share of shelf for sponsored placements",
                    change: sponsoredChange.text,
                    changeColor: sponsoredChange.color,
                    prevText: "vs Previous Period",
                    extra: "",
                    extraChange: "",
                    extraChangeColor: "red",
                    months: weeklyTrends.sponsored.dates,
                    sparklineData: weeklyTrends.sponsored.values
                },
                {
                    title: "Organic SOS",
                    value: `${currentSOS.organic.toFixed(1)}%`,
                    sub: "Natural shelf share without sponsorship",
                    change: organicChange.text,
                    changeColor: organicChange.color,
                    prevText: "vs Previous Period",
                    extra: "",
                    extraChange: "",
                    extraChangeColor: "green",
                    months: weeklyTrends.organic.dates,
                    sparklineData: weeklyTrends.organic.values
                }
            ]
        };
    } catch (error) {
        console.error('[VisibilityService] Error getting visibility overview:', error);
        // Return mock data as fallback
        return getVisibilityOverviewMockData();
    }
}

// Mock data fallback for Visibility Overview cards
const getVisibilityOverviewMockData = () => ({
    cards: [
        {
            title: "Overall SOS",
            value: "19.6%",
            sub: "Share of shelf across all active SKUs",
            change: "▲4.3 pts (from 15.3%)",
            changeColor: "green",
            prevText: "vs Previous Period",
            extra: "New launches contributing: 7 SKUs",
            extraChange: "▲12.5%",
            extraChangeColor: "green",
        },
        {
            title: "Sponsored SOS",
            value: "17.6%",
            sub: "Share of shelf for sponsored placements",
            change: "▼8.6 pts (from 26.2%)",
            changeColor: "red",
            prevText: "vs Previous Period",
            extra: "High-risk stores: 18",
            extraChange: "+5 stores",
            extraChangeColor: "red",
        },
        {
            title: "Organic SOS",
            value: "20.7%",
            sub: "Natural shelf share without sponsorship",
            change: "▲19.5% (from 17.3%)",
            changeColor: "green",
            prevText: "vs Previous Period",
            extra: "Benchmark range: 18–22%",
            extraChange: "Slightly above benchmark",
            extraChangeColor: "orange",
        },
    ]
});

// Mock data for Platform KPI Matrix (matching current frontend static data)
const getPlatformKpiMatrixMockData = () => ({
    platformData: {
        columns: ["kpi", "Blinkit", "Zepto", "Instamart"],
        rows: [
            { kpi: "Overall SOS", Blinkit: 19.6, Zepto: 18.2, Instamart: 21.1, trend: { Blinkit: 0.5, Zepto: -0.3, Instamart: 1.2 }, series: { Blinkit: [18.2, 18.8, 19.1, 19.6], Zepto: [18.5, 18.3, 18.4, 18.2], Instamart: [19.8, 20.2, 20.6, 21.1] } },
            { kpi: "Sponsored SOS", Blinkit: 17.6, Zepto: 16.8, Instamart: 18.9, trend: { Blinkit: -0.2, Zepto: 0.4, Instamart: 0.8 }, series: { Blinkit: [17.8, 17.7, 17.6, 17.6], Zepto: [16.4, 16.5, 16.7, 16.8], Instamart: [18.1, 18.4, 18.6, 18.9] } },
            { kpi: "Organic SOS", Blinkit: 20.7, Zepto: 19.5, Instamart: 22.3, trend: { Blinkit: 1.2, Zepto: 0.8, Instamart: 1.5 }, series: { Blinkit: [19.5, 20.0, 20.4, 20.7], Zepto: [18.7, 19.0, 19.2, 19.5], Instamart: [20.8, 21.4, 21.9, 22.3] } }
        ]
    },
    formatData: {
        columns: ["kpi", "Quick Commerce", "E-Commerce", "Hyperlocal"],
        rows: [
            { kpi: "Overall SOS", "Quick Commerce": 20.2, "E-Commerce": 18.5, "Hyperlocal": 19.1, trend: { "Quick Commerce": 0.6, "E-Commerce": -0.2, "Hyperlocal": 0.4 }, series: { "Quick Commerce": [19.6, 19.8, 20.0, 20.2], "E-Commerce": [18.7, 18.6, 18.5, 18.5], "Hyperlocal": [18.7, 18.9, 19.0, 19.1] } },
            { kpi: "Sponsored SOS", "Quick Commerce": 18.1, "E-Commerce": 16.5, "Hyperlocal": 17.2, trend: { "Quick Commerce": 0.3, "E-Commerce": -0.4, "Hyperlocal": 0.1 }, series: { "Quick Commerce": [17.8, 17.9, 18.0, 18.1], "E-Commerce": [16.9, 16.7, 16.6, 16.5], "Hyperlocal": [17.1, 17.1, 17.2, 17.2] } },
            { kpi: "Organic SOS", "Quick Commerce": 21.4, "E-Commerce": 19.8, "Hyperlocal": 20.5, trend: { "Quick Commerce": 1.0, "E-Commerce": 0.5, "Hyperlocal": 0.7 }, series: { "Quick Commerce": [20.4, 20.8, 21.1, 21.4], "E-Commerce": [19.3, 19.5, 19.6, 19.8], "Hyperlocal": [19.8, 20.1, 20.3, 20.5] } }
        ]
    },
    cityData: {
        columns: ["kpi", "Delhi NCR", "Mumbai", "Bangalore", "Hyderabad", "Chennai"],
        rows: [
            { kpi: "Overall SOS", "Delhi NCR": 21.2, "Mumbai": 19.8, "Bangalore": 20.5, "Hyderabad": 18.9, "Chennai": 18.1, trend: { "Delhi NCR": 0.8, "Mumbai": 0.4, "Bangalore": 0.6, "Hyderabad": 0.2, "Chennai": -0.1 }, series: { "Delhi NCR": [20.4, 20.7, 21.0, 21.2], "Mumbai": [19.4, 19.6, 19.7, 19.8], "Bangalore": [19.9, 20.1, 20.3, 20.5], "Hyderabad": [18.7, 18.8, 18.9, 18.9], "Chennai": [18.2, 18.2, 18.1, 18.1] } },
            { kpi: "Sponsored SOS", "Delhi NCR": 18.5, "Mumbai": 17.2, "Bangalore": 17.9, "Hyderabad": 16.5, "Chennai": 15.8, trend: { "Delhi NCR": 0.5, "Mumbai": 0.2, "Bangalore": 0.4, "Hyderabad": -0.1, "Chennai": -0.3 }, series: { "Delhi NCR": [18.0, 18.2, 18.4, 18.5], "Mumbai": [17.0, 17.1, 17.1, 17.2], "Bangalore": [17.5, 17.7, 17.8, 17.9], "Hyderabad": [16.6, 16.5, 16.5, 16.5], "Chennai": [16.1, 16.0, 15.9, 15.8] } },
            { kpi: "Organic SOS", "Delhi NCR": 22.6, "Mumbai": 21.2, "Bangalore": 21.9, "Hyderabad": 20.1, "Chennai": 19.5, trend: { "Delhi NCR": 1.1, "Mumbai": 0.8, "Bangalore": 0.9, "Hyderabad": 0.5, "Chennai": 0.3 }, series: { "Delhi NCR": [21.5, 21.9, 22.3, 22.6], "Mumbai": [20.4, 20.7, 20.9, 21.2], "Bangalore": [21.0, 21.3, 21.6, 21.9], "Hyderabad": [19.6, 19.8, 20.0, 20.1], "Chennai": [19.2, 19.3, 19.4, 19.5] } }
        ]
    }
});

// Mock data for Keywords at a Glance (matching current frontend static data)
const getKeywordsAtGlanceMockData = () => ({
    hierarchy: [
        {
            id: 'generic',
            label: 'Generic',
            level: 'keyword-type',
            metrics: { catImpShare: 65.6, adSos: 0.6, orgSos: 1.0, overallSos: 0.8 },
            platforms: {
                Blinkit: { overallSos: 0.8, adSos: 0.6, orgSos: 1.0, catImpShare: 65.6 },
                Zepto: { overallSos: 0.7, adSos: 0.5, orgSos: 0.9, catImpShare: 64.2 },
                Instamart: { overallSos: 0.9, adSos: 0.7, orgSos: 1.1, catImpShare: 66.3 },
            },
            children: [
                {
                    id: 'generic-brand-kwality',
                    label: 'Kwality Walls',
                    level: 'brand',
                    metrics: { catImpShare: 65.6, adSos: 0.6, orgSos: 1.0, overallSos: 0.8 },
                    platforms: {
                        Blinkit: { overallSos: 0.8, adSos: 0.6, orgSos: 1.0, catImpShare: 65.6 },
                    },
                    children: [
                        {
                            id: 'generic-ice-cream-delivery',
                            label: 'ice cream delivery',
                            level: 'keyword',
                            metrics: { catImpShare: 6.2, adSos: 0.1, orgSos: 0.2, overallSos: 0.3 },
                            platforms: {
                                Blinkit: { overallSos: 0.3, adSos: 0.1, orgSos: 0.2, catImpShare: 6.2 },
                                Zepto: { overallSos: 0.2, adSos: 0.1, orgSos: 0.2, catImpShare: 5.8 },
                            },
                            children: [
                                {
                                    id: 'generic-delivery-cornetto',
                                    label: 'Cornetto Double Chocolate',
                                    level: 'sku',
                                    metrics: { catImpShare: 0.3, adSos: 0.2, orgSos: 0.1, overallSos: 0.2, adPos: 4, orgPos: 12 },
                                    platforms: {
                                        Blinkit: { catImpShare: 0.3, adSos: 0.2, orgSos: 0.1, overallSos: 0.2, adPos: 3, orgPos: 11 },
                                        Zepto: { catImpShare: 0.3, adSos: 0.2, orgSos: 0.1, overallSos: 0.2, adPos: 5, orgPos: 13 },
                                    },
                                    children: [
                                        {
                                            id: 'generic-delivery-cornetto-delhi',
                                            label: 'Delhi NCR',
                                            level: 'city',
                                            metrics: { catImpShare: 0.1, adSos: 0.2, orgSos: 0.1, overallSos: 0.3, adPos: 3, orgPos: 10 },
                                            platforms: {
                                                Blinkit: { catImpShare: 0.1, adSos: 0.2, orgSos: 0.1, overallSos: 0.3, adPos: 2, orgPos: 9 },
                                            }
                                        },
                                        {
                                            id: 'generic-delivery-cornetto-mumbai',
                                            label: 'Mumbai',
                                            level: 'city',
                                            metrics: { catImpShare: 0.1, adSos: 0.2, orgSos: 0.1, overallSos: 0.3, adPos: 3, orgPos: 10 },
                                            platforms: {
                                                Blinkit: { catImpShare: 0.1, adSos: 0.2, orgSos: 0.1, overallSos: 0.3, adPos: 2, orgPos: 9 },
                                            }
                                        }
                                    ],
                                },
                            ],
                        },
                        {
                            id: 'generic-cone-ice-cream',
                            label: 'cone ice cream',
                            level: 'keyword',
                            metrics: { catImpShare: 5.1, adSos: 0.1, orgSos: 0.2, overallSos: 0.3 },
                            platforms: {
                                Blinkit: { overallSos: 0.3, adSos: 0.1, orgSos: 0.2, catImpShare: 5.1 },
                                Zepto: { overallSos: 0.2, adSos: 0.1, orgSos: 0.2, catImpShare: 4.8 },
                            },
                            children: [
                                {
                                    id: 'generic-cone-cornetto',
                                    label: 'Cornetto Disc',
                                    level: 'sku',
                                    metrics: { catImpShare: 2.1, adSos: 0.1, orgSos: 0.1, overallSos: 0.2, adPos: 5, orgPos: 11 },
                                    platforms: {
                                        Blinkit: { catImpShare: 2.1, adSos: 0.1, orgSos: 0.1, overallSos: 0.2, adPos: 4, orgPos: 10 },
                                        Zepto: { catImpShare: 2.1, adSos: 0.1, orgSos: 0.1, overallSos: 0.2, adPos: 6, orgPos: 12 },
                                    },
                                    children: [
                                        {
                                            id: 'generic-cone-cornetto-delhi',
                                            label: 'Delhi NCR',
                                            level: 'city',
                                            metrics: { catImpShare: 1.0, adSos: 0.1, orgSos: 0.1, overallSos: 0.2, adPos: 4, orgPos: 10 },
                                            platforms: {
                                                Blinkit: { catImpShare: 1.0, adSos: 0.1, orgSos: 0.1, overallSos: 0.2, adPos: 3, orgPos: 9 },
                                            }
                                        }
                                    ]
                                }
                            ],
                        }
                    ]
                }
            ],
        },
        {
            id: 'brand',
            label: 'Brand',
            level: 'keyword-type',
            metrics: { catImpShare: 0.5, adSos: 88.4, orgSos: 83.0, overallSos: 85.1 },
            platforms: {
                Blinkit: { catImpShare: 0.5, adSos: 88.4, orgSos: 83.0, overallSos: 85.1 },
            },
            children: [
                {
                    id: 'brand-kwality-walls',
                    label: 'kwality walls ice cream',
                    level: 'brand',
                    metrics: { catImpShare: 14.2, adSos: 41.2, orgSos: 36.7, overallSos: 38.4 },
                    platforms: {
                        Blinkit: { overallSos: 38.4, adSos: 41.2, orgSos: 36.7, catImpShare: 14.2 },
                    },
                    children: [
                        {
                            id: 'brand-kwality-keyword-1',
                            label: 'ice cream',
                            level: 'keyword',
                            metrics: { catImpShare: 14.2, adSos: 41.2, orgSos: 36.7, overallSos: 38.4 },
                            platforms: {
                                Blinkit: { overallSos: 38.4, adSos: 41.2, orgSos: 36.7, catImpShare: 14.2 },
                            },
                            children: [
                                {
                                    id: 'brand-kwality-magnum',
                                    label: 'Magnum Almond',
                                    level: 'sku',
                                    metrics: { catImpShare: 0.2, adSos: 0.4, orgSos: 0.2, overallSos: 0.6, adPos: 2, orgPos: 8 },
                                    platforms: {
                                        Blinkit: { catImpShare: 0.2, adSos: 0.4, orgSos: 0.2, overallSos: 0.6, adPos: 1, orgPos: 7 },
                                    },
                                    children: [],
                                },
                            ],
                        }
                    ],
                },
            ],
        },
        {
            id: 'competition',
            label: 'Competition',
            level: 'keyword-type',
            metrics: { catImpShare: 33.9, adSos: 0.8, orgSos: 0.2, overallSos: 0.4 },
            platforms: {
                Blinkit: { catImpShare: 33.9, adSos: 0.8, orgSos: 0.2, overallSos: 0.4 },
            },
            children: [
                {
                    id: 'competition-amul',
                    label: 'Amul',
                    level: 'brand',
                    metrics: { catImpShare: 33.9, adSos: 0.8, orgSos: 0.2, overallSos: 0.4 },
                    platforms: {
                        Blinkit: { catImpShare: 33.9, adSos: 0.8, orgSos: 0.2, overallSos: 0.4 },
                    },
                    children: [
                        {
                            id: 'competition-amul-cone',
                            label: 'Amul Cone',
                            level: 'keyword',
                            metrics: { catImpShare: 0.3, adSos: 0.1, orgSos: 0.1, overallSos: 0.2, adPos: 9, orgPos: 18 },
                            platforms: {
                                Blinkit: { catImpShare: 0.3, adSos: 0.1, orgSos: 0.1, overallSos: 0.2, adPos: 8, orgPos: 17 },
                            },
                            children: [],
                        }
                    ]
                },
            ],
        },
    ]
});

// Mock data for Top Search Terms (matching current frontend static data)
const getTopSearchTermsMockData = (filter) => {
    const allTerms = [
        {
            keyword: "ice cream",
            topBrand: "KWALITY WALLS",
            searchVolume: 12500,
            overallSos: 65,
            overallDelta: -3.1,
            organicSos: 45,
            organicDelta: -4.5,
            paidSos: 20,
            paidDelta: 0.0,
            type: "Generic"
        },
        {
            keyword: "cornetto",
            topBrand: "KWALITY WALLS",
            searchVolume: 8200,
            overallSos: 88,
            overallDelta: 0.9,
            organicSos: 55,
            organicDelta: 2.4,
            paidSos: 33,
            paidDelta: -0.9,
            type: "Branded"
        },
        {
            keyword: "chocolate ice cream",
            topBrand: "KWALITY WALLS",
            searchVolume: 5600,
            overallSos: 42,
            overallDelta: -0.5,
            organicSos: 30,
            organicDelta: -0.8,
            paidSos: 12,
            paidDelta: 0.0,
            type: "Generic"
        },
        {
            keyword: "vanilla tub",
            topBrand: "AMUL",
            searchVolume: 4100,
            overallSos: 15,
            overallDelta: -1.4,
            organicSos: 10,
            organicDelta: -2.0,
            paidSos: 5,
            paidDelta: 0.0,
            type: "Competition"
        },
        {
            keyword: "strawberry cone",
            topBrand: "KWALITY WALLS",
            searchVolume: 3500,
            overallSos: 72,
            overallDelta: -1.0,
            organicSos: 40,
            organicDelta: -1.5,
            paidSos: 32,
            paidDelta: 0.0,
            type: "Branded"
        },
        {
            keyword: "family pack ice cream",
            topBrand: "KWALITY WALLS",
            searchVolume: 3200,
            overallSos: 55,
            overallDelta: -1.0,
            organicSos: 35,
            organicDelta: -0.2,
            paidSos: 20,
            paidDelta: -0.2,
            type: "Generic"
        },
        {
            keyword: "magnum",
            topBrand: "KWALITY WALLS",
            searchVolume: 2900,
            overallSos: 92,
            overallDelta: -2.7,
            organicSos: 60,
            organicDelta: -4.0,
            paidSos: 32,
            paidDelta: 0.0,
            type: "Branded"
        },
        {
            keyword: "cup ice cream",
            topBrand: "MOTHER DAIRY",
            searchVolume: 2400,
            overallSos: 25,
            overallDelta: 2.5,
            organicSos: 15,
            organicDelta: 3.7,
            paidSos: 10,
            paidDelta: -1.0,
            type: "Competition"
        },
        {
            keyword: "chocobar",
            topBrand: "KWALITY WALLS",
            searchVolume: 2100,
            overallSos: 60,
            overallDelta: -4.4,
            organicSos: 45,
            organicDelta: -2.8,
            paidSos: 15,
            paidDelta: -3.6,
            type: "Generic"
        },
        {
            keyword: "mango duets",
            topBrand: "KWALITY WALLS",
            searchVolume: 1800,
            overallSos: 48,
            overallDelta: -0.8,
            organicSos: 30,
            organicDelta: -1.0,
            paidSos: 18,
            paidDelta: 0.0,
            type: "Branded"
        },
        {
            keyword: "butterscotch tub",
            topBrand: "AMUL",
            searchVolume: 1600,
            overallSos: 12,
            overallDelta: -0.1,
            organicSos: 8,
            organicDelta: 0.0,
            paidSos: 4,
            paidDelta: 0.0,
            type: "Competitor"
        },
        {
            keyword: "kulfi",
            topBrand: "KWALITY WALLS",
            searchVolume: 1500,
            overallSos: 35,
            overallDelta: -0.6,
            organicSos: 25,
            organicDelta: -1.1,
            paidSos: 10,
            paidDelta: 0.0,
            type: "Generic"
        },
    ];

    // Filter based on type
    let filteredTerms = allTerms;
    if (filter && filter !== 'All') {
        filteredTerms = allTerms.filter(term => term.type === filter);
    }

    return { terms: filteredTerms };
};

/**
 * Visibility Service class with all visibility-related methods
 */
class VisibilityService {
    /**
     * Get Visibility Overview cards data
     */
    async getVisibilityOverview(filters) {
        console.log('[VisibilityService] getVisibilityOverview called with filters:', filters);
        const cacheKey = generateCacheKey('visibility_overview', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            // Use dynamic data from database
            return await getVisibilityOverviewData(filters);
        }, CACHE_TTL.ONE_HOUR);
    }

    /**
     * Get Platform KPI Matrix data with Platform/Format/City breakdown
     * Fetches real data from rb_kw_olap table
     */
    async getPlatformKpiMatrix(filters) {
        console.log('[VisibilityService] getPlatformKpiMatrix called with filters:', filters);
        const cacheKey = generateCacheKey('visibility_platform_matrix', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                // Build WHERE clause based on date filters
                let startDate = filters.startDate;
                let endDate = filters.endDate;

                if (!startDate || !endDate) {
                    // Default to last 30 days
                    endDate = dayjs().format('YYYY-MM-DD');
                    startDate = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
                }

                const replacements = { startDate, endDate };

                // Base WHERE clause for rb_kw_olap
                let baseWhere = `DATE BETWEEN '${startDate}' AND '${endDate}'`;

                // Apply platform filter if provided
                if (filters.platform && filters.platform !== 'All') {
                    const platCond = buildCHCondition(filters.platform, 'platform_name');
                    baseWhere += ` AND ${platCond}`;
                } else {
                    // Always exclude specific platforms from the matrix
                    const excludedList = EXCLUDED_PLATFORMS.map(p => `'${escapeCH(p)}'`).join(',');
                    baseWhere += ` AND platform_name NOT IN (${excludedList})`;
                }

                // Apply location filter if provided
                if (filters.location && filters.location !== 'All') {
                    const locCond = buildCHCondition(filters.location, 'location_name');
                    baseWhere += ` AND ${locCond}`;
                }

                // Apply keyword filter if provided
                if (filters.keyword && filters.keyword !== 'All') {
                    baseWhere += ` AND ${buildCHCondition(filters.keyword, 'keyword')}`;
                }

                if (filters.keywordType && filters.keywordType !== 'All') {
                    baseWhere += ` AND ${buildCHCondition(filters.keywordType, 'keyword_type')}`;
                }

                // Apply format (category) filter if provided
                const categoryValue = filters.category || filters.format;
                if (categoryValue && String(categoryValue).toLowerCase() !== 'all') {
                    const formatCond = buildCHCondition(categoryValue, 'keyword_category', { isCategory: true });
                    baseWhere += ` AND ${formatCond}`;
                }

                // Apply pincode filter if provided
                if (filters.pincode && filters.pincode !== 'All') {
                    const pins = Array.isArray(filters.pincode) ? filters.pincode : [filters.pincode];
                    const filteredPins = pins.filter(p => p && p !== 'all' && p !== 'All');
                    if (filteredPins.length > 0) {
                        const pinList = filteredPins.map(p => `'${escapeCH(p)}'`).join(',');
                        baseWhere += ` AND toString(pincode) IN (${pinList})`;
                    }
                }

                // Handle Zone/MetroFlag filters: fetch cities first to ensure reliable filtering
                if ((filters.zone && filters.zone !== 'All') || (filters.metroFlag && filters.metroFlag !== 'All')) {
                    let cityQueryConditions = [];

                    if (filters.zone && filters.zone !== 'All') {
                        const zones = Array.isArray(filters.zone) ? filters.zone : [filters.zone];
                        const filteredZones = zones.filter(z => z && z !== 'all' && z !== 'All');
                        if (filteredZones.length > 0) {
                            const zoneList = filteredZones.map(z => `'${escapeCH(z)}'`).join(',');
                            cityQueryConditions.push(`region IN (${zoneList})`);
                        }
                    }

                    if (filters.metroFlag && filters.metroFlag !== 'All') {
                        const flags = Array.isArray(filters.metroFlag) ? filters.metroFlag : [filters.metroFlag];
                        const filteredFlags = flags.filter(f => f && f !== 'all' && f !== 'All');
                        if (filteredFlags.length > 0) {
                            const flagList = filteredFlags.map(f => `'${escapeCH(f)}'`).join(',');
                            cityQueryConditions.push(`tier IN (${flagList})`);
                        }
                    }

                    if (cityQueryConditions.length > 0) {
                        const cityQuery = `
                            SELECT DISTINCT location as city 
                            FROM rb_location_darkstore 
                            WHERE ${cityQueryConditions.join(' AND ')}
                              AND location IS NOT NULL AND location != ''
                        `;
                        const cities = await queryClickHouse(cityQuery);
                        const cityList = cities.map(c => `'${escapeCH(c.city)}'`).join(',');

                        if (cityList) {
                            baseWhere += ` AND location_name IN (${cityList})`;
                        } else {
                            baseWhere += ` AND 1=0`;
                        }
                    }
                }

                // Brand Condition for SOS calculation
                const brandSOSCondition = buildCHCondition(filters.brand, 'brand', { isBrand: true });

                // Date ranges for trend calculation (Current vs Previous)
                const start = dayjs(startDate);
                const end = dayjs(endDate);
                const durationDays = end.diff(start, 'day') + 1;
                const prevStart = start.subtract(durationDays, 'day').format('YYYY-MM-DD');
                const prevEnd = start.subtract(1, 'day').format('YYYY-MM-DD');

                // Base WHERE for previous period
                let prevBaseWhere = `DATE BETWEEN '${prevStart}' AND '${prevEnd}'`;
                if (filters.platform && filters.platform !== 'All') {
                    prevBaseWhere += ` AND ${buildCHCondition(filters.platform, 'platform_name')}`;
                }
                if (filters.location && filters.location !== 'All') {
                    prevBaseWhere += ` AND ${buildCHCondition(filters.location, 'location_name')}`;
                }
                if (filters.pincode && filters.pincode !== 'All') {
                    const pins = Array.isArray(filters.pincode) ? filters.pincode : [filters.pincode];
                    const filteredPins = pins.filter(p => p && p !== 'all' && p !== 'All');
                    if (filteredPins.length > 0) {
                        const pinList = filteredPins.map(p => `'${escapeCH(p)}'`).join(',');
                        prevBaseWhere += ` AND toString(pincode) IN (${pinList})`;
                    }
                }
                // Re-apply city list filter to previous where if needed
                if (baseWhere.includes('location_name IN')) {
                    const cityListMatch = baseWhere.match(/location_name IN \(([^)]+)\)/);
                    if (cityListMatch) {
                        prevBaseWhere += ` AND location_name IN (${cityListMatch[1]})`;
                    }
                }

                // Query builder helper for current/prev/sparkline
                const getMatrixQueries = (dimColumn, dimAlias, filtersToExclude = []) => {
                    // Build filtered where clauses for this specific matrix
                    let currentWhere = `DATE BETWEEN '${startDate}' AND '${endDate}' AND POSITION < 11`;
                    let prevWhere = `DATE BETWEEN '${prevStart}' AND '${prevEnd}' AND POSITION < 11`;

                    // Helper to add condition if not excluded
                    const addCond = (val, col, exclusionKeys) => {
                        if (val && val !== 'All' && !exclusionKeys.includes(col)) {
                            const isCat = col === 'keyword_category';
                            const cond = buildCHCondition(val, col, { isCategory: isCat });
                            currentWhere += ` AND ${cond}`;
                            prevWhere += ` AND ${cond}`;
                        }
                    };

                    addCond(filters.platform, 'platform_name', filtersToExclude);
                    addCond(filters.location, 'location_name', filtersToExclude);
                    // Add keyword/category/format - all map to keyword_category for Visibility page
                    addCond(filters.keyword, 'keyword', filtersToExclude);
                    addCond(filters.keywordType, 'keyword_type', filtersToExclude);
                    addCond(filters.format || filters.category, 'keyword_category', filtersToExclude);

                    // Pincode (use toString to match ClickHouse type if necessary)
                    if (filters.pincode && filters.pincode !== 'All') {
                        const pins = Array.isArray(filters.pincode) ? filters.pincode : [filters.pincode];
                        const filteredPins = pins.filter(p => p && p !== 'all' && p !== 'All');
                        if (filteredPins.length > 0) {
                            const pinList = filteredPins.map(p => `'${escapeCH(p)}'`).join(',');
                            const pinCond = `toString(pincode) IN (${pinList})`;
                            currentWhere += ` AND ${pinCond}`;
                            prevWhere += ` AND ${pinCond}`;
                        }
                    }

                    // Re-apply city list filter if zones/metroFlags were used
                    if (baseWhere.includes('location_name IN (')) {
                        const cityListMatch = baseWhere.match(/location_name IN \(([^)]+)\)/);
                        if (cityListMatch && !filtersToExclude.includes('location_name')) {
                            currentWhere += ` AND location_name IN (${cityListMatch[1]})`;
                            prevWhere += ` AND location_name IN (${cityListMatch[1]})`;
                        }
                    }

                    const current = `
                        SELECT 
                            ${dimColumn} as ${dimAlias},
                            ROUND(sumIf(toInt32(overall), ${brandSOSCondition}) * 100.0 / nullIf(sum(toInt32(overall)), 0), 2) AS overall_sos,
                            ROUND(sumIf(toInt32(spons), ${brandSOSCondition}) * 100.0 / nullIf(sum(toInt32(spons)), 0), 2) AS sponsored_sos,
                            ROUND(sumIf(toInt32(organic), ${brandSOSCondition}) * 100.0 / nullIf(sum(toInt32(organic)), 0), 2) AS organic_sos,
                            ROUND(sumIf(toInt32(spons), ${brandSOSCondition}) * 100.0 / nullIf(sum(toInt32(spons)), 0), 2) AS display_sos
                        FROM rb_kw_olap
                        WHERE ${currentWhere} AND ${dimColumn} IS NOT NULL AND ${dimColumn} != ''
                        GROUP BY ${dimColumn}
                        ORDER BY count() DESC
                        LIMIT 15
                    `;

                    const previous = `
                        SELECT 
                            ${dimColumn} as ${dimAlias},
                            ROUND(sumIf(toInt32(overall), ${brandSOSCondition}) * 100.0 / nullIf(sum(toInt32(overall)), 0), 2) AS overall_sos,
                            ROUND(sumIf(toInt32(spons), ${brandSOSCondition}) * 100.0 / nullIf(sum(toInt32(spons)), 0), 2) AS sponsored_sos,
                            ROUND(sumIf(toInt32(organic), ${brandSOSCondition}) * 100.0 / nullIf(sum(toInt32(organic)), 0), 2) AS organic_sos,
                            ROUND(sumIf(toInt32(spons), ${brandSOSCondition}) * 100.0 / nullIf(sum(toInt32(spons)), 0), 2) AS display_sos
                        FROM rb_kw_olap
                        WHERE ${prevWhere} AND ${dimColumn} IS NOT NULL AND ${dimColumn} != ''
                        GROUP BY ${dimColumn}
                    `;

                    const sparkline = `
                        SELECT 
                            ${dimColumn} as ${dimAlias},
                            DATE as date,
                            ROUND(sumIf(toInt32(overall), ${brandSOSCondition}) * 100.0 / nullIf(sum(toInt32(overall)), 0), 2) AS overall_sos,
                            ROUND(sumIf(toInt32(spons), ${brandSOSCondition}) * 100.0 / nullIf(sum(toInt32(spons)), 0), 2) AS sponsored_sos,
                            ROUND(sumIf(toInt32(organic), ${brandSOSCondition}) * 100.0 / nullIf(sum(toInt32(organic)), 0), 2) AS organic_sos,
                            ROUND(sumIf(toInt32(spons), ${brandSOSCondition}) * 100.0 / nullIf(sum(toInt32(spons)), 0), 2) AS display_sos
                        FROM rb_kw_olap
                        WHERE ${currentWhere} AND ${dimColumn} IS NOT NULL AND ${dimColumn} != ''
                        GROUP BY ${dimColumn}, date
                        ORDER BY date ASC
                    `;

                    return { current, previous, sparkline };
                };

                const platQueries = getMatrixQueries('platform_name', 'name', ['platform_name']);
                const formatQueries = getMatrixQueries('keyword_category', 'name', ['keyword_category']);
                const cityQueries = getMatrixQueries('location_name', 'name', ['location_name']);

                // Execute all queries in parallel
                const [
                    platRes, platPrev, platSpark,
                    formRes, formPrev, formSpark,
                    cityRes, cityPrev, citySpark
                ] = await Promise.all([
                    queryClickHouse(platQueries.current), queryClickHouse(platQueries.previous), queryClickHouse(platQueries.sparkline),
                    queryClickHouse(formatQueries.current), queryClickHouse(formatQueries.previous), queryClickHouse(formatQueries.sparkline),
                    queryClickHouse(cityQueries.current), queryClickHouse(cityQueries.previous), queryClickHouse(cityQueries.sparkline)
                ]);

                // Helper to process results into the final matrix format
                const processResults = (current, previous, sparklines) => {
                    const kpis = ['Overall SOS', 'Sponsored SOS', 'Organic SOS'];
                    const columns = ['kpi', ...current.map(r => r.name)];

                    const prevMap = {};
                    previous.forEach(p => { prevMap[p.name] = p; });

                    const sparkMap = {};
                    sparklines.forEach(s => {
                        if (!sparkMap[s.name]) {
                            sparkMap[s.name] = { overall: [], sponsored: [], organic: [] };
                        }
                        sparkMap[s.name].overall.push(Number(s.overall_sos) || 0);
                        sparkMap[s.name].sponsored.push(Number(s.sponsored_sos) || 0);
                        sparkMap[s.name].organic.push(Number(s.organic_sos) || 0);
                    });

                    const rows = kpis.map(kpi => {
                        const row = { kpi };
                        const trend = {};
                        const series = {};

                        current.forEach(curr => {
                            const name = curr.name;
                            let val = 0;
                            let prevVal = 0;
                            let sparkKey = 'overall';

                            if (kpi === 'Overall SOS') {
                                val = Number(curr.overall_sos) || 0;
                                prevVal = Number(prevMap[name]?.overall_sos) || 0;
                                sparkKey = 'overall';
                            } else if (kpi === 'Sponsored SOS') {
                                val = Number(curr.sponsored_sos) || 0;
                                prevVal = Number(prevMap[name]?.sponsored_sos) || 0;
                                sparkKey = 'sponsored';
                            } else if (kpi === 'Organic SOS') {
                                val = Number(curr.organic_sos) || 0;
                                prevVal = Number(prevMap[name]?.organic_sos) || 0;
                                sparkKey = 'organic';
                            }

                            row[name] = val;
                            trend[name] = Number((val - prevVal).toFixed(1));
                            series[name] = sparkMap[name]?.[sparkKey] || [val];
                        });

                        row.trend = trend;
                        row.series = series;
                        return row;
                    });

                    return { columns, rows };
                };

                return {
                    platformData: processResults(platRes, platPrev, platSpark),
                    formatData: processResults(formRes, formPrev, formSpark),
                    cityData: processResults(cityRes, cityPrev, citySpark)
                };

            } catch (error) {
                console.error('[VisibilityService] Error in getPlatformKpiMatrix:', error);
                // Fallback to mock data on error
                return getPlatformKpiMatrixMockData();
            }
        }, CACHE_TTL.ONE_HOUR);
    }


    /**
     * Get Keywords at a Glance hierarchical data
     * Fetches real data from rb_kw_olap table with hierarchy:
     * Keyword Type → Keyword → Brand → SKU → City
     */
    async getKeywordsAtGlance(filters) {
        console.log('[VisibilityService] getKeywordsAtGlance called with filters:', filters);
        const cacheKey = generateCacheKey('visibility_keywords_at_glance', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                // Build WHERE clause based on filters
                let whereConditions = ["1=1"]; // Start with a safe default
                const replacements = {};

                if (filters.platform && filters.platform !== 'All') {
                    const platCond = buildCHCondition(filters.platform, 'platform_name');
                    whereConditions.push(platCond);
                }
                if (filters.keyword && filters.keyword !== 'All') {
                    whereConditions.push(buildCHCondition(filters.keyword, 'keyword'));
                }
                if (filters.keywordType && filters.keywordType !== 'All') {
                    whereConditions.push(buildCHCondition(filters.keywordType, 'keyword_type'));
                }
                if (filters.location && filters.location !== 'All') {
                    const locCond = buildCHCondition(filters.location, 'location_name');
                    whereConditions.push(locCond);
                }
                const categoryValue = filters.category || filters.format;
                if (categoryValue && String(categoryValue).toLowerCase() !== 'all') {
                    const catCond = buildCHCondition(categoryValue, 'keyword_category', { isCategory: true });
                    whereConditions.push(catCond);
                }
                if (filters.sku && filters.sku !== 'All') {
                    whereConditions.push(`keyword_search_product IN (${(Array.isArray(filters.sku) ? filters.sku : [filters.sku]).map(s => `'${escapeCH(s)}'`).join(',')})`);
                }
                if (filters.city && filters.city !== 'All') {
                    whereConditions.push(`location_name IN (${(Array.isArray(filters.city) ? filters.city : [filters.city]).map(c => `'${escapeCH(c)}'`).join(',')})`);
                }
                if (filters.startDate && filters.endDate) {
                    whereConditions.push(`DATE BETWEEN '${filters.startDate}' AND '${filters.endDate}'`);
                } else {
                    // Default to latest date using subquery for precision
                    whereConditions.push("DATE = (SELECT MAX(DATE) FROM rb_kw_olap)");
                }
                const baseWhereClause = `WHERE ${whereConditions.join(' AND ')}`;

                const sosBrandCondition = buildCHCondition(filters.brand, 'brand', { isBrand: true });

                // If a specific brand is selected, we filter the TOP keywords BY that brand(s)
                if (filters.brand && filters.brand !== 'All') {
                    whereConditions.push(sosBrandCondition);
                }

                const searchWhereClause = `WHERE ${whereConditions.join(' AND ')}`;

                // Stage 1: Fast fetch of top keywords per type - ClickHouse
                const topKeywordsQuery = `
                    SELECT * FROM (
                        SELECT 
                            keyword, 
                            keyword_type,
                            sumIf(toInt32(overall), ${sosBrandCondition}) as rb_results,
                            dense_rank() OVER(PARTITION BY keyword_type ORDER BY count(*) DESC) as rnk
                        FROM rb_kw_olap
                        ${baseWhereClause}
                        GROUP BY keyword, keyword_type
                    ) t
                    WHERE rnk <= 15
                    ${filters.brand && filters.brand !== 'All' ? `AND rb_results > 0` : ''}
                `;

                console.log('[VisibilityService] Fetching top keywords (ClickHouse)...');
                const selectedKeywords = await queryClickHouse(topKeywordsQuery);

                console.log(`[VisibilityService] Found ${selectedKeywords.length} top keywords`);
                if (selectedKeywords.length === 0) {
                    return { hierarchy: [] };
                }

                // Group keywords by type for a multi-IN condition
                const keywordList = selectedKeywords.map(sk => `'${sk.keyword.replace(/'/g, "''")}'`).join(',');
                const typeList = [...new Set(selectedKeywords.map(sk => `'${sk.keyword_type.replace(/'/g, "''")}'`))].join(',');
                const keywordCondition = `AND keyword IN (${keywordList}) AND keyword_type IN (${typeList})`;

                // Stage 2: Detailed hierarchy for selected keywords - ClickHouse
                const query = `
                    SELECT 
                        keyword_type, 
                        keyword, 
                        brand as brand_name, 
                        keyword_search_product as sku, 
                        location_name as city, 
                        platform_name,
                        SUM(agg_overall) OVER(PARTITION BY keyword) as market_overall,
                        SUM(agg_spons) OVER(PARTITION BY keyword) as market_spons,
                        SUM(agg_organic) OVER(PARTITION BY keyword) as market_organic,
                        rbr,
                        rbs,
                        rbo,
                        aap,
                        aop
                    FROM (
                        SELECT 
                            keyword_type, 
                            keyword, 
                            brand, 
                            keyword_search_product, 
                            location_name, 
                            platform_name,
                            SUM(toInt32(overall)) as agg_overall,
                            SUM(toInt32(spons)) as agg_spons,
                            SUM(toInt32(organic)) as agg_organic,
                            sumIf(toInt32(overall), ${sosBrandCondition}) as rbr,
                            sumIf(toInt32(spons), ${sosBrandCondition}) as rbs,
                            sumIf(toInt32(organic), ${sosBrandCondition}) as rbo,
                            avgIf(POSITION, toInt32(spons) = 1 AND ${sosBrandCondition}) as aap,
                            avgIf(POSITION, toInt32(organic) = 1 AND ${sosBrandCondition}) as aop
                        FROM rb_kw_olap
                        ${baseWhereClause}
                        ${keywordCondition}
                        GROUP BY keyword_type, keyword, brand, keyword_search_product, location_name, platform_name
                    ) AS base_agg
                `;

                console.log('[VisibilityService] Fetching hierarchy details (ClickHouse)...');
                const results = await queryClickHouse(query);

                console.log(`[VisibilityService] Fetched ${results.length} rows for hierarchy`);

                // Build hierarchy in memory
                const typeMap = new Map();

                results.forEach(row => {
                    const {
                        keyword_type: kt,
                        keyword: kw,
                        brand_name: brand,
                        sku,
                        city,
                        total,
                        market_overall,
                        market_spons,
                        market_organic,
                        rbr,
                        rbs,
                        rbo,
                        aap,
                        aop
                    } = row;

                    if (!kt || !kw || !brand || !sku || !city) return;

                    // If a specific brand is selected, we filter the BRAND nodes, 
                    // but we always process the row to ensure ALL brands contribute to Keyword-level metrics
                    const isTargetBrand = filters.brand === 'All' || filters.brand === brand;

                    // Helper to initialize or get level node
                    if (!typeMap.has(kt)) {
                        typeMap.set(kt, {
                            id: kt.toLowerCase().replace(/\s+/g, '-'),
                            label: kt, level: 'keyword-type',
                            children: new Map(),
                            metrics: { rb: 0, total: 0, rbs: 0, rbo: 0, aap: [], aop: [] }
                        });
                    }
                    const ktNode = typeMap.get(kt);

                    if (!ktNode.children.has(kw)) {
                        ktNode.children.set(kw, {
                            id: `${kt}-${kw}`.toLowerCase().replace(/\s+/g, '-'),
                            label: kw, level: 'keyword',
                            children: new Map(),
                            metrics: { rb: 0, rbs: 0, rbo: 0, market_overall: Number(market_overall || 0), market_spons: Number(market_spons || 0), market_organic: Number(market_organic || 0), aap: [], aop: [] }
                        });
                    }
                    const kwNode = ktNode.children.get(kw);

                    // Update metrics for Type and Keyword levels (must include ALL brands for correct Market Total)
                    [ktNode, kwNode].forEach(node => {
                        if (node === ktNode) {
                            node.metrics.market_overall = (node.metrics.market_overall || 0) + Number(market_overall || 0);
                            node.metrics.market_spons = (node.metrics.market_spons || 0) + Number(market_spons || 0);
                            node.metrics.market_organic = (node.metrics.market_organic || 0) + Number(market_organic || 0);
                        }
                        // kwNode.metrics.total is already set correctly from keyword_market_total partition
                        node.metrics.rb += Number(rbr || 0);
                        node.metrics.rbs += Number(rbs || 0);
                        node.metrics.rbo += Number(rbo || 0);
                        if (aap !== null && aap !== undefined && aap > 0) node.metrics.aap.push(Number(aap));
                        if (aop !== null && aop !== undefined && aop > 0) node.metrics.aop.push(Number(aop));
                    });

                    // For lower levels (Brand, SKU, City), we only create nodes and aggregate if it's the target brand
                    if (!isTargetBrand) return;

                    if (!kwNode.children.has(brand)) {
                        kwNode.children.set(brand, {
                            id: `${kt}-${kw}-${brand}`.toLowerCase().replace(/\s+/g, '-'),
                            label: brand, level: 'brand',
                            children: new Map(),
                            metrics: { rb: 0, rbs: 0, rbo: 0, market_overall: Number(market_overall || 0), market_spons: Number(market_spons || 0), market_organic: Number(market_organic || 0), aap: [], aop: [] }
                        });
                    }
                    const brandNode = kwNode.children.get(brand);

                    if (!brandNode.children.has(sku)) {
                        brandNode.children.set(sku, {
                            id: `${kt}-${kw}-${brand}-${sku}`.toLowerCase().replace(/\s+/g, '-'),
                            label: sku, level: 'sku',
                            children: new Map(),
                            metrics: { rb: 0, rbs: 0, rbo: 0, market_overall: Number(market_overall || 0), market_spons: Number(market_spons || 0), market_organic: Number(market_organic || 0), aap: [], aop: [] }
                        });
                    }
                    const brandSkuNode = brandNode.children.get(sku);

                    if (!brandSkuNode.children.has(city)) {
                        brandSkuNode.children.set(city, {
                            id: `${kt}-${kw}-${brand}-${sku}-${city}`.toLowerCase().replace(/\s+/g, '-'),
                            label: city, level: 'city',
                            children: [],
                            metrics: { rb: 0, rbs: 0, rbo: 0, market_overall: Number(market_overall || 0), market_spons: Number(market_spons || 0), market_organic: Number(market_organic || 0), aap: [], aop: [] }
                        });
                    }
                    const brandCityNode = brandSkuNode.children.get(city);

                    [brandNode, brandSkuNode, brandCityNode].forEach(node => {
                        node.metrics.rb += Number(rbr || 0);
                        node.metrics.rbs += Number(rbs || 0);
                        node.metrics.rbo += Number(rbo || 0);
                        if (aap !== null && aap !== undefined && aap > 0) node.metrics.aap.push(Number(aap));
                        if (aop !== null && aop !== undefined && aop > 0) node.metrics.aop.push(Number(aop));
                    });
                });

                // Post-process to calculate final percentages and convert Maps to arrays
                const finalizeNode = (node) => {
                    const mOverall = node.metrics.market_overall || 1;
                    const mSpons = node.metrics.market_spons || 1;
                    const mOrganic = node.metrics.market_organic || 1;

                    const finalMetrics = {
                        catImpShare: Number(((node.metrics.rb / mOverall) * 100).toFixed(2)),
                        overallSos: Number(((node.metrics.rb / mOverall) * 100).toFixed(2)),
                        adSos: Number(((node.metrics.rbs / mSpons) * 100).toFixed(2)),
                        orgSos: Number(((node.metrics.rbo / mOrganic) * 100).toFixed(2)),
                        adPos: node.metrics.aap.length > 0 ? Number((node.metrics.aap.reduce((a, b) => a + b, 0) / node.metrics.aap.length).toFixed(1)) : 0,
                        orgPos: node.metrics.aop.length > 0 ? Number((node.metrics.aop.reduce((a, b) => a + b, 0) / node.metrics.aop.length).toFixed(1)) : 0,
                    };
                    node.metrics = finalMetrics;

                    if (node.children instanceof Map) {
                        node.children = Array.from(node.children.values())
                            .map(finalizeNode)
                            .sort((a, b) => {
                                // Primary: Overall SOS (desc)
                                const sosDiff = b.metrics.overallSos - a.metrics.overallSos;
                                if (Math.abs(sosDiff) > 0.001) return sosDiff;
                                // Secondary: Label (asc)
                                return a.label.localeCompare(b.label);
                            });
                    }
                    return node;
                };

                const hierarchy = Array.from(typeMap.values())
                    .map(finalizeNode)
                    .sort((a, b) => {
                        const sosDiff = b.metrics.overallSos - a.metrics.overallSos;
                        if (Math.abs(sosDiff) > 0.001) return sosDiff;
                        return a.label.localeCompare(b.label);
                    });

                console.log('[VisibilityService] Built hierarchy tree with', hierarchy.length, 'root types');
                return { hierarchy };
            } catch (error) {
                console.error('[VisibilityService] Error fetching keywords at glance:', error);
                return { hierarchy: [] };
            }
        }, CACHE_TTL.ONE_HOUR);
    }

    async getTopSearchTerms(filters = {}) {
        console.log('[VisibilityService] getTopSearchTerms called with filters:', filters);
        console.log(`[VisibilityService] getTopSearchTerms called for platform=${filters.platform}, category=${filters.category}, startDate=${filters.startDate}, endDate=${filters.endDate}`);
        const cacheKey = generateCacheKey('visibility_top_search_terms_v3', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            console.log(`[VisibilityService] [CACHE MISS] Computing top search terms for key: ${cacheKey}`);
            try {
                const platform = filters.platform || 'All';
                const location = filters.location || 'All';
                const brand = filters.brand || 'All';

                const platformCondition = buildCHCondition(platform, 'platform_name');
                const locationCondition = buildCHCondition(location, 'location_name');
                const brandFilterCondition = buildCHCondition(brand, 'brand', { isBrand: true });
                const brandSOSCondition = buildCHCondition(filters.brand || 'All', 'brand', { isBrand: true });

                // 1. Get latest date
                const maxDateRes = await queryClickHouse(`
                    SELECT MAX(DATE) as maxDate
                    FROM rb_kw_olap
                    WHERE DATE IS NOT NULL
                `);
                const maxDate = maxDateRes[0]?.maxDate;

                if (!maxDate || maxDate === '0000-00-00') {
                    return { terms: [] };
                }

                let startDate = filters.startDate ? dayjs(filters.startDate).format('YYYY-MM-DD') : maxDate;
                let endDate = filters.endDate ? dayjs(filters.endDate).format('YYYY-MM-DD') : maxDate;

                const start = dayjs(startDate);
                const end = dayjs(endDate);
                const durationDays = end.diff(start, 'day') + 1;
                const prevStart = start.subtract(durationDays, 'day').format('YYYY-MM-DD');
                const prevEnd = start.subtract(1, 'day').format('YYYY-MM-DD');

                let dateCondition = `DATE BETWEEN '${startDate}' AND '${endDate}'`;
                let prevDateCondition = `DATE BETWEEN '${prevStart}' AND '${prevEnd}'`;

                // Add rank filter for current and previous dates
                dateCondition += ` AND POSITION < 11`;
                prevDateCondition += ` AND POSITION < 11`;

                // 2. Aggregate metrics for keywords
                let typeConds = [];
                const processType = (val) => {
                    if (!val || val === 'All') return null;
                    if (Array.isArray(val)) return val.map(t => t === 'Competitor' ? 'Competition' : t);
                    return val === 'Competitor' ? 'Competition' : val;
                };

                const widgetType = processType(filters.filter);
                const globalType = processType(filters.keywordType);

                if (widgetType) typeConds.push(buildCHCondition(widgetType, 'keyword_type'));
                if (globalType) typeConds.push(buildCHCondition(globalType, 'keyword_type'));

                const typeFilter = typeConds.length > 0 ? `AND ${typeConds.join(' AND ')}` : '';

                console.log(`[VisibilityService] [getTopSearchTerms] Querying with Date Range: ${startDate} to ${endDate} (Prev: ${prevStart} to ${prevEnd})`);

                // Apply keyword filter if provided
                const keywordFilter = (filters.keyword && filters.keyword !== 'All')
                    ? `AND ${buildCHCondition(filters.keyword, 'keyword')}`
                    : '';

                // Apply category filter if provided
                const categoryValue = filters.category || filters.format;
                const categoryFilter = buildCHCondition(categoryValue, 'keyword_category', { isCategory: true });
                const categoryClause = categoryFilter !== '1=1' ? `AND ${categoryFilter}` : '';

                const isSkuMode = filters.viewMode === 'sku';
                let terms = [];

                if (isSkuMode) {
                    // 1. Get Top 50 SKUs based on total volume
                    const topSkusQuery = `
                        SELECT 
                            keyword_search_product as sku, 
                            count() as vol,
                            topKIf(1)(brand, brand != '') as best_brand_arr
                        FROM rb_kw_olap
                        WHERE ${dateCondition} AND ${platformCondition} AND ${locationCondition} ${typeFilter} ${keywordFilter} ${categoryClause} AND keyword_search_product != ''
                        GROUP BY sku
                        HAVING vol > 0
                        ORDER BY vol DESC
                        LIMIT 50
                    `;
                    const topSkusResult = await queryClickHouse(topSkusQuery);
                    if (topSkusResult.length === 0) return { terms: [] };

                    const skuList = topSkusResult.map(s => `'${escapeCH(s.sku)}'`).join(',');
                    const skuContextMap = {};
                    topSkusResult.forEach(s => {
                        skuContextMap[s.sku] = {
                            vol: s.vol,
                            topBrand: (s.best_brand_arr && s.best_brand_arr.length > 0) ? s.best_brand_arr[0] : 'N/A'
                        };
                    });

                    // 2. Query SKU Level POSITION counts for mode calculation (no more deltas)
                    const skuPositionsQuery = `
                        SELECT 
                            keyword_search_product as sku,
                            POSITION,
                            countIf(toInt32(spons) = 1) as ad_cnt,
                            countIf(toInt32(organic) = 1) as org_cnt,
                            countIf(toInt32(overall) = 1) as ov_cnt
                        FROM rb_kw_olap
                        WHERE ${dateCondition} AND ${platformCondition} AND ${locationCondition} ${typeFilter} ${keywordFilter} ${categoryClause} 
                          AND keyword_search_product IN (${skuList})
                          AND POSITION > 0 AND POSITION < 11
                        GROUP BY sku, POSITION
                    `;

                    // 3. Query SKU-Keyword Level POSITION counts for mode calculation
                    const skuKeywordPositionsQuery = `
                        SELECT 
                            keyword_search_product as sku,
                            keyword,
                            POSITION,
                            countIf(toInt32(spons) = 1) as ad_cnt,
                            countIf(toInt32(organic) = 1) as org_cnt,
                            countIf(toInt32(overall) = 1) as ov_cnt
                        FROM rb_kw_olap
                        WHERE ${dateCondition} AND ${platformCondition} AND ${locationCondition} ${typeFilter} ${keywordFilter} ${categoryClause} 
                          AND keyword_search_product IN (${skuList})
                          AND POSITION > 0 AND POSITION < 11
                        GROUP BY sku, keyword, POSITION
                    `;

                    const [skuPosRes, kwPosRes] = await Promise.all([
                        queryClickHouse(skuPositionsQuery),
                        queryClickHouse(skuKeywordPositionsQuery)
                    ]);

                    // Helper to calculate modes from count maps
                    const getModes = (posMap) => {
                        const maxCnt = Math.max(...Object.values(posMap), 0);
                        if (maxCnt === 0) return '0';
                        return Object.keys(posMap)
                            .filter(pos => posMap[pos] === maxCnt)
                            .sort((a, b) => a - b)
                            .join(', ');
                    };

                    // Process SKU level distributions
                    const skuDist = {};
                    skuPosRes.forEach(r => {
                        if (!skuDist[r.sku]) {
                            skuDist[r.sku] = { ad: {}, org: {}, overall: {} };
                        }
                        const pos = Math.round(Number(r.POSITION));
                        if (r.ad_cnt > 0) skuDist[r.sku].ad[pos] = (skuDist[r.sku].ad[pos] || 0) + Number(r.ad_cnt);
                        if (r.org_cnt > 0) skuDist[r.sku].org[pos] = (skuDist[r.sku].org[pos] || 0) + Number(r.org_cnt);
                        if (r.ov_cnt > 0) skuDist[r.sku].overall[pos] = (skuDist[r.sku].overall[pos] || 0) + Number(r.ov_cnt);
                    });

                    // Process Keyword level distributions
                    const skuKwDist = {};
                    kwPosRes.forEach(r => {
                        const key = `${r.sku}_${r.keyword}`;
                        if (!skuKwDist[key]) {
                            skuKwDist[key] = { ad: {}, org: {}, overall: {} };
                        }
                        const pos = Math.round(Number(r.POSITION));
                        if (r.ad_cnt > 0) skuKwDist[key].ad[pos] = (skuKwDist[key].ad[pos] || 0) + Number(r.ad_cnt);
                        if (r.org_cnt > 0) skuKwDist[key].org[pos] = (skuKwDist[key].org[pos] || 0) + Number(r.org_cnt);
                        if (r.ov_cnt > 0) skuKwDist[key].overall[pos] = (skuKwDist[key].overall[pos] || 0) + Number(r.ov_cnt);
                    });

                    // Collect keywords per SKU
                    const skuKeywordsMap = {};
                    const kwKeysProcessed = new Set();
                    kwPosRes.forEach(r => {
                        const key = `${r.sku}_${r.keyword}`;
                        if (kwKeysProcessed.has(key)) return;
                        kwKeysProcessed.add(key);

                        if (!skuKeywordsMap[r.sku]) skuKeywordsMap[r.sku] = [];

                        const dist = skuKwDist[key];
                        const adModes = getModes(dist.ad);
                        const orgModes = getModes(dist.org);
                        const ovModes = getModes(dist.overall);

                        skuKeywordsMap[r.sku].push({
                            keyword: r.keyword,
                            adRankData: { rank: adModes, delta: 0 },
                            organicData: { rank: orgModes, delta: 0 },
                            overallData: { rank: ovModes, delta: 0 },
                            paidData: { rank: adModes, delta: 0 }
                        });
                    });

                    // Build final SKU terms
                    terms = topSkusResult.map(s => {
                        const dist = skuDist[s.sku] || { ad: {}, org: {}, overall: {} };

                        return {
                            skuName: s.sku,
                            topBrand: skuContextMap[s.sku]?.topBrand || 'N/A',
                            overallRank: getModes(dist.overall),
                            overallDelta: 0,
                            organicRank: getModes(dist.org),
                            organicDelta: 0,
                            paidRank: getModes(dist.ad),
                            paidDelta: 0,
                            keywords: skuKeywordsMap[s.sku] || [],
                            _vol: skuContextMap[s.sku]?.vol || 0
                        };
                    });

                    // Resort by volume DESC exactly as fetched
                    terms.sort((a, b) => b._vol - a._vol);

                } else {
                    const limitClause = 'LIMIT 50';

                    const metricsQuery = `
                        SELECT 
                            keyword,
                            MAX(keyword_type) as type,
                            sumIf(toInt32(overall), ${brandSOSCondition}) as rb_overall,
                            sumIf(toInt32(organic), ${brandSOSCondition}) as rb_organic,
                            sumIf(toInt32(spons), ${brandSOSCondition}) as rb_sponsored,
                            sum(toInt32(overall)) as total_overall,
                            sum(toInt32(organic)) as total_organic,
                            sum(toInt32(spons)) as total_spons,
                            sumIf(toInt32(overall), ${brandSOSCondition}) as brand_filter_overall,
                            ROUND(AVG(POSITION), 1) as avg_overall_pos,
                            ROUND(avgIf(POSITION, toInt32(organic) = 1 AND ${brandSOSCondition}), 1) as avg_org_pos,
                            ROUND(avgIf(POSITION, toInt32(spons) = 1 AND ${brandSOSCondition}), 1) as avg_ad_pos
                        FROM rb_kw_olap
                        WHERE ${dateCondition}
                          AND ${platformCondition}
                          AND ${locationCondition}
                          ${typeFilter}
                          ${keywordFilter}
                          ${categoryClause}
                        GROUP BY keyword
                        ${brand && brand !== 'All' ? 'HAVING brand_filter_overall > 0' : ''}
                        ORDER BY (ifNull(toFloat64OrZero(toString(rb_overall)), 0) / nullIf(total_overall, 0)) DESC, total_overall DESC
                        ${limitClause}
                    `;

                    const keywordMetrics = await queryClickHouse(metricsQuery);

                    if (keywordMetrics.length === 0) return { terms: [] };

                    const keywordList = keywordMetrics.map(k => `'${escapeCH(k.keyword)}'`).join(',');

                    // 2b. Aggregate metrics for previous period (for Deltas)
                    const prevMetricsQuery = `
                        SELECT 
                            keyword,
                            sum(toInt32(overall)) as total_overall,
                            sum(toInt32(organic)) as total_organic,
                            sum(toInt32(spons)) as total_spons,
                            sumIf(toInt32(overall), ${brandSOSCondition}) as rb_overall,
                            sumIf(toInt32(organic), ${brandSOSCondition}) as rb_organic,
                            sumIf(toInt32(spons), ${brandSOSCondition}) as rb_sponsored
                        FROM rb_kw_olap
                        WHERE ${prevDateCondition}
                          AND ${platformCondition}
                          AND ${locationCondition}
                          AND keyword IN (${keywordList})
                          AND POSITION < 11
                          ${typeFilter}
                          ${categoryClause}
                        GROUP BY keyword
                    `;
                    const prevKeywordMetrics = await queryClickHouse(prevMetricsQuery);

                    const prevMap = {};
                    prevKeywordMetrics.forEach(p => {
                        prevMap[p.keyword] = {
                            overallSos: Number(((Number(p.rb_overall) / (Number(p.total_overall) || 1)) * 100).toFixed(1)),
                            organicSos: Number(((Number(p.rb_organic) / (Number(p.total_organic) || 1)) * 100).toFixed(1)),
                            paidSos: Number(((Number(p.rb_sponsored) / (Number(p.total_spons) || 1)) * 100).toFixed(1))
                        };
                    });

                    // 3. Get leading brand for each keyword (the brand with most shelf share)
                    const leadingBrandQuery = `
                        SELECT 
                            keyword,
                            brand as brand_name,
                            count() as brand_count
                        FROM rb_kw_olap
                        WHERE ${dateCondition}
                          AND keyword IN (${keywordList})
                          AND ${platformCondition}
                          AND ${locationCondition}
                          AND POSITION < 11
                          ${typeFilter}
                          AND brand IS NOT NULL 
                          AND brand != ''
                        GROUP BY keyword, brand
                        ORDER BY keyword, brand_count DESC
                    `;

                    const brandResults = await queryClickHouse(leadingBrandQuery);

                    const brandMap = {};
                    brandResults.forEach(r => {
                        if (!brandMap[r.keyword]) {
                            brandMap[r.keyword] = r.brand_name;
                        }
                    });

                    terms = keywordMetrics.map(km => {
                        const tOverall = Number(km.total_overall) || 1;
                        const tOrganic = Number(km.total_organic) || 1;
                        const tSpons = Number(km.total_spons) || 1;

                        const currOverallSos = Number(((Number(km.rb_overall) / tOverall) * 100).toFixed(1));
                        const currOrganicSos = Number(((Number(km.rb_organic) / tOrganic) * 100).toFixed(1));
                        const currPaidSos = Number(((Number(km.rb_sponsored) / tSpons) * 100).toFixed(1));

                        const prev = prevMap[km.keyword] || { overallSos: currOverallSos, organicSos: currOrganicSos, paidSos: currPaidSos };

                        return {
                            keyword: km.keyword,
                            topBrand: brandMap[km.keyword] || 'N/A',
                            overallSos: currOverallSos,
                            overallDelta: Number((currOverallSos - prev.overallSos).toFixed(1)),
                            overallPos: Number(Number(km.avg_overall_pos || 0).toFixed(1)),
                            organicSos: currOrganicSos,
                            organicDelta: Number((currOrganicSos - prev.organicSos).toFixed(1)),
                            organicPos: Number(Number(km.avg_org_pos || 0).toFixed(1)),
                            paidSos: currPaidSos,
                            paidDelta: Number((currPaidSos - prev.paidSos).toFixed(1)),
                            paidPos: Number(Number(km.avg_ad_pos || 0).toFixed(1)),
                        };
                    });
                }

                return { terms };
            } catch (error) {
                console.error('[VisibilityService] Error in getTopSearchTerms (ClickHouse):', error);
                return { terms: [] };
            }
        }, CACHE_TTL.ONE_HOUR);
    }

    /**
     * Get Brand Visibility Drilldown for a specific keyword
     * Compares current SOS metrics with previous period to find "losers"
     * @param {Object} filters - { keyword, platform, location, startDate, endDate }
     */
    async getBrandDrilldown(filters) {
        console.log(`[VisibilityService] getBrandDrilldown (ClickHouse): keyword="${filters.keyword}"`);
        const cacheKey = generateCacheKey('visibility_brand_drilldown_v3', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                if (!filters.keyword) return { brands: [], topLosers: [] };

                const platform = filters.platform || 'All';
                const location = filters.location || 'All';

                const platformCondition = buildCHCondition(platform, 'platform_name');
                const locationCondition = buildCHCondition(location, 'location_name');
                const keywordCondition = buildCHCondition(filters.keyword, 'keyword');
                const keywordTypeCondition = buildCHCondition(filters.keywordType, 'keyword_type');

                // Apply category filter if provided
                const categoryValue = filters.category || filters.format;
                const categoryFilter = buildCHCondition(categoryValue, 'keyword_category', { isCategory: true });
                const categoryClause = categoryFilter !== '1=1' ? `AND ${categoryFilter}` : '';

                // 1. Calculate Period Boundaries (consistent with getTopSearchTerms)
                const start = dayjs(filters.startDate || dayjs().subtract(7, 'day'));
                const end = dayjs(filters.endDate || dayjs());
                const duration = end.diff(start, 'day') + 1;

                const currStart = start.format('YYYY-MM-DD');
                const currEnd = end.format('YYYY-MM-DD');
                const prevStartStr = start.subtract(duration, 'day').format('YYYY-MM-DD');
                const prevEndStr = start.subtract(1, 'day').format('YYYY-MM-DD');

                // 2. Fetch aggregate metrics for ALL brands for both periods
                const drilldownQuery = `
                    SELECT 
                        brand as brand_name,
                        if(DATE BETWEEN '${currStart}' AND '${currEnd}', 'current', 'previous') as period,
                        sum(toInt32(overall)) as brand_overall,
                        sum(toInt32(organic)) as brand_organic,
                        sum(toInt32(spons)) as brand_sponsored
                    FROM rb_kw_olap
                    WHERE ${keywordCondition}
                      AND (DATE BETWEEN '${currStart}' AND '${currEnd}' OR DATE BETWEEN '${prevStartStr}' AND '${prevEndStr}')
                      AND POSITION < 11
                      AND ${platformCondition}
                      AND ${locationCondition}
                      AND ${keywordTypeCondition}
                      ${categoryClause}
                      AND brand IS NOT NULL AND brand != ''
                      AND lower(brand) != 'other'
                    GROUP BY brand_name, period
                `;
                console.log('[VisibilityService] Brand Drilldown Query:', drilldownQuery);

                const totalsQuery = `
                    SELECT 
                        if(DATE BETWEEN '${currStart}' AND '${currEnd}', 'current', 'previous') as period,
                        sum(toInt32(overall)) as total_overall,
                        sum(toInt32(organic)) as total_organic,
                        sum(toInt32(spons)) as total_spons
                    FROM rb_kw_olap 
                    WHERE ${keywordCondition}
                      AND (DATE BETWEEN '${currStart}' AND '${currEnd}' OR DATE BETWEEN '${prevStartStr}' AND '${prevEndStr}')
                      AND POSITION < 11
                      AND ${platformCondition} 
                      AND ${locationCondition}
                      AND ${keywordTypeCondition}
                      ${categoryClause}
                    GROUP BY period
                `;
                const [drilldownResults, totalResults] = await Promise.all([
                    queryClickHouse(drilldownQuery),
                    queryClickHouse(totalsQuery)
                ]);

                if (drilldownResults.length === 0) return { brands: [], topLosers: [] };

                // Map totals by period
                const periodTotals = {};
                totalResults.forEach(r => {
                    periodTotals[r.period] = {
                        overall: Number(r.total_overall) || 1,
                        organic: Number(r.total_organic) || 1,
                        spons: Number(r.total_spons) || 1
                    };
                });

                // Process results
                const brandData = {};
                drilldownResults.forEach(row => {
                    const brand = row.brand_name;
                    const period = row.period;
                    if (!brandData[brand]) {
                        brandData[brand] = { brand, current: { overall: 0, organic: 0, paid: 0 }, previous: { overall: 0, organic: 0, paid: 0 } };
                    }

                    const totals = periodTotals[period] || { overall: 1, organic: 1, spons: 1 };
                    const sosOverall = Number(((Number(row.brand_overall) / totals.overall) * 100).toFixed(1));
                    const sosOrganic = Number(((Number(row.brand_organic) / totals.organic) * 100).toFixed(1));
                    const sosPaid = Number(((Number(row.brand_sponsored) / totals.spons) * 100).toFixed(1));

                    if (period === 'current') {
                        brandData[brand].current = { overall: sosOverall, organic: sosOrganic, paid: sosPaid };
                    } else {
                        brandData[brand].previous = { overall: sosOverall, organic: sosOrganic, paid: sosPaid };
                    }
                });

                // 5. Final formatting with deltas
                const brands = Object.values(brandData).map(b => ({
                    brand: b.brand,
                    overallSos: { value: b.current.overall, delta: Number((b.current.overall - b.previous.overall).toFixed(1)) },
                    organicSos: { value: b.current.organic, delta: Number((b.current.organic - b.previous.organic).toFixed(1)) },
                    paidSos: { value: b.current.paid, delta: Number((b.current.paid - b.previous.paid).toFixed(1)) }
                })).sort((a, b) => b.overallSos.value - a.overallSos.value);

                // 6. Identify top losers (negative delta in ANY SOS metric)
                const topLosers = brands
                    .filter(b => b.overallSos.delta < 0 || b.organicSos.delta < 0 || b.paidSos.delta < 0)
                    .sort((a, b) => a.overallSos.delta - b.overallSos.delta)
                    .slice(0, 10);

                return { brands, topLosers };
            } catch (error) {
                console.error('[VisibilityService] Error in getBrandDrilldown (ClickHouse):', error);
                return { brands: [], topLosers: [] };
            }
        }, CACHE_TTL.ONE_HOUR);
    }

    /**
     * Get dynamic filter options for visibility analysis cascading filters
     * Uses rb_kw_olap as primary source (main visibility data table)
     * @param {Object} params - { filterType, platform, format, city }
     * @returns {Object} { options: [...] }
     */
    async getVisibilityFilterOptions({ filterType, platform, format, city, brand, ownBrandsOnly }) {
        console.log(`[VisibilityService] getVisibilityFilterOptions called: type=${filterType}`);
        const cacheKey = generateCacheKey('visibility_filters_v6', { filterType, platform, format, city, brand, ownBrandsOnly });

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                console.log(`[VisibilityService] getVisibilityFilterOptions called: type=${filterType}`);

                // Shared conditions for cascading filters
                const platformFilter = platform || null;
                const formatFilter = format || null;
                const cityFilter = city || null;

                const platformCondition = buildCHCondition(platformFilter, 'platform_name');
                const formatCondition = buildCHCondition(formatFilter, 'keyword_category');
                const cityCondition = buildCHCondition(cityFilter, 'location_name');
                const brandCondition = buildCHCondition(brand || null, 'brand');

                // PLATFORMS: from rb_kw_olap.platform_name
                if (filterType === 'platforms') {
                    const results = await queryClickHouse(`
                    SELECT DISTINCT platform_name as platform
                    FROM rb_kw_olap
                    WHERE platform_name IS NOT NULL AND platform_name != ''
                    ORDER BY platform_name
                `);
                    const options = results.map(r => r.platform).filter(Boolean);
                    return { options };
                }

                // MONTHS: from rb_kw_olap.DATE
                if (filterType === 'months') {
                    const results = await queryClickHouse(`
                    SELECT DISTINCT toStartOfMonth(DATE) as date
                    FROM rb_kw_olap
                    WHERE DATE IS NOT NULL
                    ORDER BY date DESC
                    LIMIT 12
                `);
                    const options = results.map(r => dayjs(r.date).format('YYYY-MM-DD')).filter(Boolean);
                    return { options };
                }

                // DATES: from rb_kw_olap.created_on (Active Dates)
                if (filterType === 'dates') {
                    const results = await queryClickHouse(`
                    SELECT DISTINCT DATE as date
                    FROM rb_kw_olap
                    WHERE DATE IS NOT NULL
                    ORDER BY date DESC
                    LIMIT 30
                `);
                    const options = results.map(r => dayjs(r.date).format('YYYY-MM-DD')).filter(Boolean);
                    return { options };
                }

                // ===========================================================================
                // UPDATED FILTER LOGIC BASED ON USER REQUEST
                // Category (formats): rb_kw_olap.keyword_category
                // Brand: rb_kw_olap.brand_name
                // SKU: rb_pdp_olap.Product
                // ===========================================================================

                // DATES (special case, keep as is or from rb_kw_olap)
                if (filterType === 'dates' || filterType === 'days') {
                    const results = await queryClickHouse(`
                    SELECT DISTINCT DATE as date
                    FROM rb_kw_olap
                    WHERE DATE IS NOT NULL
                    ORDER BY date DESC
                    LIMIT 30
                `);
                    const options = results.map(r => dayjs(r.date).format('YYYY-MM-DD')).filter(Boolean);
                    return { options };
                }

                // FORMATS (Category): from rb_kw_olap.keyword_category
                if (filterType === 'formats') {
                    let formatWhere = "WHERE keyword_category IS NOT NULL AND keyword_category != ''";
                    if (platform && platform !== 'All') {
                        formatWhere += ` AND platform_name = '${escapeCH(platform)}'`;
                    }
                    if (city && city !== 'All') {
                        formatWhere += ` AND location_name = '${escapeCH(city)}'`;
                    }

                    const results = await queryClickHouse(`
                        SELECT DISTINCT keyword_category as format
                        FROM rb_kw_olap
                        ${formatWhere}
                        ORDER BY format
                    `);
                    const options = results.map(r => r.format).filter(Boolean);
                    return { options };
                }

                // BRANDS: from rb_kw_olap.brand
                if (filterType === 'brands') {
                    let brandWhere = "WHERE brand IS NOT NULL AND brand != ''";
                    if (platform && platform !== 'All') {
                        brandWhere += ` AND platform_name = '${escapeCH(platform)}'`;
                    }
                    if (city && city !== 'All') {
                        brandWhere += ` AND location_name = '${escapeCH(city)}'`;
                    }
                    if (format && format !== 'All') {
                        brandWhere += ` AND keyword_category = '${escapeCH(format)}'`;
                    }
                    if (ownBrandsOnly) {
                        brandWhere += ` AND flag = '1'`;
                    }

                    const results = await queryClickHouse(`
                        SELECT DISTINCT brand as brand
                        FROM rb_kw_olap
                        ${brandWhere}
                        ORDER BY brand
                    `);
                    const options = results.map(r => r.brand).filter(Boolean);
                    console.log(`[DEBUG] brands filter options returned ${options.length} options:`, options);
                    return { options };
                }

                // SKUs: from rb_pdp_olap.Product
                if (filterType === 'skus') {
                    let skuWhere = "WHERE Product IS NOT NULL AND Product != ''";
                    if (platform && platform !== 'All') {
                        skuWhere += ` AND Platform = '${escapeCH(platform)}'`;
                    }
                    if (city && city !== 'All') {
                        skuWhere += ` AND Location = '${escapeCH(city)}'`;
                    }
                    if (format && format !== 'All') {
                        skuWhere += ` AND Category = '${escapeCH(format)}'`;
                    }
                    if (brand && brand !== 'All') {
                        skuWhere += ` AND Brand = '${escapeCH(brand)}'`;
                    }

                    const results = await queryClickHouse(`
                        SELECT DISTINCT Product as sku
                        FROM rb_pdp_olap
                        ${skuWhere}
                        ORDER BY sku
                    `);
                    const options = results.map(r => r.sku).filter(Boolean);
                    return { options };
                }

                // CITIES: from rb_kw_olap.location_name
                if (filterType === 'cities') {
                    let cityWhere = "WHERE location_name IS NOT NULL AND location_name != ''";
                    if (platform && platform !== 'All') {
                        cityWhere += ` AND platform_name = '${escapeCH(platform)}'`;
                    }
                    if (format && format !== 'All') {
                        cityWhere += ` AND keyword_category = '${escapeCH(format)}'`;
                    }

                    const results = await queryClickHouse(`
                        SELECT DISTINCT location_name as city
                        FROM rb_kw_olap
                        ${cityWhere}
                        ORDER BY city
                    `);
                    const options = results.map(r => r.city).filter(Boolean);
                    return { options };
                }

                // Default fallbacks for other legacy types
                if (filterType === 'zones') {
                    const results = await queryClickHouse(`SELECT DISTINCT region as zone FROM rb_location_darkstore WHERE region != '' ORDER BY zone`);
                    return { options: results.map(r => r.zone).filter(Boolean) };
                }

                if (filterType === 'metroFlags') {
                    const results = await queryClickHouse(`SELECT DISTINCT tier as metroFlag FROM rb_location_darkstore WHERE tier != '' ORDER BY metroFlag`);
                    return { options: results.map(r => r.metroFlag).filter(Boolean) };
                }

                if (filterType === 'productName' || filterType === 'keywords') {
                    let keywordWhere = "WHERE keyword IS NOT NULL AND keyword != ''";
                    if (platform && platform !== 'All') {
                        keywordWhere += ` AND platform_name = '${escapeCH(platform)}'`;
                    }
                    if (city && city !== 'All') {
                        keywordWhere += ` AND location_name = '${escapeCH(city)}'`;
                    }
                    if (format && format !== 'All') {
                        keywordWhere += ` AND keyword_category = '${escapeCH(format)}'`;
                    }

                    const results = await queryClickHouse(`
                        SELECT DISTINCT keyword
                        FROM rb_kw_olap
                        ${keywordWhere}
                        ORDER BY keyword
                        LIMIT 1000
                    `);
                    return { options: results.map(r => r.keyword).filter(Boolean) };
                }

                return { options: [] };
            } catch (error) {
                console.error('[VisibilityService] getVisibilityFilterOptions error:', error);
                throw error;
            }
        }, CACHE_TTL.LONG);
    }

    /**
     * Get the latest available dates from rb_kw_olap table
     * Returns the date range of the latest month that has data
     */
    async getLatestAvailableDates() {
        console.log('[VisibilityService] getLatestAvailableDates (ClickHouse) called');
        const cacheKey = 'visibility_latest_dates';

        return await getCachedOrCompute(cacheKey, async () => {
            try {

                // Get the max date from rb_kw_olap table - ClickHouse
                const results = await queryClickHouse(`
                SELECT MAX(DATE) as maxDate
                FROM rb_kw_olap
                WHERE DATE IS NOT NULL
            `);

                const maxDate = results[0]?.maxDate;

                if (!maxDate || maxDate === '0000-00-00' || maxDate === '1970-01-01') {
                    console.log('[VisibilityService] No valid data found in rb_kw_olap table, returning current month');
                    // Fallback to current month if no data
                    const now = dayjs();
                    return {
                        available: false,
                        startDate: now.startOf('month').format('YYYY-MM-DD'),
                        endDate: now.format('YYYY-MM-DD'),
                        latestDate: now.format('YYYY-MM-DD'),
                        defaultStartDate: now.startOf('month').format('YYYY-MM-DD')
                    };
                }

                const latestDate = dayjs(maxDate);
                const startOfMonth = latestDate.startOf('month');

                console.log('[VisibilityService] Found latest date (ClickHouse):', latestDate.format('YYYY-MM-DD'));

                return {
                    available: true,
                    startDate: startOfMonth.format('YYYY-MM-DD'),
                    endDate: latestDate.format('YYYY-MM-DD'),
                    latestDate: latestDate.format('YYYY-MM-DD'),
                    defaultStartDate: startOfMonth.format('YYYY-MM-DD')
                };
            } catch (error) {
                console.error('[VisibilityService] Error getting latest available dates (ClickHouse):', error);
                // Fallback to current month on error
                const now = dayjs();
                return {
                    available: false,
                    startDate: now.startOf('month').format('YYYY-MM-DD'),
                    endDate: now.format('YYYY-MM-DD'),
                    latestDate: now.format('YYYY-MM-DD'),
                    defaultStartDate: now.startOf('month').format('YYYY-MM-DD'),
                    error: error.message
                };
            }
        }, CACHE_TTL.ONE_HOUR);
    }

    /**
     * Get Visibility KPI Trends for chart display
     * Returns daily SOS trends for Overall, Sponsored, Organic, and Display metrics
     * @param {Object} filters - { platform, location, brand, startDate, endDate, period, timeStep }
     * @returns {Promise<{timeSeries: Array}>}
     */
    async getVisibilityKpiTrends(filters = {}) {
        console.log('[VisibilityService] getVisibilityKpiTrends called with filters:', filters);
        const cacheKey = generateCacheKey('visibility_kpi_trends', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                // Determine date range based on period or explicit dates
                let startDate, endDate;
                const period = filters.period || '1M';

                if (filters.startDate && filters.endDate) {
                    startDate = dayjs(filters.startDate);
                    endDate = dayjs(filters.endDate);
                } else {
                    // Fetch the latest available date from ClickHouse
                    const maxDateRes = await queryClickHouse(`
                        SELECT MAX(DATE) as maxDate
                        FROM rb_kw_olap
                        WHERE DATE IS NOT NULL
                    `);
                    const maxDate = maxDateRes[0]?.maxDate;

                    if (maxDate && maxDate !== '0000-00-00' && maxDate !== '1970-01-01') {
                        endDate = dayjs(maxDate);
                    } else {
                        endDate = dayjs();
                    }

                    const periodToDays = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
                    const days = periodToDays[period] || 30;
                    startDate = endDate.subtract(days, 'day');
                }

                const dateFrom = startDate.format('YYYY-MM-DD');
                const dateTo = endDate.format('YYYY-MM-DD');

                const platform = filters.platform || null;
                const location = filters.location || null;
                const brand = filters.brand || null;
                const categoryValue = filters.category || filters.format || null;

                const platformCondition = buildCHCondition(platform, 'platform_name');
                const locationCondition = buildCHCondition(location, 'location_name');
                const keywordCondition = buildCHCondition(filters.keyword, 'keyword');
                const keywordTypeCondition = buildCHCondition(filters.keywordType, 'keyword_type');
                const formatCondition = buildCHCondition(categoryValue, 'keyword_category', { isCategory: true });
                // const brandSOSCondition = buildCHCondition(brand, 'brand_name', { isBrand: true });
                const brandSOSCondition = buildCHCondition(filters.brand || 'All', 'brand', { isBrand: true }); // Dynamic SOS

                // Determine aggregation based on timeStep
                let dateAggregation;
                let dateFormat;
                const timeStep = filters.timeStep || 'Daily';

                if (timeStep === 'Weekly') {
                    dateAggregation = 'toStartOfWeek(DATE, 1)'; // 1 for Monday
                    dateFormat = "DD MMM'YY";
                } else if (timeStep === 'Monthly') {
                    dateAggregation = 'toStartOfMonth(DATE)';
                    dateFormat = "MMM 'YY";
                } else {
                    // Default to Daily
                    dateAggregation = 'DATE';
                    dateFormat = "DD MMM'YY";
                }

                // Aggregate by selected time step - ClickHouse
                const query = `
                SELECT 
                    ${dateAggregation} as crawl_date,
                    ROUND(sumIf(toInt32(overall), ${brandSOSCondition}) * 100.0 / nullIf(sum(toInt32(overall)), 0), 2) AS overall_sos,
                    ROUND(sumIf(toInt32(spons), ${brandSOSCondition}) * 100.0 / nullIf(sum(toInt32(spons)), 0), 2) AS sponsored_sos,
                    ROUND(sumIf(toInt32(organic), ${brandSOSCondition}) * 100.0 / nullIf(sum(toInt32(organic)), 0), 2) AS organic_sos,
                    ROUND(sumIf(toInt32(spons), ${brandSOSCondition}) * 100.0 / nullIf(sum(toInt32(spons)), 0), 2) AS display_sos
                FROM rb_kw_olap
                WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND ${platformCondition}
                  AND ${locationCondition}
                  AND ${formatCondition}
                  AND ${keywordTypeCondition}
                GROUP BY crawl_date
                ORDER BY crawl_date ASC
            `;

                const results = await queryClickHouse(query);

                // Format dates based on time step
                const timeSeries = results.map(row => {
                    const date = dayjs(row.crawl_date);
                    return {
                        date: date.format(dateFormat),
                        overall_sos: Number(row.overall_sos) || 0,
                        sponsored_sos: Number(row.sponsored_sos) || 0,
                        organic_sos: Number(row.organic_sos) || 0,
                        display_sos: Number(row.display_sos) || 0
                    };
                });

                console.log('[VisibilityService] Returning', timeSeries.length, 'trend data points');
                return { timeSeries };
            } catch (error) {
                console.error('[VisibilityService] Error getting visibility KPI trends:', error);
                return { timeSeries: [] };
            }
        }, CACHE_TTL.ONE_HOUR);
    }

    /**
     * Get Visibility Competition data for brand/SKU comparison
     * Returns SOS metrics with period-over-period delta for all brands and SKUs
     * @param {Object} filters - { platform, location, period }
     * @returns {Promise<{brands: Array, skus: Array}>}
     */
    async getVisibilityCompetition(filters = {}) {
        console.log('[VisibilityService] getVisibilityCompetition called with filters:', filters);
        const cacheKey = generateCacheKey('visibility_competition', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                // First, get the latest available date from ClickHouse
                const maxDateRes = await queryClickHouse(`
                SELECT MAX(DATE) as maxDate
                FROM rb_kw_olap
                WHERE DATE IS NOT NULL
            `);

                const maxDate = maxDateRes[0]?.maxDate;

                if (!maxDate || maxDate === '0000-00-00') {
                    console.error('[VisibilityService] No data found in rb_kw_olap table');
                    return { brands: [], skus: [] };
                }

                const latestDate = dayjs(maxDate);
                console.log('[VisibilityService] Using latest available date (ClickHouse):', latestDate.format('YYYY-MM-DD'));

                // Determine date ranges
                const period = filters.period || '1M';
                const periodToDays = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
                const days = periodToDays[period] || 30;

                const currentEnd = latestDate;
                const currentStart = currentEnd.subtract(days, 'day');
                const prevEnd = currentStart.subtract(1, 'day');
                const prevStart = prevEnd.subtract(days, 'day');

                const dateFrom = currentStart.format('YYYY-MM-DD');
                const dateTo = currentEnd.format('YYYY-MM-DD');
                const prevDateFrom = prevStart.format('YYYY-MM-DD');
                const prevDateTo = prevEnd.format('YYYY-MM-DD');

                // Build conditions
                const platform = filters.platform || null;
                const location = filters.location || null;
                const categoryValue = filters.category || filters.format || null;
                const productName = filters.productName || filters.keyword || null;
                const brandFilter = filters.brand || null;

                const platformCondition = buildCHCondition(filters.platform, 'platform_name');
                const locationCondition = buildCHCondition(filters.location, 'location_name');
                const formatCondition = buildCHCondition(filters.category || filters.format, 'keyword_category', { isCategory: true });
                const keywordCondition = buildCHCondition(filters.keyword, 'keyword');
                const keywordTypeCondition = buildCHCondition(filters.keywordType, 'keyword_type');
                const brandsCondition = buildCHCondition(filters.brands, 'brand');
                const brandCondition = buildCHCondition(brandFilter, 'brand');

                const allFilters = `
                AND ${platformCondition}
                AND ${locationCondition}
                AND ${formatCondition}
                AND ${keywordCondition}
                AND ${keywordTypeCondition}
                AND ${brandCondition}
            `;

                // 1. Get total volume for both periods
                const volumeQuery = `
                SELECT 
                    sumIf(toInt32(overall), DATE BETWEEN '${dateFrom}' AND '${dateTo}') as current_total_overall,
                    sumIf(toInt32(overall), DATE BETWEEN '${prevDateFrom}' AND '${prevDateTo}') as prev_total_overall,
                    sumIf(toInt32(spons), DATE BETWEEN '${dateFrom}' AND '${dateTo}') as current_total_spons,
                    sumIf(toInt32(spons), DATE BETWEEN '${prevDateFrom}' AND '${prevDateTo}') as prev_total_spons,
                    sumIf(toInt32(organic), DATE BETWEEN '${dateFrom}' AND '${dateTo}') as current_total_organic,
                    sumIf(toInt32(organic), DATE BETWEEN '${prevDateFrom}' AND '${prevDateTo}') as prev_total_organic
                FROM rb_kw_olap
                WHERE (DATE BETWEEN '${dateFrom}' AND '${dateTo}' OR DATE BETWEEN '${prevDateFrom}' AND '${prevDateTo}')
                ${allFilters}
            `;

                const volumeRes = await queryClickHouse(volumeQuery);
                const currV = {
                    overall: Number(volumeRes[0]?.current_total_overall) || 1,
                    spons: Number(volumeRes[0]?.current_total_spons) || 1,
                    organic: Number(volumeRes[0]?.current_total_organic) || 1
                };
                const prevV = {
                    overall: Number(volumeRes[0]?.prev_total_overall) || 1,
                    spons: Number(volumeRes[0]?.prev_total_spons) || 1,
                    organic: Number(volumeRes[0]?.prev_total_organic) || 1
                };

                console.log(`[VisibilityService] Competition Volume (ClickHouse) - Current: ${currV.overall}, Prev: ${prevV.overall}`);

                // 2. Query for brand-level competition
                const brandQuery = `
                SELECT 
                    brand as brand_name,
                    ROUND(sumIf(toInt32(overall), DATE BETWEEN '${dateFrom}' AND '${dateTo}') * 100.0 / ${currV.overall}, 2) AS current_overall_sos,
                    ROUND(sumIf(toInt32(spons), DATE BETWEEN '${dateFrom}' AND '${dateTo}') * 100.0 / ${currV.spons}, 2) AS current_sponsored_sos,
                    ROUND(sumIf(toInt32(organic), DATE BETWEEN '${dateFrom}' AND '${dateTo}') * 100.0 / ${currV.organic}, 2) AS current_organic_sos,
                    ROUND(sumIf(toInt32(overall), DATE BETWEEN '${prevDateFrom}' AND '${prevDateTo}') * 100.0 / ${prevV.overall}, 2) AS prev_overall_sos,
                    ROUND(sumIf(toInt32(spons), DATE BETWEEN '${prevDateFrom}' AND '${prevDateTo}') * 100.0 / ${prevV.spons}, 2) AS prev_sponsored_sos,
                    ROUND(sumIf(toInt32(organic), DATE BETWEEN '${prevDateFrom}' AND '${prevDateTo}') * 100.0 / ${prevV.organic}, 2) AS prev_organic_sos,
                    countIf(DATE BETWEEN '${dateFrom}' AND '${dateTo}') as impressions
                FROM rb_kw_olap
                WHERE (DATE BETWEEN '${dateFrom}' AND '${dateTo}' OR DATE BETWEEN '${prevDateFrom}' AND '${prevDateTo}')
                  ${allFilters}
                  AND brand IS NOT NULL AND brand != ''
                  AND lower(brand) != 'other'
                  AND flag = '0'
                GROUP BY brand
                ORDER BY impressions DESC
                LIMIT 20
            `;

                const brandResults = await queryClickHouse(brandQuery);

                const brands = brandResults.map(b => ({
                    brand: b.brand_name,
                    overall_sos: {
                        value: Number(b.current_overall_sos) || 0,
                        delta: Number((Number(b.current_overall_sos) - Number(b.prev_overall_sos)).toFixed(2))
                    },
                    sponsored_sos: {
                        value: Number(b.current_sponsored_sos) || 0,
                        delta: Number((Number(b.current_sponsored_sos) - Number(b.prev_sponsored_sos)).toFixed(2))
                    },
                    organic_sos: {
                        value: Number(b.current_organic_sos) || 0,
                        delta: Number((Number(b.current_organic_sos) - Number(b.prev_organic_sos)).toFixed(2))
                    },
                    display_sos: { value: 0, delta: 0 }
                }));

                // 3. Query for SKU-level competition using rb_kw_olap
                const skuQuery = `
                SELECT 
                    keyword_search_product as sku_name,
                    brand as brand_name,
                    ROUND(sum(toInt32(overall)) * 100.0 / ${currV.overall}, 2) AS overall_sos,
                    ROUND(sum(toInt32(spons)) * 100.0 / ${currV.spons}, 2) AS sponsored_sos,
                    ROUND(sum(toInt32(organic)) * 100.0 / ${currV.organic}, 2) AS organic_sos,
                    count(*) as impressions
                FROM rb_kw_olap
                WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
                  ${allFilters}
                  AND keyword IS NOT NULL AND keyword != ''
                  AND lower(brand) != 'other'
                  AND flag = '0'
                GROUP BY sku_name, brand_name
                ORDER BY impressions DESC
                LIMIT 20
            `;

                console.log(`[VisibilityService] ClickHouse SKU Competition Query: ${skuQuery}`);
                const skuResults = await queryClickHouse(skuQuery);

                const skus = skuResults.map(s => ({
                    sku: s.sku_name,
                    brand: s.brand_name,
                    overall_sos: { value: Number(s.overall_sos) || 0, delta: 0 },
                    sponsored_sos: { value: Number(s.sponsored_sos) || 0, delta: 0 },
                    organic_sos: { value: Number(s.organic_sos) || 0, delta: 0 },
                    display_sos: { value: 0, delta: 0 }
                }));

                return { brands, skus };
            } catch (error) {
                console.error('[VisibilityService] Error getting visibility competition (ClickHouse):', error);
                return { brands: [], skus: [] };
            }
        }, CACHE_TTL.ONE_HOUR);
    }

    /**
     * Get Brand Comparison Trends for chart display
     * Returns daily SOS trends for multiple selected brands for comparison
     * @param {Object} filters - { brands: string[], platform, location, period, startDate, endDate }
     * @returns {Promise<{brands: {[brandName]: {timeSeries: Array, color: string}}, days: string[]}>}
     */
    async getBrandComparisonTrends(filters = {}) {
        console.log('[VisibilityService] getBrandComparisonTrends called with filters:', filters);
        const cacheKey = generateCacheKey('visibility_brand_comparison', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                // Predefined colors for brand lines (up to 10 brands)
                const BRAND_COLORS = [
                    '#3B82F6', // blue
                    '#10B981', // emerald
                    '#F59E0B', // amber
                    '#EF4444', // red
                    '#8B5CF6', // violet
                    '#EC4899', // pink
                    '#06B6D4', // cyan
                    '#84CC16', // lime
                    '#F97316', // orange
                    '#6366F1', // indigo
                ];

                let selectedBrands = Array.isArray(filters.brands)
                    ? filters.brands
                    : (filters.brands ? filters.brands.split(',') : []);

                // [FIX] Remove 'Other' brand from comparison as requested
                selectedBrands = selectedBrands.filter(b => b && b.trim().toLowerCase() !== 'other');

                if (selectedBrands.length === 0) {
                    return { brands: {}, days: [] };
                }

                const dimension = filters.dimension || 'brand';
                let dimColumn = 'brand';
                if (dimension === 'sku') dimColumn = 'keyword_search_product';
                else if (dimension === 'keyword') dimColumn = 'keyword';

                const platformCondition = buildCHCondition(filters.platform, 'platform_name');
                const locationCondition = buildCHCondition(filters.location, 'location_name');
                const formatCondition = buildCHCondition(filters.category || filters.format, 'keyword_category', { isCategory: true });
                const keywordCondition = buildCHCondition(filters.keyword, 'keyword');
                const keywordTypeCondition = buildCHCondition(filters.keywordType, 'keyword_type');
                const brandsCondition = buildCHCondition(selectedBrands, dimColumn);

                // Determine date range
                let startDate, endDate;
                const period = filters.period || '1M';

                if (filters.startDate && filters.endDate) {
                    startDate = dayjs(filters.startDate);
                    endDate = dayjs(filters.endDate);
                } else {
                    // Fetch the latest available date from ClickHouse
                    const maxDateRes = await queryClickHouse(`
                        SELECT MAX(DATE) as maxDate
                        FROM rb_kw_olap
                        WHERE DATE IS NOT NULL
                    `);
                    const maxDate = maxDateRes[0]?.maxDate;

                    if (maxDate && maxDate !== '0000-00-00' && maxDate !== '1970-01-01') {
                        endDate = dayjs(maxDate);
                    } else {
                        endDate = dayjs();
                    }

                    const periodToDays = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
                    const days = periodToDays[period] || 30;
                    startDate = endDate.subtract(days, 'day');
                }

                const dateFrom = startDate.format('YYYY-MM-DD');
                const dateTo = endDate.format('YYYY-MM-DD');

                // Determine aggregation based on timeStep
                let dateAggregation;
                let dateFormat;
                const timeStep = filters.timeStep || 'Daily';

                if (timeStep === 'Weekly') {
                    dateAggregation = 'toStartOfWeek(DATE, 1)'; // 1 for Monday
                    dateFormat = "DD MMM'YY";
                } else if (timeStep === 'Monthly') {
                    dateAggregation = 'toStartOfMonth(DATE)';
                    dateFormat = "MMM 'YY";
                } else {
                    // Default to Daily
                    dateAggregation = 'DATE';
                    dateFormat = "DD MMM'YY";
                }


                // 1. Get total volume by date for denominator
                const volumeQuery = `
                SELECT 
                    ${dateAggregation} as crawl_date,
                    sum(toInt32(overall)) as total_overall,
                    sum(toInt32(spons)) as total_spons,
                    sum(toInt32(organic)) as total_organic
                FROM rb_kw_olap
                WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND ${platformCondition}
                  AND ${locationCondition}
                  AND ${formatCondition}
                  AND ${keywordCondition}
                  AND ${keywordTypeCondition}
                GROUP BY crawl_date
                ORDER BY crawl_date ASC
            `;

                const volumeResults = await queryClickHouse(volumeQuery);
                const volumeByDate = {};
                const allDays = [];
                volumeResults.forEach(row => {
                    const date = dayjs(row.crawl_date);
                    const dateStr = date.format(dateFormat);
                    volumeByDate[dateStr] = {
                        overall: Number(row.total_overall) || 1,
                        spons: Number(row.total_spons) || 1,
                        organic: Number(row.total_organic) || 1
                    };
                    allDays.push(dateStr);
                });

                // 2. Query brand-specific data for all selected brands at once
                const brandDataQuery = `
                SELECT 
                    ${dimColumn} as brand_name,
                    ${dateAggregation} as crawl_date,
                    sum(toInt32(overall)) as brand_volume,
                    sum(toInt32(spons)) as sponsored_volume,
                    sum(toInt32(organic)) as organic_volume,
                    sum(toInt32(spons)) as display_volume
                FROM rb_kw_olap
                WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND ${platformCondition}
                   AND ${locationCondition}
                   AND ${formatCondition}
                   AND ${keywordCondition}
                   AND ${brandsCondition}
                GROUP BY brand_name, crawl_date
                ORDER BY crawl_date ASC
            `;

                const brandResults = await queryClickHouse(brandDataQuery);

                // Group results by brand
                const brandDataMap = {};
                brandResults.forEach(row => {
                    if (!brandDataMap[row.brand_name]) brandDataMap[row.brand_name] = {};
                    const date = dayjs(row.crawl_date);
                    const dateStr = date.format(dateFormat);
                    brandDataMap[row.brand_name][dateStr] = {
                        brand_volume: Number(row.brand_volume) || 0,
                        sponsored_volume: Number(row.sponsored_volume) || 0,
                        organic_volume: Number(row.organic_volume) || 0,
                        display_volume: Number(row.display_volume) || 0
                    };
                });

                const brandsResult = {};
                selectedBrands.forEach((brandName, index) => {
                    const brandHistory = brandDataMap[brandName] || {};
                    const timeSeries = allDays.map(dateStr => {
                        const totalVol = volumeByDate[dateStr] || { overall: 1, spons: 1, organic: 1 };
                        const data = brandHistory[dateStr] || { brand_volume: 0, sponsored_volume: 0, organic_volume: 0, display_volume: 0 };
                        return {
                            date: dateStr,
                            overall_sos: Number(((data.brand_volume / totalVol.overall) * 100).toFixed(2)),
                            sponsored_sos: Number(((data.sponsored_volume / totalVol.spons) * 100).toFixed(2)),
                            organic_sos: Number(((data.organic_volume / totalVol.organic) * 100).toFixed(2)),
                            display_sos: Number(((data.display_volume / totalVol.spons) * 100).toFixed(2))
                        };
                    });

                    brandsResult[brandName] = {
                        color: BRAND_COLORS[index % BRAND_COLORS.length],
                        timeSeries
                    };
                });

                console.log('[VisibilityService] Returning trends for', Object.keys(brandsResult).length, 'brands');
                return {
                    brands: brandsResult,
                    days: allDays
                };
            } catch (error) {
                console.error('[VisibilityService] Error getting brand comparison trends (ClickHouse):', error);
                return { brands: {}, days: [] };
            }
        }, CACHE_TTL.ONE_HOUR);
    }

    /**
     * Get dynamic categories specifically for Visibility Analysis using keyword_category
     */
    async getVisibilityCategories(platform) {
        try {
            let conds = [`keyword_category IS NOT NULL`, `keyword_category != ''`];
            const platformCond = buildCHCondition(platform, 'platform_name');
            if (platformCond !== '1=1') {
                conds.push(platformCond);
            }

            const query = `
                SELECT DISTINCT keyword_category as category 
                FROM rb_kw_olap 
                WHERE ${conds.join(' AND ')} 
                ORDER BY category ASC
            `;

            const results = await queryClickHouse(query);
            return results.map(r => r.category).filter(Boolean);
        } catch (error) {
            console.error('[VisibilityService] Error getting categories:', error);
            return ["Chocolates (Gifting)", "Chocolates (Non Gifting)", "GMFC"];
        }
    }

    /**
     * Get dynamic keywords specifically for Visibility Analysis
     */
    async getVisibilityKeywords(platform, category, brand) {
        try {
            let conds = [`keyword IS NOT NULL`, `keyword != ''`];

            const platformCond = buildCHCondition(platform, 'platform_name');
            if (platformCond !== '1=1') conds.push(platformCond);

            const categoryCond = buildCHCondition(category, 'keyword_category', { isCategory: true });
            if (categoryCond !== '1=1') conds.push(categoryCond);

            if (brand && brand !== 'All') {
                const brandArr = Array.isArray(brand) ? brand : brand.split(',').map(b => b.trim()).filter(Boolean);
                conds.push(`brand IN (${brandArr.map(b => `'${escapeCH(b)}'`).join(',')})`);
            }

            const query = `
                SELECT DISTINCT keyword 
                FROM rb_kw_olap 
                WHERE ${conds.join(' AND ')} 
                ORDER BY keyword ASC
            `;

            const results = await queryClickHouse(query);
            return results.map(k => k.keyword).filter(Boolean);
        } catch (error) {
            console.error('[VisibilityService] Error getting keywords:', error);
            return [];
        }
    }

    /**
     * Get dynamic keyword types specifically for Visibility Analysis
     * Fetches distinct keyword_type values from rb_kw_olap table
     */
    async getVisibilityKeywordTypes(platform) {
        try {
            let conds = [`keyword_type IS NOT NULL`, `keyword_type != ''`];

            if (platform && platform !== 'All') {
                const platformArr = Array.isArray(platform) ? platform : platform.split(',').map(p => p.trim()).filter(Boolean);
                conds.push(`platform_name IN (${platformArr.map(p => `'${escapeCH(p)}'`).join(',')})`);
            }

            const query = `
                SELECT DISTINCT keyword_type 
                FROM rb_kw_olap 
                WHERE ${conds.join(' AND ')} 
                ORDER BY keyword_type ASC
            `;

            const results = await queryClickHouse(query);
            return results.map(k => k.keyword_type).filter(Boolean);
        } catch (error) {
            console.error('[VisibilityService] Error getting keyword types:', error);
            return [];
        }
    }

    /**
     * Get SKU-level Visibility Drilldown for a specific keyword
     */
    async getSkuDrilldown(filters) {
        const { keyword, platform, keywordType, category, brand } = filters;
        let { startDate, endDate } = filters;
        
        console.log(`[VisibilityService] getSkuDrilldown called for keyword: "${keyword}"`, { startDate, endDate });

        // If dates not provided, fetch latest available date from DB
        if (!startDate || !endDate) {
            const maxDateRes = await queryClickHouse(`SELECT MAX(DATE) as maxDate FROM rb_kw_olap WHERE DATE IS NOT NULL`);
            const maxDate = maxDateRes[0]?.maxDate;
            if (!maxDate || maxDate === '0000-00-00') return { skus: [] };
            startDate = startDate || maxDate;
            endDate = endDate || maxDate;
        }

        // First, get the total impressions for this keyword in the period to use as denominator
        const totalImpressionsQuery = `
            SELECT 
                sum(toInt32(overall)) as total_overall,
                sum(toInt32(spons)) as total_spons,
                sum(toInt32(organic)) as total_organic
            FROM rb_kw_olap
            WHERE lower(keyword) = lower({kw:String})
            AND DATE BETWEEN {sd:String} AND {ed:String}
        `;
        const totalRes = await queryClickHouse(totalImpressionsQuery, { kw: keyword, sd: startDate, ed: endDate });
        const totalOverall = Number(totalRes[0]?.total_overall) || 1;
        const totalSpons = Number(totalRes[0]?.total_spons) || 1;
        const totalOrganic = Number(totalRes[0]?.total_organic) || 1;

        let query = `
            SELECT 
                keyword_search_product AS skuName,
                brand AS brand,
                ROUND(sum(toInt32(overall)) * 100.0 / ${totalOverall}, 2) AS overallSos,
                ROUND(sum(toInt32(spons)) * 100.0 / ${totalSpons}, 2) AS paidSos,
                ROUND(sum(toInt32(organic)) * 100.0 / ${totalOrganic}, 2) AS organicSos
            FROM rb_kw_olap
            WHERE lower(keyword) = lower({kw:String})
            AND DATE BETWEEN {sd:String} AND {ed:String}
        `;

        const params = { kw: keyword, sd: startDate, ed: endDate };

        if (platform && platform !== 'All') {
            query += " AND lower(platform_name) = lower({plt:String})";
            params.plt = platform;
        }

        if (brand && brand !== 'All') {
            query += " AND lower(brand) = lower({brd:String})";
            params.brd = brand;
        }

        query += " GROUP BY skuName, brand ORDER BY overallSos DESC LIMIT 50";

        try {
            const skus = await queryClickHouse(query, params);
            console.log(`[VisibilityService] getSkuDrilldown returned ${skus.length} SKUs`);
            return { skus };
        } catch (error) {
            console.error('[VisibilityService] Error getting SKU drilldown:', error);
            throw error;
        }
    }

    /**
     * Get City-level Visibility Drilldown for a specific SKU and keyword
     */
    async getCityDrilldown(filters) {
        const { keyword, sku, platform, brand } = filters;
        let { startDate, endDate } = filters;
        
        console.log(`[VisibilityService] getCityDrilldown called for SKU: "${sku}" at Keyword: "${keyword}"`, { startDate, endDate });

        // If dates not provided, fetch latest available date from DB
        if (!startDate || !endDate) {
            const maxDateRes = await queryClickHouse(`SELECT MAX(DATE) as maxDate FROM rb_kw_olap WHERE DATE IS NOT NULL`);
            const maxDate = maxDateRes[0]?.maxDate;
            if (!maxDate || maxDate === '0000-00-00') return { cities: [] };
            startDate = startDate || maxDate;
            endDate = endDate || maxDate;
        }

        // Denominator logic: Total impressions for the keyword in EACH city.
        let query = `
            WITH city_totals AS (
                SELECT 
                    location_name,
                    sum(toInt32(overall)) as city_total_overall,
                    sum(toInt32(spons)) as city_total_spons,
                    sum(toInt32(organic)) as city_total_organic
                FROM rb_kw_olap
                WHERE lower(keyword) = lower({kw:String})
                AND DATE BETWEEN {sd:String} AND {ed:String}
                GROUP BY location_name
            )
            SELECT 
                t.location_name AS city,
                ROUND(sum(toInt32(t.overall)) * 100.0 / nullIf(ct.city_total_overall, 0), 2) AS overallSos,
                ROUND(sum(toInt32(t.spons)) * 100.0 / nullIf(ct.city_total_spons, 0), 2) AS paidSos,
                ROUND(sum(toInt32(t.organic)) * 100.0 / nullIf(ct.city_total_organic, 0), 2) AS organicSos,
                ROUND(avgIf(t.POSITION, toInt32(t.overall) = 1), 1) AS overallRank,
                ROUND(avgIf(t.POSITION, toInt32(t.spons) = 1), 1) AS paidRank,
                ROUND(avgIf(t.POSITION, toInt32(t.organic) = 1), 1) AS organicRank
            FROM rb_kw_olap t
            LEFT JOIN city_totals ct ON t.location_name = ct.location_name
            WHERE lower(t.keyword) = lower({kw:String})
            AND lower(t.keyword_search_product) = lower({sku:String})
            AND t.DATE BETWEEN {sd:String} AND {ed:String}
        `;

        const params = { kw: keyword, sku: sku, sd: startDate, ed: endDate };

        if (platform && platform !== 'All') {
            query += " AND lower(t.platform_name) = lower({plt:String})";
            params.plt = platform;
        }

        query += " GROUP BY city, ct.city_total_overall, ct.city_total_spons, ct.city_total_organic ORDER BY overallSos DESC LIMIT 50";

        try {
            const cities = await queryClickHouse(query, params);
            console.log(`[VisibilityService] getCityDrilldown returned ${cities.length} cities`);
            return { cities };
        } catch (error) {
            console.error('[VisibilityService] Error getting City drilldown:', error);
            throw error;
        }
    }
}

export default new VisibilityService();
