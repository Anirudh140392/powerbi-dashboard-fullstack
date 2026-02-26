import { queryClickHouse } from '../config/clickhouse.js';
import dayjs from 'dayjs';
import { getCachedOrCompute, generateCacheKey, CACHE_TTL } from '../utils/cacheHelper.js';

const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

const parseMultiSelectFilter = (value) => {
    if (!value || value === 'All') return null;
    if (Array.isArray(value)) {
        const filtered = value.filter(v => v && v !== 'All');
        return filtered.length > 0 ? filtered : null;
    }
    if (typeof value === 'string' && value.includes(',')) {
        const filtered = value.split(',').map(v => v.trim()).filter(v => v && v !== 'All');
        return filtered.length > 0 ? filtered : null;
    }
    return [value];
};

const buildInClause = (column, values) => {
    if (!values || values.length === 0) return null;
    const escaped = values.map(v => `'${escapeStr(v)}'`).join(',');
    return `${column} IN (${escaped})`;
};

/**
 * Main aggregates query (no JOIN) — returns discount, asp, rpi
 */
function buildMainQuery(dateStart, dateEnd, extraWhere) {
    return `
        SELECT
            AVG(
                CASE WHEN toFloat64OrNull(MRP) > 0 AND toFloat64OrNull(Selling_Price) > 0
                THEN ((toFloat64(MRP) - toFloat64(Selling_Price)) / toFloat64(MRP)) * 100
                ELSE NULL END
            ) AS discount_pct,

            AVG(
                CASE WHEN toFloat64OrNull(Selling_Price) > 0
                THEN toFloat64(Selling_Price) ELSE NULL END
            ) AS avg_sp,

            AVG(
                CASE WHEN toFloat64OrNull(MRP) > 0
                THEN toFloat64(MRP) ELSE NULL END
            ) AS avg_mrp,

            AVG(
                CASE WHEN toString(Comp_flag) = '0' AND toFloat64OrNull(Selling_Price) > 0
                THEN toFloat64(Selling_Price) ELSE NULL END
            ) AS own_brand_sp,

            AVG(
                CASE WHEN toString(Comp_flag) = '1' AND toFloat64OrNull(Selling_Price) > 0
                THEN toFloat64(Selling_Price) ELSE NULL END
            ) AS competitor_sp,

            countIf(toString(Comp_flag) = '1' AND toFloat64OrNull(Selling_Price) > 0) AS competitor_count,

            COUNT(*) AS total_records
        FROM rb_pdp_olap
        WHERE DATE BETWEEN '${dateStart}' AND '${dateEnd}'
            AND Selling_Price IS NOT NULL
            AND toFloat64OrNull(Selling_Price) > 0
            ${extraWhere}
    `;
}

/**
 * Gram aggregates via JOIN with rb_sku_platform for Price Per Unit
 */
function buildGramQuery(dateStart, dateEnd, extraWhereP) {
    return `
        SELECT
            SUM(CASE WHEN toFloat64OrNull(p.Selling_Price) > 0 AND toFloat64OrNull(s.gram) > 0
                THEN toFloat64(p.Selling_Price) ELSE 0 END) AS sum_sp_with_gram,
            SUM(CASE WHEN toFloat64OrNull(s.gram) > 0 AND toFloat64OrNull(p.Selling_Price) > 0
                THEN toFloat64(s.gram) ELSE 0 END) AS sum_gram
        FROM rb_pdp_olap p
        LEFT JOIN rb_sku_platform s ON p.Web_Pid = s.web_pid
        WHERE p.DATE BETWEEN '${dateStart}' AND '${dateEnd}'
            AND p.Selling_Price IS NOT NULL
            AND toFloat64OrNull(p.Selling_Price) > 0
            ${extraWhereP}
    `;
}

/**
 * Compute PPU: SUM(SP)/SUM(gram) if gram available; fallback to AVG(SP)
 */
function computePpu(gramRow, mainRow) {
    const sumGram = parseFloat(gramRow?.sum_gram);
    const sumSp = parseFloat(gramRow?.sum_sp_with_gram);
    if (!isNaN(sumGram) && sumGram > 0 && !isNaN(sumSp)) {
        return sumSp / sumGram;
    }
    // Fallback: plain AVG(SP)
    const avgSp = parseFloat(mainRow?.avg_sp);
    return isNaN(avgSp) ? null : avgSp;
}

/**
 * Compute RPI: own_brand_sp / competitor_sp if competitordata exists; fallback SP/MRP
 */
function computeRpi(mainRow) {
    const compCount = parseInt(mainRow?.competitor_count) || 0;
    const ownSp = parseFloat(mainRow?.own_brand_sp);
    const compSp = parseFloat(mainRow?.competitor_sp);
    const avgSp = parseFloat(mainRow?.avg_sp);
    const avgMrp = parseFloat(mainRow?.avg_mrp);

    if (compCount > 0 && !isNaN(ownSp) && !isNaN(compSp) && compSp > 0) {
        return ownSp / compSp;
    }
    if (!isNaN(avgSp) && !isNaN(avgMrp) && avgMrp > 0) {
        return avgSp / avgMrp;
    }
    return null;
}

/**
 * Get Pricing Overview KPIs (Discount, Price Per Unit, RPI, ASP)
 * Uses rb_sku_platform JOIN for gram data, with AVG(SP) fallback for PPU.
 */
