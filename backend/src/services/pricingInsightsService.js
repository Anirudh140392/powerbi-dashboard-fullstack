import { queryClickHouse } from '../config/clickhouse.js';
import dayjs from 'dayjs';

const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

const parseMultiSelectFilter = (value) => {
    if (!value || value === 'All') return null;
    if (Array.isArray(value)) {
        const f = value.filter(v => v && v !== 'All');
        return f.length > 0 ? f : null;
    }
    if (typeof value === 'string' && value.includes(',')) {
        const f = value.split(',').map(v => v.trim()).filter(v => v && v !== 'All');
        return f.length > 0 ? f : null;
    }
    return [value];
};

const buildInClause = (col, vals) => {
    if (!vals || vals.length === 0) return null;
    const esc = vals.map(v => `'${escapeStr(v)}'`).join(',');
    return `${col} IN (${esc})`;
};

/**
 * Get pricing insights — products with significant price changes.
 *
 * Query logic:
 * 1. For CURRENT period: AVG(Selling_Price) per Product+Brand+Category
 * 2. For PREVIOUS period: same
 * 3. Filter by Comp_flag=0 (own) or Comp_flag=1 (competitor)
 * 4. Compute delta = (curr_sp - prev_sp) / prev_sp * 100
 * 5. For each product, find top 2 cities by Discount value in current period
 *
 * @param {Object} filters
 *   - type: 'pd_my' | 'pi_my' | 'pd_comp' | 'pi_comp'
 *   - platform, location, category, startDate, endDate,
 *     compareStartDate, compareEndDate
 *   - limit: default 10
 */
