/**
 * Visibility Analysis Service
 * Provides business logic for visibility analysis APIs
 */

import sequelize from '../config/db.js';
import { Op } from 'sequelize';
import dayjs from 'dayjs';

/**
 * Generic helper to parse and format multi-select filters for SQL IN clauses
 * @param {string|Array} value - Filter value(s) from request
 * @param {string} column - Database column name
 * @param {Object} replacements - Sequelize replacements object to populate
 * @param {string} prefix - Prefix for replacement keys
 * @param {Object} options - { isBrand: boolean, caseInsensitive: boolean }
 * @returns {string} SQL condition (e.g., "column_name IN (:prefix0, :prefix1)")
 */
function parseMultiSelectFilter(value, column, replacements, prefix, options = {}) {
    const { isBrand = false, caseInsensitive = false } = options;

    // special handling for "All" in brands
    if (isBrand && (!value || value === 'All')) return "keyword_is_rb_product = 1";

    // skip filter if "All" or empty
    if (!value || value === 'All') return "1=1";

    const list = typeof value === 'string'
        ? value.split(',').map(v => v.trim()).filter(Boolean)
        : Array.isArray(value) ? value : [value];

    if (list.length === 0) return isBrand ? "keyword_is_rb_product = 1" : "1=1";

    const keys = list.map((v, i) => {
        const key = `${prefix}${i}`;
        replacements[key] = v;
        return `:${key}`;
    });

    const col = caseInsensitive ? `LOWER(${column})` : column;
    const vals = caseInsensitive ? keys.map(k => `LOWER(${k})`) : keys;

    return `${col} IN (${vals.join(', ')})`;
}

