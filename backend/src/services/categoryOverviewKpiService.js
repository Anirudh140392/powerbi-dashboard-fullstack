import { queryClickHouse } from '../config/clickhouse.js';
import dayjs from 'dayjs';

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
 * Run two separate queries per group:
 *  QUERY A: Main aggregates without JOIN
 *  QUERY B: Gram aggregates via JOIN
 * Then merge JS‑side.
 * This approach is more reliable than a single complex CASE in ClickHouse.
 */
async function runMainQuery(groupCol, dateStart, dateEnd, extraWhere) {
    const q = `
        SELECT
            ${groupCol} AS dimension_key,
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
            COUNT(*) AS total_records,
            countIf(toString(Comp_flag) = '1' AND toFloat64OrNull(Selling_Price) > 0) AS competitor_count
        FROM rb_pdp_olap
        WHERE DATE BETWEEN '${dateStart}' AND '${dateEnd}'
            AND Selling_Price IS NOT NULL
            AND toFloat64OrNull(Selling_Price) > 0
            AND ${groupCol} IS NOT NULL
            AND ${groupCol} != ''
            ${extraWhere}
        GROUP BY ${groupCol}
        ORDER BY total_records DESC
        LIMIT 50
    `;
    return queryClickHouse(q);
}


async function runGramQuery(groupCol, dateStart, dateEnd, extraWhere) {
    const q = `
        SELECT
            p.${groupCol}  AS dimension_key,
            SUM(CASE WHEN toFloat64OrNull(p.Selling_Price) > 0 AND toFloat64OrNull(s.gram) > 0
                THEN toFloat64(p.Selling_Price) ELSE 0 END) AS sum_sp_with_gram,
            SUM(CASE WHEN toFloat64OrNull(s.gram) > 0 AND toFloat64OrNull(p.Selling_Price) > 0
                THEN toFloat64(s.gram) ELSE 0 END) AS sum_gram
        FROM rb_pdp_olap p
        LEFT JOIN rb_sku_platform s ON p.Web_Pid = s.web_pid
        WHERE p.DATE BETWEEN '${dateStart}' AND '${dateEnd}'
            AND p.Selling_Price IS NOT NULL
            AND toFloat64OrNull(p.Selling_Price) > 0
            AND p.${groupCol} IS NOT NULL
            AND p.${groupCol} != ''
            ${extraWhere}
        GROUP BY p.${groupCol}
    `;
    return queryClickHouse(q);
}

