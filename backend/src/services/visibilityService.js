/**
 * Visibility Analysis Service
 * Provides business logic for visibility analysis APIs
 */

import sequelize from '../config/db.js';
import { Op } from 'sequelize';
import dayjs from 'dayjs';

/**
 * OPTIMIZED: Calculate ALL SOS percentages in a SINGLE query
 * Returns overall, sponsored, and organic SOS in one database call
 * @param {string} dateFrom - Start date (YYYY-MM-DD)
 * @param {string} dateTo - End date (YYYY-MM-DD)
 * @param {string|null} platform - Platform filter (optional)
 * @returns {Promise<{overall: number, sponsored: number, organic: number}>}
 */
async function calculateAllSOS(dateFrom, dateTo, platform = null) {
    try {
        let platformCondition = '';
        if (platform && platform !== 'All') {
            platformCondition = `AND LOWER(platform_name) = LOWER('${platform}')`;
        }

        // Single query that calculates ALL SOS types at once
        const query = `
            SELECT 
                ROUND(SUM(CASE WHEN keyword_is_rb_product = 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) AS overall_sos,
                ROUND(SUM(CASE WHEN keyword_is_rb_product = 1 AND spons_flag = 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) AS sponsored_sos,
                ROUND(SUM(CASE WHEN keyword_is_rb_product = 1 AND (spons_flag = 0 OR spons_flag IS NULL) THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) AS organic_sos
            FROM rb_kw
            WHERE kw_crawl_date BETWEEN :dateFrom AND :dateTo
            ${platformCondition}
        `;

        const result = await sequelize.query(query, {
            replacements: { dateFrom, dateTo },
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
async function getAllSOSTrends(days = 7, platform = null) {
    try {
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - (days - 1));

        const dateFrom = startDate.toISOString().split('T')[0];
        const dateTo = today.toISOString().split('T')[0];

        let platformCondition = '';
        if (platform && platform !== 'All') {
            platformCondition = `AND LOWER(platform_name) = LOWER('${platform}')`;
        }

        // Single query to get ALL SOS types grouped by date
        const query = `
            SELECT 
                DATE(kw_crawl_date) as crawl_date,
                ROUND(SUM(CASE WHEN keyword_is_rb_product = 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) AS overall_sos,
                ROUND(SUM(CASE WHEN keyword_is_rb_product = 1 AND spons_flag = 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) AS sponsored_sos,
                ROUND(SUM(CASE WHEN keyword_is_rb_product = 1 AND (spons_flag = 0 OR spons_flag IS NULL) THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) AS organic_sos
            FROM rb_kw
            WHERE kw_crawl_date BETWEEN :dateFrom AND :dateTo
            ${platformCondition}
            GROUP BY DATE(kw_crawl_date)
            ORDER BY crawl_date ASC
        `;

        const results = await sequelize.query(query, {
            replacements: { dateFrom, dateTo },
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
            calculateAllSOS(dateRanges.current.start, dateRanges.current.end, platform),
            calculateAllSOS(dateRanges.previous.start, dateRanges.previous.end, platform),
            getAllSOSTrends(7, platform)
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
            type: "Competitor"
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
            type: "Competitor"
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
     */
    async getPlatformKpiMatrix(filters) {
        console.log('[VisibilityService] getPlatformKpiMatrix called with filters:', filters);
        // TODO: Replace with actual database query when visibility data is available
        return getPlatformKpiMatrixMockData();
    }

    /**
     * Get Keywords at a Glance hierarchical data
     */
    async getKeywordsAtGlance(filters) {
        console.log('[VisibilityService] getKeywordsAtGlance called with filters:', filters);
        // TODO: Replace with actual database query when visibility data is available
        return getKeywordsAtGlanceMockData();
    }

    /**
     * Get Top Search Terms data with SOS metrics
     */
    async getTopSearchTerms(filters) {
        console.log('[VisibilityService] getTopSearchTerms called with filters:', filters);
        // TODO: Replace with actual database query when visibility data is available
        return getTopSearchTermsMockData(filters.filter || 'All');
    }

    /**
     * Get dynamic filter options for visibility analysis cascading filters
     * Uses rb_kw as primary source (main visibility data table)
     * @param {Object} params - { filterType, platform, format, city, metroFlag }
     * @returns {Object} { options: [...] }
     */
    async getVisibilityFilterOptions({ filterType, platform, format, city, metroFlag }) {
        try {
            console.log(`[VisibilityService] getVisibilityFilterOptions called: type=${filterType}, platform=${platform}, format=${format}, city=${city}, metroFlag=${metroFlag}`);

            // PLATFORMS: from rca_sku_dim.platform (master data)
            if (filterType === 'platforms') {
                const [results] = await sequelize.query(`
                    SELECT DISTINCT platform 
                    FROM rca_sku_dim 
                    WHERE platform IS NOT NULL AND platform != ''
                    ORDER BY platform
                `);
                const options = results.map(r => r.platform).filter(Boolean);
                console.log(`[VisibilityService] Found ${options.length} platforms from rca_sku_dim`);
                return { options };
            }

            // MONTHS: from rb_kw.kw_crawl_date (filter by platform)
            if (filterType === 'months') {
                let whereClause = "WHERE kw_crawl_date IS NOT NULL";
                if (platform && platform !== 'All') {
                    whereClause += ` AND LOWER(platform_name) = LOWER('${platform}')`;
                }
                const [results] = await sequelize.query(`
                    SELECT DISTINCT DATE_FORMAT(kw_crawl_date, '%Y-%m') as month
                    FROM rb_kw
                    ${whereClause}
                    ORDER BY month DESC
                    LIMIT 36
                `);
                const options = results.map(r => r.month).filter(Boolean);
                console.log(`[VisibilityService] Found ${options.length} months from rb_kw`);
                return { options };
            }

            // DATES: from rb_kw.kw_crawl_date (filter by platform)
            if (filterType === 'dates') {
                let whereClause = "WHERE kw_crawl_date IS NOT NULL";
                if (platform && platform !== 'All') {
                    whereClause += ` AND LOWER(platform_name) = LOWER('${platform}')`;
                }
                const [results] = await sequelize.query(`
                    SELECT DISTINCT DATE_FORMAT(kw_crawl_date, '%Y-%m-%d') as date
                    FROM rb_kw
                    ${whereClause}
                    ORDER BY date DESC
                    LIMIT 365
                `);
                const options = results.map(r => r.date).filter(Boolean);
                console.log(`[VisibilityService] Found ${options.length} dates from rb_kw`);
                return { options };
            }

            // FORMATS (Categories): from rca_sku_dim.Category (master data, status=1)
            if (filterType === 'formats') {
                let whereClause = "WHERE Category IS NOT NULL AND Category != '' AND status = 1";
                if (platform && platform !== 'All') {
                    whereClause += ` AND LOWER(platform) = LOWER('${platform}')`;
                }
                const [results] = await sequelize.query(`
                    SELECT DISTINCT Category as format
                    FROM rca_sku_dim
                    ${whereClause}
                    ORDER BY Category
                `);
                const options = results.map(r => r.format).filter(Boolean);
                console.log(`[VisibilityService] Found ${options.length} formats (Category) from rca_sku_dim`);
                return { options };
            }

            // CITIES: from rca_sku_dim.location (master data, filter by platform, format, metroFlag)
            if (filterType === 'cities') {
                // If metroFlag is set, filter cities by tier from rb_location_darkstore
                if (metroFlag && metroFlag !== 'All') {
                    const [tierCities] = await sequelize.query(`
                        SELECT DISTINCT location 
                        FROM rb_location_darkstore 
                        WHERE tier = '${metroFlag}' AND location IS NOT NULL
                        ORDER BY location
                    `);
                    const options = tierCities.map(r => r.location).filter(Boolean);
                    console.log(`[VisibilityService] Found ${options.length} cities for tier=${metroFlag}`);
                    return { options };
                }

                // Otherwise get from rca_sku_dim with platform and format filters
                let whereClause = "WHERE location IS NOT NULL AND location != ''";
                if (platform && platform !== 'All') {
                    whereClause += ` AND LOWER(platform) = LOWER('${platform}')`;
                }
                if (format && format !== 'All') {
                    whereClause += ` AND LOWER(Category) = LOWER('${format}')`;
                }
                const [results] = await sequelize.query(`
                    SELECT DISTINCT location as city
                    FROM rca_sku_dim
                    ${whereClause}
                    ORDER BY location
                `);
                const options = results.map(r => r.city).filter(Boolean);
                console.log(`[VisibilityService] Found ${options.length} cities from rca_sku_dim`);
                return { options };
            }

            // ZONES: from rb_location_darkstore.region
            if (filterType === 'zones') {
                let whereClause = "WHERE region IS NOT NULL AND region != ''";
                // Can filter by metroFlag (tier) if needed
                if (metroFlag && metroFlag !== 'All') {
                    whereClause += ` AND tier = '${metroFlag}'`;
                }
                const [results] = await sequelize.query(`
                    SELECT DISTINCT region as zone
                    FROM rb_location_darkstore
                    ${whereClause}
                    ORDER BY region
                `);
                const options = results.map(r => r.zone).filter(Boolean);
                console.log(`[VisibilityService] Found ${options.length} zones from rb_location_darkstore`);
                return { options };
            }

            // PINCODES: from rb_kw.pincode (filter by platform, city)
            if (filterType === 'pincodes') {
                let whereClause = "WHERE pincode IS NOT NULL";
                if (platform && platform !== 'All') {
                    whereClause += ` AND LOWER(platform_name) = LOWER('${platform}')`;
                }
                if (city && city !== 'All') {
                    whereClause += ` AND LOWER(location_name) = LOWER('${city}')`;
                }
                const [results] = await sequelize.query(`
                    SELECT DISTINCT pincode
                    FROM rb_kw
                    ${whereClause}
                    ORDER BY pincode
                    LIMIT 1000
                `);
                const options = results.map(r => String(r.pincode)).filter(Boolean);
                console.log(`[VisibilityService] Found ${options.length} pincodes from rb_kw`);
                return { options };
            }

            // METRO FLAGS: from rb_location_darkstore.tier (no filter)
            if (filterType === 'metroFlags') {
                const [results] = await sequelize.query(`
                    SELECT DISTINCT tier 
                    FROM rb_location_darkstore 
                    WHERE tier IS NOT NULL AND tier != ''
                    ORDER BY tier
                `);
                const options = results.map(r => r.tier).filter(Boolean);
                console.log(`[VisibilityService] Found ${options.length} metro flags (tiers)`);
                return { options };
            }

            // KPI: hardcoded values for SOS metrics
            if (filterType === 'kpis') {
                return {
                    options: [
                        'Overall SOS',
                        'Sponsored SOS',
                        'Organic SOS',
                        'Display SOS'
                    ]
                };
            }

            // Unknown filter type
            console.warn(`[VisibilityService] Unknown filterType: ${filterType}`);
            return { options: [] };

        } catch (error) {
            console.error(`[VisibilityService] Error in getVisibilityFilterOptions:`, error);
            return { options: [] };
        }
    }
}

export default new VisibilityService();
