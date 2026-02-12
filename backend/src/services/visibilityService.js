import dayjs from 'dayjs';
import { queryClickHouse } from '../config/clickhouse.js';
import { getCachedOrCompute, generateCacheKey, CACHE_TTL } from '../utils/cacheHelper.js';

const escapeCH = (str) => str ? str.replace(/'/g, "''") : '';

function buildCHCondition(value, column, options = {}) {
    const { isBrand = false } = options;
    if (isBrand && (!value || value === 'All' || value === 'All India')) return "toString(keyword_is_rb_product) = '1'";
    if (!value || value === 'All' || value === 'All India') return "1=1";
    const list = typeof value === 'string'
        ? value.split(',').map(v => v.trim()).filter(v => v && v !== 'All' && v !== 'All India')
        : Array.isArray(value) ? value.filter(v => v && v !== 'All' && v !== 'All India') : [value];
    if (list.length === 0) return isBrand ? "toString(keyword_is_rb_product) = '1'" : "1=1";
    return `${column} IN (${list.map(v => `'${escapeCH(v)}'`).join(', ')})`;
}

async function calculateAllSOS(dateFrom, dateTo, platform = null, brand = null, location = null) {
    try {
        const platformCondition = buildCHCondition(platform, 'platform_name');
        const locationCondition = buildCHCondition(location, 'location_name');
        const brandSOSCondition = buildCHCondition(brand, 'brand_name', { isBrand: true });

        // Single query that calculates ALL SOS types at once - ClickHouse syntax
        const query = `
            SELECT 
                ROUND(countIf(${brandSOSCondition}) * 100.0 / nullIf(count(), 0), 2) AS overall_sos,
                ROUND(countIf(${brandSOSCondition} AND toString(spons_flag) = '1') * 100.0 / nullIf(count(), 0), 2) AS sponsored_sos,
                ROUND(countIf(${brandSOSCondition} AND toString(spons_flag) != '1') * 100.0 / nullIf(count(), 0), 2) AS organic_sos
            FROM rb_kw
            WHERE toDate(created_on) BETWEEN '${dateFrom}' AND '${dateTo}'
              AND keyword_search_rank < 11
              AND ${platformCondition}
              AND ${locationCondition}
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
async function getAllSOSTrends(days = 7, platform = null, brand = null, location = null, customStartDate = null, customEndDate = null) {
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
        const brandSOSCondition = buildCHCondition(brand, 'brand_name', { isBrand: true });

        const query = `
            SELECT 
                toDate(created_on) as crawl_date,
                ROUND(countIf(${brandSOSCondition}) * 100.0 / nullIf(count(), 0), 2) AS overall_sos,
                ROUND(countIf(${brandSOSCondition} AND toString(spons_flag) = '1') * 100.0 / nullIf(count(), 0), 2) AS sponsored_sos,
                ROUND(countIf(${brandSOSCondition} AND toString(spons_flag) != '1') * 100.0 / nullIf(count(), 0), 2) AS organic_sos
            FROM rb_kw
            WHERE toDate(created_on) BETWEEN '${dateFrom}' AND '${dateTo}'
              AND keyword_search_rank < 11
              AND ${platformCondition}
              AND ${locationCondition}
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
        console.log('[VisibilityService] Using filters:', { platform: filters.platform, startDate: filters.startDate, endDate: filters.endDate });

        // OPTIMIZED: Only 3 database queries instead of 9
        // 1. Current period SOS (all 3 types in 1 query)
        // 2. Previous period SOS (all 3 types in 1 query)
        // 3. Sparkline trends (all 3 types in 1 query)
        // OPTIMIZED: Only 3 database queries instead of 9
        // Fetch trend data for the SELECTED range to display weekly points
        const [currentSOS, prevSOS, trends] = await Promise.all([
            calculateAllSOS(dateRanges.current.start, dateRanges.current.end, platform, filters.brand, filters.location),
            calculateAllSOS(dateRanges.previous.start, dateRanges.previous.end, platform, filters.brand, filters.location),
            getAllSOSTrends(null, platform, filters.brand, filters.location, dateRanges.current.start, dateRanges.current.end)
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

        console.log('[VisibilityService] Optimized query results:', { currentSOS, prevSOS, trendsReceived: !!trends });

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
                },
                {
                    title: "Display SOS",
                    value: "Coming Soon...",
                    sub: "Share of shelf from display-led visibility",
                    change: "",
                    changeColor: "gray",
                    prevText: "",
                    extra: "",
                    extraChange: "",
                    extraChangeColor: "gray",
                    isComingSoon: true,
                },
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
        {
            title: "Display SOS",
            value: "Coming Soon...",
            sub: "Share of shelf from display-led visibility",
            change: "",
            changeColor: "gray",
            prevText: "",
            extra: "",
            extraChange: "",
            extraChangeColor: "gray",
            isComingSoon: true,
        },
    ]
});

// Mock data for Platform KPI Matrix (matching current frontend static data)
const getPlatformKpiMatrixMockData = () => ({
    platformData: {
        columns: ["kpi", "Blinkit", "Zepto", "Instamart", "BigBasket"],
        rows: [
            { kpi: "Overall SOS", Blinkit: 19.6, Zepto: 18.2, Instamart: 21.1, BigBasket: 17.8, trend: { Blinkit: 0.5, Zepto: -0.3, Instamart: 1.2, BigBasket: -0.8 }, series: { Blinkit: [18.2, 18.8, 19.1, 19.6], Zepto: [18.5, 18.3, 18.4, 18.2], Instamart: [19.8, 20.2, 20.6, 21.1], BigBasket: [18.6, 18.2, 18.0, 17.8] } },
            { kpi: "Sponsored SOS", Blinkit: 17.6, Zepto: 16.8, Instamart: 18.9, BigBasket: 15.2, trend: { Blinkit: -0.2, Zepto: 0.4, Instamart: 0.8, BigBasket: -1.1 }, series: { Blinkit: [17.8, 17.7, 17.6, 17.6], Zepto: [16.4, 16.5, 16.7, 16.8], Instamart: [18.1, 18.4, 18.6, 18.9], BigBasket: [16.3, 15.8, 15.5, 15.2] } },
            { kpi: "Organic SOS", Blinkit: 20.7, Zepto: 19.5, Instamart: 22.3, BigBasket: 18.9, trend: { Blinkit: 1.2, Zepto: 0.8, Instamart: 1.5, BigBasket: 0.3 }, series: { Blinkit: [19.5, 20.0, 20.4, 20.7], Zepto: [18.7, 19.0, 19.2, 19.5], Instamart: [20.8, 21.4, 21.9, 22.3], BigBasket: [18.6, 18.7, 18.8, 18.9] } },
            { kpi: "Display SOS", Blinkit: 26.9, Zepto: 25.4, Instamart: 28.2, BigBasket: 24.1, trend: { Blinkit: 0.8, Zepto: -0.5, Instamart: 1.0, BigBasket: -0.2 }, series: { Blinkit: [26.1, 26.4, 26.7, 26.9], Zepto: [25.9, 25.7, 25.5, 25.4], Instamart: [27.2, 27.6, 27.9, 28.2], BigBasket: [24.3, 24.2, 24.1, 24.1] } }
        ]
    },
    formatData: {
        columns: ["kpi", "Quick Commerce", "E-Commerce", "Hyperlocal"],
        rows: [
            { kpi: "Overall SOS", "Quick Commerce": 20.2, "E-Commerce": 18.5, "Hyperlocal": 19.1, trend: { "Quick Commerce": 0.6, "E-Commerce": -0.2, "Hyperlocal": 0.4 }, series: { "Quick Commerce": [19.6, 19.8, 20.0, 20.2], "E-Commerce": [18.7, 18.6, 18.5, 18.5], "Hyperlocal": [18.7, 18.9, 19.0, 19.1] } },
            { kpi: "Sponsored SOS", "Quick Commerce": 18.1, "E-Commerce": 16.5, "Hyperlocal": 17.2, trend: { "Quick Commerce": 0.3, "E-Commerce": -0.4, "Hyperlocal": 0.1 }, series: { "Quick Commerce": [17.8, 17.9, 18.0, 18.1], "E-Commerce": [16.9, 16.7, 16.6, 16.5], "Hyperlocal": [17.1, 17.1, 17.2, 17.2] } },
            { kpi: "Organic SOS", "Quick Commerce": 21.4, "E-Commerce": 19.8, "Hyperlocal": 20.5, trend: { "Quick Commerce": 1.0, "E-Commerce": 0.5, "Hyperlocal": 0.7 }, series: { "Quick Commerce": [20.4, 20.8, 21.1, 21.4], "E-Commerce": [19.3, 19.5, 19.6, 19.8], "Hyperlocal": [19.8, 20.1, 20.3, 20.5] } },
            { kpi: "Display SOS", "Quick Commerce": 27.5, "E-Commerce": 25.2, "Hyperlocal": 26.3, trend: { "Quick Commerce": 0.9, "E-Commerce": 0.2, "Hyperlocal": 0.5 }, series: { "Quick Commerce": [26.6, 26.9, 27.2, 27.5], "E-Commerce": [25.0, 25.1, 25.1, 25.2], "Hyperlocal": [25.8, 26.0, 26.1, 26.3] } }
        ]
    },
    cityData: {
        columns: ["kpi", "Delhi NCR", "Mumbai", "Bangalore", "Hyderabad", "Chennai"],
        rows: [
            { kpi: "Overall SOS", "Delhi NCR": 21.2, "Mumbai": 19.8, "Bangalore": 20.5, "Hyderabad": 18.9, "Chennai": 18.1, trend: { "Delhi NCR": 0.8, "Mumbai": 0.4, "Bangalore": 0.6, "Hyderabad": 0.2, "Chennai": -0.1 }, series: { "Delhi NCR": [20.4, 20.7, 21.0, 21.2], "Mumbai": [19.4, 19.6, 19.7, 19.8], "Bangalore": [19.9, 20.1, 20.3, 20.5], "Hyderabad": [18.7, 18.8, 18.9, 18.9], "Chennai": [18.2, 18.2, 18.1, 18.1] } },
            { kpi: "Sponsored SOS", "Delhi NCR": 18.5, "Mumbai": 17.2, "Bangalore": 17.9, "Hyderabad": 16.5, "Chennai": 15.8, trend: { "Delhi NCR": 0.5, "Mumbai": 0.2, "Bangalore": 0.4, "Hyderabad": -0.1, "Chennai": -0.3 }, series: { "Delhi NCR": [18.0, 18.2, 18.4, 18.5], "Mumbai": [17.0, 17.1, 17.1, 17.2], "Bangalore": [17.5, 17.7, 17.8, 17.9], "Hyderabad": [16.6, 16.5, 16.5, 16.5], "Chennai": [16.1, 16.0, 15.9, 15.8] } },
            { kpi: "Organic SOS", "Delhi NCR": 22.6, "Mumbai": 21.2, "Bangalore": 21.9, "Hyderabad": 20.1, "Chennai": 19.5, trend: { "Delhi NCR": 1.1, "Mumbai": 0.8, "Bangalore": 0.9, "Hyderabad": 0.5, "Chennai": 0.3 }, series: { "Delhi NCR": [21.5, 21.9, 22.3, 22.6], "Mumbai": [20.4, 20.7, 20.9, 21.2], "Bangalore": [21.0, 21.3, 21.6, 21.9], "Hyderabad": [19.6, 19.8, 20.0, 20.1], "Chennai": [19.2, 19.3, 19.4, 19.5] } },
            { kpi: "Display SOS", "Delhi NCR": 28.4, "Mumbai": 26.8, "Bangalore": 27.5, "Hyderabad": 25.6, "Chennai": 24.9, trend: { "Delhi NCR": 1.0, "Mumbai": 0.6, "Bangalore": 0.8, "Hyderabad": 0.3, "Chennai": 0.1 }, series: { "Delhi NCR": [27.4, 27.8, 28.1, 28.4], "Mumbai": [26.2, 26.4, 26.6, 26.8], "Bangalore": [26.7, 27.0, 27.3, 27.5], "Hyderabad": [25.3, 25.4, 25.5, 25.6], "Chennai": [24.8, 24.8, 24.9, 24.9] } }
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
                BigBasket: { overallSos: 0.8, adSos: 0.6, orgSos: 1.0, catImpShare: 65.1 },
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
     * Fetches real data from rb_kw table
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

                // Base WHERE clause
                let baseWhere = `toDate(created_on) BETWEEN '${startDate}' AND '${endDate}' AND keyword_search_rank < 11`;

                // Apply platform filter if provided
                if (filters.platform && filters.platform !== 'All') {
                    const platCond = buildCHCondition(filters.platform, 'platform_name');
                    baseWhere += ` AND ${platCond}`;
                }

                // Apply location filter if provided
                if (filters.location && filters.location !== 'All') {
                    const locCond = buildCHCondition(filters.location, 'location_name');
                    baseWhere += ` AND ${locCond}`;
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
                const brandSOSCondition = buildCHCondition(filters.brand, 'brand_name', { isBrand: true });

                // Date ranges for trend calculation (Current vs Previous)
                const start = dayjs(startDate);
                const end = dayjs(endDate);
                const durationDays = end.diff(start, 'day') + 1;
                const prevStart = start.subtract(durationDays, 'day').format('YYYY-MM-DD');
                const prevEnd = start.subtract(1, 'day').format('YYYY-MM-DD');

                // Base WHERE for previous period
                let prevBaseWhere = `toDate(created_on) BETWEEN '${prevStart}' AND '${prevEnd}' AND keyword_search_rank < 11`;
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
                    let currentWhere = `toDate(created_on) BETWEEN '${startDate}' AND '${endDate}' AND keyword_search_rank < 11`;
                    let prevWhere = `toDate(created_on) BETWEEN '${prevStart}' AND '${prevEnd}' AND keyword_search_rank < 11`;

                    // Helper to add condition if not excluded
                    const addCond = (val, col, exclusionKeys) => {
                        if (val && val !== 'All' && !exclusionKeys.includes(col)) {
                            const cond = buildCHCondition(val, col);
                            currentWhere += ` AND ${cond}`;
                            prevWhere += ` AND ${cond}`;
                        }
                    };

                    addCond(filters.platform, 'platform_name', filtersToExclude);
                    addCond(filters.location, 'location_name', filtersToExclude);
                    // Add format/category if present in global filters (Visibility global filter often has categories/formats)
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
                            ROUND(countIf(${brandSOSCondition}) * 100.0 / nullIf(count(), 0), 1) AS overall_sos,
                            ROUND(countIf(${brandSOSCondition} AND toString(spons_flag) = '1') * 100.0 / nullIf(count(), 0), 1) AS sponsored_sos,
                            ROUND(countIf(${brandSOSCondition} AND toString(spons_flag) != '1') * 100.0 / nullIf(count(), 0), 1) AS organic_sos,
                            ROUND(countIf(${brandSOSCondition} AND (toDate(created_on) < '2025-01-01' OR spons_flag = '1')) * 100.0 / nullIf(count(), 0), 1) AS display_sos
                        FROM rb_kw
                        WHERE ${currentWhere} AND ${dimColumn} IS NOT NULL AND ${dimColumn} != ''
                        GROUP BY ${dimColumn}
                        ORDER BY count() DESC
                        LIMIT 15
                    `;

                    const previous = `
                        SELECT 
                            ${dimColumn} as ${dimAlias},
                            ROUND(countIf(${brandSOSCondition}) * 100.0 / nullIf(count(), 0), 1) AS overall_sos,
                            ROUND(countIf(${brandSOSCondition} AND toString(spons_flag) = '1') * 100.0 / nullIf(count(), 0), 1) AS sponsored_sos,
                            ROUND(countIf(${brandSOSCondition} AND toString(spons_flag) != '1') * 100.0 / nullIf(count(), 0), 1) AS organic_sos,
                            ROUND(countIf(${brandSOSCondition} AND (toDate(created_on) < '2025-01-01' OR spons_flag = '1')) * 100.0 / nullIf(count(), 0), 1) AS display_sos
                        FROM rb_kw
                        WHERE ${prevWhere} AND ${dimColumn} IS NOT NULL AND ${dimColumn} != ''
                        GROUP BY ${dimColumn}
                    `;

                    const sparkline = `
                        SELECT 
                            ${dimColumn} as ${dimAlias},
                            toDate(created_on) as date,
                            ROUND(countIf(${brandSOSCondition}) * 100.0 / nullIf(count(), 0), 1) AS overall_sos,
                            ROUND(countIf(${brandSOSCondition} AND toString(spons_flag) = '1') * 100.0 / nullIf(count(), 0), 1) AS sponsored_sos,
                            ROUND(countIf(${brandSOSCondition} AND toString(spons_flag) != '1') * 100.0 / nullIf(count(), 0), 1) AS organic_sos,
                            ROUND(countIf(${brandSOSCondition} AND (toDate(created_on) < '2025-01-01' OR spons_flag = '1')) * 100.0 / nullIf(count(), 0), 1) AS display_sos
                        FROM rb_kw
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
                    const kpis = ['Overall SOS', 'Sponsored SOS', 'Organic SOS', 'Display SOS'];
                    const columns = ['kpi', ...current.map(r => r.name)];

                    const prevMap = {};
                    previous.forEach(p => { prevMap[p.name] = p; });

                    const sparkMap = {};
                    sparklines.forEach(s => {
                        if (!sparkMap[s.name]) {
                            sparkMap[s.name] = { overall: [], sponsored: [], organic: [], display: [] };
                        }
                        sparkMap[s.name].overall.push(Number(s.overall_sos) || 0);
                        sparkMap[s.name].sponsored.push(Number(s.sponsored_sos) || 0);
                        sparkMap[s.name].organic.push(Number(s.organic_sos) || 0);
                        sparkMap[s.name].display.push(Number(s.display_sos) || 0);
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
                            } else if (kpi === 'Display SOS') {
                                val = Number(curr.display_sos) || 0;
                                prevVal = Number(prevMap[name]?.display_sos) || 0;
                                sparkKey = 'display';
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
     * Fetches real data from rb_kw table with hierarchy:
     * Keyword Type → Keyword → Brand → SKU → City
     */
    async getKeywordsAtGlance(filters) {
        console.log('[VisibilityService] getKeywordsAtGlance called with filters:', filters);
        const cacheKey = generateCacheKey('visibility_keywords_at_glance', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                // Build WHERE clause based on filters
                let whereConditions = ["keyword_type IS NOT NULL AND keyword_type != ''"];
                const replacements = {};

                if (filters.platform && filters.platform !== 'All') {
                    const platCond = buildCHCondition(filters.platform, 'platform_name');
                    whereConditions.push(platCond);
                }
                if (filters.keyword && filters.keyword !== 'All') {
                    whereConditions.push(`LOWER(keyword) LIKE LOWER('%${escapeCH(filters.keyword)}%')`);
                }
                if (filters.location && filters.location !== 'All') {
                    const locCond = buildCHCondition(filters.location, 'location_name');
                    whereConditions.push(locCond);
                }
                if (filters.startDate && filters.endDate) {
                    whereConditions.push(`toDate(created_on) BETWEEN '${filters.startDate}' AND '${filters.endDate}'`);
                } else {
                    // Default to latest date using subquery for precision
                    whereConditions.push("toDate(created_on) = (SELECT MAX(toDate(created_on)) FROM rb_kw)");
                }
                whereConditions.push("keyword_search_rank < 11");

                const sosBrandCondition = buildCHCondition(filters.brand, 'brand_name', { isBrand: true });

                // If a specific brand is selected, we filter the results BY that brand(s)
                if (filters.brand && filters.brand !== 'All') {
                    whereConditions.push(sosBrandCondition);
                }

                const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

                // Stage 1: Fast fetch of top keywords per type - ClickHouse
                const topKeywordsQuery = `
                    SELECT keyword, keyword_type, rb_results
                    FROM (
                        SELECT 
                            keyword, 
                            keyword_type, 
                            count() as row_count,
                            countIf(${sosBrandCondition}) as rb_results,
                            ROW_NUMBER() OVER(PARTITION BY keyword_type ORDER BY countIf(${sosBrandCondition}) DESC, count() DESC) as rnk
                        FROM rb_kw
                        ${whereClause}
                        GROUP BY keyword, keyword_type
                    ) t
                    WHERE rnk <= 15
                    ${filters.brand && filters.brand !== 'All' ? 'AND rb_results > 0' : ''}
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
                        brand_name, 
                        keyword_search_product as sku, 
                        location_name as city, 
                        platform_name,
                        count() as total,
                        countIf(${sosBrandCondition}) as rbr,
                        countIf(toString(spons_flag) = '1' AND ${sosBrandCondition}) as rbs,
                        countIf(toString(spons_flag) != '1' AND ${sosBrandCondition}) as rbo,
                        avgIf(toFloat64(keyword_search_rank), toString(spons_flag) = '1' AND ${sosBrandCondition} AND toFloat64(keyword_search_rank) > 0) as aap,
                        avgIf(toFloat64(keyword_search_rank), toString(spons_flag) != '1' AND ${sosBrandCondition} AND toFloat64(keyword_search_rank) > 0) as aop
                    FROM rb_kw
                    ${whereClause}
                    ${keywordCondition}
                    GROUP BY keyword_type, keyword, brand_name, sku, city, platform_name
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
                        rbr,
                        rbs,
                        rbo,
                        aap,
                        aop
                    } = row;

                    if (!kt || !kw || !brand || !sku || !city) return;

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
                            metrics: { rb: 0, total: 0, rbs: 0, rbo: 0, aap: [], aop: [] }
                        });
                    }
                    const kwNode = ktNode.children.get(kw);

                    if (!kwNode.children.has(brand)) {
                        kwNode.children.set(brand, {
                            id: `${kt}-${kw}-${brand}`.toLowerCase().replace(/\s+/g, '-'),
                            label: brand, level: 'brand',
                            children: new Map(),
                            metrics: { rb: 0, total: 0, rbs: 0, rbo: 0, aap: [], aop: [] }
                        });
                    }
                    const brandNode = kwNode.children.get(brand);

                    if (!brandNode.children.has(sku)) {
                        brandNode.children.set(sku, {
                            id: `${kt}-${kw}-${brand}-${sku}`.toLowerCase().replace(/\s+/g, '-'),
                            label: sku, level: 'sku',
                            children: new Map(),
                            metrics: { rb: 0, total: 0, rbs: 0, rbo: 0, aap: [], aop: [] }
                        });
                    }
                    const skuNode = brandNode.children.get(sku);

                    if (!skuNode.children.has(city)) {
                        skuNode.children.set(city, {
                            id: `${kt}-${kw}-${brand}-${sku}-${city}`.toLowerCase().replace(/\s+/g, '-'),
                            label: city, level: 'city',
                            children: [],
                            metrics: { rb: 0, total: 0, rbs: 0, rbo: 0, aap: [], aop: [] }
                        });
                    }
                    const cityNode = skuNode.children.get(city);

                    // Update metrics for all levels in the path
                    [ktNode, kwNode, brandNode, skuNode, cityNode].forEach(node => {
                        node.metrics.rb += Number(rbr || 0);
                        node.metrics.total += Number(total || 0);
                        node.metrics.rbs += Number(rbs || 0);
                        node.metrics.rbo += Number(rbo || 0);
                        if (aap !== null && aap !== undefined) node.metrics.aap.push(Number(aap));
                        if (aop !== null && aop !== undefined) node.metrics.aop.push(Number(aop));
                    });
                });

                // Post-process to calculate final percentages and convert Maps to arrays
                const finalizeNode = (node) => {
                    const total = node.metrics.total || 1;
                    const finalMetrics = {
                        catImpShare: Number(((node.metrics.rb / total) * 100).toFixed(2)),
                        overallSos: Number(((node.metrics.rb / total) * 100).toFixed(2)),
                        adSos: Number(((node.metrics.rbs / total) * 100).toFixed(2)),
                        orgSos: Number(((node.metrics.rbo / total) * 100).toFixed(2)),
                        adPos: node.metrics.aap.length > 0 ? Number((node.metrics.aap.reduce((a, b) => a + b, 0) / node.metrics.aap.length).toFixed(1)) : 0,
                        orgPos: node.metrics.aop.length > 0 ? Number((node.metrics.aop.reduce((a, b) => a + b, 0) / node.metrics.aop.length).toFixed(1)) : 0,
                    };
                    node.metrics = finalMetrics;

                    if (node.children instanceof Map) {
                        const childrenArray = Array.from(node.children.values());
                        node.children = childrenArray.map(finalizeNode).sort((a, b) => b.metrics.overallSos - a.metrics.overallSos);
                    }
                    return node;
                };

                const hierarchy = Array.from(typeMap.values()).map(finalizeNode);

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
        const cacheKey = generateCacheKey('visibility_top_search_terms', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                const platform = filters.platform || 'All';
                const location = filters.location || 'All';
                const brand = filters.brand || 'All';

                const platformCondition = buildCHCondition(platform, 'platform_name');
                const locationCondition = buildCHCondition(location, 'location_name');
                const brandSOSCondition = buildCHCondition(brand, 'brand_name', { isBrand: true });

                // 1. Get latest date
                const maxDateRes = await queryClickHouse(`
                    SELECT MAX(toDate(created_on)) as maxDate
                    FROM rb_kw
                    WHERE created_on IS NOT NULL
                `);
                const maxDate = maxDateRes[0]?.maxDate;

                if (!maxDate || maxDate === '0000-00-00') {
                    return { terms: [] };
                }

                let dateCondition = `toDate(created_on) = '${maxDate}'`;
                if (filters.startDate && filters.endDate) {
                    dateCondition = `toDate(created_on) BETWEEN '${dayjs(filters.startDate).format('YYYY-MM-DD')}' AND '${dayjs(filters.endDate).format('YYYY-MM-DD')}'`;
                }
                dateCondition += ` AND keyword_search_rank < 11`;

                // 2. Aggregate metrics for keywords
                const typeFilter = filters.filter && filters.filter !== 'All'
                    ? `AND keyword_type = '${escapeCH(filters.filter)}'`
                    : '';

                const metricsQuery = `
                    SELECT 
                        keyword,
                        MAX(keyword_type) as type,
                        count() as total_results,
                        countIf(${brandSOSCondition}) as rb_results,
                        countIf(${brandSOSCondition} AND toString(spons_flag) != '1') as rb_organic,
                        countIf(${brandSOSCondition} AND toString(spons_flag) = '1') as rb_sponsored,
                        avgIf(toFloat64(keyword_search_rank), toFloat64(keyword_search_rank) > 0) as avg_overall_pos,
                        avgIf(toFloat64(keyword_search_rank), ${brandSOSCondition} AND toString(spons_flag) != '1' AND toFloat64(keyword_search_rank) > 0) as avg_org_pos,
                        avgIf(toFloat64(keyword_search_rank), ${brandSOSCondition} AND toString(spons_flag) = '1' AND toFloat64(keyword_search_rank) > 0) as avg_ad_pos
                    FROM rb_kw
                    WHERE ${dateCondition}
                      AND ${platformCondition}
                      AND ${locationCondition}
                      ${typeFilter}
                    GROUP BY keyword
                    ${brand && brand !== 'All' ? 'HAVING rb_results > 0' : ''}
                    ORDER BY (toFloat64(rb_results) / nullIf(count(), 0)) DESC, total_results DESC
                    LIMIT 50
                `;

                const keywordMetrics = await queryClickHouse(metricsQuery);

                if (keywordMetrics.length === 0) return { terms: [] };

                // 3. Get leading brand for each keyword (the brand with most shelf share)
                const keywordList = keywordMetrics.map(k => `'${escapeCH(k.keyword)}'`).join(',');
                const leadingBrandQuery = `
                    SELECT 
                        keyword,
                        brand_name,
                        count() as brand_count
                    FROM rb_kw
                    WHERE toDate(created_on) = '${maxDate}'
                      AND keyword IN (${keywordList})
                      AND keyword_search_rank < 11
                      AND ${platformCondition}
                      AND ${locationCondition}
                    GROUP BY keyword, brand_name
                    ORDER BY keyword, brand_count DESC
                `;

                const brandResults = await queryClickHouse(leadingBrandQuery);

                // ClickHouse doesn't have a direct ROW_NUMBER equivalent in simple GROUP BY, 
                // so we'll pick the top one per keyword in JS or use argMax
                const brandMap = {};
                brandResults.forEach(r => {
                    if (!brandMap[r.keyword]) {
                        brandMap[r.keyword] = r.brand_name;
                    }
                });

                const terms = keywordMetrics.map(km => {
                    const total = Number(km.total_results) || 1;
                    const rbResults = Number(km.rb_results) || 0;
                    const rbOrganic = Number(km.rb_organic) || 0;
                    const rbSponsored = Number(km.rb_sponsored) || 0;

                    return {
                        keyword: km.keyword,
                        topBrand: brandMap[km.keyword] || 'N/A',
                        overallSos: Number(((rbResults / total) * 100).toFixed(1)),
                        overallPos: Number(Number(km.avg_overall_pos || 0).toFixed(1)),
                        organicSos: Number(((rbOrganic / total) * 100).toFixed(1)),
                        organicPos: Number(Number(km.avg_org_pos || 0).toFixed(1)),
                        paidSos: Number(((rbSponsored / total) * 100).toFixed(1)),
                        paidPos: Number(Number(km.avg_ad_pos || 0).toFixed(1)),
                    };
                });

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
        const cacheKey = generateCacheKey('visibility_brand_drilldown', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                if (!filters.keyword) return { brands: [], topLosers: [] };

                const platform = filters.platform || 'All';
                const location = filters.location || 'All';

                const platformCondition = buildCHCondition(platform, 'platform_name');
                const locationCondition = buildCHCondition(location, 'location_name');
                const keyword = escapeCH(filters.keyword);

                // 1. Get two most recent crawl dates for this keyword
                const dateQuery = `
                    SELECT DISTINCT toDate(created_on) as crawl_date
                    FROM rb_kw
                    WHERE lower(trim(keyword)) = lower(trim('${keyword}'))
                      AND keyword_search_rank < 11
                    ORDER BY crawl_date DESC
                    LIMIT 2
                `;
                const dateResults = await queryClickHouse(dateQuery);

                if (dateResults.length === 0) return { brands: [], topLosers: [] };

                const latestDate = dayjs(dateResults[0].crawl_date).format('YYYY-MM-DD');
                const previousDate = dateResults[1] ? dayjs(dateResults[1].crawl_date).format('YYYY-MM-DD') : latestDate;

                // 2. Fetch metrics for ALL brands for both dates
                const drilldownQuery = `
                    SELECT 
                        brand_name,
                        toDate(created_on) as crawl_date,
                        count() as brand_results,
                        countIf(toString(spons_flag) != '1') as brand_organic,
                        countIf(toString(spons_flag) = '1') as brand_sponsored
                    FROM rb_kw
                    WHERE lower(trim(keyword)) = lower(trim('${keyword}'))
                      AND toDate(created_on) IN ('${latestDate}', '${previousDate}')
                      AND keyword_search_rank < 11
                      AND ${platformCondition}
                      AND ${locationCondition}
                    GROUP BY brand_name, crawl_date
                `;

                const results = await queryClickHouse(drilldownQuery);

                // 3. Get total results per date for SOS normalization
                const totalsQuery = `
                    SELECT toDate(created_on) as crawl_date, count() as total 
                    FROM rb_kw 
                    WHERE lower(trim(keyword)) = lower(trim('${keyword}'))
                      AND toDate(created_on) IN ('${latestDate}', '${previousDate}')
                      AND keyword_search_rank < 11
                      AND ${platformCondition}
                      AND ${locationCondition}
                    GROUP BY crawl_date
                `;

                const totalResults = await queryClickHouse(totalsQuery);
                const totalMap = {};
                totalResults.forEach(t => {
                    totalMap[dayjs(t.crawl_date).format('YYYY-MM-DD')] = Number(t.total);
                });

                // 4. Process results into a map of brands
                const brandData = {};
                results.forEach(row => {
                    const brand = row.brand_name || 'Unknown';
                    const dateStr = dayjs(row.crawl_date).format('YYYY-MM-DD');
                    const total = totalMap[dateStr] || 1;

                    if (!brandData[brand]) {
                        brandData[brand] = {
                            brand,
                            current: { overall: 0, organic: 0, paid: 0 },
                            previous: { overall: 0, organic: 0, paid: 0 }
                        };
                    }

                    const sosOverall = Number(((Number(row.brand_results) / total) * 100).toFixed(1));
                    const sosOrganic = Number(((Number(row.brand_organic) / total) * 100).toFixed(1));
                    const sosPaid = Number(((Number(row.brand_sponsored) / total) * 100).toFixed(1));

                    if (dateStr === latestDate) {
                        brandData[brand].current = { overall: sosOverall, organic: sosOrganic, paid: sosPaid };
                    } else if (dateStr === previousDate) {
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

                // 6. Identify top losers (most negative delta in overall SOS)
                const topLosers = brands
                    .filter(b => b.overallSos.delta < 0)
                    .sort((a, b) => a.overallSos.delta - b.overallSos.delta)
                    .slice(0, 5);

                return { brands, topLosers };
            } catch (error) {
                console.error('[VisibilityService] Error in getBrandDrilldown (ClickHouse):', error);
                return { brands: [], topLosers: [] };
            }
        }, CACHE_TTL.ONE_HOUR);
    }

    /**
     * Get dynamic filter options for visibility analysis cascading filters
     * Uses rb_kw as primary source (main visibility data table)
     * @param {Object} params - { filterType, platform, format, city }
     * @returns {Object} { options: [...] }
     */
    async getVisibilityFilterOptions({ filterType, platform, format, city, brand }) {
        console.log(`[VisibilityService] getVisibilityFilterOptions called: type=${filterType}`);
        const cacheKey = generateCacheKey('visibility_filters', { filterType, platform, format, city, brand });

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                console.log(`[VisibilityService] getVisibilityFilterOptions called: type=${filterType}`);

                // Shared conditions for cascading filters
                const platformFilter = platform || null;
                const formatFilter = format || null;
                const cityFilter = city || null;

                const platformCondition = buildCHCondition(platformFilter, 'platform_name');
                const formatCondition = buildCHCondition(formatFilter, 'keyword_search_product');
                const cityCondition = buildCHCondition(cityFilter, 'location_name');
                const brandCondition = buildCHCondition(brand || null, 'brand_crawl');

                // PLATFORMS: from rb_kw.platform_name
                if (filterType === 'platforms') {
                    const results = await queryClickHouse(`
                    SELECT DISTINCT platform_name as platform
                    FROM rb_kw
                    WHERE platform_name IS NOT NULL AND platform_name != ''
                    ORDER BY platform_name
                `);
                    const options = results.map(r => r.platform).filter(Boolean);
                    return { options };
                }

                // MONTHS: from rb_kw.created_on
                if (filterType === 'months') {
                    const results = await queryClickHouse(`
                    SELECT DISTINCT toStartOfMonth(toDate(created_on)) as date
                    FROM rb_kw
                    WHERE created_on IS NOT NULL
                    ORDER BY date DESC
                    LIMIT 12
                `);
                    const options = results.map(r => dayjs(r.date).format('YYYY-MM-DD')).filter(Boolean);
                    return { options };
                }

                // DATES: from rb_kw.created_on (Active Dates)
                if (filterType === 'dates') {
                    const results = await queryClickHouse(`
                    SELECT DISTINCT toDate(created_on) as date
                    FROM rb_kw
                    WHERE created_on IS NOT NULL
                    ORDER BY date DESC
                    LIMIT 30
                `);
                    const options = results.map(r => dayjs(r.date).format('YYYY-MM-DD')).filter(Boolean);
                    return { options };
                }

                // FORMATS (Category): from rca_sku_dim.category where status = 1
                if (filterType === 'formats') {
                    const results = await queryClickHouse(`
                    SELECT DISTINCT category as format
                    FROM rca_sku_dim
                    WHERE toString(status) = '1' AND category IS NOT NULL AND category != ''
                    ORDER BY category
                `);
                    const options = results.map(r => r.format).filter(Boolean);
                    return { options };
                }

                // Shared WHERE clause for other filters
                const whereConditions = ["1=1"];
                if (platform && platform !== 'All') {
                    whereConditions.push(platformCondition);
                }
                const baseWhere = `WHERE ${whereConditions.join(' AND ')}`;

                // CITIES: from rb_kw.location_name
                if (filterType === 'cities') {
                    let cityWhere = baseWhere;
                    if (format && format !== 'All') {
                        cityWhere += ` AND ${formatCondition}`;
                    }

                    const results = await queryClickHouse(`
                    SELECT DISTINCT location_name as city
                    FROM rb_kw
                    ${cityWhere} AND location_name IS NOT NULL AND location_name != ''
                    ORDER BY location_name
                `);
                    const options = results.map(r => r.city).filter(Boolean);
                    return { options };
                }

                // DATES: from rb_kw.created_on
                if (filterType === 'dates') {
                    const results = await queryClickHouse(`
                    SELECT DISTINCT toDate(created_on) as date
                    FROM rb_kw
                    WHERE created_on IS NOT NULL
                    ORDER BY date DESC
                    LIMIT 60
                `);
                    const options = results.map(r => r.date).filter(Boolean);
                    return { options };
                }

                // ZONES (regions): from rb_location_darkstore.region
                if (filterType === 'zones') {
                    const results = await queryClickHouse(`
                    SELECT DISTINCT region as zone
                    FROM rb_location_darkstore
                    WHERE region IS NOT NULL AND region != ''
                    ORDER BY region
                `);
                    const options = results.map(r => r.zone).filter(Boolean);
                    return { options };
                }

                // METRO FLAGS: from rb_location_darkstore.tier
                if (filterType === 'metroFlags') {
                    const results = await queryClickHouse(`
                    SELECT DISTINCT tier as metroFlag
                    FROM rb_location_darkstore
                    WHERE tier IS NOT NULL AND tier != ''
                    ORDER BY tier
                `);
                    const options = results.map(r => r.metroFlag).filter(Boolean);
                    return { options };
                }

                // PINCODES: from rb_kw.pincode (handle type conversion)
                if (filterType === 'pincodes') {
                    let pinWhere = baseWhere;
                    if (city && city !== 'All') {
                        pinWhere += ` AND ${cityCondition}`;
                    }
                    const results = await queryClickHouse(`
                    SELECT DISTINCT toString(pincode) as pincode_str
                    FROM rb_kw
                    ${pinWhere} AND pincode IS NOT NULL AND toString(pincode) != '' AND toString(pincode) != '0'
                    ORDER BY pincode_str
                    LIMIT 500
                `);
                    const options = results.map(r => r.pincode_str).filter(Boolean);
                    return { options };
                }


                // PRODUCT NAMES: from rb_kw.keyword
                if (filterType === 'productName') {
                    const results = await queryClickHouse(`
                    SELECT DISTINCT keyword as productName
                    FROM rb_kw
                    ${baseWhere} AND keyword IS NOT NULL AND keyword != ''
                    ORDER BY keyword
                    LIMIT 200
                `);
                    const options = results.map(r => r.productName).filter(Boolean);
                    return { options };
                }

                // SKUs: from rb_kw.keyword_search_product
                if (filterType === 'skus') {
                    let skuWhere = baseWhere;
                    if (format && format !== 'All') {
                        skuWhere += ` AND ${formatCondition}`;
                    }
                    if (brand && brand !== 'All') {
                        skuWhere += ` AND ${brandCondition}`;
                    }
                    const results = await queryClickHouse(`
                    SELECT DISTINCT keyword_search_product as sku
                    FROM rb_kw
                    ${skuWhere} AND keyword_search_product IS NOT NULL AND keyword_search_product != ''
                    ORDER BY keyword_search_product
                    LIMIT 200
                `);
                    const options = results.map(r => r.sku).filter(Boolean);
                    return { options };
                }

                // BRANDS: from rb_kw.brand_crawl (competitor brands where is_competitor_product=1)
                if (filterType === 'brands') {
                    const results = await queryClickHouse(`
                    SELECT DISTINCT brand_crawl as brand
                    FROM rb_kw
                    ${baseWhere} AND brand_crawl IS NOT NULL AND brand_crawl != '' AND toString(is_competitor_product) = '1'
                    ORDER BY brand_crawl
                    LIMIT 200
                `);
                    const options = results.map(r => r.brand).filter(Boolean);
                    return { options };
                }

                return { options: [] };
            } catch (error) {
                console.error('[VisibilityService] Error getting filter options (ClickHouse):', error);
                return { options: [] };
            }
        }, CACHE_TTL.LONG);
    }

    /**
     * Get the latest available dates from rb_kw table
     * Returns the date range of the latest month that has data
     */
    async getLatestAvailableDates() {
        console.log('[VisibilityService] getLatestAvailableDates (ClickHouse) called');
        const cacheKey = 'visibility_latest_dates';

        return await getCachedOrCompute(cacheKey, async () => {
            try {

                // Get the max date from rb_kw table - ClickHouse
                const results = await queryClickHouse(`
                SELECT MAX(toDate(created_on)) as maxDate
                FROM rb_kw
                WHERE created_on IS NOT NULL
            `);

                const maxDate = results[0]?.maxDate;

                if (!maxDate || maxDate === '0000-00-00' || maxDate === '1970-01-01') {
                    console.log('[VisibilityService] No valid data found in rb_kw table, returning current month');
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
                        SELECT MAX(toDate(created_on)) as maxDate
                        FROM rb_kw
                        WHERE created_on IS NOT NULL
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

                const platformCondition = buildCHCondition(platform, 'platform_name');
                const locationCondition = buildCHCondition(location, 'location_name');
                const brandSOSCondition = buildCHCondition(brand, 'brand_name', { isBrand: true });

                // Determine aggregation based on timeStep
                let dateAggregation;
                let dateFormat;
                const timeStep = filters.timeStep || 'Daily';

                if (timeStep === 'Weekly') {
                    dateAggregation = 'toStartOfWeek(toDate(created_on), 1)'; // 1 for Monday
                    dateFormat = "DD MMM'YY";
                } else if (timeStep === 'Monthly') {
                    dateAggregation = 'toStartOfMonth(toDate(created_on))';
                    dateFormat = "MMM 'YY";
                } else {
                    // Default to Daily
                    dateAggregation = 'toDate(created_on)';
                    dateFormat = "DD MMM'YY";
                }

                // Aggregate by selected time step - ClickHouse
                const query = `
                SELECT 
                    ${dateAggregation} as crawl_date,
                    ROUND(countIf(${brandSOSCondition}) * 100.0 / nullIf(count(), 0), 2) AS overall_sos,
                    ROUND(countIf(${brandSOSCondition} AND toString(spons_flag) = '1') * 100.0 / nullIf(count(), 0), 2) AS sponsored_sos,
                    ROUND(countIf(${brandSOSCondition} AND toString(spons_flag) != '1') * 100.0 / nullIf(count(), 0), 2) AS organic_sos,
                    ROUND(countIf(${brandSOSCondition} AND (toDate(created_on) < '2025-01-01' OR spons_flag = '1')) * 100.0 / nullIf(count(), 0), 2) AS display_sos
                FROM rb_kw
                WHERE toDate(created_on) BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND keyword_search_rank < 11
                  AND ${platformCondition}
                  AND ${locationCondition}
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
                SELECT MAX(toDate(created_on)) as maxDate
                FROM rb_kw
                WHERE created_on IS NOT NULL
            `);

                const maxDate = maxDateRes[0]?.maxDate;

                if (!maxDate || maxDate === '0000-00-00') {
                    console.error('[VisibilityService] No data found in rb_kw table');
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
                const format = filters.format || null;
                const productName = filters.productName || null;
                const brandFilter = filters.brand || null;

                const platformCondition = buildCHCondition(platform, 'platform_name');
                const locationCondition = buildCHCondition(location, 'location_name');
                const formatCondition = buildCHCondition(format, 'keyword_search_product');
                const productCondition = buildCHCondition(productName, 'keyword');
                const brandCondition = buildCHCondition(brandFilter, 'brand_crawl');

                const allFilters = `
                AND ${platformCondition}
                AND ${locationCondition}
                AND ${formatCondition}
                AND ${productCondition}
                AND ${brandCondition}
            `;

                // 1. Get total volume for both periods
                const volumeQuery = `
                SELECT 
                    countIf(toDate(created_on) BETWEEN '${dateFrom}' AND '${dateTo}') as current_total,
                    countIf(toDate(created_on) BETWEEN '${prevDateFrom}' AND '${prevDateTo}') as prev_total
                FROM rb_kw
                WHERE (toDate(created_on) BETWEEN '${dateFrom}' AND '${dateTo}' OR toDate(created_on) BETWEEN '${prevDateFrom}' AND '${prevDateTo}')
                  AND keyword_search_rank < 11
                ${allFilters}
            `;

                const volumeRes = await queryClickHouse(volumeQuery);
                const currentVolume = Number(volumeRes[0]?.current_total) || 1;
                const prevVolume = Number(volumeRes[0]?.prev_total) || 1;

                console.log(`[VisibilityService] Competition Volume (ClickHouse) - Current: ${currentVolume}, Prev: ${prevVolume}`);

                // 2. Query for brand-level competition
                const brandQuery = `
                SELECT 
                    brand_crawl as brand_name,
                    ROUND(countIf(toDate(created_on) BETWEEN '${dateFrom}' AND '${dateTo}') * 100.0 / ${currentVolume}, 2) AS current_overall_sos,
                    ROUND(countIf(toDate(created_on) BETWEEN '${dateFrom}' AND '${dateTo}' AND toString(spons_flag) = '1') * 100.0 / ${currentVolume}, 2) AS current_sponsored_sos,
                    ROUND(countIf(toDate(created_on) BETWEEN '${dateFrom}' AND '${dateTo}' AND toString(spons_flag) != '1') * 100.0 / ${currentVolume}, 2) AS current_organic_sos,
                    ROUND(countIf(toDate(created_on) BETWEEN '${prevDateFrom}' AND '${prevDateTo}') * 100.0 / ${prevVolume}, 2) AS prev_overall_sos,
                    ROUND(countIf(toDate(created_on) BETWEEN '${prevDateFrom}' AND '${prevDateTo}' AND toString(spons_flag) = '1') * 100.0 / ${prevVolume}, 2) AS prev_sponsored_sos,
                    ROUND(countIf(toDate(created_on) BETWEEN '${prevDateFrom}' AND '${prevDateTo}' AND toString(spons_flag) != '1') * 100.0 / ${prevVolume}, 2) AS prev_organic_sos,
                    countIf(toDate(created_on) BETWEEN '${dateFrom}' AND '${dateTo}') as impressions
                FROM rb_kw
                WHERE (toDate(created_on) BETWEEN '${dateFrom}' AND '${dateTo}' OR toDate(created_on) BETWEEN '${prevDateFrom}' AND '${prevDateTo}')
                  AND keyword_search_rank < 11
                  ${allFilters}
                  AND brand_crawl IS NOT NULL AND brand_crawl != ''
                  AND toString(is_competitor_product) = '1'
                GROUP BY brand_crawl
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

                // 3. Query for SKU-level competition
                const skuQuery = `
                SELECT 
                    keyword_search_product as sku_name,
                    brand_crawl as brand_name,
                    ROUND(count() * 100.0 / ${currentVolume}, 2) AS overall_sos,
                    ROUND(countIf(toString(spons_flag) = '1') * 100.0 / ${currentVolume}, 2) AS sponsored_sos,
                    ROUND(countIf(toString(spons_flag) != '1') * 100.0 / ${currentVolume}, 2) AS organic_sos,
                    count() as impressions
                FROM rb_kw
                WHERE toDate(created_on) BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND keyword_search_rank < 11
                  ${allFilters}
                  AND keyword_search_product IS NOT NULL AND keyword_search_product != ''
                  AND toString(is_competitor_product) = '1'
                GROUP BY keyword_search_product, brand_crawl
                ORDER BY impressions DESC
                LIMIT 20
            `;

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

                const platform = filters.platform || null;
                const location = filters.location || null;
                const selectedBrands = Array.isArray(filters.brands)
                    ? filters.brands
                    : (filters.brands ? filters.brands.split(',') : []);

                if (selectedBrands.length === 0) {
                    return { brands: {}, days: [] };
                }

                // Determine date range
                let startDate, endDate;
                const period = filters.period || '1M';

                if (filters.startDate && filters.endDate) {
                    startDate = dayjs(filters.startDate);
                    endDate = dayjs(filters.endDate);
                } else {
                    // Fetch the latest available date from ClickHouse
                    const maxDateRes = await queryClickHouse(`
                        SELECT MAX(toDate(created_on)) as maxDate
                        FROM rb_kw
                        WHERE created_on IS NOT NULL
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
                    dateAggregation = 'toStartOfWeek(toDate(created_on), 1)'; // 1 for Monday
                    dateFormat = "DD MMM'YY";
                } else if (timeStep === 'Monthly') {
                    dateAggregation = 'toStartOfMonth(toDate(created_on))';
                    dateFormat = "MMM 'YY";
                } else {
                    // Default to Daily
                    dateAggregation = 'toDate(created_on)';
                    dateFormat = "DD MMM'YY";
                }

                const platformCondition = buildCHCondition(platform, 'platform_name');
                const locationCondition = buildCHCondition(location, 'location_name');
                const brandsCondition = buildCHCondition(selectedBrands, 'brand_crawl');

                // 1. Get total volume by date for denominator
                const volumeQuery = `
                SELECT 
                    ${dateAggregation} as crawl_date,
                    count() as total_volume
                FROM rb_kw
                WHERE toDate(created_on) BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND keyword_search_rank < 11
                  AND ${platformCondition}
                  AND ${locationCondition}
                GROUP BY crawl_date
                ORDER BY crawl_date ASC
            `;

                const volumeResults = await queryClickHouse(volumeQuery);
                const volumeByDate = {};
                const allDays = [];
                volumeResults.forEach(row => {
                    const date = dayjs(row.crawl_date);
                    const dateStr = date.format(dateFormat);
                    volumeByDate[dateStr] = Number(row.total_volume) || 1;
                    allDays.push(dateStr);
                });

                // 2. Query brand-specific data for all selected brands at once
                const brandDataQuery = `
                SELECT 
                    brand_crawl as brand_name,
                    ${dateAggregation} as crawl_date,
                    count() as brand_volume,
                    countIf(toString(spons_flag) = '1') as sponsored_volume,
                    countIf(toString(spons_flag) != '1') as organic_volume,
                    countIf(toDate(created_on) < '2025-01-01' OR spons_flag = '1') as display_volume
                FROM rb_kw
                WHERE toDate(created_on) BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND keyword_search_rank < 11
                  AND ${platformCondition}
                  AND ${locationCondition}
                  AND ${brandsCondition}
                  AND toString(is_competitor_product) = '1'
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
                        const totalVol = volumeByDate[dateStr] || 1;
                        const data = brandHistory[dateStr] || { brand_volume: 0, sponsored_volume: 0, organic_volume: 0 };
                        return {
                            date: dateStr,
                            overall_sos: Number(((data.brand_volume / totalVol) * 100).toFixed(2)),
                            sponsored_sos: Number(((data.sponsored_volume / totalVol) * 100).toFixed(2)),
                            organic_sos: Number(((data.organic_volume / totalVol) * 100).toFixed(2)),
                            display_sos: Number(((data.display_volume / totalVol) * 100).toFixed(2))
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
}


export default new VisibilityService();