async function getPricingOverviewKpis(filters = {}) {
    console.log('[PricingOverviewKpiService] called:', filters);

    const cacheKey = generateCacheKey('pricing_overview_kpis_v2', filters);

    return await getCachedOrCompute(cacheKey, async () => {
        try {
            const endDate = filters.endDate || dayjs().format('YYYY-MM-DD');
            const startDate = filters.startDate || dayjs().subtract(30, 'days').format('YYYY-MM-DD');

            let compareStartDate, compareEndDate;
            if (filters.compareStartDate && filters.compareEndDate) {
                compareStartDate = filters.compareStartDate;
                compareEndDate = filters.compareEndDate;
            } else {
                const periodDays = dayjs(endDate).diff(dayjs(startDate), 'day') + 1;
                compareEndDate = dayjs(startDate).subtract(1, 'day').format('YYYY-MM-DD');
                compareStartDate = dayjs(compareEndDate).subtract(periodDays - 1, 'day').format('YYYY-MM-DD');
            }

            // Build filter conditions for unjoined query
            const conditions = [];
            const platforms = parseMultiSelectFilter(filters.platform);
            if (platforms) conditions.push(buildInClause('Platform', platforms));
            const locations = parseMultiSelectFilter(filters.location);
            if (locations) conditions.push(buildInClause('Location', locations));
            const categories = parseMultiSelectFilter(filters.category);
            if (categories) conditions.push(buildInClause('Category', categories));

            const extraWhere = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
            // For JOIN query, prefix columns with p.
            const extraWhereP = conditions.length > 0
                ? `AND ${conditions.map(c => c.replace(/^(Platform|Location|Category)/, 'p.$1')).join(' AND ')}`
                : '';

            // Run 4 queries in parallel
            const [currMain, prevMain, currGram, prevGram] = await Promise.all([
                queryClickHouse(buildMainQuery(startDate, endDate, extraWhere)),
                queryClickHouse(buildMainQuery(compareStartDate, compareEndDate, extraWhere)),
                queryClickHouse(buildGramQuery(startDate, endDate, extraWhereP)),
                queryClickHouse(buildGramQuery(compareStartDate, compareEndDate, extraWhereP)),
            ]);

            const curr = currMain?.[0] || {};
            const prev = prevMain?.[0] || {};
            const currG = currGram?.[0] || {};
            const prevG = prevGram?.[0] || {};

            const calcDelta = (current, previous) => {
                if (!previous || previous === 0 || isNaN(current) || isNaN(previous)) return 0;
                return parseFloat((((current - previous) / Math.abs(previous)) * 100).toFixed(2));
            };

            // Compute all KPI values
            const discountCurr = parseFloat(curr.discount_pct);
            const discountPrev = parseFloat(prev.discount_pct);

            const ppuCurr = computePpu(currG, curr);
            const ppuPrev = computePpu(prevG, prev);

            const rpiCurr = computeRpi(curr);
            const rpiPrev = computeRpi(prev);

            const aspCurr = parseFloat(curr.avg_sp);
            const aspPrev = parseFloat(prev.avg_sp);

            const kpis = [
                {
                    id: 'discount',
                    title: 'Discount',
                    value: !isNaN(discountCurr) && discountCurr > 0 ? `${discountCurr.toFixed(1)}%` : '—',
                    rawValue: !isNaN(discountCurr) ? discountCurr : 0,
                    prevValue: !isNaN(discountPrev) ? discountPrev : 0,
                    delta: calcDelta(discountCurr, discountPrev),
                    subtitle: 'Avg discount across active SKUs',
                    extra: 'Formula: (MRP - SP) / MRP',
                    gradient: ['#7c3aed', '#a78bfa'],
                },
                {
                    id: 'price_per_unit',
                    title: 'Price Per Unit',
                    value: ppuCurr !== null && !isNaN(ppuCurr)
                        ? `₹${ppuCurr.toFixed(2)}`
                        : '—',
                    rawValue: ppuCurr !== null ? ppuCurr : 0,
                    prevValue: ppuPrev !== null ? ppuPrev : 0,
                    delta: calcDelta(ppuCurr, ppuPrev),
                    subtitle: 'Avg selling price per unit (gram)',
                    extra: 'SP ÷ gram (rb_sku_platform), fallback: AVG(SP)',
                    gradient: ['#0891b2', '#22d3ee'],
                },
                {
                    id: 'rpi',
                    title: 'RPI',
                    value: rpiCurr !== null ? rpiCurr.toFixed(2) : '—',
                    rawValue: rpiCurr !== null ? rpiCurr : null,
                    prevValue: rpiPrev !== null ? rpiPrev : null,
                    delta: calcDelta(rpiCurr, rpiPrev),
                    subtitle: 'Own brand SP ÷ Competitor SP (Comp_flag)',
                    extra: 'AVG(own_brand_price) / NULLIF(AVG(competitor_price), 0)',
                    gradient: ['#db2777', '#f9a8d4'],
                },
                {
                    id: 'avg_selling_price',
                    title: 'Average Selling Price',
                    value: !isNaN(aspCurr) && aspCurr > 0 ? `₹${aspCurr.toFixed(2)}` : '—',
                    rawValue: !isNaN(aspCurr) ? aspCurr : 0,
                    prevValue: !isNaN(aspPrev) ? aspPrev : 0,
                    delta: calcDelta(aspCurr, aspPrev),
                    subtitle: 'Overall average selling price',
                    extra: 'Formula: AVG(Selling_Price)',
                    gradient: ['#059669', '#34d399'],
                },
            ];

            return {
                success: true,
                kpis,
                meta: {
                    startDate,
                    endDate,
                    compareStartDate,
                    compareEndDate,
                    totalRecords: parseInt(curr.total_records) || 0,
                },
            };

        } catch (error) {
            console.error('[PricingOverviewKpiService] Error:', error);
            return { success: false, kpis: [], error: error.message };
        }
    }, CACHE_TTL.METRICS);
}

export default { getPricingOverviewKpis };
