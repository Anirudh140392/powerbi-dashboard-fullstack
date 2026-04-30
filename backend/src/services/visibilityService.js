import dayjs from 'dayjs';
import { queryClickHouse } from '../config/clickhouse.js';
import { getCachedOrCompute, generateCacheKey, CACHE_TTL } from '../utils/cacheHelper.js';
import { getTableColumns, resolveColumn } from '../utils/schemaHelper.js';

const escapeCH = (str) => str ? str.replace(/'/g, "''") : '';
const EXCLUDED_PLATFORMS = ['BigBasket', 'Amazon', 'Flipkart'];

function buildCHCondition(value, column, options = {}) {
    const { isBrand = false, isCategory = false, isKeywordType = false } = options;

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
        if (!val) return false;
        const lower = String(val).toLowerCase();
        // Standardize own-brand recognition across all dashboards
        return lower === 'mamaearth' || lower === 'honasa' || lower.includes('mamaearth') ||
            lower.includes('derma co') || lower.includes('aqualogica') || lower.includes('dr. sheth') ||
            lower.includes('dr sheth');
    };

    // If "All" brands or our main brand is selected, we want our brand's data (flag=1)
    if (isBrand && (isAll(value) || isOurBrand(value))) return "flag = 1";
    if (isAll(value)) return "1=1";

    const list = typeof value === 'string'
        ? value.split(',').map(v => v.trim()).filter(v => !isAll(v))
        : Array.isArray(value) ? value.filter(v => !isAll(v)) : [value];

    if (list.length === 0) return isBrand ? "flag = 1" : "1=1";

    if (isCategory || isKeywordType) {
        return `LOWER(${column}) IN (${list.map(v => `'${escapeCH(String(v).toLowerCase())}'`).join(', ')})`;
    }
    return `${column} IN (${list.map(v => `'${escapeCH(v)}'`).join(', ')})`;
}

/**
 * Shared helper to map keyword types (e.g., Competitor -> [competitor, competition])
 * Returns lowercase values to be used with LOWER() in SQL for case-insensitive matching.
 */
const processKeywordType = (val) => {
    if (!val || val === 'All' || val === 'all') return null;
    if (Array.isArray(val)) {
        return val.filter(t => t !== 'All' && t !== 'all').map(t => {
            const lower = String(t).toLowerCase();
            if (lower === 'competitor' || lower === 'competition') return ['competitor', 'competition'];
            return lower;
        }).flat();
    }
    const lower = String(val).toLowerCase();
    if (lower === 'competitor' || lower === 'competition') return ['competitor', 'competition'];
    return lower;
};

/**
 * Shared helper to build platform condition based on channel
 * Mimics watchTowerService logic for rb_kw_olap which lacks a channel structure
 */
function buildChannelCondition(channel, columnName = 'platform_name') {
    if (!channel || channel === 'All') return "1=1";

    const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';
    const channels = Array.isArray(channel) ? channel : (typeof channel === 'string' && channel.includes(',') ? channel.split(',') : [channel]);

    if (channels.length === 0 || channels.every(c => c.toLowerCase() === 'all')) return "1=1";

    const isEcom = channels.some(c => ['ecommerce', 'e-commerce', 'ecom'].includes(String(c).toLowerCase()));
    const isQuickComm = channels.some(c => String(c).toLowerCase().includes('quick'));
    const isModernTrade = channels.some(c => ['modern trades', 'moderntrade'].includes(String(c).toLowerCase()));

    // Distinct lists for platforms
    const ecomPlatforms = ['Amazon', 'Flipkart'];
    const quickPlatforms = ['Blinkit', 'Zepto', 'Instamart', 'Swiggy Instamart', 'Swiggy'];

    let conditions = [];

    if (isQuickComm) {
        conditions.push(`lower(${columnName}) IN (${quickPlatforms.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})`);
    } else if (isEcom && !isModernTrade) {
        // If Ecommerce selected (and NOT Modern Trade or Quick Commerce), only show pure Ecom platforms
        conditions.push(`lower(${columnName}) IN (${ecomPlatforms.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})`);
    } else if (isModernTrade && !isEcom) {
        // If Modern Trade selected (and NOT Ecom), exclude all Ecom and Quick platforms
        const allEcomQuick = [...ecomPlatforms, ...quickPlatforms];
        conditions.push(`lower(${columnName}) NOT IN (${allEcomQuick.map(p => `'${escapeStr(p.toLowerCase())}'`).join(', ')})`);
    }

    return conditions.length > 0 ? conditions.join(' OR ') : "1=1";
}