async function calculateAllSOS(dateFrom, dateTo, platform = null, brand = null, location = null) {
    try {
        const replacements = { dateFrom, dateTo };

        const platformCondition = parseMultiSelectFilter(platform, 'platform_name', replacements, 'plat', { caseInsensitive: true });
        const locationCondition = parseMultiSelectFilter(location, 'location_name', replacements, 'loc', { caseInsensitive: true });
        const brandSOSCondition = parseMultiSelectFilter(brand, 'brand_name', replacements, 'sosBrand', { isBrand: true });

        // Optimization: Add YEAR and MONTH filters to help partition pruning
        const start = dayjs(dateFrom);
        const end = dayjs(dateTo);
        const startYear = start.year();
        const startMonth = start.month() + 1; // dayjs is 0-indexed
        const endYear = end.year();
        const endMonth = end.month() + 1;

        let partitionCondition = '';
        if (startYear === endYear && startMonth === endMonth) {
            partitionCondition = `AND YEAR = ${startYear} AND MONTH = ${startMonth}`;
        } else if (startYear === endYear) {
            partitionCondition = `AND YEAR = ${startYear} AND MONTH BETWEEN ${startMonth} AND ${endMonth}`;
        } else {
            // Basic cross-year/month handling
            partitionCondition = `AND (
                (YEAR = ${startYear} AND MONTH >= ${startMonth}) OR 
                (YEAR = ${endYear} AND MONTH <= ${endMonth})
             )`;
        }

        // Single query that calculates ALL SOS types at once
        const query = `
            SELECT 
                ROUND(SUM(CASE WHEN ${brandSOSCondition} THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) AS overall_sos,
                ROUND(SUM(CASE WHEN ${brandSOSCondition} AND spons_flag = 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) AS sponsored_sos,
                ROUND(SUM(CASE WHEN ${brandSOSCondition} AND (spons_flag = 0 OR spons_flag IS NULL) THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) AS organic_sos
            FROM rb_kw
            WHERE kw_crawl_date BETWEEN :dateFrom AND :dateTo
              AND ${platformCondition}
              AND ${locationCondition}
              ${partitionCondition}
        `;

        const result = await sequelize.query(query, {
            replacements,
            type: sequelize.QueryTypes.SELECT
        });

        return {
            overall: Number(result[0]?.overall_sos) || 0,
            sponsored: Number(result[0]?.sponsored_sos) || 0,
            organic: Number(result[0]?.organic_sos) || 0
        };
    } catch (error) {
        console.error('Error calculating all SOS:', error);
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
async function getAllSOSTrends(days = 7, platform = null, brand = null, location = null) {
    try {
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - (days - 1));

        const dateFrom = startDate.toISOString().split('T')[0];
        const dateTo = today.toISOString().split('T')[0];

        const replacements = { dateFrom, dateTo };
        const platformCondition = parseMultiSelectFilter(platform, 'platform_name', replacements, 'trendPlat', { caseInsensitive: true });
        const locationCondition = parseMultiSelectFilter(location, 'location_name', replacements, 'trendLoc', { caseInsensitive: true });
        const brandSOSCondition = parseMultiSelectFilter(brand, 'brand_name', replacements, 'trendBrand', { isBrand: true });

        const query = `
            SELECT 
                DATE(kw_crawl_date) as crawl_date,
                ROUND(SUM(CASE WHEN ${brandSOSCondition} THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) AS overall_sos,
                ROUND(SUM(CASE WHEN ${brandSOSCondition} AND spons_flag = 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) AS sponsored_sos,
                ROUND(SUM(CASE WHEN ${brandSOSCondition} AND (spons_flag = 0 OR spons_flag IS NULL) THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) AS organic_sos
            FROM rb_kw
            WHERE kw_crawl_date BETWEEN :dateFrom AND :dateTo
              AND ${platformCondition}
              AND ${locationCondition}
            GROUP BY DATE(kw_crawl_date)
            ORDER BY crawl_date ASC
        `;

        const results = await sequelize.query(query, {
            replacements,
            type: sequelize.QueryTypes.SELECT
        });

        const overall = { dates: [], values: [] };
        const sponsored = { dates: [], values: [] };
        const organic = { dates: [], values: [] };

        results.forEach(row => {
            const date = new Date(row.crawl_date);
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            overall.dates.push(dateStr);
            overall.values.push(Number(row.overall_sos) || 0);

            sponsored.dates.push(dateStr);
            sponsored.values.push(Number(row.sponsored_sos) || 0);

            organic.dates.push(dateStr);
            organic.values.push(Number(row.organic_sos) || 0);
        });

        return { overall, sponsored, organic };
    } catch (error) {
        console.error('Error getting all SOS trends:', error);
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
        // Default to last 30 days (like Watch Tower), NOT MTD which has no data on month start
        let endDate = dayjs();
        let startDate = endDate.subtract(1, 'month');

        // Override with filter dates if provided
        if (filters.startDate && filters.endDate) {
            startDate = dayjs(filters.startDate);
            endDate = dayjs(filters.endDate);
        }

        // Previous period = same range shifted back by 1 month (same as Watch Tower)
        const prevStart = startDate.subtract(1, 'month');
        const prevEnd = endDate.subtract(1, 'month');

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
        const [currentSOS, prevSOS, trends] = await Promise.all([
            calculateAllSOS(dateRanges.current.start, dateRanges.current.end, platform, filters.brand, filters.location),
            calculateAllSOS(dateRanges.previous.start, dateRanges.previous.end, platform, filters.brand, filters.location),
            getAllSOSTrends(7, platform, filters.brand, filters.location)
        ]);

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
                    months: trends.overall.dates,
                    sparklineData: trends.overall.values
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
                    months: trends.sponsored.dates,
                    sparklineData: trends.sponsored.values
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
                    months: trends.organic.dates,
                    sparklineData: trends.organic.values
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
        // Use dynamic data from database
        return await getVisibilityOverviewData(filters);
    }

    /**
     * Get Platform KPI Matrix data with Platform/Format/City breakdown
     * Fetches real data from rb_kw table
     */
    async getPlatformKpiMatrix(filters) {
        console.log('[VisibilityService] getPlatformKpiMatrix called with filters:', filters);

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
            let baseWhere = `kw_crawl_date BETWEEN :startDate AND :endDate`;

            // Apply platform filter if provided
            if (filters.platform && filters.platform !== 'All') {
                const platCond = parseMultiSelectFilter(filters.platform, 'platform_name', replacements, 'matrixPlat', { caseInsensitive: true });
                baseWhere += ` AND ${platCond}`;
            }

            // Apply location filter if provided
            if (filters.location && filters.location !== 'All') {
                const locCond = parseMultiSelectFilter(filters.location, 'location_name', replacements, 'matrixLoc', { caseInsensitive: true });
                baseWhere += ` AND ${locCond}`;
            }

            // KPI definitions (rows)
            const kpis = ['OVERALL WEIGHTED SOS', 'SPONSORED SOS', 'ORGANIC SOS'];

            // ========== PLATFORM DATA ==========
            const platformQuery = `
                SELECT 
                    platform_name,
                    ROUND(SUM(CASE WHEN keyword_is_rb_product = 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 1) AS overall_sos,
                    ROUND(SUM(CASE WHEN keyword_is_rb_product = 1 AND spons_flag = 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN spons_flag = 1 THEN 1 ELSE 0 END), 0), 1) AS sponsored_sos,
                    ROUND(SUM(CASE WHEN keyword_is_rb_product = 1 AND (spons_flag = 0 OR spons_flag IS NULL) THEN 1 ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN spons_flag = 0 OR spons_flag IS NULL THEN 1 ELSE 0 END), 0), 1) AS organic_sos
                FROM rb_kw
                WHERE ${baseWhere}
                  AND platform_name IS NOT NULL AND platform_name != ''
                GROUP BY platform_name
                ORDER BY COUNT(*) DESC
                LIMIT 10
            `;

            // ========== FORMAT DATA (Category from rca_sku_dim where status=1) ==========
            const formatQuery = `
                SELECT 
                    Category as format_name,
                    0 as overall_sos,
                    0 as sponsored_sos,
                    0 as organic_sos
                FROM rca_sku_dim
                WHERE status = 1 
                  AND Category IS NOT NULL AND Category != ''
                GROUP BY Category
                ORDER BY Category
            `;

            // ========== CITY DATA (location_name) - ALL CITIES ==========
            const cityQuery = `
                SELECT 
                    location_name as city,
                    ROUND(SUM(CASE WHEN keyword_is_rb_product = 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 1) AS overall_sos,
                    ROUND(SUM(CASE WHEN keyword_is_rb_product = 1 AND spons_flag = 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN spons_flag = 1 THEN 1 ELSE 0 END), 0), 1) AS sponsored_sos,
                    ROUND(SUM(CASE WHEN keyword_is_rb_product = 1 AND (spons_flag = 0 OR spons_flag IS NULL) THEN 1 ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN spons_flag = 0 OR spons_flag IS NULL THEN 1 ELSE 0 END), 0), 1) AS organic_sos
                FROM rb_kw
                WHERE ${baseWhere}
                  AND location_name IS NOT NULL AND location_name != ''
                GROUP BY location_name
                ORDER BY location_name
            `;

            // Execute all queries in parallel
            const [platformResults, formatResults, cityResults] = await Promise.all([
                sequelize.query(platformQuery, { replacements, type: sequelize.QueryTypes.SELECT }),
                sequelize.query(formatQuery, { replacements, type: sequelize.QueryTypes.SELECT }),
                sequelize.query(cityQuery, { replacements, type: sequelize.QueryTypes.SELECT })
            ]);

            console.log('[VisibilityService] Matrix query results:', {
                platforms: platformResults.length,
                formats: formatResults.length,
                cities: cityResults.length
            });

            // Helper to build matrix data structure
            const buildMatrixData = (results, nameKey) => {
                const columns = ['kpi', ...results.map(r => r[nameKey])];

                const rows = kpis.map(kpi => {
                    const row = { kpi };
                    const trend = {};
                    const series = {};

                    results.forEach(r => {
                        const colName = r[nameKey];
                        let value = 0;

                        if (kpi === 'OVERALL WEIGHTED SOS') {
                            value = Number(r.overall_sos) || 0;
                        } else if (kpi === 'SPONSORED SOS') {
                            value = Number(r.sponsored_sos) || 0;
                        } else if (kpi === 'ORGANIC SOS') {
                            value = Number(r.organic_sos) || 0;
                        }

                        row[colName] = value;
                        trend[colName] = Math.round((Math.random() - 0.5) * 10); // Placeholder trend
                        series[colName] = [value * 0.95, value * 0.97, value * 0.99, value]; // Placeholder sparkline
                    });

                    row.trend = trend;
                    row.series = series;
                    return row;
                });

                return { columns, rows };
            };

            return {
                platformData: buildMatrixData(platformResults, 'platform_name'),
                formatData: buildMatrixData(formatResults, 'format_name'),
                cityData: buildMatrixData(cityResults, 'city')
            };

        } catch (error) {
            console.error('[VisibilityService] Error in getPlatformKpiMatrix:', error);
            // Fallback to mock data on error
            return getPlatformKpiMatrixMockData();
        }
    }


    /**
     * Get Keywords at a Glance hierarchical data
     * Fetches real data from rb_kw table with hierarchy:
     * Keyword Type → Keyword → Brand → SKU → City
     */
    /**
     * Get Keywords at a Glance hierarchical data
     * Fetches real data from rb_kw table with hierarchy:
     * Keyword Type → Keyword → Brand → SKU → City
     */
    async getKeywordsAtGlance(filters) {
        console.log('[VisibilityService] getKeywordsAtGlance called with filters:', filters);

        try {
            // Build WHERE clause based on filters
            let whereConditions = ["keyword_type IS NOT NULL AND keyword_type != ''"];
            const replacements = {};

            if (filters.platform && filters.platform !== 'All') {
                const platCond = parseMultiSelectFilter(filters.platform, 'platform_name', replacements, 'hierPlat', { caseInsensitive: true });
                whereConditions.push(platCond);
            }
            if (filters.keyword && filters.keyword !== 'All') {
                whereConditions.push("LOWER(keyword) LIKE LOWER(:keyword)");
                replacements.keyword = `%${filters.keyword}%`;
            }
            if (filters.location && filters.location !== 'All') {
                const locCond = parseMultiSelectFilter(filters.location, 'location_name', replacements, 'hierLoc', { caseInsensitive: true });
                whereConditions.push(locCond);
            }
            if (filters.startDate && filters.endDate) {
                whereConditions.push("kw_crawl_date BETWEEN :startDate AND :endDate");
                replacements.startDate = filters.startDate;
                replacements.endDate = filters.endDate;
            } else {
                // Default to latest date using subquery for precision
                whereConditions.push("kw_crawl_date = (SELECT MAX(kw_crawl_date) FROM rb_kw)");
            }

            // Define the brand condition for SOS calculation
            const sosBrandCondition = parseMultiSelectFilter(filters.brand, 'brand_name', replacements, 'hierarchyBrand', { isBrand: true });

            // If a specific brand is selected, we filter the results BY that brand(s)
            if (filters.brand && filters.brand !== 'All') {
                whereConditions.push(sosBrandCondition);
            }

            const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

            // Stage 1: Fast fetch of top keywords per type
            const topKeywordsQuery = `
                SELECT keyword, keyword_type, rb_results
                FROM (
                    SELECT 
                        keyword, 
                        keyword_type, 
                        COUNT(*) as row_count,
                        SUM(CASE WHEN ${sosBrandCondition} THEN 1 ELSE 0 END) as rb_results,
                        ROW_NUMBER() OVER(PARTITION BY keyword_type ORDER BY SUM(CASE WHEN ${sosBrandCondition} THEN 1 ELSE 0 END) DESC, COUNT(*) DESC) as rnk
                    FROM rb_kw
                    ${whereClause}
                    GROUP BY keyword, keyword_type
                ) t
                WHERE rnk <= 15
                ${filters.brand && filters.brand !== 'All' ? 'AND rb_results > 0' : ''}
            `;

            console.log('[VisibilityService] Fetching top keywords...');
            const selectedKeywords = await sequelize.query(topKeywordsQuery, {
                replacements,
                type: sequelize.QueryTypes.SELECT
            });

            console.log(`[VisibilityService] Found ${selectedKeywords.length} top keywords`);
            if (selectedKeywords.length === 0) {
                return { hierarchy: [] };
            }

            // Group keywords by type for a multi-IN condition
            const keywordList = selectedKeywords.map(sk => `'${sk.keyword.replace(/'/g, "''")}'`).join(',');
            const typeList = [...new Set(selectedKeywords.map(sk => `'${sk.keyword_type.replace(/'/g, "''")}'`))].join(',');
            const keywordCondition = `AND keyword IN (${keywordList}) AND keyword_type IN (${typeList})`;

            // Stage 2: Detailed hierarchy for selected keywords
            const query = `
                SELECT 
                    keyword_type, 
                    keyword, 
                    brand_name, 
                    keyword_search_product as sku, 
                    location_name as city,
                    COUNT(*) as total_results,
                    SUM(CASE WHEN ${sosBrandCondition} THEN 1 ELSE 0 END) as rb_results,
                    SUM(CASE WHEN ${sosBrandCondition} AND spons_flag = 1 THEN 1 ELSE 0 END) as rb_sponsored,
                    SUM(CASE WHEN ${sosBrandCondition} AND (spons_flag = 0 OR spons_flag IS NULL) THEN 1 ELSE 0 END) as rb_organic,
                    AVG(CASE WHEN ${sosBrandCondition} AND spons_flag = 1 THEN keyword_search_rank ELSE NULL END) as avg_ad_pos,
                    AVG(CASE WHEN ${sosBrandCondition} AND (spons_flag = 0 OR spons_flag IS NULL) THEN keyword_search_rank ELSE NULL END) as avg_org_pos
                FROM rb_kw
                ${whereClause}
                ${keywordCondition}
                GROUP BY keyword_type, keyword, brand_name, keyword_search_product, location_name
                ORDER BY keyword_type ASC, total_results DESC
            `;

            console.log('[VisibilityService] Fetching hierarchy data...');
            const results = await sequelize.query(query, {
                replacements,
                type: sequelize.QueryTypes.SELECT
            });

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
                    total_results: total,
                    rb_results: rbr,
                    rb_sponsored: rbs,
                    rb_organic: rbo,
                    avg_ad_pos: aap,
                    avg_org_pos: aop
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
                    if (aap !== null) node.metrics.aap.push(Number(aap));
                    if (aop !== null) node.metrics.aop.push(Number(aop));
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
    }

    async getTopSearchTerms(filters) {
        console.log('[VisibilityService] getTopSearchTerms called with filters:', filters);
        try {
            const replacements = {};
            const whereConditions = ["1=1"];

            let platCond = "1=1";
            if (filters.platform && filters.platform !== 'All') {
                platCond = parseMultiSelectFilter(filters.platform, 'platform_name', replacements, 'topPlat', { caseInsensitive: true });
                whereConditions.push(platCond);
            }

            let locCond = "1=1";
            if (filters.location && filters.location !== 'All') {
                locCond = parseMultiSelectFilter(filters.location, 'location_name', replacements, 'topLoc', { caseInsensitive: true });
                whereConditions.push(locCond);
            }

            // Map frontend filter tabs to keyword_type
            if (filters.filter && filters.filter !== 'All') {
                const typeMap = {
                    'Branded': 'Branded',
                    'Competition': 'Competition',
                    'Generic': 'Generic'
                };
                const mappedType = typeMap[filters.filter];
                if (mappedType) {
                    whereConditions.push("keyword_type = :type");
                    replacements.type = mappedType;
                }
            }

            // Get max date first for better performance
            const [maxDateResult] = await sequelize.query("SELECT MAX(kw_crawl_date) as maxDate FROM rb_kw", { type: sequelize.QueryTypes.SELECT });
            let maxDate = maxDateResult ? maxDateResult.maxDate : null;

            // Format date for MySQL compatibility if it's a Date object
            if (maxDate instanceof Date) {
                maxDate = maxDate.toISOString().slice(0, 19).replace('T', ' ');
            }
            console.log('[VisibilityService] Using maxDate:', maxDate);

            if (filters.startDate && filters.endDate) {
                whereConditions.push("kw_crawl_date BETWEEN :startDate AND :endDate");
                replacements.startDate = filters.startDate;
                replacements.endDate = filters.endDate;
            } else if (maxDate) {
                whereConditions.push("kw_crawl_date = :maxDate");
                replacements.maxDate = maxDate;
            }

            const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

            // Define the brand condition for SOS calculation
            // If a specific brand is selected, we calculate SOS for THAT brand(s).
            // If "All" is selected, we calculate SOS for all "RB" products.
            const sosBrandCondition = parseMultiSelectFilter(filters.brand, 'brand_name', replacements, 'searchBrand', { isBrand: true });

            // Step 1: Get top keywords and their SOS metrics
            // If a specific brand is selected, we prioritize keywords where THAT brand has most visibility
            const metricsQuery = `
                SELECT 
                    keyword,
                    MAX(keyword_type) as type,
                    COUNT(*) as total_results,
                    SUM(CASE WHEN ${sosBrandCondition} THEN 1 ELSE 0 END) as rb_results,
                    SUM(CASE WHEN ${sosBrandCondition} AND (spons_flag = 0 OR spons_flag IS NULL) THEN 1 ELSE 0 END) as rb_organic,
                    SUM(CASE WHEN ${sosBrandCondition} AND spons_flag = 1 THEN 1 ELSE 0 END) as rb_sponsored,
                    AVG(CASE WHEN ${sosBrandCondition} THEN keyword_search_rank ELSE NULL END) as avg_overall_pos,
                    AVG(CASE WHEN ${sosBrandCondition} AND (spons_flag = 0 OR spons_flag IS NULL) THEN keyword_search_rank ELSE NULL END) as avg_org_pos,
                    AVG(CASE WHEN ${sosBrandCondition} AND spons_flag = 1 THEN keyword_search_rank ELSE NULL END) as avg_ad_pos
                FROM rb_kw
                ${whereClause}
                GROUP BY keyword
                ${filters.brand && filters.brand !== 'All' ? 'HAVING rb_results > 0' : ''}
                ORDER BY (SUM(CASE WHEN ${sosBrandCondition} THEN 1 ELSE 0 END) / COUNT(*)) DESC, total_results DESC
                LIMIT 50
            `;

            console.log('[VisibilityService] Executing metrics query...');
            const keywordMetrics = await sequelize.query(metricsQuery, {
                replacements,
                type: sequelize.QueryTypes.SELECT
            });

            console.log(`[VisibilityService] Found ${keywordMetrics.length} keywords`);
            if (keywordMetrics.length === 0) return { terms: [] };

            // Step 2: Get leading brands for these keywords
            // MUST include platform/location filters to match Step 1 context
            const keywordsForIn = keywordMetrics.map(k => `'${k.keyword.replace(/'/g, "''")}'`).join(',');
            const leadingBrandQuery = `
                WITH BrandCounts AS (
                    SELECT 
                        keyword,
                        brand_name,
                        COUNT(*) as brand_count,
                        ROW_NUMBER() OVER(PARTITION BY keyword ORDER BY COUNT(*) DESC) as rnk
                    FROM rb_kw
                    WHERE keyword IN (${keywordsForIn})
                      AND kw_crawl_date = :maxDate
                      AND ${platCond}
                      AND ${locCond}
                    GROUP BY keyword, brand_name
                )
                SELECT keyword, brand_name FROM BrandCounts WHERE rnk = 1
            `;

            const leadingBrands = await sequelize.query(leadingBrandQuery, {
                replacements: { ...replacements, maxDate },
                type: sequelize.QueryTypes.SELECT
            });

            const brandMap = new Map(leadingBrands.map(lb => [lb.keyword, lb.brand_name]));

            // Format results for frontend
            const terms = keywordMetrics.map(km => {
                const total = Number(km.total_results) || 1;
                const rbResults = Number(km.rb_results) || 0;
                const rbOrganic = Number(km.rb_organic) || 0;
                const rbSponsored = Number(km.rb_sponsored) || 0;

                // Average positions (cast string to number safely)
                const avgOverall = Number(km.avg_overall_pos) || 0;
                const avgOrg = Number(km.avg_org_pos) || 0;
                const avgAd = Number(km.avg_ad_pos) || 0;

                return {
                    keyword: km.keyword,
                    topBrand: brandMap.get(km.keyword) || 'N/A',
                    overallSos: Number(((rbResults / total) * 100).toFixed(1)),
                    overallPos: Number(avgOverall.toFixed(1)),
                    organicSos: Number(((rbOrganic / total) * 100).toFixed(1)),
                    organicPos: Number(avgOrg.toFixed(1)),
                    paidSos: Number(((rbSponsored / total) * 100).toFixed(1)),
                    paidPos: Number(avgAd.toFixed(1)),
                };
            });

            console.log(`[VisibilityService] Returning ${terms.length} terms`);
            return { terms };
        } catch (error) {
            console.error('[VisibilityService] Error in getTopSearchTerms:', error);
            return { terms: [] };
        }
    }

    /**
     * Get Brand Visibility Drilldown for a specific keyword
     * Compares current SOS metrics with previous period to find "losers"
     * @param {Object} filters - { keyword, platform, location, startDate, endDate }
     */
    async getBrandDrilldown(filters) {
        try {
            console.log(`[VisibilityService] getBrandDrilldown: keyword="${filters.keyword}"`);

            // Base where conditions for main filters
            // Using case-insensitive and trimmed keyword matching
            const whereConditions = ["LOWER(TRIM(keyword)) = LOWER(TRIM(:keyword))"];
            const replacements = { keyword: filters.keyword };

            let platCond = "1=1";
            if (filters.platform && filters.platform !== 'All') {
                platCond = parseMultiSelectFilter(filters.platform, 'platform_name', replacements, 'drillPlat', { caseInsensitive: true });
                whereConditions.push(platCond);
            }

            let locCond = "1=1";
            if (filters.location && filters.location !== 'All') {
                locCond = parseMultiSelectFilter(filters.location, 'location_name', replacements, 'drillLoc', { caseInsensitive: true });
                whereConditions.push(locCond);
            }

            // Get two most recent crawl dates for comparison
            const dateResult = await sequelize.query(
                "SELECT DISTINCT kw_crawl_date FROM rb_kw WHERE LOWER(TRIM(keyword)) = LOWER(TRIM(:keyword)) ORDER BY kw_crawl_date DESC LIMIT 2",
                { replacements: { keyword: filters.keyword }, type: sequelize.QueryTypes.SELECT }
            );

            if (!dateResult || dateResult.length === 0) return { brands: [], topLosers: [] };

            // Format dates precisely to avoid matching issues
            const latestDate = dayjs(dateResult[0].kw_crawl_date).format('YYYY-MM-DD');
            const previousDate = dateResult[1] ? dayjs(dateResult[1].kw_crawl_date).format('YYYY-MM-DD') : latestDate;

            console.log(`[VisibilityService] Dates: Latest=${latestDate}, Previous=${previousDate}`);

            // Fetch metrics for ALL brands for both dates
            const drilldownQuery = `
                SELECT 
                    brand_name,
                    DATE_FORMAT(kw_crawl_date, '%Y-%m-%d') as crawl_date,
                    COUNT(*) as brand_results,
                    SUM(CASE WHEN (spons_flag = 0 OR spons_flag IS NULL) THEN 1 ELSE 0 END) as brand_organic,
                    SUM(CASE WHEN spons_flag = 1 THEN 1 ELSE 0 END) as brand_sponsored
                FROM rb_kw
                WHERE LOWER(TRIM(keyword)) = LOWER(TRIM(:keyword))
                  AND DATE(kw_crawl_date) IN (:latestDate, :previousDate)
                  AND ${platCond}
                  AND ${locCond}
                GROUP BY brand_name, crawl_date
            `;

            const results = await sequelize.query(drilldownQuery, {
                replacements: { ...replacements, latestDate, previousDate },
                type: sequelize.QueryTypes.SELECT
            });

            // Get total results per date for SOS normalization
            const totalsQuery = `
                SELECT DATE_FORMAT(kw_crawl_date, '%Y-%m-%d') as crawl_date, COUNT(*) as total 
                FROM rb_kw 
                WHERE LOWER(TRIM(keyword)) = LOWER(TRIM(:keyword))
                  AND DATE(kw_crawl_date) IN (:latestDate, :previousDate)
                  AND ${platCond}
                  AND ${locCond}
                GROUP BY crawl_date
            `;

            const totalResults = await sequelize.query(totalsQuery, {
                replacements: { ...replacements, latestDate, previousDate },
                type: sequelize.QueryTypes.SELECT
            });

            const totalMap = new Map(totalResults.map(t => [String(t.crawl_date), t.total]));

            // Process results into a map of brands
            const brandData = {};
            results.forEach(row => {
                const brand = row.brand_name || 'Unknown';
                const dateStr = String(row.crawl_date);
                const total = totalMap.get(dateStr) || 1;

                if (!brandData[brand]) {
                    brandData[brand] = {
                        brand,
                        current: { overall: 0, organic: 0, paid: 0 },
                        previous: { overall: 0, organic: 0, paid: 0 }
                    };
                }

                const metrics = {
                    overall: (row.brand_results / total) * 100,
                    organic: (row.brand_organic / total) * 100,
                    paid: (row.brand_sponsored / total) * 100
                };

                if (dateStr === latestDate) {
                    brandData[brand].current = metrics;
                } else if (dateStr === previousDate && latestDate !== previousDate) {
                    brandData[brand].previous = metrics;
                }
            });

            // Format final array and calculate deltas
            const brands = Object.values(brandData).map(b => {
                const delta = b.current.overall - b.previous.overall;
                return {
                    brand: b.brand,
                    overall: Number(b.current.overall.toFixed(1)),
                    organic: Number(b.current.organic.toFixed(1)),
                    paid: Number(b.current.paid.toFixed(1)),
                    delta: Number(delta.toFixed(1)),
                    prevOverall: Number(b.previous.overall.toFixed(1))
                };
            }).sort((a, b) => b.overall - a.overall);

            // "Top Losers" are brands with the most negative delta
            const topLosers = [...brands]
                .filter(b => b.delta < 0)
                .sort((a, b) => a.delta - b.delta) // Most negative first
                .slice(0, 5);

            return { brands, topLosers };
        } catch (error) {
            console.error('[VisibilityService] Error in getBrandDrilldown:', error);
            return { brands: [], topLosers: [] };
        }
    }

    /**
     * Get dynamic filter options for visibility analysis cascading filters
     * Uses rb_kw as primary source (main visibility data table)
     * @param {Object} params - { filterType, platform, format, city, metroFlag }
     * @returns {Object} { options: [...] }
     */
    /**
     * Get dynamic filter options for visibility analysis cascading filters
     * Uses rb_kw as primary source (main visibility data table)
     * @param {Object} params - { filterType, platform, format, city }
     * @returns {Object} { options: [...] }
     */
    async getVisibilityFilterOptions({ filterType, platform, format, city }) {
        try {
            console.log(`[VisibilityService] getVisibilityFilterOptions called: type=${filterType}`);

            // Base WHERE clause
            let whereClause = "WHERE 1=1";
            if (platform && platform !== 'All') {
                whereClause += ` AND LOWER(platform_name) = LOWER('${platform}')`;
            }

            // PLATFORMS: from rb_kw.platform_name
            if (filterType === 'platforms') {
                const [results] = await sequelize.query(`
                    SELECT DISTINCT platform_name as platform
                    FROM rb_kw 
                    WHERE platform_name IS NOT NULL AND platform_name != ''
                    ORDER BY platform_name
                `);
                const options = results.map(r => r.platform).filter(Boolean);
                return { options };
            }

            // MONTHS: from rb_kw.kw_crawl_date (Active Months)
            if (filterType === 'months') {
                const [results] = await sequelize.query(`
                    SELECT DISTINCT DATE_FORMAT(kw_crawl_date, '%Y-%m') as month
                    FROM rb_kw
                    ${whereClause} AND kw_crawl_date IS NOT NULL
                    ORDER BY month DESC
                    LIMIT 36
                `);
                const options = results.map(r => r.month).filter(Boolean);
                return { options };
            }

            // DATES: from rb_kw.kw_crawl_date (Active Dates)
            if (filterType === 'dates') {
                const [results] = await sequelize.query(`
                    SELECT DISTINCT DATE_FORMAT(kw_crawl_date, '%Y-%m-%d') as date
                    FROM rb_kw
                    ${whereClause} AND kw_crawl_date IS NOT NULL
                    ORDER BY date DESC
                    LIMIT 365
                `);
                const options = results.map(r => r.date).filter(Boolean);
                return { options };
            }

            // FORMATS (Category): from rca_sku_dim.Category where status = 1
            if (filterType === 'formats') {
                const [results] = await sequelize.query(`
                    SELECT DISTINCT Category as format
                    FROM rca_sku_dim
                    WHERE status = 1 AND Category IS NOT NULL AND Category != ''
                    ORDER BY Category
                `);
                const options = results.map(r => r.format).filter(Boolean);
                return { options };
            }

            // CITIES: from rb_kw.location_name
            if (filterType === 'cities') {
                // Cascading: Filter by format (keyword_search_product) if selected
                if (format && format !== 'All') {
                    whereClause += ` AND LOWER(keyword_search_product) = LOWER('${format}')`;
                }

                const [results] = await sequelize.query(`
                    SELECT DISTINCT location_name as city
                    FROM rb_kw
                    ${whereClause} AND location_name IS NOT NULL AND location_name != ''
                    ORDER BY location_name
                `);
                const options = results.map(r => r.city).filter(Boolean);
                return { options };
            }

            // PINCODES: from rb_kw.pincode
            if (filterType === 'pincodes') {
                if (city && city !== 'All') {
                    whereClause += ` AND LOWER(location_name) = LOWER('${city}')`;
                }
                const [results] = await sequelize.query(`
                    SELECT DISTINCT pincode
                    FROM rb_kw
                    ${whereClause} AND pincode IS NOT NULL
                    ORDER BY pincode
                `);
                const options = results.map(r => r.pincode).filter(Boolean);
                return { options };
            }

            // PRODUCT NAMES: from rb_kw.keyword (or brand_name/keyword_search_product_id depending on need)
            // Assuming "Product Name" refers to the search keyword or the specific product
            if (filterType === 'productName') {
                const [results] = await sequelize.query(`
                    SELECT DISTINCT keyword as productName
                    FROM rb_kw
                    ${whereClause} AND keyword IS NOT NULL AND keyword != ''
                    ORDER BY keyword
                `);
                const options = results.map(r => r.productName).filter(Boolean);
                return { options };
            }

            // BRANDS: from rb_kw.brand_crawl (competitor brands where is_competitor_product=1)
            if (filterType === 'brands') {
                const [results] = await sequelize.query(`
                    SELECT DISTINCT brand_crawl as brand
                    FROM rb_kw
                    ${whereClause} AND brand_crawl IS NOT NULL AND brand_crawl != '' AND is_competitor_product = 1
                    ORDER BY brand_crawl
                    LIMIT 50
                `);
                const options = results.map(r => r.brand).filter(Boolean);
                return { options };
            }

            return { options: [] };
        } catch (error) {
            console.error('[VisibilityService] Error getting filter options:', error);
            return { options: [] };
        }
    }

    /**
     * Get the latest available dates from rb_kw table
     * Returns the date range of the latest month that has data
     */
    async getLatestAvailableDates() {
        try {
            console.log('[VisibilityService] getLatestAvailableDates called');

            // Get the max date from rb_kw table
            const [maxDateResult] = await sequelize.query(`
                SELECT MAX(kw_crawl_date) as maxDate
                FROM rb_kw
                WHERE kw_crawl_date IS NOT NULL
            `, { type: sequelize.QueryTypes.SELECT });

            if (!maxDateResult?.maxDate) {
                console.log('[VisibilityService] No data found in rb_kw table, returning current month');
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

            const latestDate = dayjs(maxDateResult.maxDate);
            const startOfMonth = latestDate.startOf('month');

            console.log('[VisibilityService] Found latest date:', latestDate.format('YYYY-MM-DD'));
            console.log('[VisibilityService] Returning date range:', {
                startDate: startOfMonth.format('YYYY-MM-DD'),
                endDate: latestDate.format('YYYY-MM-DD')
            });

            return {
                available: true,
                startDate: startOfMonth.format('YYYY-MM-DD'),
                endDate: latestDate.format('YYYY-MM-DD'),
                latestDate: latestDate.format('YYYY-MM-DD'),
                defaultStartDate: startOfMonth.format('YYYY-MM-DD')
            };
        } catch (error) {
            console.error('[VisibilityService] Error getting latest available dates:', error);
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
    }

    /**
     * Get Visibility KPI Trends for chart display
     * Returns daily SOS trends for Overall, Sponsored, Organic, and Display metrics
     * @param {Object} filters - { platform, location, brand, startDate, endDate, period, timeStep }
     * @returns {Promise<{timeSeries: Array}>}
     */
    async getVisibilityKpiTrends(filters = {}) {
        console.log('[VisibilityService] getVisibilityKpiTrends called with filters:', filters);

        try {
            // Determine date range based on period or explicit dates
            let startDate, endDate;
            const period = filters.period || '1M';

            if (filters.startDate && filters.endDate) {
                startDate = dayjs(filters.startDate);
                endDate = dayjs(filters.endDate);
            } else {
                endDate = dayjs();
                const periodToDays = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
                const days = periodToDays[period] || 30;
                startDate = endDate.subtract(days, 'day');
            }

            const dateFrom = startDate.format('YYYY-MM-DD');
            const dateTo = endDate.format('YYYY-MM-DD');

            const replacements = { dateFrom, dateTo };
            const platform = filters.platform || null;
            const location = filters.location || null;
            const brand = filters.brand || null;

            const platformCondition = parseMultiSelectFilter(platform, 'platform_name', replacements, 'trendPlat', { caseInsensitive: true });
            const locationCondition = parseMultiSelectFilter(location, 'location_name', replacements, 'trendLoc', { caseInsensitive: true });
            const brandSOSCondition = parseMultiSelectFilter(brand, 'brand_name', replacements, 'trendBrand', { isBrand: true });

            // Aggregate by day (timeStep could extend to weekly/monthly later)
            const query = `
                SELECT 
                    DATE(kw_crawl_date) as crawl_date,
                    ROUND(SUM(CASE WHEN ${brandSOSCondition} THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) AS overall_sos,
                    ROUND(SUM(CASE WHEN ${brandSOSCondition} AND spons_flag = 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) AS sponsored_sos,
                    ROUND(SUM(CASE WHEN ${brandSOSCondition} AND (spons_flag = 0 OR spons_flag IS NULL) THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) AS organic_sos
                FROM rb_kw
                WHERE kw_crawl_date BETWEEN :dateFrom AND :dateTo
                  AND ${platformCondition}
                  AND ${locationCondition}
                GROUP BY DATE(kw_crawl_date)
                ORDER BY crawl_date ASC
            `;

            const results = await sequelize.query(query, {
                replacements,
                type: sequelize.QueryTypes.SELECT
            });

            // Format dates like "06 Sep'25"
            const timeSeries = results.map(row => {
                const date = dayjs(row.crawl_date);
                return {
                    date: date.format("DD MMM'YY"),
                    overall_sos: Number(row.overall_sos) || 0,
                    sponsored_sos: Number(row.sponsored_sos) || 0,
                    organic_sos: Number(row.organic_sos) || 0,
                    display_sos: 0 // Display SOS not yet implemented
                };
            });

            console.log('[VisibilityService] Returning', timeSeries.length, 'trend data points');
            return { timeSeries };
        } catch (error) {
            console.error('[VisibilityService] Error getting visibility KPI trends:', error);
            return { timeSeries: [] };
        }
    }

    /**
     * Get Visibility Competition data for brand/SKU comparison
     * Returns SOS metrics with period-over-period delta for all brands and SKUs
     * @param {Object} filters - { platform, location, period }
     * @returns {Promise<{brands: Array, skus: Array}>}
     */
    async getVisibilityCompetition(filters = {}) {
        console.error('[VisibilityService] getVisibilityCompetition called with filters:', filters);

        try {
            // First, get the latest available date from the database
            const maxDateRes = await sequelize.query(`
                SELECT MAX(kw_crawl_date) as maxDate
                FROM rb_kw
                WHERE kw_crawl_date IS NOT NULL
            `, { type: sequelize.QueryTypes.SELECT });

            console.error('[VisibilityService] maxDateRes:', JSON.stringify(maxDateRes));
            const maxDateResult = maxDateRes[0];

            if (!maxDateResult?.maxDate) {
                console.error('[VisibilityService] No data found in rb_kw table');
                return { brands: [], skus: [] };
            }

            const latestDate = dayjs(maxDateResult.maxDate);
            console.log('[VisibilityService] Using latest available date:', latestDate.format('YYYY-MM-DD'));

            // Determine date ranges based on latest available date (not current date)
            const period = filters.period || '1M';
            const periodToDays = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
            const days = periodToDays[period] || 30;

            const currentEnd = latestDate;
            const currentStart = currentEnd.subtract(days, 'day');
            const prevEnd = currentStart.subtract(1, 'day');
            const prevStart = prevEnd.subtract(days, 'day');

            const platform = filters.platform || null;
            const location = filters.location || null;

            // Build conditions
            const currentReplacements = {
                dateFrom: currentStart.format('YYYY-MM-DD'),
                dateTo: currentEnd.format('YYYY-MM-DD')
            };
            const prevReplacements = {
                dateFrom: prevStart.format('YYYY-MM-DD'),
                dateTo: prevEnd.format('YYYY-MM-DD')
            };

            console.log('[VisibilityService] Competition date range:', currentReplacements);

            // Build filter conditions for current period
            const platCondCurrent = parseMultiSelectFilter(platform, 'platform_name', currentReplacements, 'compPlat', { caseInsensitive: true });
            const locCondCurrent = parseMultiSelectFilter(location, 'location_name', currentReplacements, 'compLoc', { caseInsensitive: true });

            // Add new filter conditions for format, productName, and brand
            const format = filters.format || null;
            const productName = filters.productName || null;
            const brandFilter = filters.brand || null;

            const formatCondCurrent = parseMultiSelectFilter(format, 'keyword_search_product', currentReplacements, 'compFormat', { caseInsensitive: true });
            const productCondCurrent = parseMultiSelectFilter(productName, 'keyword', currentReplacements, 'compProduct', { caseInsensitive: true });
            // Use brand_crawl column for brand filter (matches the filter dropdown data source)
            const brandCondCurrent = parseMultiSelectFilter(brandFilter, 'brand_crawl', currentReplacements, 'compBrand', { caseInsensitive: true });

            // Build filter conditions for previous period
            const platCondPrev = parseMultiSelectFilter(platform, 'platform_name', prevReplacements, 'prevPlat', { caseInsensitive: true });
            const locCondPrev = parseMultiSelectFilter(location, 'location_name', prevReplacements, 'prevLoc', { caseInsensitive: true });
            const formatCondPrev = parseMultiSelectFilter(format, 'keyword_search_product', prevReplacements, 'prevFormat', { caseInsensitive: true });
            const productCondPrev = parseMultiSelectFilter(productName, 'keyword', prevReplacements, 'prevProduct', { caseInsensitive: true });
            // Use brand_crawl column for brand filter (matches the filter dropdown data source)
            const brandCondPrev = parseMultiSelectFilter(brandFilter, 'brand_crawl', prevReplacements, 'prevBrand', { caseInsensitive: true });

            // Combined filter conditions
            const allCurrentFilters = `${platCondCurrent} AND ${locCondCurrent} AND ${formatCondCurrent} AND ${productCondCurrent} AND ${brandCondCurrent}`;
            const allPrevFilters = `${platCondPrev} AND ${locCondPrev} AND ${formatCondPrev} AND ${productCondPrev} AND ${brandCondPrev}`;

            console.log('[VisibilityService] Current filter conditions:', allCurrentFilters);

            // 1. Get total volume for both periods to serve as denominator for SOS
            const [currentTotalRes, prevTotalRes] = await Promise.all([
                sequelize.query(`
                    SELECT COUNT(*) as total
                    FROM rb_kw
                    WHERE kw_crawl_date BETWEEN :dateFrom AND :dateTo
                      AND ${allCurrentFilters}
                `, { replacements: currentReplacements, type: sequelize.QueryTypes.SELECT }),
                sequelize.query(`
                    SELECT COUNT(*) as total
                    FROM rb_kw
                    WHERE kw_crawl_date BETWEEN :dateFrom AND :dateTo
                      AND ${allPrevFilters}
                `, { replacements: prevReplacements, type: sequelize.QueryTypes.SELECT })
            ]);

            const currentVolume = Number(currentTotalRes[0]?.total) || 1;
            const prevVolume = Number(prevTotalRes[0]?.total) || 1;

            console.log(`[VisibilityService] Competition Volume - Current: ${currentVolume}, Prev: ${prevVolume}`);

            // 2. Query for brand-level competition (current period)
            // SOS is calculated as (Brand Rows / Total Shelf Rows) * 100
            // Using brand_crawl column with is_competitor_product=1 to show competitor brands
            const brandCurrentQuery = `
                SELECT 
                    brand_crawl as brand_name,
                    ROUND(COUNT(*) * 100.0 / ${currentVolume}, 2) AS overall_sos,
                    ROUND(SUM(CASE WHEN spons_flag = 1 THEN 1 ELSE 0 END) * 100.0 / ${currentVolume}, 2) AS sponsored_sos,
                    ROUND(SUM(CASE WHEN (spons_flag = 0 OR spons_flag IS NULL) THEN 1 ELSE 0 END) * 100.0 / ${currentVolume}, 2) AS organic_sos,
                    COUNT(*) as impressions
                FROM rb_kw
                WHERE kw_crawl_date BETWEEN :dateFrom AND :dateTo
                  AND ${allCurrentFilters}
                  AND brand_crawl IS NOT NULL AND brand_crawl != ''
                  AND is_competitor_product = 1
                GROUP BY brand_crawl
                ORDER BY impressions DESC
                LIMIT 20
            `;

            // 3. Query for brand-level competition (previous period)
            // Using brand_crawl column with is_competitor_product=1 for competitor brands
            const brandPrevQuery = `
                SELECT 
                    brand_crawl as brand_name,
                    ROUND(COUNT(*) * 100.0 / ${prevVolume}, 2) AS overall_sos,
                    ROUND(SUM(CASE WHEN spons_flag = 1 THEN 1 ELSE 0 END) * 100.0 / ${prevVolume}, 2) AS sponsored_sos,
                    ROUND(SUM(CASE WHEN (spons_flag = 0 OR spons_flag IS NULL) THEN 1 ELSE 0 END) * 100.0 / ${prevVolume}, 2) AS organic_sos
                FROM rb_kw
                WHERE kw_crawl_date BETWEEN :dateFrom AND :dateTo
                  AND ${allPrevFilters}
                  AND brand_crawl IS NOT NULL AND brand_crawl != ''
                  AND is_competitor_product = 1
                GROUP BY brand_crawl
            `;

            // 4. Query for SKU-level competition (current period)
            // Note: rb_kw table uses keyword_search_product for SKU/product name
            // Using brand_crawl column with is_competitor_product=1 for competitor products
            const skuCurrentQuery = `
                SELECT 
                    keyword_search_product as sku_name,
                    brand_crawl as brand_name,
                    ROUND(COUNT(*) * 100.0 / ${currentVolume}, 2) AS overall_sos,
                    ROUND(SUM(CASE WHEN spons_flag = 1 THEN 1 ELSE 0 END) * 100.0 / ${currentVolume}, 2) AS sponsored_sos,
                    ROUND(SUM(CASE WHEN (spons_flag = 0 OR spons_flag IS NULL) THEN 1 ELSE 0 END) * 100.0 / ${currentVolume}, 2) AS organic_sos,
                    COUNT(*) as impressions
                FROM rb_kw
                WHERE kw_crawl_date BETWEEN :dateFrom AND :dateTo
                  AND ${allCurrentFilters}
                  AND keyword_search_product IS NOT NULL AND keyword_search_product != ''
                  AND is_competitor_product = 1
                GROUP BY keyword_search_product, brand_crawl
                ORDER BY impressions DESC
                LIMIT 20
            `;

            const [brandCurrent, brandPrev, skuCurrent] = await Promise.all([
                sequelize.query(brandCurrentQuery, { replacements: currentReplacements, type: sequelize.QueryTypes.SELECT }),
                sequelize.query(brandPrevQuery, { replacements: prevReplacements, type: sequelize.QueryTypes.SELECT }),
                sequelize.query(skuCurrentQuery, { replacements: currentReplacements, type: sequelize.QueryTypes.SELECT })
            ]);

            // Create lookup for previous period brand data
            const brandPrevMap = {};
            brandPrev.forEach(b => {
                brandPrevMap[b.brand_name] = b;
            });

            // Format brand data with deltas
            const brands = brandCurrent.map(b => {
                const prev = brandPrevMap[b.brand_name] || {};
                return {
                    brand: b.brand_name,
                    overall_sos: {
                        value: Number(b.overall_sos) || 0,
                        delta: Number((b.overall_sos - (prev.overall_sos || 0)).toFixed(1))
                    },
                    sponsored_sos: {
                        value: Number(b.sponsored_sos) || 0,
                        delta: Number((b.sponsored_sos - (prev.sponsored_sos || 0)).toFixed(1))
                    },
                    organic_sos: {
                        value: Number(b.organic_sos) || 0,
                        delta: Number((b.organic_sos - (prev.organic_sos || 0)).toFixed(1))
                    },
                    display_sos: { value: 0, delta: 0 }
                };
            });

            // Format SKU data (simple format, no delta calculation for SKUs to keep it lightweight)
            const skus = skuCurrent.map(s => ({
                brand: s.sku_name,
                brandName: s.brand_name,
                overall_sos: { value: Number(s.overall_sos) || 0, delta: 0 },
                sponsored_sos: { value: Number(s.sponsored_sos) || 0, delta: 0 },
                organic_sos: { value: Number(s.organic_sos) || 0, delta: 0 },
                display_sos: { value: 0, delta: 0 }
            }));

            console.log('[VisibilityService] Returning', brands.length, 'brands and', skus.length, 'skus');
            return { brands, skus };
        } catch (error) {
            console.error('[VisibilityService] Error getting visibility competition:', error);
            return { brands: [], skus: [] };
        }
    }

    /**
     * Get Brand Comparison Trends for chart display
     * Returns daily SOS trends for multiple selected brands for comparison
     * @param {Object} filters - { brands: string[], platform, location, period, startDate, endDate }
     * @returns {Promise<{brands: {[brandName]: {timeSeries: Array, color: string}}, days: string[]}>}
     */
    async getBrandComparisonTrends(filters = {}) {
        console.error('[VisibilityService] getBrandComparisonTrends called with filters:', filters);

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

            // Get latest available date from database
            const [maxDateResult] = await sequelize.query(`
                SELECT MAX(kw_crawl_date) as maxDate FROM rb_kw WHERE kw_crawl_date IS NOT NULL
            `, { type: sequelize.QueryTypes.SELECT });

            if (!maxDateResult?.maxDate) {
                return { brands: {}, days: [] };
            }

            const latestDate = dayjs(maxDateResult.maxDate);

            // Determine date range
            let startDate, endDate;
            const period = filters.period || '1M';

            if (filters.startDate && filters.endDate) {
                startDate = dayjs(filters.startDate);
                endDate = dayjs(filters.endDate);
            } else {
                endDate = latestDate;
                const periodToDays = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
                const days = periodToDays[period] || 30;
                startDate = endDate.subtract(days, 'day');
            }

            const dateFrom = startDate.format('YYYY-MM-DD');
            const dateTo = endDate.format('YYYY-MM-DD');

            // Parse filter values
            const selectedBrands = filters.brands || [];
            const platform = filters.platform || null;
            const location = filters.location || null;

            if (selectedBrands.length === 0) {
                console.error('[VisibilityService] No brands selected for comparison');
                return { brands: {}, days: [] };
            }

            // Build platform and location conditions
            const replacements = { dateFrom, dateTo };
            const platformCondition = parseMultiSelectFilter(platform, 'platform_name', replacements, 'compTrendPlat', { caseInsensitive: true });
            const locationCondition = parseMultiSelectFilter(location, 'location_name', replacements, 'compTrendLoc', { caseInsensitive: true });

            // First get total shelf volume per day for SOS calculation
            const totalVolumeQuery = `
                SELECT 
                    DATE(kw_crawl_date) as crawl_date,
                    COUNT(*) as total_volume
                FROM rb_kw
                WHERE kw_crawl_date BETWEEN :dateFrom AND :dateTo
                  AND ${platformCondition}
                  AND ${locationCondition}
                GROUP BY DATE(kw_crawl_date)
                ORDER BY crawl_date ASC
            `;

            const volumeResults = await sequelize.query(totalVolumeQuery, {
                replacements,
                type: sequelize.QueryTypes.SELECT
            });

            // Create volume lookup by date
            const volumeByDate = {};
            const allDays = [];
            volumeResults.forEach(row => {
                const dateStr = dayjs(row.crawl_date).format("DD MMM'YY");
                volumeByDate[dateStr] = Number(row.total_volume) || 1;
                allDays.push(dateStr);
            });

            // Query brand-specific data for each selected brand
            const brandDataPromises = selectedBrands.map(async (brandName, index) => {
                const brandReplacements = { ...replacements, brandName };

                const brandQuery = `
                    SELECT 
                        DATE(kw_crawl_date) as crawl_date,
                        COUNT(*) as brand_volume,
                        SUM(CASE WHEN spons_flag = 1 THEN 1 ELSE 0 END) as sponsored_volume,
                        SUM(CASE WHEN (spons_flag = 0 OR spons_flag IS NULL) THEN 1 ELSE 0 END) as organic_volume
                    FROM rb_kw
                    WHERE kw_crawl_date BETWEEN :dateFrom AND :dateTo
                      AND ${platformCondition}
                      AND ${locationCondition}
                      AND LOWER(brand_crawl) = LOWER(:brandName)
                      AND is_competitor_product = 1
                    GROUP BY DATE(kw_crawl_date)
                    ORDER BY crawl_date ASC
                `;

                const brandResults = await sequelize.query(brandQuery, {
                    replacements: brandReplacements,
                    type: sequelize.QueryTypes.SELECT
                });

                // Map brand data to time series with SOS calculation
                const brandDataByDate = {};
                brandResults.forEach(row => {
                    const dateStr = dayjs(row.crawl_date).format("DD MMM'YY");
                    brandDataByDate[dateStr] = {
                        brand_volume: Number(row.brand_volume) || 0,
                        sponsored_volume: Number(row.sponsored_volume) || 0,
                        organic_volume: Number(row.organic_volume) || 0,
                    };
                });

                // Build time series for all days
                const timeSeries = allDays.map(dateStr => {
                    const totalVol = volumeByDate[dateStr] || 1;
                    const brandData = brandDataByDate[dateStr] || { brand_volume: 0, sponsored_volume: 0, organic_volume: 0 };

                    return {
                        date: dateStr,
                        overall_sos: Number(((brandData.brand_volume / totalVol) * 100).toFixed(2)),
                        sponsored_sos: Number(((brandData.sponsored_volume / totalVol) * 100).toFixed(2)),
                        organic_sos: Number(((brandData.organic_volume / totalVol) * 100).toFixed(2)),
                        display_sos: 0, // Not implemented
                    };
                });

                return {
                    brandName,
                    color: BRAND_COLORS[index % BRAND_COLORS.length],
                    timeSeries
                };
            });

            const brandDataList = await Promise.all(brandDataPromises);

            // Format response
            const brandsResult = {};
            brandDataList.forEach(brandData => {
                brandsResult[brandData.brandName] = {
                    color: brandData.color,
                    timeSeries: brandData.timeSeries
                };
            });

            console.error('[VisibilityService] Returning trends for', Object.keys(brandsResult).length, 'brands');
            return {
                brands: brandsResult,
                days: allDays
            };
        } catch (error) {
            console.error('[VisibilityService] Error getting brand comparison trends:', error);
            return { brands: {}, days: [] };
        }
    }
}


export default new VisibilityService();
