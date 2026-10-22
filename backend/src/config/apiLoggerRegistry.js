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
    'Cross Platform Pricing': {
        pageName: 'Cross Platform Pricing',
        description: 'Cross-platform SKU pricing comparison, city locations, and pricing breach monitoring',

        /**
         * Dynamically resolves context values (valid dates, city, and sample SKU)
         * to pass realistic parameters to endpoints.
         */
        resolveContext: async (baseUrl, authHeaders) => {
            const context = {
                city: 'Delhi',
                searchQuery: 'Colgate',
                ...getDynamicDateRange(),
            };

            try {
                // 1. Fetch latest dates from watchtower
                const dateRes = await axios.get(`${baseUrl}/api/watchtower/latest-available-month`, {
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (dateRes?.data?.defaultEndDate && dateRes?.data?.defaultStartDate) {
                    context.endDate = dateRes.data.defaultEndDate;
                    context.startDate = dateRes.data.defaultStartDate;
                }

                // 2. Fetch a sample city and search SKU from cross-platform-pricing
                const sampleRes = await axios.get(`${baseUrl}/api/watchtower/cross-platform-pricing`, {
                    params: { startDate: context.startDate, endDate: context.endDate },
                    headers: authHeaders,
                    timeout: 10000,
                }).catch(() => null);

                if (sampleRes?.data) {
                    if (Array.isArray(sampleRes.data.cities) && sampleRes.data.cities.length > 0) {
                        const firstCity = sampleRes.data.cities[0]?.name;
                        if (firstCity) context.city = firstCity;
                    }
                    if (Array.isArray(sampleRes.data.skus) && sampleRes.data.skus.length > 0) {
                        const firstSkuName = sampleRes.data.skus[0]?.product_name;
                        if (firstSkuName) {
                            context.searchQuery = firstSkuName.split(' ').slice(0, 2).join(' ');
                        }
                    }
                }
            } catch (err) {
                console.warn('[ApiLoggerRegistry] Note: Used default context for Cross Platform Pricing:', err.message);
            }

            return context;
        },

        endpoints: [
            {
                path: '/api/watchtower/cross-platform-pricing',
                method: 'GET',
                segment: 'SKU Pricing Matrix',
                description: 'Core cross platform pricing table data for selected city',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    location: ctx.city,
                }),
            },
            {
                path: '/api/watchtower/cross-platform-pricing',
                method: 'GET',
                segment: 'All Cities Overview',
                description: 'Cross platform pricing across all Tier 1 cities with breach distribution',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/watchtower/cross-platform-pricing',
                method: 'GET',
                segment: 'Breaches Only',
                description: 'Filter SKUs exceeding pricing guardrails (>20% or <=0%)',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    location: ctx.city,
                    breachesOnly: 'true',
                }),
            },
            {
                path: '/api/watchtower/cross-platform-pricing',
                method: 'GET',
                segment: 'SKU Search',
                description: 'Keyword search for SKU products in cross platform pricing',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    search: ctx.searchQuery || 'Colgate',
                }),
            },
            {
                path: '/api/watchtower/latest-available-month',
                method: 'GET',
                segment: 'Date Boundaries',
                description: 'Latest date boundaries in rb_pdp_olap for date picker',
                buildParams: () => ({}),
            },
            {
                path: '/api/watchtower/channels',
                method: 'GET',
                segment: 'Filters',
                description: 'Available sales channels for Watch Tower pages',
                buildParams: () => ({}),
            },
            {
                path: '/api/watchtower/platform-channels',
                method: 'GET',
                segment: 'Filters',
                description: 'Platform to channel mappings for header filters',
                buildParams: () => ({}),
            },
            {
                path: '/api/watchtower/platforms',
                method: 'GET',
                segment: 'Filters',
                description: 'Distinct platforms list for Watch Tower pages',
                buildParams: () => ({}),
            },
        ],
    },

    'MOP Analysis': {
        pageName: 'MOP Analysis',
        targetDb: 'pidilite',
        description: 'Pidilite MOP pricing variance, multi-platform breaches, and product catalog monitoring',

        resolveContext: async (baseUrl, authHeaders) => {
            const context = {
                startDate: '2026-10-13',
                endDate: '2026-10-20',
            };

            try {
                // Discover dynamic date boundaries from /api/mop-analysis/latest-date
                const dateRes = await axios.get(`${baseUrl}/api/mop-analysis/latest-date`, {
                    headers: authHeaders,
                    timeout: 7000,
                }).catch(() => null);

                if (dateRes?.data?.available) {
                    context.startDate = dateRes.data.startDate || dateRes.data.defaultStartDate || context.startDate;
                    context.endDate = dateRes.data.endDate || dateRes.data.defaultEndDate || context.endDate;
                }
            } catch (err) {
                console.warn('[ApiLoggerRegistry] Note: Used default context for MOP Analysis:', err.message);
            }

            return context;
        },

        endpoints: [
            {
                path: '/api/mop-analysis/latest-date',
                method: 'GET',
                segment: 'Date Boundaries',
                description: 'Latest crawl date boundaries from rb_pdp_olap and mop_master',
                buildParams: () => ({}),
            },
            {
                path: '/api/mop-analysis/filters',
                method: 'GET',
                segment: 'Filters',
                description: 'Distinct Ecom Naming and SKU Code filter dropdown options from mop_master',
                buildParams: () => ({}),
            },
            {
                path: '/api/mop-analysis/data',
                method: 'GET',
                segment: 'Pricing Matrix',
                description: 'Full multi-platform MOP pricing grid with T1 and T2 price breach analysis',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    page: 1,
                    pageSize: 50,
                }),
            },
        ],
    },

    'Availability Analysis': {
        pageName: 'Availability Analysis',
        description: 'Absolute OSA, platform KPI matrix, DOI, category details, competition trends, and signal lab analytics',

        /**
         * Dynamically resolves context values (valid dates, platforms, categories, brands, cities, sample SKU)
         * to pass realistic parameters to all availability endpoints.
         */
        resolveContext: async (baseUrl, authHeaders) => {
            const context = {
                platform: 'Blinkit',
                category: 'Headphones',
                brand: 'Boat',
                city: 'Delhi',
                webPid: 'SAMPLE_SKU',
                skuName: 'Sample Product',
                ...getDynamicDateRange(),
            };

            try {
                // 1. Fetch valid dates from availability filter options
                const dateRes = await axios.get(`${baseUrl}/api/availability-analysis/filter-options`, {
                    params: { filterType: 'dates' },
                    headers: authHeaders,
                    timeout: 7000,
                }).catch(() => null);

                if (dateRes?.data?.options && Array.isArray(dateRes.data.options) && dateRes.data.options.length > 0) {
                    const validDates = dateRes.data.options.filter(d => d && d !== 'All');
                    if (validDates.length > 0) {
                        context.endDate = validDates[0];
                        context.startDate = validDates[Math.min(6, validDates.length - 1)];
                    }
                }

                // 2. Fetch platforms dynamically
                const platRes = await axios.get(`${baseUrl}/api/availability-analysis/filter-options`, {
                    params: { filterType: 'platforms' },
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (platRes?.data?.options && Array.isArray(platRes.data.options) && platRes.data.options.length > 0) {
                    const firstPlat = platRes.data.options.find(p => p && p !== 'All') || platRes.data.options[0];
                    if (firstPlat) context.platform = firstPlat;
                }

                // 3. Fetch categories dynamically
                const catRes = await axios.get(`${baseUrl}/api/availability-analysis/filter-options`, {
                    params: { filterType: 'categories' },
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (catRes?.data?.options && Array.isArray(catRes.data.options) && catRes.data.options.length > 0) {
                    const firstCat = catRes.data.options.find(c => c && c !== 'All') || catRes.data.options[0];
                    if (firstCat) context.category = firstCat;
                }

                // 4. Fetch brands dynamically
                const brandRes = await axios.get(`${baseUrl}/api/availability-analysis/brand-options`, {
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (brandRes?.data?.brands && Array.isArray(brandRes.data.brands) && brandRes.data.brands.length > 0) {
                    const firstBrand = brandRes.data.brands.find(b => b && b !== 'All') || brandRes.data.brands[0];
                    if (firstBrand) context.brand = firstBrand;
                }

                // 5. Fetch cities dynamically
                const cityRes = await axios.get(`${baseUrl}/api/availability-analysis/filter-options`, {
                    params: { filterType: 'cities' },
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (cityRes?.data?.options && Array.isArray(cityRes.data.options) && cityRes.data.options.length > 0) {
                    const firstCity = cityRes.data.options.find(c => c && c !== 'All') || cityRes.data.options[0];
                    if (firstCity) context.city = firstCity;
                }

                // 6. Fetch a sample SKU from signal-lab
                const skuRes = await axios.get(`${baseUrl}/api/availability-analysis/signal-lab`, {
                    params: {
                        startDate: context.startDate,
                        endDate: context.endDate,
                        platform: context.platform,
                        limit: 3,
                    },
                    headers: authHeaders,
                    timeout: 8000,
                }).catch(() => null);

                const sampleSkus = skuRes?.data?.skus;
                if (Array.isArray(sampleSkus) && sampleSkus.length > 0) {
                    const firstSku = sampleSkus[0];
                    context.webPid = firstSku.webPid || firstSku.Web_Pid || firstSku.web_pid || firstSku.sku || 'SAMPLE_SKU';
                    context.skuName = firstSku.skuName || firstSku.product_name || firstSku.title || 'Sample Product';
                }
            } catch (err) {
                console.warn('[ApiLoggerRegistry] Note: Used default context for Availability Analysis:', err.message);
            }

            return context;
        },

        endpoints: [
            {
                path: '/api/availability-analysis',
                method: 'GET',
                segment: 'Control Tower',
                description: 'Availability Analysis control tower metrics and assortment',
                buildParams: (ctx) => ({
                    platform: ctx.platform,
                }),
            },
            {
                path: '/api/availability-analysis/absolute-osa/availability-overview',
                method: 'GET',
                segment: 'Absolute OSA',
                description: 'Core availability overview metrics (stock availability, fill rate, SKU count, delivery time)',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    platform: ctx.platform,
                }),
            },
            {
                path: '/api/availability-analysis/absolute-osa/platform-kpi-matrix',
                method: 'GET',
                segment: 'Platform Matrix',
                description: 'Platform KPI Matrix breakdown with platform, format, and city view modes',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    viewMode: 'Platform',
                }),
            },
            {
                path: '/api/availability-analysis/standalone-kpi-matrix',
                method: 'GET',
                segment: 'Platform Matrix',
                description: 'Standalone KPI Matrix combining OSA and Market Share metrics',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    viewMode: 'Platform',
                }),
            },
            {
                path: '/api/availability-analysis/absolute-osa/osa-percentage-detail',
                method: 'GET',
                segment: 'OSA Details',
                description: 'Daily OSA percentage detail view grid across platforms and brands',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    platform: ctx.platform,
                }),
            },
            {
                path: '/api/availability-analysis/absolute-osa/doi',
                method: 'GET',
                segment: 'Inventory (DOI)',
                description: 'Days of Inventory calculation (Inventory / DRR) across platforms and locations',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    platform: ctx.platform,
                }),
            },
            {
                path: '/api/availability-analysis/absolute-osa/metro-city-stock-availability',
                method: 'GET',
                segment: 'City Analysis',
                description: 'Stock availability metrics focused specifically on Tier 1 / Metro cities',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    platform: ctx.platform,
                }),
            },
            {
                path: '/api/availability-analysis/osa-detail-by-category',
                method: 'GET',
                segment: 'Category Breakdown',
                description: 'Category-level daily OSA percentage breakdown over the last 31 days',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    platform: ctx.platform,
                }),
            },
            {
                path: '/api/availability-analysis/kpi-trends',
                method: 'GET',
                segment: 'Trends',
                description: 'Time-series trend points for OSA, DOI, Fillrate, and Assortment',
                buildParams: (ctx) => ({
                    platform: ctx.platform,
                    period: '1M',
                    timeStep: 'Daily',
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/availability-analysis/competition',
                method: 'GET',
                segment: 'Competition',
                description: 'Top competitor brands with comparative OSA, DOI, Fillrate, and Assortment',
                buildParams: (ctx) => ({
                    platform: ctx.platform,
                    period: '1M',
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/availability-analysis/competition-filter-options',
                method: 'GET',
                segment: 'Competition',
                description: 'Cascading filter options for competition locations, categories, and brands',
                buildParams: (ctx) => ({
                    platform: ctx.platform,
                }),
            },
            {
                path: '/api/availability-analysis/competition-brand-trends',
                method: 'GET',
                segment: 'Competition',
                description: 'Multi-brand time series comparison for availability competition trends',
                buildParams: (ctx) => ({
                    brands: ctx.brand,
                    period: '1M',
                    timeStep: 'Daily',
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/availability-analysis/competition-sku-trends',
                method: 'GET',
                segment: 'Competition',
                description: 'Multi-SKU time series comparison for availability competition trends',
                buildParams: (ctx) => ({
                    skus: 'All',
                    period: '1M',
                    timeStep: 'Daily',
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/availability-analysis/signal-lab',
                method: 'GET',
                segment: 'Signal Lab',
                description: 'SKU-level availability drainers and drivers with OSA and DOI signals',
                buildParams: (ctx) => ({
                    platform: ctx.platform,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    limit: 10,
                }),
            },
            {
                path: '/api/availability-analysis/signal-lab/city-details',
                method: 'GET',
                segment: 'Signal Lab',
                description: 'City-level breakdown for a specific product SKU in Signal Lab',
                buildParams: (ctx) => ({
                    webPid: ctx.webPid || 'SAMPLE_SKU',
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/availability-analysis/brand-sku-city-day',
                method: 'GET',
                segment: 'SKU Day Analysis',
                description: 'Brand to SKU to City day-level granular availability and ECP mapping',
                buildParams: (ctx) => ({
                    platform: ctx.platform,
                    brand: ctx.brand,
                    dayRange: 7,
                }),
            },
            {
                path: '/api/availability-analysis/filter-options',
                method: 'GET',
                segment: 'Filters',
                description: 'Dynamic platform filter options from rca_sku_dim',
                buildParams: () => ({
                    filterType: 'platforms',
                }),
            },
            {
                path: '/api/availability-analysis/filter-options',
                method: 'GET',
                segment: 'Filters',
                description: 'Dynamic category filter options from rca_sku_dim',
                buildParams: () => ({
                    filterType: 'categories',
                }),
            },
            {
                path: '/api/availability-analysis/filter-options',
                method: 'GET',
                segment: 'Filters',
                description: 'Dynamic city filter options from rca_sku_dim',
                buildParams: () => ({
                    filterType: 'cities',
                }),
            },
            {
                path: '/api/availability-analysis/brand-options',
                method: 'GET',
                segment: 'Filters',
                description: 'Distinct brand options from rb_pdp_olap for filter modals',
                buildParams: () => ({}),
            },
        ],
    },

    'Visibility Analysis': {
        pageName: 'Visibility Analysis',
        description: 'Comprehensive visibility, share of search (SOS), keyword drilldown, and search term analytics',
        
        resolveContext: async (baseUrl, authHeaders) => {
            const context = {
                platform: 'Blinkit',
                brand: 'Colgate',
                keyword: 'toothpaste',
                sku: 'SAMPLE_SKU',
                ...getDynamicDateRange(),
            };

            try {
                // Fetch latest available dates from Visibility table rb_kw_olap
                const datesRes = await axios.get(`${baseUrl}/api/visibility-analysis/latest-available-dates`, {
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (datesRes?.data?.available) {
                    context.startDate = datesRes.data.defaultStartDate || datesRes.data.startDate || context.startDate;
                    context.endDate = datesRes.data.latestDate || datesRes.data.endDate || context.endDate;
                }

                // Fetch dynamic platforms
                const platRes = await axios.get(`${baseUrl}/api/visibility-analysis/filter-options`, {
                    params: { filterType: 'platforms' },
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (platRes?.data && Array.isArray(platRes.data) && platRes.data.length > 0) {
                    const firstPlat = platRes.data.find(p => p && p !== 'All') || platRes.data[0];
                    if (firstPlat) context.platform = firstPlat;
                }

                // Fetch dynamic keywords
                const kwRes = await axios.get(`${baseUrl}/api/visibility-analysis/keywords`, {
                    params: { startDate: context.startDate, endDate: context.endDate },
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (kwRes?.data && Array.isArray(kwRes.data) && kwRes.data.length > 0) {
                    const firstKw = typeof kwRes.data[0] === 'string' ? kwRes.data[0] : (kwRes.data[0].keyword || kwRes.data[0].name);
                    if (firstKw) context.keyword = firstKw;
                }

                // Fetch sample SKU for drilldown
                const skuRes = await axios.get(`${baseUrl}/api/visibility-analysis/sku-drilldown`, {
                    params: { keyword: context.keyword, startDate: context.startDate, endDate: context.endDate },
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (skuRes?.data?.skus && Array.isArray(skuRes.data.skus) && skuRes.data.skus.length > 0) {
                    const s = skuRes.data.skus[0].sku || skuRes.data.skus[0].web_pid;
                    if (s) context.sku = s;
                }
            } catch (err) {
                console.warn('[ApiLoggerRegistry] Note: Used fallback context for Visibility Analysis:', err.message);
            }

            return context;
        },

        endpoints: [
            {
                path: '/api/visibility-analysis',
                method: 'GET',
                segment: 'Workspace',
                description: 'Workspace root metrics for Visibility Analysis',
                buildParams: (ctx) => ({
                    platform: ctx.platform,
                }),
            },
            {
                path: '/api/visibility-analysis/latest-available-dates',
                method: 'GET',
                segment: 'Dates',
                description: 'Latest available data month and date range in rb_kw_olap',
                buildParams: () => ({}),
            },
            {
                path: '/api/visibility-analysis/max-position',
                method: 'GET',
                segment: 'Overview',
                description: 'Maximum rank position threshold for organic and sponsored visibility',
                buildParams: () => ({}),
            },
            {
                path: '/api/visibility-analysis/visibility-overview',
                method: 'GET',
                segment: 'Overview',
                description: 'SOS KPI overview cards (Overall, Sponsored, Organic, Display)',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    platform: ctx.platform,
                }),
            },
            {
                path: '/api/visibility-analysis/platform-kpi-matrix',
                method: 'GET',
                segment: 'Platform Matrix',
                description: 'Platform, Format, and City breakdown matrix with SOS metrics',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    viewMode: 'Platform',
                }),
            },
            {
                path: '/api/visibility-analysis/keywords-at-glance',
                method: 'GET',
                segment: 'Keywords at a Glance',
                description: 'Hierarchical keyword/SKU drill matrix across platforms',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    view: 'keywords',
                }),
            },
            {
                path: '/api/visibility-analysis/filter-options',
                method: 'GET',
                segment: 'Filters',
                description: 'Dynamic platform filter options for visibility',
                buildParams: () => ({
                    filterType: 'platforms',
                }),
            },
            {
                path: '/api/visibility-analysis/filter-options',
                method: 'GET',
                segment: 'Filters',
                description: 'Dynamic format filter options for visibility',
                buildParams: () => ({
                    filterType: 'formats',
                }),
            },
            {
                path: '/api/visibility-analysis/filter-options',
                method: 'GET',
                segment: 'Filters',
                description: 'Dynamic city filter options for visibility',
                buildParams: () => ({
                    filterType: 'cities',
                }),
            },
            {
                path: '/api/visibility-analysis/brand-drilldown',
                method: 'GET',
                segment: 'Brand Drilldown',
                description: 'SOS metrics for all brands associated with a specific keyword',
                buildParams: (ctx) => ({
                    keyword: ctx.keyword,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/visibility-analysis/kpi-trends',
                method: 'GET',
                segment: 'Trends',
                description: 'Daily SOS trends for Overall, Sponsored, Organic, and Display',
                buildParams: (ctx) => ({
                    period: '1M',
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    platform: ctx.platform,
                }),
            },
            {
                path: '/api/visibility-analysis/competition',
                method: 'GET',
                segment: 'Competition',
                description: 'Brand and SKU competition visibility benchmarks and deltas',
                buildParams: (ctx) => ({
                    period: '1M',
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    platform: ctx.platform,
                }),
            },
            {
                path: '/api/visibility-analysis/brand-comparison-trends',
                method: 'GET',
                segment: 'Competition',
                description: 'Comparative multi-brand daily SOS trends',
                buildParams: (ctx) => ({
                    brands: ctx.brand || 'Colgate',
                    period: '1M',
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/visibility-analysis/visibility-signals',
                method: 'GET',
                segment: 'Signal Lab',
                description: 'Visibility signals and drainer identification for SKUs',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    platform: ctx.platform,
                }),
            },
            {
                path: '/api/visibility-analysis/visibility-signals/city-details',
                method: 'GET',
                segment: 'Signal Lab',
                description: 'City-level drilldown for visibility signal SKU',
                buildParams: (ctx) => ({
                    webPid: ctx.sku || 'SAMPLE_SKU',
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/visibility-analysis/categories',
                method: 'GET',
                segment: 'Filters',
                description: 'Dynamic category dropdown options for visibility',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/visibility-analysis/keywords',
                method: 'GET',
                segment: 'Filters',
                description: 'Dynamic keyword dropdown options for visibility',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/visibility-analysis/keyword-types',
                method: 'GET',
                segment: 'Filters',
                description: 'Dynamic keyword types dropdown options',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/visibility-analysis/sku-drilldown',
                method: 'GET',
                segment: 'SKU Drilldown',
                description: 'SKU-level SOS metrics and ranks for a selected keyword',
                buildParams: (ctx) => ({
                    keyword: ctx.keyword,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/visibility-analysis/city-drilldown',
                method: 'GET',
                segment: 'City Drilldown',
                description: 'City-level rank and visibility distribution for keyword and SKU',
                buildParams: (ctx) => ({
                    keyword: ctx.keyword,
                    sku: ctx.sku || 'SAMPLE_SKU',
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/visibility-analysis/gainers-drainers',
                method: 'GET',
                segment: 'Gainers & Drainers',
                description: 'Top gainers and drainers in visibility share',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    platform: ctx.platform,
                }),
            },
            {
                path: '/api/visibility-analysis/search-terms-performance',
                method: 'GET',
                segment: 'Search Terms',
                description: 'Search term performance ranking and metrics',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    platform: ctx.platform,
                }),
            },
            {
                path: '/api/visibility-analysis/search-terms-locations',
                method: 'GET',
                segment: 'Search Terms',
                description: 'Location drilldown for specific search terms',
                buildParams: (ctx) => ({
                    keyword: ctx.keyword,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/visibility-analysis/search-terms-brand-breakdown',
                method: 'GET',
                segment: 'Search Terms',
                description: 'Brand breakdown for specific search terms',
                buildParams: (ctx) => ({
                    keyword: ctx.keyword,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/visibility-analysis/bsr-data',
                method: 'GET',
                segment: 'BSR',
                description: 'Best Seller Rank (BSR) performance data across categories',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    platform: ctx.platform,
                }),
            },
            {
                path: '/api/visibility-analysis/bsr-trends',
                method: 'GET',
                segment: 'BSR',
                description: 'Best Seller Rank (BSR) time series trends',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    platform: ctx.platform,
                }),
            },
        ],
    },

    'Content Analysis': {
        pageName: 'Content Analysis',
        description: 'Product content score auditing, title, image, secondary image, description, and ratings verification',
        targetDb: 'mars',

        resolveContext: async (baseUrl, authHeaders) => {
            const context = {
                platform: '',
                category: '',
                brand: '',
                zone: '',
                ...getDynamicDateRange(),
            };

            try {
                // Fetch valid platforms dynamically
                const platRes = await axios.get(`${baseUrl}/api/content-analysis/platforms`, {
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (platRes?.data && Array.isArray(platRes.data) && platRes.data.length > 0) {
                    const firstPlat = platRes.data.find(p => p && p !== 'All') || platRes.data[0];
                    if (firstPlat) context.platform = firstPlat;
                }

                // Fetch valid categories dynamically
                const catRes = await axios.get(`${baseUrl}/api/content-analysis/categories`, {
                    params: context.platform ? { platform: context.platform } : {},
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (catRes?.data && Array.isArray(catRes.data) && catRes.data.length > 0) {
                    context.category = catRes.data[0];
                }

                // Fetch valid brands dynamically
                const brandRes = await axios.get(`${baseUrl}/api/content-analysis/brands`, {
                    params: context.platform ? { platform: context.platform } : {},
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (brandRes?.data && Array.isArray(brandRes.data) && brandRes.data.length > 0) {
                    context.brand = brandRes.data[0];
                }

                // Fetch valid zones dynamically
                const zoneRes = await axios.get(`${baseUrl}/api/content-analysis/zones`, {
                    params: context.brand ? { brand: context.brand } : {},
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (zoneRes?.data && Array.isArray(zoneRes.data) && zoneRes.data.length > 0) {
                    context.zone = zoneRes.data[0];
                }
            } catch (err) {
                console.warn('[ApiLoggerRegistry] Note: Used fallback context for Content Analysis:', err.message);
            }

            return context;
        },

        endpoints: [
            {
                path: '/api/content-analysis',
                method: 'GET',
                segment: 'Overview Table',
                description: 'Detailed SKU-level content quality scores (Title, Image, SI, Desc, Rating)',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    platform: ctx.platform || undefined,
                }),
            },
            {
                path: '/api/content-analysis/overview',
                method: 'GET',
                segment: 'Overview Cards',
                description: 'Aggregated content scorecard metrics with period-over-period deltas',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    platform: ctx.platform || undefined,
                }),
            },
            {
                path: '/api/content-analysis/platform-breakdown',
                method: 'GET',
                segment: 'Platform Breakdown',
                description: 'Cross-platform content performance comparison with delta indicators',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/content-analysis/platforms',
                method: 'GET',
                segment: 'Filters',
                description: 'Dynamic available platform list for content audits',
                buildParams: () => ({}),
            },
            {
                path: '/api/content-analysis/categories',
                method: 'GET',
                segment: 'Filters',
                description: 'Dynamic category filter options for content audits',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                }),
            },
            {
                path: '/api/content-analysis/brands',
                method: 'GET',
                segment: 'Filters',
                description: 'Dynamic brand filter options for content audits',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                }),
            },
            {
                path: '/api/content-analysis/zones',
                method: 'GET',
                segment: 'Filters',
                description: 'Dynamic city/zone filter options for content audits',
                buildParams: (ctx) => ({
                    brand: ctx.brand || undefined,
                }),
            },
            {
                path: '/api/content-analysis/trends',
                method: 'GET',
                segment: 'Trends',
                description: 'Historical content score evolution and compliance trends',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    platform: ctx.platform || undefined,
                }),
            },
        ],
    },

    'Inventory Analysis': {
        pageName: 'Inventory Analysis',
        description: 'Inventory health analytics, Days on Hand (DOH), Daily Run Rate (DRR), replenishment requirements, and SKU x City stock matrices',

        resolveContext: async (baseUrl, authHeaders) => {
            const context = {
                channel: 'QuickComm',
                platform: 'Blinkit',
                brand: 'Boat',
                category: '',
                location: '',
                ...getDynamicDateRange(),
            };

            try {
                // 1. Fetch valid dates from availability filter options (both use rb_pdp_olap)
                const dateRes = await axios.get(`${baseUrl}/api/availability-analysis/filter-options`, {
                    params: { filterType: 'dates' },
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (dateRes?.data?.options && Array.isArray(dateRes.data.options) && dateRes.data.options.length > 0) {
                    const validDates = dateRes.data.options.filter(d => d && d !== 'All');
                    if (validDates.length > 0) {
                        context.endDate = validDates[0];
                        context.startDate = validDates[Math.min(6, validDates.length - 1)];
                    }
                }

                // 2. Fetch platforms dynamically
                const platRes = await axios.get(`${baseUrl}/api/inventory-analysis/platforms`, {
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (platRes?.data && Array.isArray(platRes.data) && platRes.data.length > 0) {
                    const firstPlat = platRes.data.find(p => p && p !== 'All') || platRes.data[0];
                    if (firstPlat) context.platform = firstPlat;
                }

                // 3. Fetch brands dynamically
                const brandRes = await axios.get(`${baseUrl}/api/inventory-analysis/brands`, {
                    params: { platform: context.platform },
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (brandRes?.data && Array.isArray(brandRes.data) && brandRes.data.length > 0) {
                    const firstBrand = brandRes.data.find(b => b && b !== 'All') || brandRes.data[0];
                    if (firstBrand) context.brand = firstBrand;
                }

                // 4. Fetch categories dynamically
                const catRes = await axios.get(`${baseUrl}/api/inventory-analysis/categories`, {
                    params: { platform: context.platform },
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (catRes?.data && Array.isArray(catRes.data) && catRes.data.length > 0) {
                    const firstCat = catRes.data.find(c => c && c !== 'All') || catRes.data[0];
                    if (firstCat) context.category = firstCat;
                }

                // 5. Fetch locations dynamically
                const locRes = await axios.get(`${baseUrl}/api/inventory-analysis/locations`, {
                    params: { platform: context.platform, brand: context.brand },
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (locRes?.data && Array.isArray(locRes.data) && locRes.data.length > 0) {
                    const firstLoc = locRes.data.find(l => l && l !== 'All') || locRes.data[0];
                    if (firstLoc) context.location = firstLoc;
                }
            } catch (err) {
                console.warn('[ApiLoggerRegistry] Note: Used fallback context for Inventory Analysis:', err.message);
            }

            return context;
        },

        endpoints: [
            {
                path: '/api/inventory-analysis/overview',
                method: 'GET',
                segment: 'Overview',
                description: 'Core inventory overview metrics (DOH, DRR, and Total Boxes Required)',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    platform: ctx.platform || undefined,
                }),
            },
            {
                path: '/api/inventory-analysis/channels',
                method: 'GET',
                segment: 'Filters',
                description: 'Dynamic available sales channels for inventory filtering',
                buildParams: () => ({}),
            },
            {
                path: '/api/inventory-analysis/platforms',
                method: 'GET',
                segment: 'Filters',
                description: 'Dynamic available platforms for inventory filtering',
                buildParams: (ctx) => ({
                    channel: ctx.channel || undefined,
                }),
            },
            {
                path: '/api/inventory-analysis/brands',
                method: 'GET',
                segment: 'Filters',
                description: 'Dynamic available brands for inventory filtering',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                }),
            },
            {
                path: '/api/inventory-analysis/categories',
                method: 'GET',
                segment: 'Filters',
                description: 'Dynamic product categories for inventory filtering',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                }),
            },
            {
                path: '/api/inventory-analysis/locations',
                method: 'GET',
                segment: 'Filters',
                description: 'Dynamic distribution locations/cities for inventory filtering',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                    brand: ctx.brand || undefined,
                }),
            },
            {
                path: '/api/inventory-analysis/msls',
                method: 'GET',
                segment: 'Filters',
                description: 'Dynamic Must Stock List (MSL) values',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                }),
            },
            {
                path: '/api/inventory-analysis/matrix',
                method: 'GET',
                segment: 'Matrix',
                description: 'Inventory Matrix (SKU x City) with offtake and stock levels',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    platform: ctx.platform || undefined,
                }),
            },
            {
                path: '/api/inventory-analysis/city-sku-matrix',
                method: 'GET',
                segment: 'Matrix',
                description: 'City-SKU Inventory Matrix with drilldown metrics and DOH',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    platform: ctx.platform || undefined,
                }),
            },
        ],
    },

    'Insights': {
        pageName: 'Insights',
        description: 'Automated executive insights, anomaly detection, metric correlations, signal trends, and automated alerting',

        resolveContext: async (baseUrl, authHeaders) => {
            const context = {
                platform: 'Blinkit',
                category: 'Accessories',
                brand: 'Boat',
                city: '',
                ...getDynamicDateRange(),
            };

            try {
                // 1. Fetch valid dates from availability filter options
                const dateRes = await axios.get(`${baseUrl}/api/availability-analysis/filter-options`, {
                    params: { filterType: 'dates' },
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (dateRes?.data?.options && Array.isArray(dateRes.data.options) && dateRes.data.options.length > 0) {
                    const validDates = dateRes.data.options.filter(d => d && d !== 'All');
                    if (validDates.length > 0) {
                        context.endDate = validDates[0];
                        context.startDate = validDates[Math.min(6, validDates.length - 1)];
                    }
                }

                // 2. Fetch filters dynamically from insights
                const filterRes = await axios.get(`${baseUrl}/api/insights/filters`, {
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (filterRes?.data?.data) {
                    const { platforms, categories, brands, geographies } = filterRes.data.data;
                    if (Array.isArray(platforms) && platforms.length > 0) {
                        const p = platforms.find(x => x && x !== 'All' && x !== 'All platforms');
                        if (p) context.platform = p;
                    }
                    if (Array.isArray(categories) && categories.length > 0) {
                        const c = categories.find(x => x && x !== 'All' && x !== 'All categories');
                        if (c) context.category = c;
                    }
                    if (Array.isArray(brands) && brands.length > 0) {
                        const b = brands.find(x => x && x !== 'All');
                        if (b) context.brand = b;
                    }
                    if (Array.isArray(geographies) && geographies.length > 0) {
                        const g = geographies.find(x => x && x !== 'All' && x !== 'All cities');
                        if (g) context.city = g;
                    }
                }
            } catch (err) {
                console.warn('[ApiLoggerRegistry] Note: Used fallback context for Insights:', err.message);
            }

            return context;
        },

        endpoints: [
            {
                path: '/api/insights',
                method: 'GET',
                segment: 'Overview',
                description: 'Executive anomalies, recommendations, and KPI summaries',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                    category: ctx.category || undefined,
                    brand: ctx.brand || undefined,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/insights/filters',
                method: 'GET',
                segment: 'Filters',
                description: 'Dynamic filter dimensions (platforms, categories, product lines, geographies, brands)',
                buildParams: () => ({}),
            },
            {
                path: '/api/insights/correlations',
                method: 'GET',
                segment: 'Correlations',
                description: 'Multivariate cross-metric correlation analysis across availability, pricing, and sales',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                    category: ctx.category || undefined,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/insights/correlations/trend',
                method: 'GET',
                segment: 'Correlations',
                description: 'Time series metric correlation trends for SKU and category level drilldown',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                    category: ctx.category || undefined,
                    brand: ctx.brand || undefined,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/insights/alerts',
                method: 'GET',
                segment: 'Alerts',
                description: 'Active alert rules and notification configurations for the user dashboard',
                buildParams: () => ({}),
            },
        ],
    },

    'Market Share': {
        pageName: 'Market Share',
        description: 'Category size, brand market share, sub-category KPIs, cross-platform overview, competition trends, and hierarchical product drilldown',

        resolveContext: async (baseUrl, authHeaders) => {
            const context = {
                platform: 'Blinkit',
                category: 'Accessories',
                brand: 'Boat',
                subCategory: '',
                ...getDynamicDateRange(),
            };

            try {
                // 1. Fetch latest available date from market share
                const ldRes = await axios.get(`${baseUrl}/api/market-share/latest-date`, {
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (ldRes?.data?.available) {
                    context.startDate = ldRes.data.defaultStartDate || ldRes.data.minDate || context.startDate;
                    context.endDate = ldRes.data.defaultEndDate || ldRes.data.maxDate || context.endDate;
                }

                // 2. Fetch top filter options (platforms, categories)
                const tfRes = await axios.get(`${baseUrl}/api/market-share/top-filter-options`, {
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (tfRes?.data?.platforms && Array.isArray(tfRes.data.platforms) && tfRes.data.platforms.length > 0) {
                    const firstPlat = tfRes.data.platforms.find(p => p && p !== 'All') || tfRes.data.platforms[0];
                    if (firstPlat) context.platform = firstPlat;
                }

                if (tfRes?.data?.categories && Array.isArray(tfRes.data.categories) && tfRes.data.categories.length > 0) {
                    const firstCat = tfRes.data.categories.find(c => c && c !== 'All') || tfRes.data.categories[0];
                    if (firstCat) context.category = firstCat;
                }

                // 3. Fetch cascaded filters for brands and sub-categories
                const cfRes = await axios.get(`${baseUrl}/api/market-share/cascaded-filters`, {
                    params: { platform: context.platform, category: context.category },
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (cfRes?.data?.brands && Array.isArray(cfRes.data.brands) && cfRes.data.brands.length > 0) {
                    const firstBrand = cfRes.data.brands.find(b => b && b !== 'All') || cfRes.data.brands[0];
                    if (firstBrand) context.brand = firstBrand;
                }

                if (cfRes?.data?.subCategories && Array.isArray(cfRes.data.subCategories) && cfRes.data.subCategories.length > 0) {
                    const firstSubCat = cfRes.data.subCategories.find(s => s && s !== 'All') || cfRes.data.subCategories[0];
                    if (firstSubCat) context.subCategory = firstSubCat;
                }
            } catch (err) {
                console.warn('[ApiLoggerRegistry] Note: Used fallback context for Market Share:', err.message);
            }

            return context;
        },

        endpoints: [
            {
                path: '/api/market-share',
                method: 'GET',
                segment: 'Overview',
                description: 'Market Share root KPIs (Category Size, Market Leader Sales, Mars/Own Brand Sales, Market Share %)',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                    category: ctx.category || undefined,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/market-share/sub-category-kpi',
                method: 'GET',
                segment: 'Sub-Category',
                description: 'Brand-level KPIs grouped by sub-category with benchmark deltas',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                    category: ctx.category || undefined,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/market-share/cross-platform',
                method: 'GET',
                segment: 'Cross-Platform',
                description: 'Cross-platform category size, market share, and sales comparison matrix',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                    category: ctx.category || undefined,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/market-share/trends',
                method: 'GET',
                segment: 'Trends',
                description: 'Time-series trend analytics for market share and category evolution',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                    category: ctx.category || undefined,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    period: '1M',
                    timeStep: 'Daily',
                }),
            },
            {
                path: '/api/market-share/competition',
                method: 'GET',
                segment: 'Competition',
                description: 'Brand competition benchmarking with market share percentages and revenue',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                    category: ctx.category || undefined,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    period: '1M',
                }),
            },
            {
                path: '/api/market-share/competition-filter-options',
                method: 'GET',
                segment: 'Filters',
                description: 'Cascading categories and brands for competition analysis',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                    category: ctx.category || undefined,
                }),
            },
            {
                path: '/api/market-share/top-filter-options',
                method: 'GET',
                segment: 'Filters',
                description: 'Top-level platform, category, and channel filter dimensions',
                buildParams: () => ({}),
            },
            {
                path: '/api/market-share/competition-trends',
                method: 'GET',
                segment: 'Competition',
                description: 'Comparative time-series trends across competitor brands and SKUs',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                    category: ctx.category || undefined,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    period: '1M',
                    mode: 'brands',
                    targets: ctx.brand || 'Boat',
                }),
            },
            {
                path: '/api/market-share/drilldown',
                method: 'GET',
                segment: 'Drilldown',
                description: 'Hierarchical Brand to Sub-Brand to SKU drilldown with share metrics',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                    category: ctx.category || undefined,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/market-share/latest-date',
                method: 'GET',
                segment: 'Dates',
                description: 'Latest available data date range in Market Share OLAP tables',
                buildParams: () => ({}),
            },
            {
                path: '/api/market-share/cascaded-filters',
                method: 'GET',
                segment: 'Filters',
                description: 'Dynamic cascading brand and sub-category filter options',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                    category: ctx.category || undefined,
                }),
            },
            {
                path: '/api/market-share/share-table',
                method: 'GET',
                segment: 'Share Table',
                description: 'Category x Brand x Sub-Category market share distribution table',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                    category: ctx.category || undefined,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/market-share/product-drilldown',
                method: 'GET',
                segment: 'Drilldown',
                description: '4-level nested hierarchy (Platform -> Category -> Brand -> Product) with market share',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                    category: ctx.category || undefined,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
        ],
    },
    'India Overview': {
        pageName: 'India Overview',
        description: 'Geographic intelligence and city-level KPI mapping across India (Sales, OSA%, Orders, Market Share)',

        resolveContext: async (baseUrl, authHeaders) => {
            const context = {
                platform: 'Blinkit',
                category: 'Accessories',
                brand: 'Boat',
                channel: 'Quick Commerce',
                ...getDynamicDateRange(),
            };

            try {
                // 1. Fetch platforms dynamically from watchtower
                const platRes = await axios.get(`${baseUrl}/api/watchtower/platforms`, {
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (platRes?.data && Array.isArray(platRes.data) && platRes.data.length > 0) {
                    const firstPlat = platRes.data.find(p => p && p !== 'All') || platRes.data[0];
                    if (firstPlat) context.platform = firstPlat;
                }

                // 2. Fetch categories dynamically from map-intellect
                const catRes = await axios.get(`${baseUrl}/api/map-intellect/categories`, {
                    params: { metric: 'OSA %', platform: context.platform },
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (catRes?.data && Array.isArray(catRes.data) && catRes.data.length > 0) {
                    const firstCat = catRes.data.find(c => c && c !== 'All') || catRes.data[0];
                    if (firstCat) context.category = firstCat;
                }

                // 3. Fetch brands dynamically from map-intellect
                const brandRes = await axios.get(`${baseUrl}/api/map-intellect/brands`, {
                    params: { platform: context.platform, metric: 'OSA %' },
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (brandRes?.data && Array.isArray(brandRes.data) && brandRes.data.length > 0) {
                    const firstBrand = brandRes.data.find(b => b && b !== 'All') || brandRes.data[0];
                    if (firstBrand) context.brand = firstBrand;
                }
            } catch (err) {
                console.warn('[ApiLoggerRegistry] Note: Used default context for India Overview:', err.message);
            }

            return context;
        },

        endpoints: [
            {
                path: '/api/watchtower/platforms',
                method: 'GET',
                segment: 'Filters',
                description: 'Available e-commerce platforms for geo intelligence map',
                buildParams: () => ({}),
            },
            {
                path: '/api/map-intellect/categories',
                method: 'GET',
                segment: 'Filters',
                description: 'Distinct product categories for selected platform and channel',
                buildParams: (ctx) => ({
                    platform: ctx.platform || 'Blinkit',
                    metric: 'OSA %',
                }),
            },
            {
                path: '/api/map-intellect/brands',
                method: 'GET',
                segment: 'Filters',
                description: 'Distinct brands portfolio for selected platform and channel',
                buildParams: (ctx) => ({
                    platform: ctx.platform || 'Blinkit',
                    metric: 'OSA %',
                }),
            },
            {
                path: '/api/map-intellect/data',
                method: 'GET',
                segment: 'OSA %',
                description: 'City-level On-Shelf Availability (OSA %) geographic distribution and pin ratings',
                buildParams: (ctx) => ({
                    platform: ctx.platform || 'Blinkit',
                    metric: 'osa',
                    months: 1,
                }),
            },
            {
                path: '/api/map-intellect/data',
                method: 'GET',
                segment: 'Market Share',
                description: 'City-level Market Share penetration and geographic volume share',
                buildParams: (ctx) => ({
                    platform: ctx.platform || 'Blinkit',
                    metric: 'marketshare',
                    months: 1,
                }),
            },
            {
                path: '/api/map-intellect/data',
                method: 'GET',
                segment: 'Sales',
                description: 'City-level Sales revenue and period-over-period growth indicators',
                buildParams: (ctx) => ({
                    platform: ctx.platform || 'Blinkit',
                    metric: 'sales',
                    months: 1,
                }),
            },
            {
                path: '/api/map-intellect/data',
                method: 'GET',
                segment: 'Orders',
                description: 'City-level Order volumes and demand distribution across pin codes',
                buildParams: (ctx) => ({
                    platform: ctx.platform || 'Blinkit',
                    metric: 'orders',
                    months: 1,
                }),
            },
            {
                path: '/api/map-intellect/data',
                method: 'GET',
                segment: 'Overview',
                description: 'Comprehensive multi-metric national and city aggregate overview',
                buildParams: (ctx) => ({
                    platform: ctx.platform || 'Blinkit',
                    metric: 'all',
                    months: 1,
                }),
            },
            {
                path: '/api/map-intellect/data',
                method: 'GET',
                segment: 'Time Horizons',
                description: '7-day rolling window geographic KPI metrics',
                buildParams: (ctx) => ({
                    platform: ctx.platform || 'Blinkit',
                    metric: 'all',
                    days: 7,
                }),
            },
            {
                path: '/api/map-intellect/data',
                method: 'GET',
                segment: 'Time Horizons',
                description: '14-day rolling window geographic KPI metrics',
                buildParams: (ctx) => ({
                    platform: ctx.platform || 'Blinkit',
                    metric: 'all',
                    days: 14,
                }),
            },
            {
                path: '/api/map-intellect/data',
                method: 'GET',
                segment: 'Time Horizons',
                description: '31-day rolling window geographic KPI metrics',
                buildParams: (ctx) => ({
                    platform: ctx.platform || 'Blinkit',
                    metric: 'all',
                    days: 31,
                }),
            },
            {
                path: '/api/map-intellect/data',
                method: 'GET',
                segment: 'Time Horizons',
                description: 'Custom date range filtered geographic KPI metrics',
                buildParams: (ctx) => ({
                    platform: ctx.platform || 'Blinkit',
                    metric: 'all',
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/map-intellect/data',
                method: 'GET',
                segment: 'Category Drilldown',
                description: 'Category-specific city level KPI metrics',
                buildParams: (ctx) => ({
                    platform: ctx.platform || 'Blinkit',
                    metric: 'all',
                    category: ctx.category || 'Accessories',
                    months: 1,
                }),
            },
            {
                path: '/api/map-intellect/data',
                method: 'GET',
                segment: 'Brand Drilldown',
                description: 'Brand-filtered city level performance metrics',
                buildParams: (ctx) => ({
                    platform: ctx.platform || 'Blinkit',
                    metric: 'all',
                    brand: ctx.brand || 'Boat',
                    months: 1,
                }),
            },
        ],
    },
    'Business Overview': {
        pageName: 'Business Overview',
        description: 'Executive Control Tower dashboard with multi-dimensional performance metrics, brand matrix, and breakdown',

        resolveContext: async (baseUrl, authHeaders) => {
            const context = {
                platform: 'Blinkit',
                category: 'Accessories',
                brand: 'Boat',
                channel: 'Quick Commerce',
                ...getDynamicDateRange(),
            };

            try {
                // 1. Fetch valid platforms dynamically
                const platRes = await axios.get(`${baseUrl}/api/watchtower/platforms`, {
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (platRes?.data && Array.isArray(platRes.data) && platRes.data.length > 0) {
                    const firstPlat = platRes.data.find(p => p && p !== 'All') || platRes.data[0];
                    if (firstPlat) context.platform = firstPlat;
                }

                // 2. Fetch categories dynamically
                const catRes = await axios.get(`${baseUrl}/api/watchtower/categories`, {
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (catRes?.data && Array.isArray(catRes.data) && catRes.data.length > 0) {
                    const firstCat = catRes.data.find(c => c && c !== 'All') || catRes.data[0];
                    if (firstCat) context.category = firstCat;
                }

                // 3. Fetch brands dynamically
                const brandRes = await axios.get(`${baseUrl}/api/watchtower/brands`, {
                    headers: authHeaders,
                    timeout: 5000,
                }).catch(() => null);

                if (brandRes?.data && Array.isArray(brandRes.data) && brandRes.data.length > 0) {
                    const firstBrand = brandRes.data.find(b => b && b !== 'All') || brandRes.data[0];
                    if (firstBrand) context.brand = firstBrand;
                }
            } catch (err) {
                console.warn('[ApiLoggerRegistry] Note: Used default context for Business Overview:', err.message);
            }

            return context;
        },

        endpoints: [
            // --- 1. Filters & Dimensions ---
            {
                path: '/api/watchtower/channels',
                method: 'GET',
                segment: 'Filters',
                description: 'Available retail channels (E-Commerce, Quick Commerce)',
                buildParams: () => ({}),
            },
            {
                path: '/api/watchtower/platforms',
                method: 'GET',
                segment: 'Filters',
                description: 'E-commerce and quick commerce platforms list',
                buildParams: () => ({}),
            },
            {
                path: '/api/watchtower/pdp-platforms',
                method: 'GET',
                segment: 'Filters',
                description: 'Platforms available in product details catalog',
                buildParams: () => ({}),
            },
            {
                path: '/api/watchtower/pm-platforms',
                method: 'GET',
                segment: 'Filters',
                description: 'Platforms available for paid performance marketing',
                buildParams: () => ({}),
            },
            {
                path: '/api/watchtower/platform-metadata',
                method: 'GET',
                segment: 'Filters',
                description: 'Platform logos, visual styles, and metadata',
                buildParams: () => ({}),
            },
            {
                path: '/api/watchtower/categories',
                method: 'GET',
                segment: 'Filters',
                description: 'Distinct product categories for dashboard filtering',
                buildParams: () => ({}),
            },
            {
                path: '/api/watchtower/brands',
                method: 'GET',
                segment: 'Filters',
                description: 'Distinct brand portfolio for dashboard filtering',
                buildParams: () => ({}),
            },
            {
                path: '/api/watchtower/locations',
                method: 'GET',
                segment: 'Filters',
                description: 'Distinct cities and geographic locations',
                buildParams: () => ({}),
            },
            {
                path: '/api/watchtower/msls',
                method: 'GET',
                segment: 'Filters',
                description: 'Must-Sell-List (MSL) status options',
                buildParams: () => ({}),
            },
            {
                path: '/api/watchtower/sub-brands',
                method: 'GET',
                segment: 'Filters',
                description: 'Dynamic sub-brands available in catalog',
                buildParams: () => ({}),
            },
            {
                path: '/api/watchtower/latest-available-month',
                method: 'GET',
                segment: 'Filters',
                description: 'Latest data month date boundary',
                buildParams: () => ({}),
            },
            {
                path: '/api/watchtower/products',
                method: 'GET',
                segment: 'Filters',
                description: 'Available SKUs and products for advanced filters',
                buildParams: () => ({}),
            },
            {
                path: '/api/watchtower/cascaded-filters',
                method: 'GET',
                segment: 'Filters',
                description: 'Dynamic cascading filter dimensions',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                }),
            },

            // --- 2. Executive Overview & KPIs ---
            {
                path: '/api/watchtower/overview',
                method: 'GET',
                segment: 'Overview',
                description: 'Executive top-line summary metrics (Offtakes, Quantity, Spend, TACoS)',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/watchtower/performance-metrics',
                method: 'GET',
                segment: 'Performance Metrics',
                description: 'Comparative KPI cards with period-over-period percentage deltas',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                    compareStartDate: ctx.compareStartDate,
                    compareEndDate: ctx.compareEndDate,
                }),
            },

            // --- 3. Multi-Dimensional Grids ---
            {
                path: '/api/watchtower/platform-overview',
                method: 'GET',
                segment: 'Platform Matrix',
                description: 'Platform dimension breakdown of offtakes, spend, OSA, and share',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/watchtower/brands-overview',
                method: 'GET',
                segment: 'Brand Matrix',
                description: 'Brand dimension performance grid with offtakes, spend, and ROAS',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/watchtower/month-overview',
                method: 'GET',
                segment: 'Monthly Trend',
                description: 'Historical monthly performance trend metrics',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/watchtower/category-overview',
                method: 'GET',
                segment: 'Category Matrix',
                description: 'Category and format level performance studio breakdown',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/watchtower/sku-overview',
                method: 'GET',
                segment: 'SKU Matrix',
                description: 'Product and SKU level performance breakdown table',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/watchtower/city-overview',
                method: 'GET',
                segment: 'City Matrix',
                description: 'Geographic and city level performance breakdown',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },

            // --- 4. Performance Breakdown ---
            {
                path: '/api/watchtower/performance-breakdown',
                method: 'GET',
                segment: 'Performance Breakdown',
                description: 'Deep-dive aggregated breakdown with impressions, clicks, spends, and orders',
                buildParams: (ctx) => ({
                    group_by: 'category',
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },

            // --- 5. Priority Actions & Diagnostics ---
            {
                path: '/api/watchtower/top-actions',
                method: 'GET',
                segment: 'Priority Actions',
                description: 'Top action recommendations and business signals',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/watchtower/osa-deep-dive',
                method: 'GET',
                segment: 'Availability Deep Dive',
                description: 'Out-of-stock and inventory deep dive diagnostics',
                buildParams: (ctx) => ({
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },

            // --- 6. Competition & Trends ---
            {
                path: '/api/watchtower/competition',
                method: 'GET',
                segment: 'Competition',
                description: 'Top competitor brands comparative metrics',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/watchtower/competition-brand-trends',
                method: 'GET',
                segment: 'Competition',
                description: 'Competitor brand time series trends',
                buildParams: (ctx) => ({
                    platform: ctx.platform || undefined,
                    brand: ctx.brand || 'Boat',
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },
            {
                path: '/api/watchtower/cross-platform-brand-matrix',
                method: 'GET',
                segment: 'Cross-Platform Matrix',
                description: 'Brand presence and performance matrix across platforms',
                buildParams: (ctx) => ({
                    brand: ctx.brand || 'Boat',
                    startDate: ctx.startDate,
                    endDate: ctx.endDate,
                }),
            },

            // --- 7. Compare SKU ---
            {
                path: '/api/watchtower/compare-sku/date-range',
                method: 'GET',
                segment: 'Compare SKU',
                description: 'Available date boundaries for SKU comparison',
                buildParams: () => ({}),
            },
            {
                path: '/api/watchtower/compare-sku/filters',
                method: 'GET',
                segment: 'Compare SKU',
                description: 'Cascading platform, brand, category, and location filters for SKU comparison',
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