async function calculateAllSOS(dateFrom, dateTo, platform = null, brand = null, location = null, keyword = null, keywordType = null, category = null, channel = null) {
    try {
        const platformCondition = buildCHCondition(platform, 'platform_name');
        const channelCondition = buildChannelCondition(channel, 'platform_name');
        const locationCondition = buildCHCondition(location, 'location_name');
        const brandSOSCondition = buildCHCondition(brand, 'brand', { isBrand: true });
        const keywordCondition = buildCHCondition(keyword, 'keyword');
        const keywordTypeCondition = buildCHCondition(keywordType, 'keyword_type');
        const categoryCondition = buildCHCondition(category, 'keyword_category', { isCategory: true });

        const query = `
            SELECT 
                ROUND(sumIf(toInt32(overall), ${brandSOSCondition}) * 100.0 / nullIf(sum(toInt32(overall)), 0), 2) AS overall_sos,
                ROUND(sumIf(toInt32(spons), ${brandSOSCondition}) * 100.0 / nullIf(sum(toInt32(spons)), 0), 2) AS sponsored_sos,
                ROUND(sumIf(toInt32(organic), ${brandSOSCondition}) * 100.0 / nullIf(sum(toInt32(organic)), 0), 2) AS organic_sos
            FROM rb_kw_olap
            WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
              AND ${platformCondition}
              AND ${channelCondition}
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
async function getAllSOSTrends(days = 7, platform = null, brand = null, location = null, customStartDate = null, customEndDate = null, keyword = null, keywordType = null, category = null, channel = null) {
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
        const channelCondition = buildChannelCondition(channel, 'platform_name');
        const locationCondition = buildCHCondition(location, 'location_name');
        const brandSOSCondition = buildCHCondition(brand, 'brand', { isBrand: true });
        const keywordCondition = buildCHCondition(keyword, 'keyword');
        const keywordTypeCondition = buildCHCondition(keywordType, 'keyword_type');
        const categoryCondition = buildCHCondition(category, 'keyword_category', { isCategory: true });

        const query = `
            SELECT 
                DATE as crawl_date,
                ROUND(sumIf(toInt32(overall), ${brandSOSCondition}) * 100.0 / nullIf(sum(toInt32(overall)), 0), 2) AS overall_sos,
                ROUND(sumIf(toInt32(spons), ${brandSOSCondition}) * 100.0 / nullIf(sum(toInt32(spons)), 0), 2) AS sponsored_sos,
                ROUND(sumIf(toInt32(organic), ${brandSOSCondition}) * 100.0 / nullIf(sum(toInt32(organic)), 0), 2) AS organic_sos
            FROM rb_kw_olap
            WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
              AND ${platformCondition}
              AND ${channelCondition}
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
            calculateAllSOS(dateRanges.current.start, dateRanges.current.end, platform, filters.brand, filters.location, filters.keyword, filters.keywordType, filters.category || filters.format, filters.channel),
            calculateAllSOS(dateRanges.previous.start, dateRanges.previous.end, platform, filters.brand, filters.location, filters.keyword, filters.keywordType, filters.category || filters.format, filters.channel),
            getAllSOSTrends(null, platform, filters.brand, filters.location, dateRanges.current.start, dateRanges.current.end, filters.keyword, filters.keywordType, filters.category || filters.format, filters.channel)
        ]);

        // Use daily trends directly for the sparkline graphs
        const dailyTrends = {
            overall: trends.overall || { dates: [], values: [] },
            sponsored: trends.sponsored || { dates: [], values: [] },
            organic: trends.organic || { dates: [], values: [] }
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
                    months: dailyTrends.overall.dates,
                    sparklineData: dailyTrends.overall.values
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
                    months: dailyTrends.sponsored.dates,
                    sparklineData: dailyTrends.sponsored.values
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
                    months: dailyTrends.organic.dates,
                    sparklineData: dailyTrends.organic.values
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

                if (filters.channel && filters.channel !== 'All' && filters.channel !== 'all') {
                    const channelCond = buildChannelCondition(filters.channel, 'platform_name');
                    if (channelCond !== '1=1') baseWhere += ` AND ${channelCond}`;
                }

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
                if (filters.channel && filters.channel !== 'All' && filters.channel !== 'all') {
                    const channelCond = buildChannelCondition(filters.channel, 'platform_name');
                    if (channelCond !== '1=1') prevBaseWhere += ` AND ${channelCond}`;
                }
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
                        // If a specific filter is provided (not "All"), we should respect it even if it's the dimension being aggregated
                        // This allows the user to drill down into a specific city/category in the matrix view
                        if (val && val !== 'All' && val !== 'all') {
                            const isCat = col === 'keyword_category';
                            const cond = buildCHCondition(val, col, { isCategory: isCat });
                            currentWhere += ` AND ${cond}`;
                            prevWhere += ` AND ${cond}`;
                        }
                    };

                    if (filters.channel && filters.channel !== 'All' && filters.channel !== 'all') {
                        const channelCond = buildChannelCondition(filters.channel, 'platform_name');
                        if (channelCond !== '1=1') {
                            currentWhere += ` AND ${channelCond}`;
                            prevWhere += ` AND ${channelCond}`;
                        }
                    }

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
                        if (cityListMatch) {
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
                if (filters.channel && filters.channel !== 'All') {
                    const channelCond = buildChannelCondition(filters.channel, 'platform_name');
                    whereConditions.push(channelCond);
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

                let platformCondition = buildCHCondition(platform, 'platform_name');
                const channelCondition = buildChannelCondition(filters.channel, 'platform_name');
                platformCondition = `${platformCondition} AND ${channelCondition}`;
                const locationCondition = buildCHCondition(location, 'location_name');
                const brandCondition = filters.brand || 'All';

                // Exclude global rollup locations from analytical results
                // CRITICAL: We MUST allow 'Nation' for Flipkart and Amazon because they often ONLY have nation-wide data
                const EXCLUDED_LOCATIONS = "'Nation', 'National', 'All India', 'Total', 'India', 'nation', 'national', 'all india'";
                const isNationOnlyPlatform = ['Flipkart', 'Amazon'].includes(platform);

                const locationFilter = location === 'All'
                    ? (isNationOnlyPlatform ? '' : `AND location_name NOT IN (${EXCLUDED_LOCATIONS})`)
                    : `AND ${locationCondition}`;

                const brandSOSCondition = buildCHCondition(brandCondition, 'brand', { isBrand: true });

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
                    if (!val || val === 'All' || val === 'all') return null;
                    if (Array.isArray(val)) {
                        return val.filter(t => t !== 'All' && t !== 'all').map(t => {
                            const lower = String(t).toLowerCase();
                            if (lower === 'competitor' || lower === 'competition') return ['Competitor', 'Competition'];
                            return lower.charAt(0).toUpperCase() + lower.slice(1);
                        }).flat();
                    }
                    const lower = String(val).toLowerCase();
                    if (lower === 'competitor' || lower === 'competition') return ['Competitor', 'Competition'];
                    return lower.charAt(0).toUpperCase() + lower.slice(1);
                };

                const widgetType = processType(filters.filter);
                const globalType = processType(filters.keywordType);

                if (widgetType) typeConds.push(buildCHCondition(widgetType, 'keyword_type'));
                if (globalType) typeConds.push(buildCHCondition(globalType, 'keyword_type'));

                // deduplicate type filters if they are identical
                const uniqueTypeConds = [...new Set(typeConds)];
                const typeFilter = uniqueTypeConds.length > 0 ? `AND ${uniqueTypeConds.join(' AND ')}` : '';

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
                    // 1. Get Top 100 SKUs based on total volume (increased from 50)
                    const topSkusQuery = `
                        SELECT 
                            keyword_search_product as sku, 
                            count() as vol,
                            max(toInt32(flag)) as is_my_sku,
                            topKIf(1)(brand, brand != '') as best_brand_arr
                        FROM rb_kw_olap
                        WHERE ${dateCondition} AND ${platformCondition} ${locationFilter} ${typeFilter} ${keywordFilter} ${categoryClause} AND keyword_search_product != '' AND toInt32(flag) = 1
                        GROUP BY sku
                        HAVING vol > 0
                        ORDER BY vol DESC
                        LIMIT 100
                    `;
                    const topSkusResult = await queryClickHouse(topSkusQuery);
                    if (topSkusResult.length === 0) return { terms: [] };

                    const skuList = topSkusResult.map(s => `'${escapeCH(s.sku)}'`).join(',');
                    const skuContextMap = {};
                    topSkusResult.forEach(s => {
                        skuContextMap[s.sku] = {
                            vol: s.vol,
                            topBrand: s.is_my_sku == 1 ? '1' : ((s.best_brand_arr && s.best_brand_arr.length > 0) ? s.best_brand_arr[0] : 'Other')
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
                        WHERE ${dateCondition} AND ${platformCondition} ${locationFilter} ${typeFilter} ${keywordFilter} ${categoryClause} 
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
                        WHERE ${dateCondition} AND ${platformCondition} ${locationFilter} ${typeFilter} ${keywordFilter} ${categoryClause} 
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

                    const colsRes = await queryClickHouse(`SELECT name FROM system.columns WHERE database = currentDatabase() AND table = 'rb_kw_olap'`);
                    const hasSearchVolPct = colsRes.some((c) => c.name === 'search_volume_percentage');
                    const searchVolumeSelect = hasSearchVolPct
                        ? `ROUND(AVG(toFloat64OrZero(toString(search_volume_percentage))), 2)`
                        : `0`;

                    const metricsQuery = `
                        SELECT 
                            keyword,
                            MAX(keyword_type) as type,
                            sumIf(toInt32(overall), flag = 1) as rb_overall,
                            sumIf(toInt32(organic), flag = 1) as rb_organic,
                            sumIf(toInt32(spons), flag = 1) as rb_sponsored,
                            sum(toInt32(overall)) as total_overall,
                            sum(toInt32(organic)) as total_organic,
                            sum(toInt32(spons)) as total_spons,
                            sumIf(toInt32(overall), ${brandSOSCondition}) as brand_filter_overall,
                            ${searchVolumeSelect} as search_volume,
                            ROUND(AVG(POSITION), 1) as avg_overall_pos,
                            ROUND(avgIf(POSITION, toInt32(organic) = 1 AND flag = 1), 1) as avg_org_pos,
                            ROUND(avgIf(POSITION, toInt32(spons) = 1 AND flag = 1), 1) as avg_ad_pos
                        FROM rb_kw_olap
                        WHERE ${dateCondition}
                          AND ${platformCondition}
                          ${locationFilter}
                          ${typeFilter}
                          ${keywordFilter}
                          ${categoryClause}
                        GROUP BY keyword
                        ${(brand && brand !== 'All' && (!filters || !filters.filter || filters.filter === 'All')) ? 'HAVING brand_filter_overall > 0' : ''}
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
                          ${locationFilter}
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
                            paidSos: Number(((Number(p.rb_sponsored) / (Number(p.total_overall) || 1)) * 100).toFixed(1))
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
                          ${locationFilter}
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
                        const currPaidSos = Number(((Number(km.rb_sponsored) / tOverall) * 100).toFixed(1));

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
                            searchVolume: Number(km.search_volume || 0),
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
                const channelCondition = buildChannelCondition(filters.channel, 'platform_name');
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
                      AND ${channelCondition}
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
                      AND ${channelCondition}
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
    async getVisibilityFilterOptions({ filterType, platform, format, city, brand, keywordType, keyword, sku, ownBrandsOnly, channel }) {
        console.log(`[VisibilityService] getVisibilityFilterOptions called: type=${filterType}`);
        const cacheKey = generateCacheKey('visibility_filters_v8', { filterType, platform, format, city, brand, keywordType, keyword, sku, ownBrandsOnly, channel });

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
                    let platformWhere = "WHERE platform_name IS NOT NULL AND platform_name != ''";
                    const channelCondition = buildChannelCondition(channel, 'platform_name');
                    platformWhere += ` AND ${channelCondition}`;
                    platformWhere += ` AND ${buildCHCondition(format, 'keyword_category', { isCategory: true })}`;
                    platformWhere += ` AND ${buildCHCondition(city, 'location_name')}`;
                    platformWhere += ` AND ${buildCHCondition(brand, 'brand', { isBrand: true })}`;
                    platformWhere += ` AND ${buildCHCondition(keywordType, 'keyword_type', { isKeywordType: true })}`;
                    platformWhere += ` AND ${buildCHCondition(keyword, 'keyword')}`;
                    platformWhere += ` AND ${buildCHCondition(sku, 'keyword_search_product')}`;
                    if (ownBrandsOnly) platformWhere += ` AND flag = 1`;

                    const results = await queryClickHouse(`
                    SELECT DISTINCT platform_name as platform
                    FROM rb_kw_olap
                    ${platformWhere}
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
                // SKU: rb_kw_olap.keyword_search_product
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
                if (filterType === 'formats' || filterType === 'categories') {
                    let formatWhere = "WHERE keyword_category IS NOT NULL AND keyword_category != ''";
                    const channelCondition = buildChannelCondition(channel, 'platform_name');
                    formatWhere += ` AND ${channelCondition}`;
                    formatWhere += ` AND ${buildCHCondition(platform, 'platform_name')}`;
                    formatWhere += ` AND ${buildCHCondition(city, 'location_name')}`;
                    formatWhere += ` AND ${buildCHCondition(keywordType, 'keyword_type', { isKeywordType: true })}`;
                    formatWhere += ` AND ${buildCHCondition(keyword, 'keyword')}`;
                    formatWhere += ` AND ${buildCHCondition(sku, 'keyword_search_product')}`;
                    formatWhere += ` AND ${buildCHCondition(brand, 'brand', { isBrand: true })}`;

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
                    const channelCondition = buildChannelCondition(channel, 'platform_name');
                    brandWhere += ` AND ${channelCondition}`;
                    brandWhere += ` AND ${buildCHCondition(platform, 'platform_name')}`;
                    brandWhere += ` AND ${buildCHCondition(city, 'location_name')}`;
                    brandWhere += ` AND ${buildCHCondition(format, 'keyword_category', { isCategory: true })}`;
                    brandWhere += ` AND ${buildCHCondition(keywordType, 'keyword_type', { isKeywordType: true })}`;
                    brandWhere += ` AND ${buildCHCondition(keyword, 'keyword')}`;
                    brandWhere += ` AND ${buildCHCondition(sku, 'keyword_search_product')}`;
                    if (ownBrandsOnly) brandWhere += ` AND flag = 1`;

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

                // SKUs: from rb_kw_olap.keyword_search_product
                if (filterType === 'skus') {
                    let skuWhere = "WHERE keyword_search_product IS NOT NULL AND keyword_search_product != ''";
                    const channelCondition = buildChannelCondition(channel, 'platform_name');
                    skuWhere += ` AND ${channelCondition}`;
                    skuWhere += ` AND ${buildCHCondition(platform, 'platform_name')}`;
                    skuWhere += ` AND ${buildCHCondition(city, 'location_name')}`;
                    skuWhere += ` AND ${buildCHCondition(format, 'keyword_category', { isCategory: true })}`;
                    skuWhere += ` AND ${buildCHCondition(keywordType, 'keyword_type', { isKeywordType: true })}`;
                    skuWhere += ` AND ${buildCHCondition(brand, 'brand', { isBrand: true })}`;
                    skuWhere += ` AND ${buildCHCondition(keyword, 'keyword')}`;
                    if (ownBrandsOnly) skuWhere += ` AND flag = 1`;

                    const results = await queryClickHouse(`
                        SELECT DISTINCT keyword_search_product as sku
                        FROM rb_kw_olap
                        ${skuWhere}
                        ORDER BY sku
                    `);
                    const options = results.map(r => r.sku).filter(Boolean);
                    return { options };
                }

                // CITIES: from rb_kw_olap.location_name
                if (filterType === 'cities') {
                    let cityWhere = "WHERE location_name IS NOT NULL AND location_name != ''";
                    const channelCondition = buildChannelCondition(channel, 'platform_name');
                    cityWhere += ` AND ${channelCondition}`;
                    cityWhere += ` AND ${buildCHCondition(platform, 'platform_name')}`;
                    cityWhere += ` AND ${buildCHCondition(format, 'keyword_category', { isCategory: true })}`;
                    cityWhere += ` AND ${buildCHCondition(keywordType, 'keyword_type', { isKeywordType: true })}`;
                    cityWhere += ` AND ${buildCHCondition(keyword, 'keyword')}`;
                    cityWhere += ` AND ${buildCHCondition(sku, 'keyword_search_product')}`;
                    cityWhere += ` AND ${buildCHCondition(brand, 'brand', { isBrand: true })}`;

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

                // KEYWORD TYPES: from rb_kw_olap.keyword_type
                if (filterType === 'keywordTypes') {
                    let typeWhere = "WHERE keyword_type IS NOT NULL AND keyword_type != ''";
                    const channelCondition = buildChannelCondition(channel, 'platform_name');
                    typeWhere += ` AND ${channelCondition}`;
                    typeWhere += ` AND ${buildCHCondition(platform, 'platform_name')}`;
                    typeWhere += ` AND ${buildCHCondition(city, 'location_name')}`;
                    typeWhere += ` AND ${buildCHCondition(keyword, 'keyword')}`;
                    typeWhere += ` AND ${buildCHCondition(sku, 'keyword_search_product')}`;
                    typeWhere += ` AND ${buildCHCondition(format, 'keyword_category', { isCategory: true })}`;
                    typeWhere += ` AND ${buildCHCondition(brand, 'brand', { isBrand: true })}`;
                    if (ownBrandsOnly) typeWhere += ` AND flag = 1`;

                    const results = await queryClickHouse(`
                        SELECT DISTINCT keyword_type
                        FROM rb_kw_olap
                        ${typeWhere}
                        ORDER BY keyword_type
                    `);
                    const options = results.map(r => r.keyword_type).filter(Boolean);
                    return { options };
                }

                if (filterType === 'productName' || filterType === 'keywords') {
                    let keywordWhere = "WHERE keyword IS NOT NULL AND keyword != ''";
                    const channelCondition = buildChannelCondition(channel, 'platform_name');
                    keywordWhere += ` AND ${channelCondition}`;
                    keywordWhere += ` AND ${buildCHCondition(platform, 'platform_name')}`;
                    keywordWhere += ` AND ${buildCHCondition(city, 'location_name')}`;
                    keywordWhere += ` AND ${buildCHCondition(format, 'keyword_category', { isCategory: true })}`;
                    keywordWhere += ` AND ${buildCHCondition(brand, 'brand', { isBrand: true })}`;
                    keywordWhere += ` AND ${buildCHCondition(keywordType, 'keyword_type', { isKeywordType: true })}`;
                    keywordWhere += ` AND ${buildCHCondition(sku, 'keyword_search_product')}`;
                    if (ownBrandsOnly) keywordWhere += ` AND flag = 1`;

                    const results = await queryClickHouse(`
                        SELECT DISTINCT keyword
                        FROM rb_kw_olap
                        ${keywordWhere}
                        ORDER BY keyword
                        LIMIT 1000
                    `);
                    return { options: results.map(r => r.keyword).filter(Boolean) };
                }

                // KEYWORD TYPES: from rb_kw_olap.keyword_type
                if (filterType === 'keywordTypes' || filterType === 'keywordType') {
                    let typeWhere = "WHERE keyword_type IS NOT NULL AND keyword_type != ''";
                    const channelCondition = buildChannelCondition(channel, 'platform_name');
                    typeWhere += ` AND ${channelCondition}`;
                    typeWhere += ` AND ${buildCHCondition(platform, 'platform_name')}`;
                    typeWhere += ` AND ${buildCHCondition(format, 'keyword_category', { isCategory: true })}`;
                    typeWhere += ` AND ${buildCHCondition(city, 'location_name')}`;
                    typeWhere += ` AND ${buildCHCondition(brand, 'brand', { isBrand: true })}`;
                    typeWhere += ` AND ${buildCHCondition(keyword, 'keyword')}`;
                    typeWhere += ` AND ${buildCHCondition(sku, 'keyword_search_product')}`;

                    const results = await queryClickHouse(`
                        SELECT DISTINCT keyword_type as type
                        FROM rb_kw_olap
                        ${typeWhere}
                        ORDER BY type
                    `);
                    const options = results.map(r => r.type).filter(Boolean);
                    return { options };
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
                const channelCondition = buildChannelCondition(filters.channel, 'platform_name');
                const locationCondition = buildCHCondition(location, 'location_name');
                const keywordCondition = buildCHCondition(filters.keyword, 'keyword');
                const keywordTypeCondition = buildCHCondition(filters.keywordType, 'keyword_type');
                const formatCondition = buildCHCondition(categoryValue, 'keyword_category', { isCategory: true });
                const skuCondition = buildCHCondition(filters.sku, 'keyword_search_product');
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
                const querySOS = `
                SELECT 
                    ${dateAggregation} as crawl_date,
                    ROUND(sumIf(toInt32(overall), ${brandSOSCondition}) * 100.0 / nullIf(sum(toInt32(overall)), 0), 2) AS overall_sos,
                    ROUND(sumIf(toInt32(spons), ${brandSOSCondition}) * 100.0 / nullIf(sum(toInt32(overall)), 0), 2) AS sponsored_sos,
                    ROUND(sumIf(toInt32(organic), ${brandSOSCondition}) * 100.0 / nullIf(sum(toInt32(organic)), 0), 2) AS organic_sos,
                    ROUND(sumIf(toInt32(spons), ${brandSOSCondition}) * 100.0 / nullIf(sum(toInt32(overall)), 0), 2) AS display_sos,
                    ROUND(avgIf(POSITION, ${brandSOSCondition} AND POSITION > 0), 1) AS search_rank
                FROM rb_kw_olap
                WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND ${platformCondition}
                  AND ${channelCondition}
                  AND ${locationCondition}
                  AND ${formatCondition}
                  AND ${keywordTypeCondition}
                  AND ${keywordCondition}
                  AND ${skuCondition}
                GROUP BY crawl_date
                ORDER BY crawl_date ASC
            `;

                // Determine if we should query pdp and ms tables
                const isNotAll = (val) => {
                    if (!val) return false;
                    if (Array.isArray(val)) {
                        if (val.length === 0) return false;
                        return !val.some(v => String(v).toLowerCase() === 'all');
                    }
                    return String(val).toLowerCase() !== 'all';
                };
                const hasKeywordFilter = isNotAll(filters.keyword) || isNotAll(filters.keywordType);

                let queryOfftake = null;
                let queryCatShare = null;

                if (!hasKeywordFilter) {
                    const pdpPlatformCondition = buildCHCondition(platform, 'Platform');
                    const msPlatformCondition = buildCHCondition(platform, 'platform');
                    
                    const pdpLocationCondition = buildCHCondition(location, 'Location');
                    const msLocationCondition = buildCHCondition(location, 'location');
                    
                    const pdpBrandCondition = buildCHCondition(brand, 'Brand');
                    const msBrandCondition = buildCHCondition(brand, 'brand');

                    const pdpSkuCondition = buildCHCondition(filters.sku, 'Product');
                    const msSkuCondition = buildCHCondition(filters.sku, 'item_name');

                    const pdpCategoryCondition = buildCHCondition(categoryValue, 'Category');
                    const msCategoryCondition = buildCHCondition(categoryValue, 'category');

                    queryOfftake = `
                        SELECT 
                            ${dateAggregation.replace(/DATE/g, 'toDate(DATE)')} as crawl_date,
                            SUM(toFloat64OrZero(toString(Sales))) as total_sales
                        FROM rb_pdp_olap
                        WHERE toDate(DATE) BETWEEN '${dateFrom}' AND '${dateTo}'
                          AND ${pdpPlatformCondition}
                          AND ${pdpLocationCondition}
                          AND ${pdpCategoryCondition}
                          AND ${pdpBrandCondition}
                          AND ${pdpSkuCondition}
                        GROUP BY crawl_date
                        ORDER BY crawl_date ASC
                    `;

                    // For Category Share, we need brand sales / total category sales
                    queryCatShare = `
                        SELECT 
                            ${dateAggregation.replace(/DATE/g, 'toDate(created_on)')} as crawl_date,
                            SUM(toFloat64OrZero(toString(sales))) as cat_total_sales,
                            SUM(If(${msBrandCondition}, toFloat64OrZero(toString(sales)), 0)) as brand_total_sales
                        FROM rb_ms_olap
                        WHERE toDate(created_on) BETWEEN '${dateFrom}' AND '${dateTo}'
                          AND ${msPlatformCondition}
                          AND ${msLocationCondition}
                          AND ${msCategoryCondition}
                          AND ${msSkuCondition}
                        GROUP BY crawl_date
                        ORDER BY crawl_date ASC
                    `;
                }

                // Execute queries in parallel
                const queries = [queryClickHouse(querySOS)];
                if (queryOfftake) queries.push(queryClickHouse(queryOfftake));
                if (queryCatShare) queries.push(queryClickHouse(queryCatShare));

                const [resultsSOS, resultsOfftake, resultsCatShare] = await Promise.all(queries);

                // Map results for easy lookup
                const offtakeMap = new Map();
                if (resultsOfftake) {
                    resultsOfftake.forEach(row => {
                        const dateStr = dayjs(row.crawl_date).format(dateFormat);
                        offtakeMap.set(dateStr, parseFloat(row.total_sales || 0));
                    });
                }

                const catShareMap = new Map();
                if (resultsCatShare) {
                    resultsCatShare.forEach(row => {
                        const dateStr = dayjs(row.crawl_date).format(dateFormat);
                        const brandSales = parseFloat(row.brand_total_sales || 0);
                        const totalSales = parseFloat(row.cat_total_sales || 0);
                        const catShare = totalSales > 0 ? (brandSales / totalSales) * 100 : 0;
                        catShareMap.set(dateStr, parseFloat(catShare.toFixed(2)));
                    });
                }

                // Format dates based on time step
                const timeSeries = resultsSOS.map(row => {
                    const date = dayjs(row.crawl_date);
                    const dateFormatted = date.format(dateFormat);
                    
                    return {
                        date: dateFormatted,
                        overall_sos: Number(row.overall_sos) || 0,
                        sponsored_sos: Number(row.sponsored_sos) || 0,
                        organic_sos: Number(row.organic_sos) || 0,
                        display_sos: Number(row.display_sos) || 0,
                        search_rank: row.search_rank !== null && !isNaN(row.search_rank) ? Number(row.search_rank) : null,
                        offtake: offtakeMap.get(dateFormatted) || null,
                        category_share: catShareMap.get(dateFormatted) || null
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
                const channelCondition = buildChannelCondition(filters.channel, 'platform_name');
                const locationCondition = buildCHCondition(filters.location, 'location_name');
                const formatCondition = buildCHCondition(filters.category || filters.format, 'keyword_category', { isCategory: true });
                const keywordCondition = buildCHCondition(filters.keyword, 'keyword');
                const keywordTypeCondition = buildCHCondition(filters.keywordType, 'keyword_type');
                const brandCondition = buildCHCondition(brandFilter, 'brand');
                const skuCondition = buildCHCondition(filters.sku, 'keyword_search_product');

                // [FIX] Separate filters: volume filters should NOT include the specific brand filter
                // so that SOS is calculated against the total category volume.
                const volumeFilters = `
                AND ${platformCondition}
                AND ${channelCondition}
                AND ${locationCondition}
                AND ${formatCondition}
                AND ${keywordCondition}
                AND ${keywordTypeCondition}
                AND ${skuCondition}
            `;

                const allFilters = `
                ${volumeFilters}
                AND ${brandCondition}
            `;

                // 1. Get total volume for both periods (UNFILTERED by specific brand)
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
                ${volumeFilters}
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
                  AND flag = 0
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
                  AND flag = 0
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
                const channelCondition = buildChannelCondition(filters.channel, 'platform_name');
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

                const isNotAll = (val) => {
                    if (!val) return false;
                    if (Array.isArray(val)) {
                        if (val.length === 0) return false;
                        return !val.some(v => String(v).toLowerCase() === 'all');
                    }
                    return String(val).toLowerCase() !== 'all';
                };
                const hasKeywordFilter = isNotAll(filters.keyword) || isNotAll(filters.keywordType) || dimension === 'keyword';

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

                const queries = [queryClickHouse(brandDataQuery)];

                let offtakeQuery = null;
                let msBrandQuery = null;
                let msCatTotalQuery = null;

                if (!hasKeywordFilter) {
                    let pdpDimCol = dimension === 'sku' ? 'Product' : 'Brand';
                    let msDimCol = dimension === 'sku' ? 'item_name' : 'brand';
                    
                    const pdpPlatformCondition = buildCHCondition(filters.platform, 'Platform');
                    const msPlatformCondition = buildCHCondition(filters.platform, 'platform');
                    const pdpLocationCondition = buildCHCondition(filters.location, 'Location');
                    const msLocationCondition = buildCHCondition(filters.location, 'location');
                    const pdpCategoryCondition = buildCHCondition(filters.category || filters.format, 'Category');
                    const msCategoryCondition = buildCHCondition(filters.category || filters.format, 'category');
                    const pdpBrandsCondition = buildCHCondition(selectedBrands, pdpDimCol);
                    const msBrandsCondition = buildCHCondition(selectedBrands, msDimCol);

                    offtakeQuery = `
                        SELECT 
                            ${pdpDimCol} as brand_name,
                            ${dateAggregation.replace(/DATE/g, 'toDate(DATE)')} as crawl_date,
                            SUM(toFloat64OrZero(toString(Sales))) as total_sales
                        FROM rb_pdp_olap
                        WHERE toDate(DATE) BETWEEN '${dateFrom}' AND '${dateTo}'
                          AND ${pdpPlatformCondition}
                          AND ${pdpLocationCondition}
                          AND ${pdpCategoryCondition}
                          AND ${pdpBrandsCondition}
                        GROUP BY brand_name, crawl_date
                    `;
                    
                    msBrandQuery = `
                        SELECT 
                            ${msDimCol} as brand_name,
                            ${dateAggregation.replace(/DATE/g, 'toDate(created_on)')} as crawl_date,
                            SUM(toFloat64OrZero(toString(sales))) as brand_total_sales
                        FROM rb_ms_olap
                        WHERE toDate(created_on) BETWEEN '${dateFrom}' AND '${dateTo}'
                          AND ${msPlatformCondition}
                          AND ${msLocationCondition}
                          AND ${msCategoryCondition}
                          AND ${msBrandsCondition}
                        GROUP BY brand_name, crawl_date
                    `;
                    
                    msCatTotalQuery = `
                        SELECT 
                            ${dateAggregation.replace(/DATE/g, 'toDate(created_on)')} as crawl_date,
                            SUM(toFloat64OrZero(toString(sales))) as cat_total_sales
                        FROM rb_ms_olap
                        WHERE toDate(created_on) BETWEEN '${dateFrom}' AND '${dateTo}'
                          AND ${msPlatformCondition}
                          AND ${msLocationCondition}
                          AND ${msCategoryCondition}
                        GROUP BY crawl_date
                    `;

                    queries.push(queryClickHouse(offtakeQuery));
                    queries.push(queryClickHouse(msBrandQuery));
                    queries.push(queryClickHouse(msCatTotalQuery));
                }

                const [brandResults, offtakeResults, msResults, msTotalResults] = await Promise.all(queries);

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

                const offtakeMap = {};
                if (offtakeResults) {
                    offtakeResults.forEach(row => {
                        if (!offtakeMap[row.brand_name]) offtakeMap[row.brand_name] = {};
                        const dateStr = dayjs(row.crawl_date).format(dateFormat);
                        offtakeMap[row.brand_name][dateStr] = parseFloat(row.total_sales || 0);
                    });
                }

                const catTotalMap = {};
                if (msTotalResults) {
                    msTotalResults.forEach(row => {
                        const dateStr = dayjs(row.crawl_date).format(dateFormat);
                        catTotalMap[dateStr] = parseFloat(row.cat_total_sales || 0);
                    });
                }

                const msMap = {};
                if (msResults) {
                    msResults.forEach(row => {
                        if (!msMap[row.brand_name]) msMap[row.brand_name] = {};
                        const dateStr = dayjs(row.crawl_date).format(dateFormat);
                        const brandSales = parseFloat(row.brand_total_sales || 0);
                        const totalSales = catTotalMap[dateStr] || 0;
                        const catShare = totalSales > 0 ? (brandSales / totalSales) * 100 : 0;
                        msMap[row.brand_name][dateStr] = parseFloat(catShare.toFixed(2));
                    });
                }

                const brandsResult = {};
                selectedBrands.forEach((brandName, index) => {
                    const brandHistory = brandDataMap[brandName] || {};
                    const offtakeHistory = offtakeMap[brandName] || {};
                    const msHistory = msMap[brandName] || {};

                    const timeSeries = allDays.map(dateStr => {
                        const totalVol = volumeByDate[dateStr] || { overall: 1, spons: 1, organic: 1 };
                        const data = brandHistory[dateStr] || { brand_volume: 0, sponsored_volume: 0, organic_volume: 0, display_volume: 0 };
                        return {
                            date: dateStr,
                            overall_sos: Number(((data.brand_volume / totalVol.overall) * 100).toFixed(2)),
                            sponsored_sos: Number(((data.sponsored_volume / totalVol.spons) * 100).toFixed(2)),
                            organic_sos: Number(((data.organic_volume / totalVol.organic) * 100).toFixed(2)),
                            display_sos: Number(((data.display_volume / totalVol.spons) * 100).toFixed(2)),
                            offtake: offtakeHistory[dateStr] || null,
                            category_share: msHistory[dateStr] || null
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
    async getVisibilityKeywords(platform, category, brand, ownBrandsOnly = false) {
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
            if (ownBrandsOnly) {
                conds.push(`flag = 1`);
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
        const { keyword, platform, channel, keywordType, category, brand, ownBrandsOnly } = filters;
        let { startDate, endDate } = filters;

        console.log(`[VisibilityService] getSkuDrilldown called for keyword: "${keyword}"`, { startDate, endDate, channel });

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
            AND ${buildChannelCondition(channel, 'platform_name')}
        `;

        if (ownBrandsOnly) {
            query += " AND flag = 1";
        }

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
        const { keyword, sku, platform, channel, brand } = filters;
        let { startDate, endDate } = filters;

        console.log(`[VisibilityService] getCityDrilldown called for SKU: "${sku}" at Keyword: "${keyword}"`, { startDate, endDate, channel });

        // If dates not provided, fetch latest available date from DB
        if (!startDate || !endDate) {
            const maxDateRes = await queryClickHouse(`SELECT MAX(DATE) as maxDate FROM rb_kw_olap WHERE DATE IS NOT NULL`);
            const maxDate = maxDateRes[0]?.maxDate;
            if (!maxDate || maxDate === '0000-00-00') return { cities: [] };
            startDate = startDate || maxDate;
            endDate = endDate || maxDate;
        }

        // Final refined logic: Denominator is the ENTIRE city volume (as per user snippet).
        // Numerator is filtered by SKU, flag=1, and current platform/channel settings.
        const platformFilter = platform && platform !== 'All' ? "AND lower(platform_name) = lower({plt:String})" : "";
        const channelFilter = channel && channel !== 'All' ? `AND ${buildChannelCondition(channel, 'platform_name')}` : "";

        let query = `
            SELECT 
                location_name AS city,
                sumIf(toInt32(overall), lower(keyword_search_product) = lower({sku:String}) AND flag = 1 ${platformFilter} ${channelFilter}) AS num_overall,
                sumIf(toInt32(organic), lower(keyword_search_product) = lower({sku:String}) AND flag = 1 ${platformFilter} ${channelFilter}) AS num_organic,
                sumIf(toInt32(spons), lower(keyword_search_product) = lower({sku:String}) AND flag = 1 ${platformFilter} ${channelFilter}) AS num_spons,
                sum(toInt32(overall)) AS den_overall,
                sum(toInt32(organic)) AS den_organic,
                sum(toInt32(spons)) AS den_spons,
                ROUND(num_overall * 100.0 / nullIf(den_overall, 0), 2) AS overallSos,
                ROUND(num_organic * 100.0 / nullIf(den_organic, 0), 2) AS organicSos,
                ROUND(num_spons * 100.0 / nullIf(den_spons, 0), 2) AS paidSos,
                ROUND(avgIf(POSITION, lower(keyword_search_product) = lower({sku:String}) AND toInt32(overall) = 1 ${platformFilter} ${channelFilter}), 1) AS overallRank,
                ROUND(avgIf(POSITION, lower(keyword_search_product) = lower({sku:String}) AND toInt32(spons) = 1 ${platformFilter} ${channelFilter}), 1) AS paidRank,
                ROUND(avgIf(POSITION, lower(keyword_search_product) = lower({sku:String}) AND toInt32(organic) = 1 ${platformFilter} ${channelFilter}), 1) AS organicRank
            FROM rb_kw_olap
            WHERE DATE BETWEEN {sd:String} AND {ed:String}
            GROUP BY city 
            HAVING num_overall > 0 
            ORDER BY overallSos DESC 
            LIMIT 50
        `;

        const params = { sku: sku, sd: startDate, ed: endDate };
        if (platform && platform !== 'All') params.plt = platform;

        try {
            const cities = await queryClickHouse(query, params);
            console.log(`[VisibilityService] getCityDrilldown returned ${cities.length} cities`);
            return { cities };
        } catch (error) {
            console.error('[VisibilityService] Error getting City drilldown:', error);
            throw error;
        }
    }

    /**
     * Get SOS Gainers & Drainers — Brand → Keyword → Location hierarchy
     * Brand SOS: sum(brand_impressions) * 100 / (SELECT sum(all_impressions))  [user's exact pattern]
     * Keyword SOS: sumIf(col, brand='X') * 100 / sum(col)  grouped by keyword
     * Location SOS: sumIf(col, brand='X') * 100 / sum(col)  grouped by location
     * Classifies by delta sign: positive change = gainer, negative change = drainer
     */
    async getSOSGainersAndDrainers(filters) {
        console.log('[VisibilityService] getSOSGainersAndDrainers called with filters:', filters);
        const cacheKey = generateCacheKey('visibility_gainers_drainers_v4', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                const { startDate, endDate, platform, brand, location, keyword, keywordType, category, channel } = filters;

                // If dates not provided, fetch latest available date from DB
                if (!startDate || !endDate) {
                    const maxDateRes = await queryClickHouse(`SELECT MAX(DATE) as maxDate FROM rb_kw_olap WHERE DATE IS NOT NULL`);
                    const maxDate = maxDateRes[0]?.maxDate;
                    if (!maxDate || maxDate === '0000-00-00') return { gain: [], drain: [] };
                    endDate = endDate || maxDate;
                    startDate = startDate || maxDate;
                }

                // Compute previous period of equal length
                const durationDays = dayjs(endDate).diff(dayjs(startDate), 'day') + 1;
                const prevEnd = dayjs(startDate).subtract(1, 'day').format('YYYY-MM-DD');
                const prevStart = dayjs(startDate).subtract(durationDays, 'day').format('YYYY-MM-DD');

                // Build filter conditions — same helpers as calculateAllSOS
                const platformCond = buildCHCondition(platform, 'platform_name');
                const channelCond = buildChannelCondition(channel, 'platform_name');
                const locationCond = buildCHCondition(location, 'location_name');
                const keywordCond = buildCHCondition(keyword, 'keyword');
                const keywordTypeCond = buildCHCondition(processKeywordType(keywordType), 'keyword_type');
                const categoryCond = buildCHCondition(category, 'keyword_category', { isCategory: true });

                const globalFilterClause = `
                    AND ${platformCond}
                    AND ${channelCond}
                    AND ${locationCond}
                    AND ${categoryCond}
                `;

                const filterClause = `
                    ${globalFilterClause}
                    AND ${keywordCond}
                    AND ${keywordTypeCond}
                `;

                // ── Step 1: Brand-level SOS — grouped by brand AND platform ──
                const brandQuery = `
                    SELECT 
                        brand, 
                        platform_name AS platform, 
                        'current' AS period,
                        sum(toInt32(overall)) as b_overall,
                        sum(toInt32(organic)) as b_organic,
                        sum(toInt32(spons)) as b_sponsored,
                        SUM(b_overall) OVER(PARTITION BY platform_name) as p_overall,
                        SUM(b_organic) OVER(PARTITION BY platform_name) as p_organic,
                        SUM(b_sponsored) OVER(PARTITION BY platform_name) as p_sponsored,
                        ROUND(b_overall * 100.0 / nullIf(p_overall, 0), 2) AS overall_sos,
                        ROUND(b_organic * 100.0 / nullIf(p_organic, 0), 2) AS organic_sos,
                        ROUND(b_sponsored * 100.0 / nullIf(p_sponsored, 0), 2) AS paid_sos
                    FROM rb_kw_olap
                    WHERE DATE BETWEEN '${startDate}' AND '${endDate}' ${globalFilterClause}
                    GROUP BY brand, platform_name

                    UNION ALL

                    SELECT 
                        brand, 
                        platform_name AS platform, 
                        'previous' AS period,
                        sum(toInt32(overall)) as b_overall,
                        sum(toInt32(organic)) as b_organic,
                        sum(toInt32(spons)) as b_sponsored,
                        SUM(b_overall) OVER(PARTITION BY platform_name) as p_overall,
                        SUM(b_organic) OVER(PARTITION BY platform_name) as p_organic,
                        SUM(b_sponsored) OVER(PARTITION BY platform_name) as p_sponsored,
                        ROUND(b_overall * 100.0 / nullIf(p_overall, 0), 2) AS overall_sos,
                        ROUND(b_organic * 100.0 / nullIf(p_organic, 0), 2) AS organic_sos,
                        ROUND(b_sponsored * 100.0 / nullIf(p_sponsored, 0), 2) AS paid_sos
                    FROM rb_kw_olap
                    WHERE DATE BETWEEN '${prevStart}' AND '${prevEnd}' ${globalFilterClause}
                    GROUP BY brand, platform_name
                `;

                const brandRows = await queryClickHouse(brandQuery);

                // Build brand map: { "brand||platform": { brand, platform, current: {...}, previous: {...} } }
                const brandMap = {};
                for (const row of brandRows) {
                    const b = row.brand;
                    const p = row.platform;
                    if (!b || b.trim().toLowerCase() === 'other' || !p) continue;

                    const key = `${b}||${p}`;
                    if (!brandMap[key]) brandMap[key] = { brand: b, platform: p };
                    brandMap[key][row.period] = {
                        overall: Number(row.overall_sos) || 0,
                        organic: Number(row.organic_sos) || 0,
                        paid: Number(row.paid_sos) || 0,
                    };
                }

                // ── Step 2: Get keyword-level SOS per brand+platform for classification ──
                const allBrandKeys = Object.keys(brandMap);
                if (allBrandKeys.length === 0) return { gain: [], drain: [] };

                const brandListSQL = [...new Set(allBrandKeys.map(k => brandMap[k].brand))].map(b => `'${escapeCH(b)}'`).join(',');

                // Query A: Raw impression counts per (brand, keyword, platform)
                const brandKwCountsQuery = `
                    SELECT brand, keyword AS kw, platform_name AS platform, 'current' AS period,
                        sum(toInt32(overall)) AS cnt_overall,
                        sum(toInt32(organic)) AS cnt_organic,
                        sum(toInt32(spons)) AS cnt_spons
                    FROM rb_kw_olap
                    WHERE DATE BETWEEN '${startDate}' AND '${endDate}' ${filterClause}
                      AND brand IN (${brandListSQL})
                    GROUP BY brand, keyword, platform_name
                    HAVING cnt_overall > 0

                    UNION ALL

                    SELECT brand, keyword AS kw, platform_name AS platform, 'previous' AS period,
                        sum(toInt32(overall)) AS cnt_overall,
                        sum(toInt32(organic)) AS cnt_organic,
                        sum(toInt32(spons)) AS cnt_spons
                    FROM rb_kw_olap
                    WHERE DATE BETWEEN '${prevStart}' AND '${prevEnd}' ${filterClause}
                      AND brand IN (${brandListSQL})
                    GROUP BY brand, keyword, platform_name
                    HAVING cnt_overall > 0
                `;

                // Query B: Total impression counts per (keyword, platform)
                const kwTotalsQuery = `
                    SELECT keyword AS kw, platform_name AS platform, 'current' AS period,
                        sum(toInt32(overall)) AS total_overall,
                        sum(toInt32(organic)) AS total_organic,
                        sum(toInt32(spons)) AS total_spons
                    FROM rb_kw_olap
                    WHERE DATE BETWEEN '${startDate}' AND '${endDate}' ${filterClause}
                    GROUP BY keyword, platform_name
                    HAVING total_overall > 0

                    UNION ALL

                    SELECT keyword AS kw, platform_name AS platform, 'previous' AS period,
                        sum(toInt32(overall)) AS total_overall,
                        sum(toInt32(organic)) AS total_organic,
                        sum(toInt32(spons)) AS total_spons
                    FROM rb_kw_olap
                    WHERE DATE BETWEEN '${prevStart}' AND '${prevEnd}' ${filterClause}
                    GROUP BY keyword, platform_name
                    HAVING total_overall > 0
                `;

                const [brandKwRows, kwTotalRows] = await Promise.all([
                    queryClickHouse(brandKwCountsQuery),
                    queryClickHouse(kwTotalsQuery)
                ]);

                // Build keyword totals map: { "keyword||platform||period": { overall, organic, spons } }
                const kwTotals = {};
                for (const row of kwTotalRows) {
                    const key = `${row.kw}||${row.platform}||${row.period}`;
                    kwTotals[key] = {
                        overall: Number(row.total_overall) || 1,
                        organic: Number(row.total_organic) || 1,
                        spons: Number(row.total_spons) || 1,
                    };
                }

                // Build keyword map with SOS
                const kwMap = {};
                for (const row of brandKwRows) {
                    if (!row.brand || !row.kw || !row.platform) continue;
                    const key = `${row.brand}||${row.platform}||${row.kw}`;
                    const totKey = `${row.kw}||${row.platform}||${row.period}`;
                    const tot = kwTotals[totKey] || { overall: 1, organic: 1, spons: 1 };

                    if (!kwMap[key]) kwMap[key] = { brand: row.brand, platform: row.platform, kw: row.kw };
                    kwMap[key][row.period] = {
                        overall: Number(((Number(row.cnt_overall) / tot.overall) * 100).toFixed(2)),
                        organic: Number(((Number(row.cnt_organic) / tot.organic) * 100).toFixed(2)),
                        paid: Number(((Number(row.cnt_spons) / tot.spons) * 100).toFixed(2)),
                    };
                }

                // Compute keyword-level deltas and classify
                const kwList = Object.values(kwMap).map(item => {
                    const curr = item.current || { overall: 0, organic: 0, paid: 0 };
                    const prev = item.previous || { overall: 0, organic: 0, paid: 0 };
                    return {
                        brand: item.brand,
                        platform: item.platform,
                        kw: item.kw,
                        overall: curr.overall,
                        organic: curr.organic,
                        paid: curr.paid,
                        dO: Number((curr.overall - prev.overall).toFixed(2)),
                        dOr: Number((curr.organic - prev.organic).toFixed(2)),
                        dP: Number((curr.paid - prev.paid).toFixed(2)),
                    };
                });

                // Split keywords into gainers and drainers by their own delta
                const kwGainers = kwList.filter(k => k.dO > 0).sort((a, b) => b.dO - a.dO);
                const kwDrainers = kwList.filter(k => k.dO < 0).sort((a, b) => a.dO - b.dO);

                // Group keywords by brand+platform and build hierarchy
                const groupByBrand = (keywords) => {
                    const grouped = {};
                    for (const kw of keywords) {
                        const key = `${kw.brand}||${kw.platform}`;
                        if (!grouped[key]) grouped[key] = [];
                        grouped[key].push(kw);
                    }
                    // Build brand-level entries with aggregated SOS from brandMap
                    return Object.entries(grouped).map(([key, kws]) => {
                        const bPeriods = brandMap[key] || {};
                        const curr = bPeriods.current || { overall: 0, organic: 0, paid: 0 };
                        const prev = bPeriods.previous || { overall: 0, organic: 0, paid: 0 };
                        return {
                            brand: bPeriods.brand || kws[0].brand,
                            platform: bPeriods.platform || kws[0].platform,
                            overall: curr.overall,
                            organic: curr.organic,
                            paid: curr.paid,
                            dOverall: Number((curr.overall - prev.overall).toFixed(2)),
                            dOrganic: Number((curr.organic - prev.organic).toFixed(2)),
                            dPaid: Number((curr.paid - prev.paid).toFixed(2)),
                            keywords: kws.slice(0, 10), // top 10 keywords
                        };
                    });
                };

                let gainerBrands = groupByBrand(kwGainers);
                let drainerBrands = groupByBrand(kwDrainers);

                // Sort brands by number of classified keywords (most keywords first)
                gainerBrands.sort((a, b) => b.keywords.length - a.keywords.length);
                drainerBrands.sort((a, b) => b.keywords.length - a.keywords.length);

                // Limit to top 10 brands
                gainerBrands = gainerBrands.slice(0, 5);
                drainerBrands = drainerBrands.slice(0, 5);

                // ── Step 3: Location drill-down for each keyword ──
                const enrichBrandKws = async (brandItem, isGainer) => {
                    const escapedBrand = escapeCH(brandItem.brand);
                    const escapedPlatform = escapeCH(brandItem.platform);

                    const keywords = await Promise.all(
                        brandItem.keywords.map(async (kwItem) => {
                            const escapedKw = escapeCH(kwItem.kw);

                            const locQuery = `
                                SELECT location_name AS loc, 'current' AS period,
                                    ROUND(sumIf(toInt32(overall), brand = '${escapedBrand}') * 100.0 /
                                        nullIf(sum(toInt32(overall)), 0), 2) AS overall_sos,
                                    ROUND(sumIf(toInt32(organic), brand = '${escapedBrand}') * 100.0 /
                                        nullIf(sum(toInt32(organic)), 0), 2) AS organic_sos,
                                    ROUND(sumIf(toInt32(spons), brand = '${escapedBrand}') * 100.0 /
                                        nullIf(sum(toInt32(spons)), 0), 2) AS paid_sos
                                FROM rb_kw_olap
                                WHERE keyword = '${escapedKw}'
                                  AND platform_name = '${escapedPlatform}'
                                  AND DATE BETWEEN '${startDate}' AND '${endDate}' ${filterClause.replace(`AND platform_name = '${escapedPlatform}'`, "").replace(/AND\s+IN\s+\([^)]+\)/g, "")}
                                GROUP BY location_name
                                HAVING sumIf(toInt32(overall), brand = '${escapedBrand}') > 0

                                UNION ALL

                                SELECT location_name AS loc, 'previous' AS period,
                                    ROUND(sumIf(toInt32(overall), brand = '${escapedBrand}') * 100.0 /
                                        nullIf(sum(toInt32(overall)), 0), 2) AS overall_sos,
                                    ROUND(sumIf(toInt32(organic), brand = '${escapedBrand}') * 100.0 /
                                        nullIf(sum(toInt32(organic)), 0), 2) AS organic_sos,
                                    ROUND(sumIf(toInt32(spons), brand = '${escapedBrand}') * 100.0 /
                                        nullIf(sum(toInt32(spons)), 0), 2) AS paid_sos
                                FROM rb_kw_olap
                                WHERE keyword = '${escapedKw}'
                                  AND platform_name = '${escapedPlatform}'
                                  AND DATE BETWEEN '${prevStart}' AND '${prevEnd}' ${filterClause.replace(`AND platform_name = '${escapedPlatform}'`, "").replace(/AND\s+IN\s+\([^)]+\)/g, "")}
                                GROUP BY location_name
                                HAVING sumIf(toInt32(overall), brand = '${escapedBrand}') > 0
                            `;

                            const locRows = await queryClickHouse(locQuery);
                            const locMap = {};
                            for (const row of locRows) {
                                const l = row.loc;
                                if (!l) continue;
                                if (!locMap[l]) locMap[l] = {};
                                locMap[l][row.period] = {
                                    overall: Number(row.overall_sos) || 0,
                                    organic: Number(row.organic_sos) || 0,
                                    paid: Number(row.paid_sos) || 0,
                                };
                            }

                            const allLocations = Object.entries(locMap).map(([loc, periods]) => {
                                const curr = periods.current || { overall: 0, organic: 0, paid: 0 };
                                const prev = periods.previous || { overall: 0, organic: 0, paid: 0 };
                                return {
                                    loc,
                                    overall: curr.overall,
                                    organic: curr.organic,
                                    paid: curr.paid,
                                    dO: Number((curr.overall - prev.overall).toFixed(2)),
                                    dOr: Number((curr.organic - prev.organic).toFixed(2)),
                                    dP: Number((curr.paid - prev.paid).toFixed(2)),
                                };
                            });

                            // Filter and sort locations matching keyword direction
                            const locations = isGainer
                                ? allLocations.filter(l => l.dO > 0).sort((a, b) => b.dO - a.dO).slice(0, 5)
                                : allLocations.filter(l => l.dO < 0).sort((a, b) => a.dO - b.dO).slice(0, 5);

                            return { ...kwItem, locations };
                        })
                    );

                    return { ...brandItem, keywords };
                };

                const [gain, drain] = await Promise.all([
                    Promise.all(gainerBrands.map(b => enrichBrandKws(b, true))),
                    Promise.all(drainerBrands.map(b => enrichBrandKws(b, false))),
                ]);

                console.log(`[VisibilityService] getSOSGainersAndDrainers returned ${gain.length} gainers, ${drain.length} drainers`);
                return { gain, drain };
            } catch (error) {
                return { gain: [], drain: [] };
            }
        }, CACHE_TTL.ONE_HOUR);
    }

    /**
     * Get Search Terms Performance (Top Search Terms segment with Keyword/SKU modes)
     * Queries rb_kw_olap for SOS metrics by keyword or SKU
     */
    async getSearchTermsPerformance(filters = {}) {
        console.log('[VisibilityService] getSearchTermsPerformance called');
        const cacheKey = generateCacheKey('search_terms_perf_v4', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                const {
                    viewMode = 'keyword',
                    platform = 'All',
                    brand = 'All',
                    location = 'All',
                    keywordType = 'All',
                    keywordTypeFilter = 'All',
                    keyword = 'All',
                    ownBrandsOnly = false,
                    startDate,
                    endDate,
                    category = 'All',
                    channel = 'All'
                } = filters;

                const dateFrom = startDate ? dayjs(startDate).format('YYYY-MM-DD') : dayjs().subtract(30, 'day').format('YYYY-MM-DD');
                const dateTo = endDate ? dayjs(endDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');

                // Conditions
                const platformCondition = buildCHCondition(platform, 'platform_name');
                const channelCondition = buildChannelCondition(channel, 'platform_name');
                const brandCondition = buildCHCondition(brand, 'brand');
                const locationCondition = buildCHCondition(location, 'location_name');
                const globalKeywordTypeCondition = buildCHCondition(processKeywordType(keywordType), 'keyword_type');
                const localKeywordTypeCondition = buildCHCondition(processKeywordType(keywordTypeFilter), 'keyword_type');
                const categoryCondition = buildCHCondition(category, 'keyword_category', { isCategory: true });
                const keywordCondition = buildCHCondition(keyword, 'keyword');
                const ownBrandsCondition = ownBrandsOnly ? 'AND toInt32(flag) = 1' : 'AND 1=1';

                const dimColumn = viewMode === 'keyword' ? 'keyword' : 'keyword_search_product';

                const colsRes = await queryClickHouse(`SELECT name FROM system.columns WHERE database = currentDatabase() AND table = 'rb_kw_olap'`);
                const hasSearchVolPct = colsRes.some((c) => c.name === 'search_volume_percentage');
                const searchVolumeSelect = hasSearchVolPct
                    ? `ROUND(AVG(toFloat64OrZero(toString(search_volume_percentage))), 2)`
                    : `0`;

                // Calculate total landscape volume for relative share (ignoring local segment filters)
                const landscapeVolQuery = `
                    SELECT sum(toInt32(overall)) as total_vol
                    FROM rb_kw_olap
                    WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
                      AND ${platformCondition}
                      AND ${channelCondition}
                      AND ${locationCondition}
                      AND ${categoryCondition}
                      AND ${brandCondition}
                      AND ${globalKeywordTypeCondition}
                      ${ownBrandsCondition}
                      AND ${dimColumn} IS NOT NULL AND ${dimColumn} != ''
                `;
                const landscapeRes = await queryClickHouse(landscapeVolQuery);
                const totalLandscapeVol = Number(landscapeRes[0]?.total_vol) || 0;

                const mainQuery = `
                    SELECT 
                        ${dimColumn} as name,
                        arrayElement(arrayFilter(x -> lowerUTF8(x) NOT IN ('other', 'others', ''), topK(5)(brand)), 1) as brand_name,
                        ${viewMode === 'keyword' ? "sumIf(toInt32(overall), flag = 1)" : "sum(toInt32(overall))"} as num_overall,
                        ${viewMode === 'keyword' ? "sum(toInt32(overall))" : "SUM(sum(toInt32(overall))) OVER()"} as den_overall,
                        ROUND(num_overall * 100.0 / nullIf(den_overall, 0), 2) AS overall_sos,

                        ${viewMode === 'keyword' ? "sumIf(toInt32(organic), flag = 1)" : "sum(toInt32(organic))"} as num_organic,
                        ${viewMode === 'keyword' ? "sum(toInt32(organic))" : "SUM(sum(toInt32(organic))) OVER()"} as den_organic,
                        ROUND(num_organic * 100.0 / nullIf(den_organic, 0), 2) AS organic_sos,

                        ${viewMode === 'keyword' ? "sumIf(toInt32(spons), flag = 1)" : "sum(toInt32(spons))"} as num_spons,
                        ${viewMode === 'keyword' ? "sum(toInt32(spons))" : "SUM(sum(toInt32(spons))) OVER()"} as den_spons,
                        ROUND(num_spons * 100.0 / nullIf(den_overall, 0), 2) AS paid_sos,

                        count(*) as impressions,
                        ${searchVolumeSelect} as search_volume,
                        ROUND(sum(toInt32(overall)) * 100.0 / nullIf(${totalLandscapeVol}, 0), 2) as max_vol_share,
                        arrayElement(topKIf(1)(toInt32(POSITION), toInt32(spons) = 1 ${viewMode === 'keyword' ? "AND flag = 1" : ""}), 1) AS ad_position,
                        arrayElement(topKIf(1)(toInt32(POSITION), toInt32(organic) = 1 ${viewMode === 'keyword' ? "AND flag = 1" : ""}), 1) AS organic_position
                    FROM rb_kw_olap
                    WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
                      AND ${platformCondition}
                      AND ${channelCondition}
                      AND ${locationCondition}
                      AND ${categoryCondition}
                      AND ${brandCondition}
                      AND ${globalKeywordTypeCondition}
                      AND ${localKeywordTypeCondition}
                      AND ${keywordCondition}
                      ${ownBrandsCondition}
                      AND ${dimColumn} IS NOT NULL AND ${dimColumn} != ''
                    GROUP BY ${dimColumn}
                    ORDER BY impressions DESC
                `;

                console.log('[VisibilityService] getSearchTermsPerformance query:', mainQuery.replace(/\s+/g, ' '));
                const results = await queryClickHouse(mainQuery);
                console.log('[VisibilityService] getSearchTermsPerformance results count:', results.length);

                // Group by name if keyword view (since keywords can have multiple brands)
                // We want the leading brand (one with highest impressions for that keyword)
                const itemsMap = {};
                results.forEach(row => {
                    itemsMap[row.name] = {
                        name: row.name,
                        leadingBrand: row.brand_name || 'Other',
                        overallSOS: Number(row.overall_sos) || 0,
                        organicSOS: Number(row.organic_sos) || 0,
                        paidSOS: Number(row.paid_sos) || 0,
                        volShare: Number(row.max_vol_share) || 0,
                        searchVolume: Number(row.search_volume) || 0,
                        impressions: Number(row.impressions),
                        adPosition: Number(row.ad_position) || null,
                        organicPosition: Number(row.organic_position) || null,
                        imageUrl: null
                    };
                });

                // Fetch SKU images from rb_sku_platform when in SKU view mode
                if (viewMode !== 'keyword') {
                    const skuNames = Object.keys(itemsMap).filter(Boolean);
                    if (skuNames.length > 0) {
                        try {
                            const imgQuery = `
                                SELECT sku_name, any(image_url) as img
                                FROM rb_sku_platform
                                WHERE sku_name IN (${skuNames.map(n => `'${escapeCH(n)}'`).join(',')})
                                GROUP BY sku_name
                            `;
                            const imgData = await queryClickHouse(imgQuery);
                            imgData.forEach(row => {
                                if (row.sku_name && itemsMap[row.sku_name]) {
                                    const imgUrl = row.img ? String(row.img).split(',')[0].trim() : null;
                                    itemsMap[row.sku_name].imageUrl = imgUrl || null;
                                }
                            });
                            console.log(`[VisibilityService] Fetched ${imgData.length} SKU images from rb_sku_platform`);
                        } catch (imgError) {
                            console.error('[VisibilityService] Failed to fetch SKU images from rb_sku_platform:', imgError);
                        }
                    }
                }

                const items = Object.values(itemsMap).sort((a, b) => b.overallSOS - a.overallSOS);

                // ── Summary row: aggregate SOS across all keywords at filter level (keyword mode only) ──
                let summary = null;
                if (viewMode === 'keyword') {
                    try {
                        // Query 1: Aggregate SOS + leading brand + keyword count across all keywords
                        const summaryQuery = `
                            SELECT
                                arrayElement(arrayFilter(x -> lowerUTF8(x) NOT IN ('other', 'others', ''), topK(5)(brand)), 1) as leading_brand,
                                count(DISTINCT keyword) as total_keywords,
                                count(*) as total_impressions,
                                ${hasSearchVolPct ? `ROUND(AVG(toFloat64OrZero(toString(search_volume_percentage))), 2)` : `sum(toInt32(overall))`} as total_search_volume,
                                sumIf(toInt32(overall), flag = 1) as num_overall,
                                sum(toInt32(overall)) as den_overall,
                                ROUND(num_overall * 100.0 / nullIf(den_overall, 0), 2) AS overall_sos,

                                sumIf(toInt32(organic), flag = 1) as num_organic,
                                sum(toInt32(organic)) as den_organic,
                                ROUND(num_organic * 100.0 / nullIf(den_organic, 0), 2) AS organic_sos,

                                sumIf(toInt32(spons), flag = 1) as num_spons,
                                ROUND(num_spons * 100.0 / nullIf(den_overall, 0), 2) AS paid_sos
                            FROM rb_kw_olap
                            WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
                              AND ${platformCondition}
                              AND ${channelCondition}
                              AND ${locationCondition}
                              AND ${categoryCondition}
                              AND ${brandCondition}
                              AND ${globalKeywordTypeCondition}
                              AND ${localKeywordTypeCondition}
                              AND ${keywordCondition}
                              ${ownBrandsCondition}
                              AND keyword IS NOT NULL AND keyword != ''
                        `;

                        // Query 2: Location-level breakdown for summary drill-down
                        const summaryLocQuery = `
                            SELECT
                                location_name as city,
                                sumIf(toInt32(overall), flag = 1) as num_overall,
                                sum(toInt32(overall)) as den_overall,
                                ROUND(num_overall * 100.0 / nullIf(den_overall, 0), 2) AS overall_sos,

                                sumIf(toInt32(organic), flag = 1) as num_organic,
                                sum(toInt32(organic)) as den_organic,
                                ROUND(num_organic * 100.0 / nullIf(den_organic, 0), 2) AS organic_sos,

                                sumIf(toInt32(spons), flag = 1) as num_spons,
                                ROUND(num_spons * 100.0 / nullIf(den_overall, 0), 2) AS paid_sos
                            FROM rb_kw_olap
                            WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
                              AND ${platformCondition}
                              AND ${channelCondition}
                              AND ${locationCondition}
                              AND ${categoryCondition}
                              AND ${brandCondition}
                              AND ${globalKeywordTypeCondition}
                              AND ${localKeywordTypeCondition}
                              AND ${keywordCondition}
                              ${ownBrandsCondition}
                              AND keyword IS NOT NULL AND keyword != ''
                              AND location_name IS NOT NULL AND location_name != ''
                            GROUP BY location_name
                            ORDER BY overall_sos DESC
                        `;

                        const [summaryRes, locRes] = await Promise.all([
                            queryClickHouse(summaryQuery),
                            queryClickHouse(summaryLocQuery)
                        ]);

                        const sRow = summaryRes[0];
                        if (sRow) {
                            const locations = (locRes || [])
                                .filter(l => l.city && l.city.toLowerCase() !== 'other' && l.city.toLowerCase() !== 'others')
                                .map(l => ({
                                    city: l.city,
                                    overallSOS: Number(l.overall_sos) || 0,
                                    organicSOS: Number(l.organic_sos) || 0,
                                    paidSOS: Number(l.paid_sos) || 0
                                }));

                            summary = {
                                leadingBrand: sRow.leading_brand || 'Other',
                                overallSOS: Number(sRow.overall_sos) || 0,
                                organicSOS: Number(sRow.organic_sos) || 0,
                                paidSOS: Number(sRow.paid_sos) || 0,
                                totalKeywords: Number(sRow.total_keywords) || 0,
                                totalSearchVolume: Number(sRow.total_search_volume) || 0,
                                filterLabel: keywordTypeFilter !== 'All' ? keywordTypeFilter : 'All',
                                locations
                            };
                        }
                        console.log('[VisibilityService] Summary computed:', summary ? `Overall SOS: ${summary.overallSOS}%, Keywords: ${summary.totalKeywords}` : 'null');
                    } catch (sumErr) {
                        console.error('[VisibilityService] Error computing summary row:', sumErr);
                        // Non-critical — continue without summary
                    }
                }

                return { items, mode: viewMode, summary };
            } catch (error) {
                console.error('[VisibilityService] Error in getSearchTermsPerformance:', error);
                return { items: [], mode: filters.viewMode || 'keyword', summary: null };
            }
        }, CACHE_TTL.ONE_HOUR);
    }

    /**
     * Get Search Terms Location Drilldown
     * Queries rb_kw_olap for SOS metrics by location for a specific keyword/SKU
     */
    async getSearchTermsLocationDrilldown(filters = {}) {
        console.log('[VisibilityService] getSearchTermsLocationDrilldown called');
        const cacheKey = generateCacheKey('search_terms_loc_drill', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                const platform = filters.platform || 'All';
                const sku = filters.sku || null;
                const keyword = filters.keyword || null;

                const startDate = filters.startDate;
                const endDate = filters.endDate;

                const dateFrom = startDate ? dayjs(startDate).format('YYYY-MM-DD') : dayjs().subtract(30, 'day').format('YYYY-MM-DD');
                const dateTo = endDate ? dayjs(endDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');

                const dimColumn = sku ? 'keyword_search_product' : 'keyword';
                const dimValue = sku || keyword;

                let platformCondition = buildCHCondition(platform, 'platform_name');
                const channelCondition = buildChannelCondition(filters.channel, 'platform_name');
                platformCondition = `${platformCondition} AND ${channelCondition}`;

                const isEcomPlatform = (plat) => {
                    if (!plat || plat === 'All') return false;
                    const plats = plat.split(',').map(p => p.trim().toLowerCase());
                    return plats.some(p => ['amazon', 'flipkart'].includes(p));
                };

                const isQuickCommPlatform = (plat) => {
                    if (!plat || plat === 'All') return false;
                    const plats = plat.split(',').map(p => p.trim().toLowerCase());
                    return plats.some(p => ['blinkit', 'zepto', 'instamart', 'swiggy instamart', 'swiggy'].includes(p));
                };

                let locationFilter = "AND location_name IS NOT NULL AND location_name != ''";
                if (filters.channel === 'Quick Commerce' || isQuickCommPlatform(platform)) {
                    locationFilter += " AND lower(location_name) NOT IN ('nation', 'national', 'all india', 'india', 'total')";
                } else if (filters.channel === 'Ecommerce' || isEcomPlatform(platform)) {
                    locationFilter += " AND lower(location_name) IN ('nation', 'national', 'all india', 'india', 'total')";
                }

                // For SKU mode: denominator = total city volume (all SKUs), numerator = this SKU with flag=1
                // For keyword mode: denominator = total keyword volume in city, numerator = keyword with flag=1
                const skuCondition = sku ? `lower(keyword_search_product) = lower('${escapeCH(sku)}')` : null;
                const kwCondition = keyword ? `lower(keyword) = lower('${escapeCH(keyword)}')` : null;

                let query;
                if (sku) {
                    // SKU mode: scan full table per city, use sumIf for numerator
                    query = `
                        SELECT 
                            location_name as city,
                            sumIf(toInt32(overall), ${skuCondition} AND flag = 1) as num_overall,
                            sum(toInt32(overall)) as den_overall,
                            ROUND(num_overall * 100.0 / nullIf(den_overall, 0), 2) AS overall_sos,

                            sumIf(toInt32(organic), ${skuCondition} AND flag = 1) as num_organic,
                            sum(toInt32(organic)) as den_organic,
                            ROUND(num_organic * 100.0 / nullIf(den_organic, 0), 2) AS organic_sos,

                            sumIf(toInt32(spons), ${skuCondition} AND flag = 1) as num_spons,
                            sum(toInt32(spons)) as den_spons,
                            ROUND(num_spons * 100.0 / nullIf(den_overall, 0), 2) AS paid_sos
                        FROM rb_kw_olap
                        WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
                          AND ${platformCondition}
                          ${locationFilter}
                        GROUP BY location_name
                        HAVING num_overall > 0
                        ORDER BY overall_sos DESC
                    `;
                } else {
                    // Keyword mode: filter by keyword, numerator uses flag=1
                    query = `
                        SELECT 
                            location_name as city,
                            sumIf(toInt32(overall), flag = 1) as num_overall,
                            sum(toInt32(overall)) as den_overall,
                            ROUND(num_overall * 100.0 / nullIf(den_overall, 0), 2) AS overall_sos,

                            sumIf(toInt32(organic), flag = 1) as num_organic,
                            sum(toInt32(organic)) as den_organic,
                            ROUND(num_organic * 100.0 / nullIf(den_organic, 0), 2) AS organic_sos,

                            sumIf(toInt32(spons), flag = 1) as num_spons,
                            sum(toInt32(spons)) as den_spons,
                            ROUND(num_spons * 100.0 / nullIf(den_overall, 0), 2) AS paid_sos
                        FROM rb_kw_olap
                        WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
                          AND ${platformCondition}
                          AND ${buildCHCondition(dimValue, dimColumn)}
                          ${locationFilter}
                        GROUP BY location_name
                        ORDER BY overall_sos DESC
                    `;
                }

                const results = await queryClickHouse(query);
                const locations = results.map(row => ({
                    city: row.city,
                    overallSOS: Number(row.overall_sos) || 0,
                    organicSOS: Number(row.organic_sos) || 0,
                    paidSOS: Number(row.paid_sos) || 0
                }));

                return { locations };
            } catch (error) {
                console.error('[VisibilityService] Error in getSearchTermsLocationDrilldown:', error);
                return { locations: [] };
            }
        }, CACHE_TTL.ONE_HOUR);
    }

    /**
     * Get Search Terms Brand Breakdown
     * Returns SOS for all brands for a specific keyword/platform
     */
    async getSearchTermsBrandBreakdown(filters = {}) {
        console.log('[VisibilityService] getSearchTermsBrandBreakdown called');
        const cacheKey = generateCacheKey('search_terms_brand_breakdown', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                const { platform = 'All', keyword = 'All', startDate, endDate } = filters;
                if (keyword === 'All') return [];

                const dateFrom = startDate ? dayjs(startDate).format('YYYY-MM-DD') : dayjs().subtract(30, 'day').format('YYYY-MM-DD');
                const dateTo = endDate ? dayjs(endDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');

                const query = `
                    SELECT 
                        brand,
                        sum(toInt32(overall)) as brand_volume,
                        SUM(sum(toInt32(overall))) OVER() as total_volume,
                        ROUND(brand_volume * 100.0 / nullIf(total_volume, 0), 2) as overall_sos,
                        
                        sum(toInt32(organic)) as org_volume,
                        SUM(sum(toInt32(organic))) OVER() as total_organic_volume,
                        ROUND(org_volume * 100.0 / nullIf(total_organic_volume, 0), 2) as organic_sos,

                        sum(toInt32(spons)) as paid_volume,
                        ROUND(paid_volume * 100.0 / nullIf(total_volume, 0), 2) as paid_sos
                    FROM rb_kw_olap
                    WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
                      AND ${buildCHCondition(platform, 'platform_name')}
                      AND ${buildCHCondition(keyword, 'keyword')}
                      AND brand IS NOT NULL AND brand != ''
                    GROUP BY brand
                    ORDER BY overall_sos DESC
                `;

                const results = await queryClickHouse(query);
                return results.map(row => ({
                    brand: row.brand,
                    overallSOS: Number(row.overall_sos) || 0,
                    organicSOS: Number(row.organic_sos) || 0,
                    paidSOS: Number(row.paid_sos) || 0
                }));
            } catch (error) {
                console.error('[VisibilityService] Error in getSearchTermsBrandBreakdown:', error);
                return [];
            }
        }, CACHE_TTL.ONE_HOUR);
    }

    /**
     * Get BSR Data for proprietary SKUs
     * Returns: SKU, Current BSR (integer Avg), Previous BSR (integer Avg), BSR Delta, Current Discount, Previous Discount, Discount Delta
     * @param {Object} filters - Global filters
     */
    async getBSRData(filters = {}) {
        console.log('[VisibilityService] getBSRData called with filters:', JSON.stringify(filters));
        const cacheKey = generateCacheKey('visibility_bsr_data_v10', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                // Discover actual column names for rb_pdp_olap
                const pdpCols = await getTableColumns('rb_pdp_olap');
                const r = (exp, fallback = null) => resolveColumn(pdpCols, exp, fallback);

                // Define standard column mappings (case-insensitive resolution)
                const skuCol = r('Product', 'Product');
                const bsrCol = r('best_seller_rank', 'best_seller_rank');
                const discountCol = r('Discount', 'Discount');
                const channelCol = r('channel', 'channel');
                const flagCol = r('Comp_flag', 'Comp_flag');
                const dateCol = r('DATE', 'DATE');
                const pltCol = r('Platform', 'Platform');
                const brdCol = r('Brand', 'Brand');
                const locCol = r('Location', 'Location');
                const catCol = r('Category', 'Category');

                console.log('[BSR] Resolved Columns for rb_pdp_olap:', {
                    skuCol, bsrCol, discountCol, channelCol, flagCol, dateCol, pltCol, brdCol, locCol, catCol
                });

                const startDate = filters.startDate || dayjs().subtract(30, 'day').format('YYYY-MM-DD');
                const endDate = filters.endDate || dayjs().format('YYYY-MM-DD');

                // Build filters for rb_pdp_olap
                let filterConditions = ['1=1'];

                // Build channel condition directly (channel column has 'Ecommerce'/'QuickComm' values)
                if (filters.channel && filters.channel !== 'All') {
                    const ch = filters.channel.toLowerCase();
                    if (['ecommerce', 'e-commerce', 'ecom'].includes(ch)) {
                        filterConditions.push(`${channelCol} = 'Ecommerce'`);
                    } else if (ch.includes('quick')) {
                        filterConditions.push(`${channelCol} = 'QuickComm'`);
                    }
                }

                if (filters.platform && filters.platform !== 'All') {
                    filterConditions.push(`lower(${pltCol}) = lower('${escapeCH(filters.platform)}')`);
                }
                if (filters.brand && filters.brand !== 'All') {
                    filterConditions.push(`lower(${brdCol}) = lower('${escapeCH(filters.brand)}')`);
                }
                if (filters.location && filters.location !== 'All') {
                    filterConditions.push(`lower(${locCol}) = lower('${escapeCH(filters.location)}')`);
                }
                if (filters.category && filters.category !== 'All') {
                    filterConditions.push(`lower(${catCol}) = lower('${escapeCH(filters.category)}')`);
                }

                const filterClause = filterConditions.join(' AND ');

                console.log('[BSR] Date range:', startDate, 'to', endDate);
                console.log('[BSR] Filter Clause:', filterClause);

                // Use CTEs to get current and previous period data
                const query = `
                    WITH
                        current_period AS (
                            SELECT 
                                ${skuCol} as sku,
                                any(${catCol}) as category,
                                any(${pltCol}) as platform,
                                AVG(toInt64OrZero(${bsrCol})) as avg_bsr,
                                AVG(${discountCol}) as avg_discount
                            FROM rb_pdp_olap
                            WHERE ${dateCol} BETWEEN '${startDate}' AND '${endDate}'
                              AND ${filterClause}
                              AND ${flagCol} = 0
                              AND ${skuCol} IS NOT NULL AND ${skuCol} != ''
                            GROUP BY sku
                        ),
                        previous_period AS (
                            SELECT 
                                ${skuCol} as sku,
                                AVG(toInt64OrZero(${bsrCol})) as avg_bsr,
                                AVG(${discountCol}) as avg_discount
                            FROM rb_pdp_olap
                            WHERE ${dateCol} BETWEEN (toDate('${startDate}') - (toDate('${endDate}') - toDate('${startDate}') + 1)) 
                                  AND (toDate('${startDate}') - 1)
                              AND ${filterClause}
                              AND ${flagCol} = 0
                              AND ${skuCol} IS NOT NULL AND ${skuCol} != ''
                            GROUP BY sku
                        )
                    SELECT 
                        c.sku as sku,
                        c.category as category,
                        c.platform as platform,
                        ROUND(c.avg_bsr) as current_bsr,
                        ROUND(p.avg_bsr) as prev_bsr,
                        ROUND(c.avg_discount, 1) as current_discount,
                        ROUND(p.avg_discount, 1) as prev_discount
                    FROM current_period c
                    LEFT JOIN previous_period p ON c.sku = p.sku
                    ORDER BY c.sku ASC
                `;

                console.log('[BSR] Executing Query (Dynamic)...');
                const results = await queryClickHouse(query);
                console.log('[BSR] Query returned', results.length, 'rows');

                const skusResult = results.map(row => {
                    const rawBSR = Number(row.current_bsr);
                    const rawPrevBSR = Number(row.prev_bsr);
                    const currentBSR = (rawBSR > 0) ? rawBSR : null;
                    const prevBSR = (rawPrevBSR > 0) ? rawPrevBSR : null;

                    const currentDiscount = Number(row.current_discount) || 0;
                    const prevDiscount = Number(row.prev_discount) || 0;

                    return {
                        sku: row.sku,
                        category: row.category,
                        platform: row.platform,
                        currentBSR,
                        prevBSR,
                        bsrDelta: (currentBSR !== null && prevBSR !== null) ? (currentBSR - prevBSR) : null,
                        currentDiscount,
                        prevDiscount,
                        discountDelta: (currentDiscount - prevDiscount)
                    };
                });

                // ==========================================
                // Fetch SKU images from rb_sku_platform
                // ==========================================
                const skuNamesForImg = skusResult.map(r => r.sku).filter(Boolean);
                if (skuNamesForImg.length > 0) {
                    try {
                        const imgQuery = `
                            SELECT sku_name, any(image_url) as img
                            FROM rb_sku_platform
                            WHERE sku_name IN (${skuNamesForImg.map(n => `'${escapeCH(n)}'`).join(',')})
                            GROUP BY sku_name
                        `;
                        const imgData = await queryClickHouse(imgQuery);
                        const imgMap = {};
                        imgData.forEach(row => {
                            if (row.sku_name) {
                                imgMap[row.sku_name] = row.img ? String(row.img).split(',')[0].trim() : null;
                            }
                        });
                        skusResult.forEach(item => {
                            item.imageUrl = imgMap[item.sku] || null;
                        });
                        console.log(`[BSR] Fetched ${imgData.length} SKU images from rb_sku_platform`);
                    } catch (imgError) {
                        console.error('[BSR] Failed to fetch SKU images:', imgError);
                    }
                }

                // ==========================================
                // Calculate BSR SOV from rb_kw_olap using the valid SKUs
                // ==========================================
                let globalSov = 0, prevGlobalSov = 0;
                let categorySovs = {};

                const currentSkus = skusResult.filter(r => r.currentBSR !== null).map(r => escapeCH(r.sku));
                const prevSkus = skusResult.filter(r => r.prevBSR !== null).map(r => escapeCH(r.sku));

                if (currentSkus.length > 0 || prevSkus.length > 0) {
                    const currTokens = currentSkus.length ? currentSkus.map(s => `'${s}'`).join(',') : "''";
                    const prevTokens = prevSkus.length ? prevSkus.map(s => `'${s}'`).join(',') : "''";

                    // Build kw_olap specific filter
                    const kwPlatformCond = buildCHCondition(filters.platform, 'platform_name');
                    const kwChannelCond = buildChannelCondition(filters.channel, 'platform_name');
                    const kwCategoryCond = buildCHCondition(filters.category, 'keyword_category', { isCategory: true });
                    const kwLocationCond = buildCHCondition(filters.location, 'location_name');

                    const kwFilterClauseList = [kwPlatformCond, kwChannelCond, kwCategoryCond, kwLocationCond].filter(c => c && c !== '1=1');
                    const kwFilterClause = kwFilterClauseList.length > 0 ? kwFilterClauseList.join(' AND ') : '1=1';

                    const sovQuery = `
                        SELECT 
                            'current' as period,
                            multiIf(keyword_category = '', 'Uncategorized', keyword_category) as category,
                            SUM(toInt32(overall)) as total_overall,
                            SUM(IF(keyword_search_product IN (${currTokens}), toInt32(overall), 0)) as bsr_overall
                        FROM rb_kw_olap
                        WHERE DATE BETWEEN '${startDate}' AND '${endDate}' 
                          AND ${kwFilterClause}
                        GROUP BY category
                        UNION ALL
                        SELECT 
                            'previous' as period,
                            multiIf(keyword_category = '', 'Uncategorized', keyword_category) as category,
                            SUM(toInt32(overall)) as total_overall,
                            SUM(IF(keyword_search_product IN (${prevTokens}), toInt32(overall), 0)) as bsr_overall
                        FROM rb_kw_olap
                        WHERE DATE BETWEEN (toDate('${startDate}') - (toDate('${endDate}') - toDate('${startDate}') + 1)) 
                              AND (toDate('${startDate}') - 1)
                          AND ${kwFilterClause}
                        GROUP BY category
                    `;

                    console.log('[BSR] Executing BSR SOV Query...');
                    const sovResults = await queryClickHouse(sovQuery);

                    let globalCNum = 0, globalCDen = 0, globalPNum = 0, globalPDen = 0;

                    sovResults.forEach(r => {
                        const period = r.period;
                        const cat = r.category || 'Uncategorized';
                        const num = Number(r.bsr_overall) || 0;
                        const den = Number(r.total_overall) || 0;

                        if (!categorySovs[cat]) categorySovs[cat] = { current: 0, prev: 0, delta: 0 };

                        if (period === 'current') {
                            globalCNum += num;
                            globalCDen += den;
                            categorySovs[cat].current = den > 0 ? (num * 100 / den) : 0;
                        } else {
                            globalPNum += num;
                            globalPDen += den;
                            categorySovs[cat].prev = den > 0 ? (num * 100 / den) : 0;
                        }
                    });

                    Object.values(categorySovs).forEach(c => c.delta = c.current - c.prev);

                    globalSov = globalCDen > 0 ? (globalCNum * 100 / globalCDen) : 0;
                    prevGlobalSov = globalPDen > 0 ? (globalPNum * 100 / globalPDen) : 0;
                }

                return {
                    skus: skusResult,
                    bsrSov: {
                        global: {
                            current: globalSov,
                            prev: prevGlobalSov,
                            delta: globalSov - prevGlobalSov
                        },
                        categories: categorySovs
                    }
                };
            } catch (error) {
                console.error('[BSR] ❌ ERROR in getBSRData:', error.message);
                console.error('[BSR] ❌ Full error:', error);
                return [];
            }
        }, CACHE_TTL.METRICS);
    }

    /**
     * BSR Trends — daily KPI trends grouped by category
     * KPIs: Products in BSR, Avg Position, BSR SOS %, Top 10 BSR Products
     */
    async getBSRTrends(filters = {}) {
        console.log('[VisibilityService] getBSRTrends called with filters:', JSON.stringify(filters));
        const cacheKey = generateCacheKey('visibility_bsr_trends_v2', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                const pdpCols = await getTableColumns('rb_pdp_olap');
                const r = (exp, fallback = null) => resolveColumn(pdpCols, exp, fallback);

                const skuCol = r('Product', 'Product');
                const bsrCol = r('best_seller_rank', 'best_seller_rank');
                const channelCol = r('channel', 'channel');
                const flagCol = r('Comp_flag', 'Comp_flag');
                const dateCol = r('DATE', 'DATE');
                const pltCol = r('Platform', 'Platform');
                const brdCol = r('Brand', 'Brand');
                const locCol = r('Location', 'Location');
                const catCol = r('Category', 'Category');

                const startDate = filters.startDate || dayjs().subtract(30, 'day').format('YYYY-MM-DD');
                const endDate = filters.endDate || dayjs().format('YYYY-MM-DD');

                // Build filters for rb_pdp_olap
                let filterConditions = ['1=1'];
                if (filters.channel && filters.channel !== 'All') {
                    const ch = filters.channel.toLowerCase();
                    if (['ecommerce', 'e-commerce', 'ecom'].includes(ch)) {
                        filterConditions.push(`${channelCol} = 'Ecommerce'`);
                    } else if (ch.includes('quick')) {
                        filterConditions.push(`${channelCol} = 'QuickComm'`);
                    }
                }
                if (filters.platform && filters.platform !== 'All') {
                    filterConditions.push(`lower(${pltCol}) = lower('${escapeCH(filters.platform)}')`);
                }
                if (filters.brand && filters.brand !== 'All') {
                    filterConditions.push(`lower(${brdCol}) = lower('${escapeCH(filters.brand)}')`);
                }
                if (filters.location && filters.location !== 'All') {
                    filterConditions.push(`lower(${locCol}) = lower('${escapeCH(filters.location)}')`);
                }
                if (filters.category && filters.category !== 'All') {
                    filterConditions.push(`lower(${catCol}) = lower('${escapeCH(filters.category)}')`);
                }
                if (filters.sku && filters.sku !== 'All') {
                    filterConditions.push(`lower(${skuCol}) = lower('${escapeCH(filters.sku)}')`);
                }
                const filterClause = filterConditions.join(' AND ');

                // Query 1: Daily BSR metrics grouped by DATE only
                const bsrTrendQuery = `
                    SELECT
                        toDate(${dateCol}) as day,
                        'Aggregate' as category,
                        COUNT(DISTINCT ${skuCol}) as products_in_bsr,
                        ROUND(AVG(toInt64OrZero(${bsrCol})), 1) as avg_position,
                        COUNT(DISTINCT IF(toInt64OrZero(${bsrCol}) <= 10, ${skuCol}, NULL)) as top_10_count
                    FROM rb_pdp_olap
                    WHERE ${dateCol} BETWEEN '${startDate}' AND '${endDate}'
                      AND ${filterClause}
                      AND ${flagCol} = 0
                      AND ${skuCol} IS NOT NULL AND ${skuCol} != ''
                      AND toInt64OrZero(${bsrCol}) > 0
                    GROUP BY day
                    ORDER BY day ASC
                `;

                console.log('[BSR Trends] Executing daily trends query...');
                const bsrResults = await queryClickHouse(bsrTrendQuery);
                console.log('[BSR Trends] Got', bsrResults.length, 'rows');

                // Query 2: Daily BSR SOS % — from rb_kw_olap
                // Get own SKUs from rb_pdp_olap for the period
                const ownSkusQuery = `
                    SELECT DISTINCT ${skuCol} as sku, ${catCol} as category
                    FROM rb_pdp_olap
                    WHERE ${dateCol} BETWEEN '${startDate}' AND '${endDate}'
                      AND ${filterClause}
                      AND ${flagCol} = 0
                      AND ${skuCol} IS NOT NULL AND ${skuCol} != ''
                      AND toInt64OrZero(${bsrCol}) > 0
                `;
                const ownSkus = await queryClickHouse(ownSkusQuery);
                const ownSkuNames = ownSkus.map(r => escapeCH(r.sku));

                let sosTrendData = [];
                if (ownSkuNames.length > 0) {
                    const skuTokens = ownSkuNames.map(s => `'${s}'`).join(',');

                    // Build kw_olap specific filter 
                    const kwChannelCond = buildChannelCondition(filters.channel, 'platform_name');
                    const kwPlatformCond = buildCHCondition(filters.platform, 'platform_name');
                    const kwCategoryCond = buildCHCondition(filters.category, 'keyword_category', { isCategory: true });
                    const kwLocationCond = buildCHCondition(filters.location, 'location_name');
                    const kwFilterList = [kwChannelCond, kwPlatformCond, kwCategoryCond, kwLocationCond].filter(c => c && c !== '1=1');
                    const kwFilterClause = kwFilterList.length > 0 ? kwFilterList.join(' AND ') : '1=1';

                    const sosTrendQuery = `
                        SELECT
                            toDate(DATE) as day,
                            'Aggregate' as category,
                            SUM(toInt32(overall)) as total_overall,
                            SUM(IF(keyword_search_product IN (${skuTokens}), toInt32(overall), 0)) as bsr_overall
                        FROM rb_kw_olap
                        WHERE DATE BETWEEN '${startDate}' AND '${endDate}'
                          AND ${kwFilterClause}
                        GROUP BY day
                        ORDER BY day ASC
                    `;

                    console.log('[BSR Trends] Executing SOS trend query...');
                    sosTrendData = await queryClickHouse(sosTrendQuery);
                    console.log('[BSR Trends] SOS got', sosTrendData.length, 'rows');
                }

                // Build SOS lookup: { day_category: sosPercent }
                const sosLookup = {};
                sosTrendData.forEach(r => {
                    const key = `${r.day}_${r.category}`;
                    const total = Number(r.total_overall) || 0;
                    const bsr = Number(r.bsr_overall) || 0;
                    sosLookup[key] = total > 0 ? parseFloat(((bsr * 100) / total).toFixed(2)) : 0;
                });

                // Build result structure: { days: [...], categories: { [cat]: { color, timeSeries: [] } } }
                const COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];
                const daysSet = new Set();
                const categoriesMap = {};

                bsrResults.forEach(row => {
                    const day = String(row.day).substring(0, 10);
                    const cat = row.category || 'Uncategorized';
                    daysSet.add(day);

                    if (!categoriesMap[cat]) {
                        const idx = Object.keys(categoriesMap).length;
                        categoriesMap[cat] = {
                            color: COLORS[idx % COLORS.length],
                            timeSeries: []
                        };
                    }

                    const sosKey = `${day}_${cat}`;
                    categoriesMap[cat].timeSeries.push({
                        date: day,
                        products_in_bsr: Number(row.products_in_bsr) || 0,
                        avg_position: Number(row.avg_position) || 0,
                        bsr_sos_pct: sosLookup[sosKey] || 0,
                        top_10_count: Number(row.top_10_count) || 0
                    });
                });

                const days = Array.from(daysSet).sort();

                return { days, categories: categoriesMap };
            } catch (error) {
                console.error('[BSR Trends] ❌ ERROR:', error.message);
                return { days: [], categories: {} };
            }
        }, CACHE_TTL.METRICS);
    }

}
export default new VisibilityService();
