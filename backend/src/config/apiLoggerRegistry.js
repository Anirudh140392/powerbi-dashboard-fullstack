/**
 * API Logger Registry
 * Configuration-driven registry of pages and endpoints under automated test.
 * To add a new page in the future, add a new entry to PAGE_REGISTRY.
 */

import dayjs from 'dayjs';
import axios from 'axios';

/**
 * Helper to compute dynamic date ranges based on today's date in IST.
 * - End date: yesterday (standard reporting date)
 * - Start date: 7 days prior to yesterday
 * - Compare end date: 8 days prior
 * - Compare start date: 14 days prior
 */
export function getDynamicDateRange() {
    const yesterday = dayjs().subtract(1, 'day');
    return {
        endDate: yesterday.format('YYYY-MM-DD'),
        startDate: yesterday.subtract(6, 'day').format('YYYY-MM-DD'),
        compareEndDate: yesterday.subtract(7, 'day').format('YYYY-MM-DD'),
        compareStartDate: yesterday.subtract(13, 'day').format('YYYY-MM-DD'),
    };
}

/**
 * Registry of all pages and their monitored endpoints.
 */
export const PAGE_REGISTRY = {
    'Pricing Analysis': {
        pageName: 'Pricing Analysis',
        description: 'Comprehensive pricing, discounts, ECP, and price grid analytics',
        
        /**
         * Dynamically resolves context values (valid platforms, categories, brands, cities)
         * to pass realistic parameters to endpoints.
         */
        resolveContext: async (baseUrl, authHeaders) => {
            const context = {
                platform: 'Blinkit',
                category: 'Oral Care',
                brand: 'Colgate',
                city: 'Delhi',
                ...getDynamicDateRange(),
            };

            try {
                // Fetch valid platforms dynamically
                const platRes = await axios.get(`${baseUrl}/api/pricing-analysis/platforms`, {
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (platRes?.data && Array.isArray(platRes.data) && platRes.data.length > 0) {
                    const firstPlat = platRes.data.find(p => p && p !== 'All') || platRes.data[0];
                    if (firstPlat) context.platform = firstPlat;
                }

                // Fetch valid categories/cities from dimension-overview
                const dimRes = await axios.get(`${baseUrl}/api/pricing-analysis/dimension-overview`, {
                    params: { dimension: 'Category', startDate: context.startDate, endDate: context.endDate },
                    headers: authHeaders,
                    timeout: 7000,
                }).catch(() => null);

                if (dimRes?.data) {
                    const items = Array.isArray(dimRes.data) ? dimRes.data : dimRes.data?.data;
                    if (Array.isArray(items) && items.length > 0) {
                        const firstCat = items[0]?.category || items[0]?.dimension_value || items[0]?.name;
                        if (firstCat) context.category = firstCat;
                    }
                }
            } catch (err) {
                console.warn('[ApiLoggerRegistry] Note: Used default context for Pricing Analysis:', err.message);
            }

            return context;
        },

        endpoints: [
            {
                path: '/api/pricing-analysis/kpis',
                method: 'GET',
                segment: 'KPIs',
                description: 'Core pricing metrics (Discount, Weighted Discount, Price Per Unit, RPI)',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    platform: ctx.platform,
                }),
            },
            {
                path: '/api/pricing-analysis/insights',
                method: 'GET',
                segment: 'Insights',
                description: 'Price drop and price hike signals',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    platform: ctx.platform,
                }),
            },
            {
                path: '/api/pricing-analysis/dimension-overview',
                method: 'GET',
                segment: 'Category Overview',
                description: 'Metrics grouped by category or location',
                buildParams: (ctx) => ({
                    dimension: 'Category',
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    platform: ctx.platform,
                }),
            },
            {
                path: '/api/pricing-analysis/ecp-comparison',
                method: 'GET',
                segment: 'ECP Comparison',
                description: 'ECP comparison between current and comparison periods',
                buildParams: (ctx) => ({
                    platform: ctx.platform,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    compareStartDate: ctx.compareStartDate,
                    compareEndDate: ctx.compareEndDate,
                }),
            },
            {
                path: '/api/pricing-analysis/ecp-by-brand',
                method: 'GET',
                segment: 'ECP Analysis',
                description: 'Average MRP and ECP grouped by Brand for a platform',
                buildParams: (ctx) => ({
                    platform: ctx.platform, // platform is required
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/pricing-analysis/discount-by-category',
                method: 'GET',
                segment: 'Discount Analysis',
                description: 'Average discount % across categories per platform',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/pricing-analysis/discount-by-brand',
                method: 'GET',
                segment: 'Discount Analysis',
                description: 'Average discount by brand in a specific category',
                buildParams: (ctx) => ({
                    category: ctx.category, // category is required
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/pricing-analysis/ecp-weekday-weekend',
                method: 'GET',
                segment: 'ECP Analysis',
                description: 'ECP split by weekday vs weekend',
                buildParams: (ctx) => ({
                    platform: ctx.platform,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/pricing-analysis/brand-price-overview',
                method: 'GET',
                segment: 'Brand Price Overview',
                description: 'ECP data grouped by Brand, Platform, and Gram Size',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/pricing-analysis/one-view-price-grid',
                method: 'GET',
                segment: 'One View Price Grid',
                description: 'Date-wise product pricing grid data',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate, // startDate & endDate are required
                    endDate: ctx.endDate,
                    platform: ctx.platform,
                }),
            },
            {
                path: '/api/pricing-analysis/brand-discount-trend',
                method: 'GET',
                segment: 'Brand Trend',
                description: 'Brand-wise average discount trend over time',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate, // required
                    endDate: ctx.endDate,     // required
                    platform: ctx.platform,
                }),
            },
            {
                path: '/api/pricing-analysis/ecp-by-city',
                method: 'GET',
                segment: 'City Analysis',
                description: 'ECP and discount grouped by city, brand, and platform',
                buildParams: (ctx) => ({
                    platform: ctx.platform,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/pricing-analysis/dimension-trends',
                method: 'GET',
                segment: 'Category Overview',
                description: 'Pricing KPI trend for selected dimension',
                buildParams: (ctx) => ({
                    dimension: 'Category',
                    value: ctx.category,
                    timeStep: 'Monthly',
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/pricing-analysis/competition',
                method: 'GET',
                segment: 'Competition',
                description: 'Brand-level and SKU-level pricing competition data',
                buildParams: (ctx) => ({
                    category: ctx.category,
                    platform: ctx.platform,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/pricing-analysis/competition-trends',
                method: 'GET',
                segment: 'Competition',
                description: 'Trend metrics for competition brands or SKUs',
                buildParams: (ctx) => ({
                    dimension: 'Brand',
                    targets: ctx.brand,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/pricing-analysis/platforms',
                method: 'GET',
                segment: 'Filters',
                description: 'List of active platforms for pricing analysis',
                buildParams: () => ({}),
            },
            {
                path: '/api/pricing-analysis/channels',
                method: 'GET',
                segment: 'Filters',
                description: 'List of available channels for pricing analysis',
                buildParams: () => ({}),
            },
        ],
    },
};

/**
 * Get config for a specific page.
 */
export function getPageConfig(pageName = 'Pricing Analysis') {
    return PAGE_REGISTRY[pageName] || null;
}

/**
 * List all registered page names.
 */
export function getRegisteredPages() {
    return Object.keys(PAGE_REGISTRY);
}