async function getCategoryOverviewKpis(filters = {}) {
    console.log('[CategoryOverviewKpiService] called:', filters);

    try {
        const dimension = filters.dimension || 'category';
        const groupCol = dimension === 'city' ? 'Location' : 'Category';

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

        const conditions = [];

        // 1. Global / Top-level filters
        const platforms = parseMultiSelectFilter(filters.platform);
        if (platforms) conditions.push(buildInClause('Platform', platforms));

        const locations = parseMultiSelectFilter(filters.location);
        if (locations) conditions.push(buildInClause('Location', locations));

        const categories = parseMultiSelectFilter(filters.category);
        if (categories) conditions.push(buildInClause('Category', categories));

        // 2. Advanced modal filters
        const filterCities = parseMultiSelectFilter(filters.filterCities);
        if (filterCities) conditions.push(buildInClause('Location', filterCities));

        const filterCategories = parseMultiSelectFilter(filters.filterCategories);
        if (filterCategories) conditions.push(buildInClause('Category', filterCategories));

        const filterBrands = parseMultiSelectFilter(filters.filterBrands);
        if (filterBrands) conditions.push(buildInClause('Brand', filterBrands)); // Note: column 'Brand' in rb_pdp_olap

        const filterPlatforms = parseMultiSelectFilter(filters.filterPlatforms);
        if (filterPlatforms) conditions.push(buildInClause('Platform', filterPlatforms));

        const filterSkus = parseMultiSelectFilter(filters.filterSkus);
        if (filterSkus) conditions.push(buildInClause('Product', filterSkus));

        console.log('[DEBUG FILTERS]', {
            rawBrands: filters.filterBrands,
            parsedBrands: filterBrands,
            rawPlatforms: filters.filterPlatforms,
            parsedPlatforms: filterPlatforms,
            rawSkus: filters.filterSkus,
            parsedSkus: filterSkus,
            finalConditions: conditions
        });

        const extraWhere = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
        // For gram query we need p-prefixed conditions
        const extraWhereP = conditions.length > 0
            ? `AND ${conditions.map(c => c.replace(/^(Category|Location|Platform|Brand|Product)/, 'p.$1')).join(' AND ')}`
            : '';

        // Run all 4 queries in parallel (curr main, prev main, curr gram, prev gram)
        const [currMain, prevMain, currGram, prevGram] = await Promise.all([
            runMainQuery(groupCol, startDate, endDate, extraWhere),
            runMainQuery(groupCol, compareStartDate, compareEndDate, extraWhere),
            runGramQuery(groupCol, startDate, endDate, extraWhereP),
            runGramQuery(groupCol, compareStartDate, compareEndDate, extraWhereP),
        ]);

        // Build maps
        const prevMainMap = {};
        (prevMain || []).forEach(r => { prevMainMap[r.dimension_key] = r; });
        const currGramMap = {};
        (currGram || []).forEach(r => { currGramMap[r.dimension_key] = r; });
        const prevGramMap = {};
        (prevGram || []).forEach(r => { prevGramMap[r.dimension_key] = r; });

        const calcDelta = (curr, prev) => {
            const c = parseFloat(curr);
            const p = parseFloat(prev);
            if (isNaN(c) || isNaN(p) || p === 0) return 0;
            return parseFloat((((c - p) / Math.abs(p)) * 100).toFixed(2));
        };

        const fmt = (raw, prevRaw, formatter) => {
            const v = parseFloat(raw);
            const valid = !isNaN(v) && isFinite(v) && raw !== null && raw !== undefined;
            const delta = calcDelta(raw, prevRaw);
            return {
                value: valid ? formatter(v) : '—',
                raw: valid ? v : null,
                delta,
                dir: delta >= 0 ? 'up' : 'down',
            };
        };

        const computePpu = (mainRow, gramRow) => {
            const sumGram = parseFloat(gramRow?.sum_gram);
            const sumSpWithGram = parseFloat(gramRow?.sum_sp_with_gram);
            if (!isNaN(sumGram) && sumGram > 0 && !isNaN(sumSpWithGram)) {
                return (sumSpWithGram / sumGram).toFixed(4);
            }
            // Fallback: plain AVG(SP)
            return mainRow?.avg_sp ?? null;
        };

        const computeRpi = (mainRow) => {
            const compCount = parseInt(mainRow?.competitor_count) || 0;
            const ownSp = parseFloat(mainRow?.own_brand_sp);
            const compSp = parseFloat(mainRow?.competitor_sp);
            const avgSp = parseFloat(mainRow?.avg_sp);
            const avgMrp = parseFloat(mainRow?.avg_mrp);

            if (compCount > 0 && !isNaN(ownSp) && !isNaN(compSp) && compSp > 0) {
                // Real RPI: own brand SP / competitor SP
                return (ownSp / compSp).toFixed(4);
            }
            if (!isNaN(avgSp) && !isNaN(avgMrp) && avgMrp > 0) {
                // Fallback: SP / MRP (price retention ratio)
                return (avgSp / avgMrp).toFixed(4);
            }
            return null;
        };

        const rows = (currMain || []).map(row => {
            const prev = prevMainMap[row.dimension_key] || {};
            const currG = currGramMap[row.dimension_key] || {};
            const prevG = prevGramMap[row.dimension_key] || {};

            const ppuCurr = computePpu(row, currG);
            const ppuPrev = computePpu(prev, prevG);
            const rpiCurr = computeRpi(row);
            const rpiPrev = computeRpi(prev);

            return {
                key: row.dimension_key?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'unknown',
                name: row.dimension_key || '—',
                recordCount: parseInt(row.total_records) || 0,
                metrics: {
                    discount: fmt(row.discount_pct, prev.discount_pct, v => `${v.toFixed(1)}%`),
                    pricePerUnit: fmt(ppuCurr, ppuPrev, v => `₹${parseFloat(v).toFixed(2)}`),
                    rpi: fmt(rpiCurr, rpiPrev, v => parseFloat(v).toFixed(3)),
                    asp: fmt(row.avg_sp, prev.avg_sp, v => `₹${v.toFixed(2)}`),
                }
            };
        });

        return { success: true, dimension, rows, meta: { startDate, endDate, compareStartDate, compareEndDate } };

    } catch (error) {
        console.error('[CategoryOverviewKpiService] Error:', error);
        return { success: false, rows: [], error: error.message };
    }
}

export default { getCategoryOverviewKpis };