async function getPricingInsights(filters = {}) {
    console.log('[PricingInsightsService] called:', filters);

    try {
        const type = filters.type || 'pi_my';
        const isCompetitor = type.endsWith('_comp');
        const isPriceDrop = type.startsWith('pd_');
        const compFlag = isCompetitor ? '1' : '0';
        const limit = parseInt(filters.limit) || 10;

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

        // Extra filters
        const conditions = [`toString(Comp_flag) = '${compFlag}'`];
        const platforms = parseMultiSelectFilter(filters.platform);
        if (platforms) conditions.push(buildInClause('Platform', platforms));
        const locations = parseMultiSelectFilter(filters.location);
        if (locations) conditions.push(buildInClause('Location', locations));
        const categories = parseMultiSelectFilter(filters.category);
        if (categories) conditions.push(buildInClause('Category', categories));
        const extraWhere = conditions.join(' AND ');

        // ── Step 1: Get current + previous avg SP per product ──────────────────
        const priceQuery = `
            SELECT
                Product,
                Brand,
                Category,
                AVG(CASE
                    WHEN DATE BETWEEN '${startDate}' AND '${endDate}'
                        AND toFloat64OrNull(Selling_Price) > 0
                    THEN toFloat64(Selling_Price) ELSE NULL
                END) AS curr_sp,
                AVG(CASE
                    WHEN DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}'
                        AND toFloat64OrNull(Selling_Price) > 0
                    THEN toFloat64(Selling_Price) ELSE NULL
                END) AS prev_sp,
                AVG(CASE
                    WHEN DATE BETWEEN '${startDate}' AND '${endDate}'
                        AND toFloat64OrNull(MRP) > 0 AND toFloat64OrNull(Selling_Price) > 0
                    THEN ((toFloat64(MRP) - toFloat64(Selling_Price)) / toFloat64(MRP)) * 100
                    ELSE NULL
                END) AS curr_discount,
                COUNT(CASE WHEN DATE BETWEEN '${startDate}' AND '${endDate}' THEN 1 END) AS curr_records,
                COUNT(CASE WHEN DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}' THEN 1 END) AS prev_records
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${compareStartDate}' AND '${endDate}'
                AND Selling_Price IS NOT NULL
                AND toFloat64OrNull(Selling_Price) > 0
                AND Product IS NOT NULL AND Product != ''
                AND Brand IS NOT NULL AND Brand != ''
                AND Category IS NOT NULL AND Category != ''
                AND ${extraWhere}
            GROUP BY Product, Brand, Category
            HAVING curr_sp > 0 AND prev_sp > 0
            ORDER BY ABS((curr_sp - prev_sp) / prev_sp) DESC
            LIMIT ${limit * 3}
        `;

        const priceResults = await queryClickHouse(priceQuery);

        if (!priceResults || priceResults.length === 0) {
            return {
                success: true,
                type,
                items: [],
                meta: { startDate, endDate, compareStartDate, compareEndDate },
            };
        }

        // ── Step 2: Filter by price direction ──────────────────────────────────
        const filtered = priceResults
            .map(row => {
                const curr = parseFloat(row.curr_sp);
                const prev = parseFloat(row.prev_sp);
                const delta = ((curr - prev) / prev) * 100;
                return { ...row, delta };
            })
            .filter(row => isPriceDrop ? row.delta < -0.2 : row.delta > 0.2)
            .sort((a, b) => isPriceDrop
                ? a.delta - b.delta      // most dropped first
                : b.delta - a.delta      // most increased first
            )
            .slice(0, limit);

        if (filtered.length === 0) {
            return {
                success: true,
                type,
                items: [],
                meta: { startDate, endDate, compareStartDate, compareEndDate },
            };
        }

        // ── Step 3: Get top 2 impacted cities per product ─────────────────────
        const productList = filtered.map(r => `'${escapeStr(r.Product)}'`).join(',');

        const cityQuery = `
            SELECT
                Product,
                Location AS city,
                AVG(CASE WHEN toFloat64OrNull(MRP) > 0 AND toFloat64OrNull(Selling_Price) > 0
                    THEN ((toFloat64(MRP) - toFloat64(Selling_Price)) / toFloat64(MRP)) * 100
                    ELSE NULL END) AS curr_discount,
                AVG(CASE WHEN toFloat64OrNull(MRP) > 0 AND toFloat64OrNull(Selling_Price) > 0
                    THEN toFloat64(Selling_Price) ELSE NULL END) AS curr_sp,
                COUNT(*) AS records
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${startDate}' AND '${endDate}'
                AND Product IN (${productList})
                AND toString(Comp_flag) = '${compFlag}'
                AND Location IS NOT NULL AND Location != ''
                AND toFloat64OrNull(Selling_Price) > 0
                ${platforms ? `AND ${buildInClause('Platform', platforms)}` : ''}
            GROUP BY Product, Location
            ORDER BY Product, records DESC
        `;

        const cityResults = await queryClickHouse(cityQuery);

        // Build city map: product → top 2 cities
        const cityMap = {};
        (cityResults || []).forEach(row => {
            if (!cityMap[row.Product]) cityMap[row.Product] = [];
            if (cityMap[row.Product].length < 2) {
                cityMap[row.Product].push({
                    name: row.city,
                    discount: parseFloat(row.curr_discount) || 0,
                    sp: parseFloat(row.curr_sp) || 0,
                });
            }
        });

        // ── Step 4: Also get previous city discounts for delta ─────────────────
        const cityPrevQuery = `
            SELECT
                Product,
                Location AS city,
                AVG(CASE WHEN toFloat64OrNull(MRP) > 0 AND toFloat64OrNull(Selling_Price) > 0
                    THEN ((toFloat64(MRP) - toFloat64(Selling_Price)) / toFloat64(MRP)) * 100
                    ELSE NULL END) AS prev_discount
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${compareStartDate}' AND '${compareEndDate}'
                AND Product IN (${productList})
                AND toString(Comp_flag) = '${compFlag}'
                AND Location IS NOT NULL AND Location != ''
                AND toFloat64OrNull(Selling_Price) > 0
                ${platforms ? `AND ${buildInClause('Platform', platforms)}` : ''}
            GROUP BY Product, Location
        `;

        const cityPrevResults = await queryClickHouse(cityPrevQuery);
        const cityPrevMap = {};
        (cityPrevResults || []).forEach(row => {
            if (!cityPrevMap[row.Product]) cityPrevMap[row.Product] = {};
            cityPrevMap[row.Product][row.city] = parseFloat(row.prev_discount) || 0;
        });

        // ── Step 5: Build final items ──────────────────────────────────────────
        const badgePrefix = isPriceDrop
            ? (isCompetitor ? 'Comp Drop' : 'Price Drop')
            : (isCompetitor ? 'Comp Hike' : 'Price Hike');

        const items = filtered.map((row, idx) => {
            const cities = (cityMap[row.Product] || []).map(c => {
                const prevDisc = (cityPrevMap[row.Product] || {})[c.name] || 0;
                const discChange = c.discount - prevDisc;
                return {
                    name: c.name,
                    discount: parseFloat(c.discount.toFixed(1)),
                    change: parseFloat(discChange.toFixed(1)),
                };
            });

            return {
                id: `${type}_${String(idx + 1).padStart(2, '0')}`,
                badge: `${badgePrefix} ${String(idx + 1).padStart(2, '0')}`,
                cat: row.Category,
                brand: row.Brand,
                title: row.Product,
                size: null, // rb_pdp_olap doesn't have a size/gram column directly
                delta: parseFloat(row.delta.toFixed(2)),
                currSp: parseFloat(parseFloat(row.curr_sp).toFixed(2)),
                prevSp: parseFloat(parseFloat(row.prev_sp).toFixed(2)),
                currDiscount: parseFloat(parseFloat(row.curr_discount || 0).toFixed(1)),
                cities,
            };
        });

        return {
            success: true,
            type,
            total: items.length,
            items,
            meta: { startDate, endDate, compareStartDate, compareEndDate },
        };

    } catch (error) {
        console.error('[PricingInsightsService] Error:', error);
        return { success: false, items: [], error: error.message };
    }
}

export default { getPricingInsights };
