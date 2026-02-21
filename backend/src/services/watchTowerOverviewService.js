import dayjs from 'dayjs';
import { queryClickHouse } from '../config/clickhouse.js';
import { buildClickHouseConditions, formatCurrency } from './watchTowerEngine.js';
import { getOfftakeData } from './watchTowerOfftakeService.js';
import { getAvailabilityData } from './watchTowerAvailabilityService.js';
import { getSosData } from './watchTowerSosService.js';
import { getMarketShareData } from './watchTowerMarketShareService.js';
import { getPromoData } from './watchTowerPromoService.js';

/**
 * Get Top SKUs for the overview table
 */
export const getTopSkus = async (filters) => {
    try {
        const conds = buildClickHouseConditions(filters, { dateCol: 'DATE' });
        const query = `
            SELECT 
                Product as sku_name,
                SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) as sku_gmv
            FROM rb_pdp_olap
            WHERE ${conds} AND Product IS NOT NULL AND Product != ''
            GROUP BY Product
            ORDER BY sku_gmv DESC
            LIMIT 10
        `;
        const result = await queryClickHouse(query);
        return result.map(sku => ({
            sku_name: sku.sku_name,
            gmv: formatCurrency(sku.sku_gmv)
        }));
    } catch (error) {
        console.error('[getTopSkus] Error:', error);
        return [];
    }
};

/**
 * The main orchestrator for the Watch Tower Overview segment
 */
export const getOverviewData = async (filters) => {
    const monthsBack = parseInt(filters.months) || 6;

    // 1. Determine Date Range (Current Period)
    // In a real system, we'd get the max date from the DB. 
    // For now, let's use the current date as absolute end.
    const endDate = filters.endDate ? dayjs(filters.endDate) : dayjs().endOf('day');
    const startDate = filters.startDate ? dayjs(filters.startDate) : endDate.subtract(monthsBack, 'month').startOf('day');

    const enrichedFilters = {
        ...filters,
        startDate,
        endDate
    };

    console.time('[WatchTowerOverview] Total Fetch Time');

    // 2. Fetch all metrics in parallel - Force Daily granularity for trends
    const [
        offtake,
        availability,
        sos,
        marketShare,
        promo,
        skuTable
    ] = await Promise.all([
        getOfftakeData({ ...enrichedFilters, timeStep: 'Daily' }),
        getAvailabilityData({ ...enrichedFilters, timeStep: 'Daily' }),
        getSosData({ ...enrichedFilters, timeStep: 'Daily' }),
        getMarketShareData({ ...enrichedFilters, timeStep: 'Daily' }),
        getPromoData({ ...enrichedFilters, timeStep: 'Daily' }),
        getTopSkus(enrichedFilters)
    ]);

    console.timeEnd('[WatchTowerOverview] Total Fetch Time');

    // 3. Format Subtitle
    const subtitle = enrichedFilters.startDate.format('DD MMM') + ' - ' + enrichedFilters.endDate.format('DD MMM');

    // 4. Format Trend Strings
    const formatTrend = (val, isPP = false) => {
        const sign = val >= 0 ? '+' : '';
        const unit = isPP ? ' pp' : '%';
        return `${sign}${val.toFixed(1)}${unit}`;
    };

    // 5. Build Top Metrics for Frontend
    const topMetrics = [
        {
            name: "Offtake",
            label: formatCurrency(offtake.total),
            subtitle,
            trend: formatTrend(offtake.change),
            trendType: offtake.change >= 0 ? "positive" : "negative",
            comparison: "vs Previous Period",
            chart: offtake.chart,
            labels: offtake.buckets
        },
        {
            name: "Availability",
            label: `${availability.value.toFixed(1)}%`,
            subtitle,
            trend: formatTrend(availability.change, true),
            trendType: availability.change >= 0 ? "positive" : "negative",
            comparison: "vs Previous Period",
            chart: availability.chart,
            labels: availability.buckets
        },
        {
            name: "Share of Search",
            label: `${sos.value.toFixed(1)}%`,
            subtitle,
            trend: formatTrend(sos.change, true),
            trendType: sos.change >= 0 ? "positive" : "negative",
            comparison: "vs Previous Period",
            chart: sos.chart,
            labels: sos.buckets
        },
        {
            name: "Market Share",
            label: `${marketShare.value.toFixed(1)}%`,
            subtitle,
            trend: formatTrend(marketShare.change, true),
            trendType: marketShare.change >= 0 ? "positive" : "negative",
            comparison: "vs Previous Period",
            chart: marketShare.chart,
            labels: marketShare.buckets
        },
        {
            name: "Promo",
            label: `${promo.value.toFixed(1)}%`,
            subtitle,
            trend: formatTrend(promo.change, true),
            trendType: promo.change >= 0 ? "positive" : "negative",
            comparison: "vs Previous Period",
            units: "Depth",
            chart: promo.chart,
            labels: promo.buckets
        }
    ];

    // 6. Build Summary Metrics
    const summaryMetrics = {
        offtakes: formatCurrency(offtake.total),
        offtakesTrend: formatTrend(offtake.change),
        shareOfSearch: `${sos.value.toFixed(1)}%`,
        shareOfSearchTrend: formatTrend(sos.change, true),
        stockAvailability: `${availability.value.toFixed(1)}%`,
        stockAvailabilityTrend: formatTrend(availability.change, true),
        marketShare: `${marketShare.value.toFixed(1)}%`,
        promo: `${promo.value.toFixed(1)}%`,
        promoTrend: formatTrend(promo.change, true)
    };

    return {
        topMetrics,
        summaryMetrics,
        skuTable,
        platformOverview: [] // Placeholder for Phase 2
    };
};
