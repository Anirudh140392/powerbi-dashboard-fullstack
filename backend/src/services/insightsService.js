import { queryClickHouse, getCurrentDbName } from '../config/clickhouse.js';
import dayjs from 'dayjs';

const ALLOWED_CITIES = ['Chandigarh', 'Delhi', 'Gurugram', 'Faridabad', 'Lucknow', 'Kolkata', 'Ahmedabad', 'Mumbai', 'Pune', 'Hyderabad', 'Bengaluru', 'Chennai'];
const ALLOWED_CITIES_LOWER = ALLOWED_CITIES.map(c => c.toLowerCase());
const ALLOWED_CITIES_SQL = ALLOWED_CITIES_LOWER.map(c => `'${c}'`).join(', ');

const isAllowedCity = (city) => {
    if (!city || city === '-') return false;
    const lower = String(city).toLowerCase();
    // Special mapping for common variants to ensure they pass the filter
    if (lower === 'gurgaon') return true;
    if (lower === 'bangalore') return true;
    return ALLOWED_CITIES_LOWER.includes(lower);
};

const CITY_NORM_EXPR = (col) => `multiIf(LOWER(${col}) IN ('gurgaon','gurugram'), 'gurugram', LOWER(${col}) IN ('bangalore','bengaluru'), 'bengaluru', LOWER(${col}))`;


const escapeCH = (str) => str ? str.replace(/'/g, "''") : '';

const buildCHCondition = (value, column, options = {}) => {
    const { isBrand = false, isCategory = false, isPdp = false } = options;

    const isAll = (val) => {
        if (!val) return true;
        const lower = String(val).toLowerCase();
        return (
            lower === 'all' ||
            lower === 'all india' ||
            lower === 'all platforms' ||
            lower === 'all categories' ||
            lower === 'all signals' ||
            lower === 'all cities' ||
            lower === 'multi-city'
        );
    };

    const ownFlag = isPdp ? "Comp_flag = 0" : "flag = 1";

    if (isBrand && isAll(value)) return ownFlag;
    if (isAll(value)) return "1=1";

    const list = typeof value === 'string'
        ? value.split(',').map(v => v.trim()).filter(v => !isAll(v))
        : Array.isArray(value) ? value.filter(v => !isAll(v)) : [value];

    if (list.length === 0) return isBrand ? ownFlag : "1=1";

    const isCityColumn = column.toLowerCase().includes('location') || column.toLowerCase().includes('city');
    const isCategoryColumn = column.toLowerCase().includes('category');
    const isPlatformColumn = column.toLowerCase().includes('platform');

    if (isCategory || isCategoryColumn || isCityColumn || isPlatformColumn) {
        return `LOWER(${column}) IN (${list.map(v => `'${escapeCH(String(v).toLowerCase())}'`).join(', ')})`;
    }
    return `${column} IN (${list.map(v => `'${escapeCH(v)}'`).join(', ')})`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: check if rb_ms_olap exists in the current DB (absent in testing)
// ─────────────────────────────────────────────────────────────────────────────
const checkRbMsOlapExists = async () => {
    try {
        const dbName = getCurrentDbName();
        const rows = await queryClickHouse(
            `SELECT name FROM system.tables WHERE database = '${dbName}' AND name = 'rb_ms_olap' LIMIT 1`
        );
        return rows.length > 0;
    } catch {
        return false;
    }
};

export const getInsightsData = async (filters) => {
    const rawDbName = getCurrentDbName();
    const brandLabel = rawDbName ? rawDbName.charAt(0).toUpperCase() + rawDbName.slice(1).toLowerCase() : "Mars";

    // Fallback logic for missing categories in the database.
    // If Category is null/empty/zero, we infer it from the Brand name.
    const catField = `if(Category IS NOT NULL AND Category != '' AND Category != '0' AND Category != '-', ` +
        `LOWER(toString(Category)), multiIf(LOWER(Brand) IN ('orbit', 'doublemint', 'boomer', 'skittles'), 'GMFC', ` +
        `LOWER(Brand) IN ('snickers', 'galaxy', 'bounty', 'twix', 'mars', 'm&m', 'm&m''s'), ` +
        `if(LOWER(toString(Product)) LIKE '%gift%' OR LOWER(toString(Product)) LIKE '%tin pack%', ` +
        `'Chocolates (Gifting)', 'Chocolates (Non Gifting)'), 'Others'))`;

    let endDate = filters.endDate ? dayjs(filters.endDate) : dayjs();
    let startDate = filters.startDate ? dayjs(filters.startDate) : endDate.subtract(30, 'day');

    const dateFrom = startDate.format('YYYY-MM-DD');
    const dateTo = endDate.format('YYYY-MM-DD');

    const prevStartDate = filters.compareStartDate ? dayjs(filters.compareStartDate).format('YYYY-MM-DD') : startDate.subtract(30, 'day').format('YYYY-MM-DD');
    const prevEndDate = filters.compareEndDate ? dayjs(filters.compareEndDate).format('YYYY-MM-DD') : startDate.subtract(1, 'day').format('YYYY-MM-DD');

    // 60-day lookback for New Market Entry "newness" check
    const lookback60Date = startDate.subtract(60, 'day').format('YYYY-MM-DD');


    const insights = [];

    // -------------------------------------------------------------------------
    // QUERY 1 — VISIBILITY (powers: Share Headroom Hotspots)
    // -------------------------------------------------------------------------
    const visibilityQuery = `
        SELECT 
            ${CITY_NORM_EXPR('location_name')} AS city,
            platform_name AS platform,
            keyword_category AS category,
            ROUND(sumIf(toFloat64OrZero(toString(overall)), flag = 1) * 100.0 / nullIf(sum(toFloat64OrZero(toString(overall))), 0), 2) AS overall_sos,
            ROUND(sumIf(toFloat64OrZero(toString(overall)), flag IN (0, '0')) * 100.0 / nullIf(sum(toFloat64OrZero(toString(overall))), 0), 2) AS comp_overall_sos,
            ROUND(sumIf(toFloat64OrZero(toString(spons)),   flag = 1) * 100.0 / nullIf(sum(toFloat64OrZero(toString(spons))),   0), 2) AS ad_sos,
            ROUND(sumIf(toFloat64OrZero(toString(organic)), flag = 1) * 100.0 / nullIf(sum(toFloat64OrZero(toString(organic))), 0), 2) AS org_sos,
            sum(toFloat64OrZero(toString(overall))) AS total_volume
        FROM rb_kw_olap
        WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
          AND ${buildCHCondition(filters.platform, 'platform_name')}
          AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('location_name'))}
          AND ${buildCHCondition(filters.category, 'keyword_category', { isCategory: true })}
        GROUP BY city, platform, category
        ORDER BY total_volume DESC
        LIMIT 1 BY category
        LIMIT 5
    `;

    // -------------------------------------------------------------------------
    // QUERY 1.5 — VISIBILITY TOTALS (True Weighted Average for Snapshot)
    // -------------------------------------------------------------------------
    const visibilityTotalsQuery = `
        SELECT 
            ROUND(sumIf(toFloat64OrZero(toString(overall)), flag = 1) * 100.0 / nullIf(sum(toFloat64OrZero(toString(overall))), 0), 2) AS overall_sos,
            ROUND(sumIf(toFloat64OrZero(toString(spons)),   flag = 1) * 100.0 / nullIf(sum(toFloat64OrZero(toString(spons))),   0), 2) AS ad_sos,
            ROUND(sumIf(toFloat64OrZero(toString(organic)), flag = 1) * 100.0 / nullIf(sum(toFloat64OrZero(toString(organic))), 0), 2) AS org_sos
        FROM rb_kw_olap
        WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
          AND ${buildCHCondition(filters.platform, 'platform_name')}
          AND ${buildCHCondition(filters.city, 'location_name')}
          AND ${buildCHCondition(filters.category, 'keyword_category', { isCategory: true })}
    `;

    // -------------------------------------------------------------------------
    // -------------------------------------------------------------------------
    // QUERY 2 — PRICING (powers: Price Parity Radar)
    // -------------------------------------------------------------------------
        const buildPricingQuery = (rbMsOlapExists) => `
        WITH ${rbMsOlapExists ? `
        ms_curr AS (
            SELECT 
                ${CITY_NORM_EXPR('location')} AS city, platform, category, group_brand, item_name,
                SUM(ifNull(toFloat64OrZero(toString(sales)), 0)) AS sku_sales
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${dateFrom}' AND '${dateTo}' AND item_name IS NOT NULL AND item_name != ''
              AND ${buildCHCondition(filters.platform, 'platform')}
              AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('location'))}
              AND ${buildCHCondition(filters.category, 'category', { isCategory: true })}
            GROUP BY city, platform, category, group_brand, item_name
        ),
        ms_cat_curr AS (
            SELECT city, platform, category, SUM(sku_sales) AS cat_sales FROM ms_curr GROUP BY city, platform, category
        ),
        ms_sku_curr AS (
            SELECT m.city, m.platform, m.category, m.group_brand, m.item_name,
                   (m.sku_sales / nullIf(c.cat_sales, 0)) AS sku_ms
            FROM ms_curr m JOIN ms_cat_curr c ON m.city = c.city AND m.platform = c.platform AND m.category = c.category
        ),
        ms_prev AS (
            SELECT 
                ${CITY_NORM_EXPR('location')} AS city, platform, category, group_brand, item_name,
                SUM(ifNull(toFloat64OrZero(toString(sales)), 0)) AS sku_sales
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${prevStartDate}' AND '${prevEndDate}' AND item_name IS NOT NULL AND item_name != ''
              AND ${buildCHCondition(filters.platform, 'platform')}
              AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('location'))}
              AND ${buildCHCondition(filters.category, 'category', { isCategory: true })}
            GROUP BY city, platform, category, group_brand, item_name
        ),
        ms_cat_prev AS (
            SELECT city, platform, category, SUM(sku_sales) AS cat_sales FROM ms_prev GROUP BY city, platform, category
        ),
        ms_sku_prev AS (
            SELECT m.city, m.platform, m.category, m.group_brand, m.item_name,
                   (m.sku_sales / nullIf(c.cat_sales, 0)) AS sku_ms
            FROM ms_prev m JOIN ms_cat_prev c ON m.city = c.city AND m.platform = c.platform AND m.category = c.category
        ),
        ms_gap AS (
            SELECT c.city, c.platform, c.category, c.group_brand, c.item_name,
                   ifNull(c.sku_ms, 0) - ifNull(p.sku_ms, 0) AS gap
            FROM ms_sku_curr c
            LEFT JOIN ms_sku_prev p ON c.city = p.city AND c.platform = p.platform AND c.category = p.category AND c.item_name = p.item_name
        ),
        our_impacted AS (
            SELECT city, platform, category, argMin(item_name, gap) AS impacted_sku
            FROM ms_gap
            WHERE LOWER(trim(replaceRegexpAll(group_brand, '[^a-zA-Z0-9 ]', ''))) = '${brandLabel.toLowerCase()}' AND gap < 0
            GROUP BY city, platform, category
        ),
        comp_gainer AS (
            SELECT city, platform, category, argMax(item_name, gap) AS comp_sku
            FROM ms_gap
            WHERE LOWER(trim(replaceRegexpAll(group_brand, '[^a-zA-Z0-9 ]', ''))) != '${brandLabel.toLowerCase()}' AND gap > 0
            GROUP BY city, platform, category
        ),
        ` : `
        our_impacted AS (
            SELECT 
                ${CITY_NORM_EXPR('Location')} AS city, Platform AS platform, ${catField} AS category,
                argMax(Product, toFloat64OrZero(toString(Sales))) AS impacted_sku
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}' AND Comp_flag IN (0, '0')
              AND ${buildCHCondition(filters.platform, 'Platform', { isPdp: true })}
              AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })}
              AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
            GROUP BY city, platform, category
        ),
        comp_gainer AS (
            SELECT 
                ${CITY_NORM_EXPR('Location')} AS city, Platform AS platform, ${catField} AS category,
                argMax(Product, ifNull(toFloat64OrZero(toString(PPU)), 0)) AS comp_sku
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}' AND Comp_flag IN (1, '1')
              AND ${buildCHCondition(filters.platform, 'Platform', { isPdp: true })}
              AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })}
              AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
            GROUP BY city, platform, category
        ),
        `}
        our_brand AS (
            SELECT 
                ${CITY_NORM_EXPR('Location')} AS city,
                Platform AS platform,
                ${catField} AS category,
                ROUND(AVG(ifNull(toFloat64OrZero(toString(PPU)), 0)), 2) AS our_ppu,
                SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) AS our_sales
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
              AND Comp_flag IN (0, '0')
              AND ifNull(toFloat64OrZero(toString(PPU)), 0) > 0
              AND ${buildCHCondition(filters.platform, 'Platform', { isPdp: true })}
              AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })}
              AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
            GROUP BY city, platform, category
        ),
        comp_brand_agg AS (
            SELECT 
                ${CITY_NORM_EXPR('Location')} AS city,
                Platform AS platform,
                ${catField} AS category,
                Brand,
                AVG(ifNull(toFloat64OrZero(toString(PPU)), 0)) AS brand_avg_ppu
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
              AND Comp_flag IN (1, '1')
              AND ifNull(toFloat64OrZero(toString(PPU)), 0) > 0
              AND ${buildCHCondition(filters.platform, 'Platform', { isPdp: true })}
              AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })}
              AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
            GROUP BY city, platform, category, Brand
        ),
        comp_brand AS (
            SELECT city, platform, category, ROUND(AVG(brand_avg_ppu), 2) AS comp_ppu
            FROM comp_brand_agg
            GROUP BY city, platform, category
        ),
        our_brand_prev AS (
            SELECT ${CITY_NORM_EXPR('Location')} AS city, Platform AS platform, ${catField} AS category,
                   ROUND(AVG(ifNull(toFloat64OrZero(toString(PPU)), 0)), 2) AS our_ppu
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${prevStartDate}' AND '${prevEndDate}'
              AND Comp_flag IN (0, '0') AND ifNull(toFloat64OrZero(toString(PPU)), 0) > 0
              AND ${buildCHCondition(filters.platform, 'Platform', { isPdp: true })}
              AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })}
              AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
            GROUP BY city, platform, category
        ),
        comp_brand_agg_prev AS (
            SELECT ${CITY_NORM_EXPR('Location')} AS city, Platform AS platform, ${catField} AS category, Brand,
                   AVG(ifNull(toFloat64OrZero(toString(PPU)), 0)) AS brand_avg_ppu
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${prevStartDate}' AND '${prevEndDate}'
              AND Comp_flag IN (1, '1') AND ifNull(toFloat64OrZero(toString(PPU)), 0) > 0
              AND ${buildCHCondition(filters.platform, 'Platform', { isPdp: true })}
              AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })}
              AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
            GROUP BY city, platform, category, Brand
        ),
        comp_brand_prev AS (
            SELECT city, platform, category, ROUND(AVG(brand_avg_ppu), 2) AS comp_ppu
            FROM comp_brand_agg_prev
            GROUP BY city, platform, category
        )
        SELECT 
            o.city AS city, o.platform AS platform, o.category AS category,
            o.our_ppu AS ourPpu, c.comp_ppu AS compPpu,
            oi.impacted_sku AS impactedSku, cg.comp_sku AS compSku,
            ROUND((o.our_ppu - c.comp_ppu) / nullIf(c.comp_ppu, 0) * 100, 2) AS gapPct,
            ROUND(o.our_sales * ABS(o.our_ppu - c.comp_ppu) / nullIf(c.comp_ppu, 0), 0) AS psl,
            o.our_sales AS totalSales,
            ifNull(ROUND((op.our_ppu - cp.comp_ppu) / nullIf(cp.comp_ppu, 0) * 100, 2), 0) AS prevGapPct,
            (ROUND((o.our_ppu - c.comp_ppu) / nullIf(c.comp_ppu, 0) * 100, 2) - ifNull(ROUND((op.our_ppu - cp.comp_ppu) / nullIf(cp.comp_ppu, 0) * 100, 2), ROUND((o.our_ppu - c.comp_ppu) / nullIf(c.comp_ppu, 0) * 100, 2))) AS gapPctChange,
            (o.our_ppu - ifNull(op.our_ppu, o.our_ppu)) AS ourPpuChange,
            (c.comp_ppu - ifNull(cp.comp_ppu, c.comp_ppu)) AS compPpuChange
        FROM our_brand o 
        JOIN comp_brand c ON o.city = c.city AND LOWER(o.platform) = LOWER(c.platform) AND LOWER(o.category) = LOWER(c.category)
        JOIN our_impacted oi ON o.city = oi.city AND LOWER(o.platform) = LOWER(oi.platform) AND LOWER(o.category) = LOWER(oi.category)
        LEFT JOIN comp_gainer cg ON o.city = cg.city AND LOWER(o.platform) = LOWER(cg.platform) AND LOWER(o.category) = LOWER(cg.category)
        LEFT JOIN our_brand_prev op ON o.city = op.city AND LOWER(o.platform) = LOWER(op.platform) AND LOWER(o.category) = LOWER(op.category)
        LEFT JOIN comp_brand_prev cp ON o.city = cp.city AND LOWER(o.platform) = LOWER(cp.platform) AND LOWER(o.category) = LOWER(cp.category)
        WHERE c.comp_ppu > 0 AND o.our_ppu > c.comp_ppu
        ORDER BY psl DESC
    `;

    // -------------------------------------------------------------------------
    // QUERY 3 — DS LISTING SUMMARY (powers: DS Listing Summary)
    // Identifies own-brand SKUs with weak dark store coverage by city.
    // Counts priority localities (stores) where the SKU is missing or low-OSA,
    // estimates category sales in those localities, finds competitor brands
    // that ARE listed there, and infers a possible cause.
    // -------------------------------------------------------------------------
    const dsListingSummaryQuery = `
        WITH
            -- Our brand SKUs per city with OSA & sales
            own_skus AS (
                SELECT
                    Product AS skuName,
                    ${CITY_NORM_EXPR('Location')} AS city,
                    Platform AS platform,
                    ${catField} AS category,
                    Brand AS brandName,
                    COUNT(DISTINCT Location) AS totalLocalities,
                    ROUND(
                        SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) * 100.0 /
                        nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0),
                    1) AS osa,
                    SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) AS skuSales,
                    SUM(ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) AS qtySold,
                    AVG(ifNull(toFloat64OrZero(toString(Inventory)), 0)) AS avgInventory,
                    argMax(Web_Pid, DATE) AS webPid
                FROM rb_pdp_olap
                WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND Comp_flag IN (0, '0')
                  AND Product IS NOT NULL AND Product != ''
                  AND ${buildCHCondition(filters.platform, 'Platform', { isPdp: true })}
                  AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })}
                  AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
                GROUP BY skuName, city, platform, category, brandName
            ),
            -- Total dark stores per city × platform
            ds_counts AS (
                SELECT
                    ${CITY_NORM_EXPR('location')} AS city,
                    LOWER(platform) AS platform,
                    COUNT(DISTINCT concat(toString(pincode), merchant_name)) AS totalDarkStores
                FROM rb_location_darkstore
                WHERE pf_id IN (4, 6, 7)
                  AND status IN ('1', '2')
                  AND ${buildCHCondition(filters.platform, 'platform')}
                  AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('location'))}
                GROUP BY city, platform
            ),
            -- Category sales per city (to estimate lost opportunity)
            cat_sales AS (
                SELECT
                    ${CITY_NORM_EXPR('Location')} AS city,
                    ${catField} AS category,
                    SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) AS categorySales
                FROM rb_pdp_olap
                WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND Comp_flag IN (0, '0')
                  AND ${buildCHCondition(filters.platform, 'Platform', { isPdp: true })}
                  AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })}
                  AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
                GROUP BY city, category
            ),
            -- Competitor brands present in same city × category
            comp_brands AS (
                SELECT
                    ${CITY_NORM_EXPR('Location')} AS city,
                    ${catField} AS category,
                    arrayStringConcat(
                        arraySlice(groupUniqArray(Brand), 1, 3),
                        ', '
                    ) AS competitors
                FROM rb_pdp_olap
                WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND Comp_flag IN (1, '1')
                  AND Brand IS NOT NULL AND Brand != ''
                  AND ${buildCHCondition(filters.platform, 'Platform', { isPdp: true })}
                  AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })}
                  AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
                GROUP BY city, category
            )
        SELECT
            o.skuName,
            o.city,
            o.platform,
            o.category,
            o.brandName,
            o.osa,
            o.skuSales,
            o.qtySold,
            o.avgInventory,
            o.totalLocalities,
            o.webPid,
            ifNull(d.totalDarkStores, 0) AS totalDarkStores,
            ROUND(greatest(ifNull(d.totalDarkStores, 0) - o.totalLocalities, 0), 0) AS priorityLocalities,
            ifNull(cs.categorySales, 0) AS categorySales,
            ifNull(cb.competitors, '-') AS competitors
        FROM own_skus o
        LEFT JOIN ds_counts d ON o.city = d.city AND LOWER(o.platform) = LOWER(d.platform)
        LEFT JOIN cat_sales cs ON o.city = cs.city AND LOWER(o.category) = LOWER(cs.category)
        LEFT JOIN comp_brands cb ON o.city = cb.city AND LOWER(o.category) = LOWER(cb.category)
        WHERE ifNull(d.totalDarkStores, 0) > 0
          AND o.osa < 80
        ORDER BY priorityLocalities DESC, o.skuSales DESC
        LIMIT 25
    `;

    // -------------------------------------------------------------------------
    // QUERY 4 — KEYWORD EFFICIENCY (powers: Keyword Efficiency and Budget Caps)
    // -------------------------------------------------------------------------
        const adStockQuery = `
        WITH pm_data AS (
            SELECT
                Platform AS platform,
                category,
                keyword,
                SUM(ifNull(toFloat64OrZero(toString(ad_spend)), 0)) AS total_spend,
                SUM(ifNull(toFloat64OrZero(toString(ad_sales)), 0)) AS total_sales,
                ROUND(
                    SUM(ifNull(toFloat64OrZero(toString(ad_sales)), 0)) /
                    nullIf(SUM(ifNull(toFloat64OrZero(toString(ad_spend)), 0)), 0),
                2) AS roas,
                ROUND(
                    SUM(ifNull(toFloat64OrZero(toString(ad_spend)), 0)) /
                    nullIf(SUM(ifNull(toFloat64OrZero(toString(ad_sales)), 0)), 0) * 100,
                1) AS acos
            FROM rb_pm_olap
            WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
              AND keyword IS NOT NULL AND keyword != ''
              AND ${buildCHCondition(filters.platform, 'Platform')}
              AND ${buildCHCondition(filters.category, 'category', { isCategory: true })}
            GROUP BY platform, category, keyword
        ),
        kw_cities AS (
            SELECT DISTINCT
                keyword,
                platform_name AS platform,
                ${CITY_NORM_EXPR('location_name')} AS city,
                keyword_category AS category
            FROM rb_kw_olap
            WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
              AND flag = 1
              AND ${CITY_NORM_EXPR('location_name')} IN (${ALLOWED_CITIES_SQL})
              AND ${buildCHCondition(filters.platform, 'platform_name')}
              AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('location_name'))}
              AND ${buildCHCondition(filters.category, 'keyword_category', { isCategory: true })}
        ),
        curr AS (
            SELECT
                pm.platform,
                kc.city,
                pm.category,
                pm.keyword,
                pm.total_spend,
                pm.total_sales,
                pm.roas,
                pm.acos
            FROM pm_data pm
            JOIN kw_cities kc 
              ON LOWER(trim(pm.platform)) = LOWER(trim(kc.platform))
             AND LOWER(trim(pm.category)) = LOWER(trim(kc.category))
             AND LOWER(trim(pm.keyword)) = LOWER(trim(kc.keyword))
        ),
        prev_pm_data AS (
            SELECT
                Platform AS platform,
                category,
                keyword,
                ROUND(
                    SUM(ifNull(toFloat64OrZero(toString(ad_spend)), 0)) /
                    nullIf(SUM(ifNull(toFloat64OrZero(toString(ad_sales)), 0)), 0) * 100,
                1) AS prevAcos
            FROM rb_pm_olap
            WHERE DATE BETWEEN '${prevStartDate}' AND '${prevEndDate}'
              AND keyword IS NOT NULL AND keyword != ''
              AND ${buildCHCondition(filters.platform, 'Platform')}
              AND ${buildCHCondition(filters.category, 'category', { isCategory: true })}
            GROUP BY platform, category, keyword
        ),
        prev_kw_cities AS (
            SELECT DISTINCT
                keyword,
                platform_name AS platform,
                ${CITY_NORM_EXPR('location_name')} AS city,
                keyword_category AS category
            FROM rb_kw_olap
            WHERE DATE BETWEEN '${prevStartDate}' AND '${prevEndDate}'
              AND flag = 1
              AND ${CITY_NORM_EXPR('location_name')} IN (${ALLOWED_CITIES_SQL})
              AND ${buildCHCondition(filters.platform, 'platform_name')}
              AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('location_name'))}
              AND ${buildCHCondition(filters.category, 'keyword_category', { isCategory: true })}
        ),
        prev AS (
            SELECT
                pm.platform,
                kc.city,
                pm.category,
                pm.keyword,
                pm.prevAcos
            FROM prev_pm_data pm
            JOIN prev_kw_cities kc 
              ON LOWER(trim(pm.platform)) = LOWER(trim(kc.platform))
             AND LOWER(trim(pm.category)) = LOWER(trim(kc.category))
             AND LOWER(trim(pm.keyword)) = LOWER(trim(kc.keyword))
        )
        SELECT 
            c.platform, 
            c.city, 
            c.category, 
            c.keyword,
            c.total_spend, 
            c.total_sales, 
            c.roas, 
            c.acos, 
            0 AS osa,
            ifNull(p.prevAcos, c.acos) AS prevAcos, 
            (c.acos - ifNull(p.prevAcos, c.acos)) AS acosChangePct
        FROM curr c 
        LEFT JOIN prev p 
          ON LOWER(trim(c.platform)) = LOWER(trim(p.platform)) 
         AND LOWER(trim(c.city)) = LOWER(trim(p.city))
         AND LOWER(trim(c.category)) = LOWER(trim(p.category)) 
         AND LOWER(trim(c.keyword)) = LOWER(trim(p.keyword))
        HAVING c.total_spend > 500 AND c.roas < 2.0
        ORDER BY c.total_spend DESC
        LIMIT 10
    `;

    // -------------------------------------------------------------------------
    // QUERY 5 — COMPETITOR OSA (powers: Competitor OSA Weak Spots)
    //
    // FIXES applied:
    //   1. rb_ms_olap CTEs are wrapped in a guard — if the table doesn't exist
    //      (e.g. testing DB), compData safely returns [] instead of crashing.
    //   2. INNER JOIN between our_brand_osa and other_brand_osa changed to
    //      CROSS-style: other_brand_osa is now the driving table, our brand OSA
    //      is LEFT JOINed so rows are not silently dropped when a city/platform/
    //      category combo exists for competitors but not for our brand.
    //   3. WHERE filter loosened: `our.kw_osa >= other.comp_osa` removed —
    //      this condition was filtering out all rows when our OSA was low.
    //      `comp_osa < 100` replaces the old `<= 80` to surface any meaningful gap.
    //   4. HAVING kw_osa > 0 in our_brand_osa CTE replaced with
    //      `kw_osa IS NOT NULL` so rows with a valid (even zero) OSA are kept.
    // -------------------------------------------------------------------------
        const buildCompetitorOsaQuery = (rbMsOlapExists) => `
        WITH 
            ${rbMsOlapExists ? `
            total_market_sales AS (
                SELECT LOWER(trim(${CITY_NORM_EXPR('location')})) AS join_city, LOWER(trim(platform)) AS join_platform, LOWER(trim(category)) AS join_category, SUM(toFloat64OrZero(toString(sales))) AS total_sales
                FROM rb_ms_olap WHERE created_on BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND ${buildCHCondition(filters.platform, 'platform')} AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('location'))} AND ${buildCHCondition(filters.category, 'category', { isCategory: true })}
                GROUP BY join_city, join_platform, join_category HAVING total_sales > 0
            ),
            brand_market_share AS (
                SELECT LOWER(trim(replaceRegexpAll(group_brand, '[^a-zA-Z0-9 ]', ''))) AS join_brand, LOWER(trim(${CITY_NORM_EXPR('location')})) AS join_city, LOWER(trim(platform)) AS join_platform, LOWER(trim(category)) AS join_category, SUM(toFloat64OrZero(toString(sales))) AS brand_sales
                FROM rb_ms_olap WHERE created_on BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND ${buildCHCondition(filters.platform, 'platform')} AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('location'))} AND ${buildCHCondition(filters.category, 'category', { isCategory: true })}
                GROUP BY join_brand, join_city, join_platform, join_category
            ),
            total_market_sales_prev AS (
                SELECT LOWER(trim(${CITY_NORM_EXPR('location')})) AS join_city, LOWER(trim(platform)) AS join_platform, LOWER(trim(category)) AS join_category, SUM(toFloat64OrZero(toString(sales))) AS prev_total_sales
                FROM rb_ms_olap WHERE created_on BETWEEN '${prevStartDate}' AND '${prevEndDate}'
                  AND ${buildCHCondition(filters.platform, 'platform')} AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('location'))} AND ${buildCHCondition(filters.category, 'category', { isCategory: true })}
                GROUP BY join_city, join_platform, join_category HAVING prev_total_sales > 0
            ),
            brand_market_share_prev AS (
                SELECT LOWER(trim(replaceRegexpAll(group_brand, '[^a-zA-Z0-9 ]', ''))) AS join_brand, LOWER(trim(${CITY_NORM_EXPR('location')})) AS join_city, LOWER(trim(platform)) AS join_platform, LOWER(trim(category)) AS join_category, SUM(toFloat64OrZero(toString(sales))) AS prev_brand_sales
                FROM rb_ms_olap WHERE created_on BETWEEN '${prevStartDate}' AND '${prevEndDate}'
                  AND ${buildCHCondition(filters.platform, 'platform')} AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('location'))} AND ${buildCHCondition(filters.category, 'category', { isCategory: true })}
                GROUP BY join_brand, join_city, join_platform, join_category
            ),` : ''}
            our_brand_osa AS (
                SELECT if(empty(trim(Location)), '-', Location) AS raw_city, if(empty(trim(Platform)), '-', Platform) AS raw_platform, if(empty(trim(${catField})), '-', ${catField}) AS raw_category,
                    LOWER(trim(${CITY_NORM_EXPR('Location')})) AS join_city, LOWER(trim(Platform)) AS join_platform, LOWER(trim(${catField})) AS join_category, LOWER(trim(replaceRegexpAll(Brand, '[^a-zA-Z0-9 ]', ''))) AS join_brand,
                    round((sum(toFloat64OrZero(toString(neno_osa))) / nullIf(sum(toFloat64OrZero(toString(deno_osa))), 0)) * 100, 2) AS kw_osa
                FROM rb_pdp_olap WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}' AND Comp_flag IN (0, '0') AND LOWER(trim(replaceRegexpAll(Brand, '[^a-zA-Z0-9 ]', ''))) = '${brandLabel.toLowerCase()}'
                  AND ${CITY_NORM_EXPR('Location')} IN (${ALLOWED_CITIES_SQL}) AND ${buildCHCondition(filters.platform, 'Platform', { isPdp: true })} AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })} AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
                GROUP BY raw_city, raw_platform, raw_category, join_city, join_platform, join_category, join_brand HAVING kw_osa IS NOT NULL
            ),
            other_brand_osa AS (
                SELECT if(empty(trim(Location)), '-', Location) AS raw_city, if(empty(trim(Platform)), '-', Platform) AS raw_platform, if(empty(trim(${catField})), '-', ${catField}) AS raw_category,
                    LOWER(trim(${CITY_NORM_EXPR('Location')})) AS join_city, LOWER(trim(Platform)) AS join_platform, LOWER(trim(${catField})) AS join_category, Brand AS raw_competitor, LOWER(trim(replaceRegexpAll(Brand, '[^a-zA-Z0-9 ]', ''))) AS join_competitor,
                    round((sum(toFloat64OrZero(toString(neno_osa))) / nullIf(sum(toFloat64OrZero(toString(deno_osa))), 0)) * 100, 2) AS comp_osa
                FROM rb_pdp_olap WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}' AND Comp_flag IN (1, '1') AND Brand IS NOT NULL AND Brand != '' AND ${CITY_NORM_EXPR('Location')} IN (${ALLOWED_CITIES_SQL}) AND ${buildCHCondition(filters.platform, 'Platform', { isPdp: true })} AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })} AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
                GROUP BY raw_city, raw_platform, raw_category, join_city, join_platform, join_category, raw_competitor, join_competitor
            ),
            our_brand_osa_prev AS (
                SELECT LOWER(trim(${CITY_NORM_EXPR('Location')})) AS join_city, LOWER(trim(Platform)) AS join_platform, LOWER(trim(${catField})) AS join_category, LOWER(trim(replaceRegexpAll(Brand, '[^a-zA-Z0-9 ]', ''))) AS join_brand,
                    round((sum(toFloat64OrZero(toString(neno_osa))) / nullIf(sum(toFloat64OrZero(toString(deno_osa))), 0)) * 100, 2) AS prev_kw_osa
                FROM rb_pdp_olap WHERE DATE BETWEEN '${prevStartDate}' AND '${prevEndDate}' AND Comp_flag IN (0, '0') AND LOWER(trim(replaceRegexpAll(Brand, '[^a-zA-Z0-9 ]', ''))) = '${brandLabel.toLowerCase()}'
                  AND ${CITY_NORM_EXPR('Location')} IN (${ALLOWED_CITIES_SQL}) AND ${buildCHCondition(filters.platform, 'Platform', { isPdp: true })} AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })} AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
                GROUP BY join_city, join_platform, join_category, join_brand
            ),
            other_brand_osa_prev AS (
                SELECT LOWER(trim(${CITY_NORM_EXPR('Location')})) AS join_city, LOWER(trim(Platform)) AS join_platform, LOWER(trim(${catField})) AS join_category, LOWER(trim(replaceRegexpAll(Brand, '[^a-zA-Z0-9 ]', ''))) AS join_competitor,
                    round((sum(toFloat64OrZero(toString(neno_osa))) / nullIf(sum(toFloat64OrZero(toString(deno_osa))), 0)) * 100, 2) AS prev_comp_osa
                FROM rb_pdp_olap WHERE DATE BETWEEN '${prevStartDate}' AND '${prevEndDate}' AND Comp_flag IN (1, '1') AND Brand IS NOT NULL AND Brand != '' AND ${CITY_NORM_EXPR('Location')} IN (${ALLOWED_CITIES_SQL}) AND ${buildCHCondition(filters.platform, 'Platform', { isPdp: true })} AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })} AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
                GROUP BY join_city, join_platform, join_category, join_competitor
            )
        SELECT 
            other.raw_city AS city, other.raw_platform AS platform, other.raw_category AS category, other.raw_competitor AS skuOrBrand, 
            other.comp_osa  AS otherBrandOsa, ifNull(our.kw_osa, 0) AS kwOsa,
            (other.comp_osa - ifNull(other_prev.prev_comp_osa, other.comp_osa)) AS otherBrandOsaChangePct,
            (ifNull(our.kw_osa, 0) - ifNull(our_prev.prev_kw_osa, ifNull(our.kw_osa, 0))) AS kwOsaChangePct,
            ${rbMsOlapExists ? `
            ROUND((ifNull(other_ms.brand_sales, 0) / nullIf(tms.total_sales, 0)) * 100, 2) AS otherBrandMkShare,
            ROUND((ifNull(our_ms.brand_sales, 0) / nullIf(tms.total_sales, 0)) * 100, 2) AS ourBrandMkShare,
            ROUND((ifNull(other_ms.brand_sales, 0) / nullIf(tms.total_sales, 0)) * 100, 2) - ROUND((ifNull(other_ms_prev.prev_brand_sales, 0) / nullIf(tms_prev.prev_total_sales, 0)) * 100, 2) AS otherBrandMkShareChange,
            ROUND((ifNull(our_ms.brand_sales, 0) / nullIf(tms.total_sales, 0)) * 100, 2) - ROUND((ifNull(our_ms_prev.prev_brand_sales, 0) / nullIf(tms_prev.prev_total_sales, 0)) * 100, 2) AS ourBrandMkShareChange,
            round((ifNull(other_ms.brand_sales, 0) / nullIf(greatest(other.comp_osa, 10) / 100.0, 0)) - ifNull(other_ms.brand_sales, 0), 0) AS psl
            ` : `
            NULL AS otherBrandMkShare, NULL AS ourBrandMkShare, NULL AS otherBrandMkShareChange, NULL AS ourBrandMkShareChange, 0 AS psl
            `},
            (ifNull(our.kw_osa, 0) - other.comp_osa) AS gapPct
        FROM other_brand_osa other
        LEFT JOIN our_brand_osa our ON our.join_city = other.join_city AND our.join_platform = other.join_platform AND our.join_category = other.join_category
        LEFT JOIN our_brand_osa_prev our_prev ON our_prev.join_city = other.join_city AND our_prev.join_platform = other.join_platform AND our_prev.join_category = other.join_category
        LEFT JOIN other_brand_osa_prev other_prev ON other_prev.join_city = other.join_city AND other_prev.join_platform = other.join_platform AND other_prev.join_category = other.join_category AND other_prev.join_competitor = other.join_competitor
        ${rbMsOlapExists ? `
        LEFT JOIN total_market_sales tms ON tms.join_city = other.join_city AND tms.join_platform = other.join_platform AND tms.join_category = other.join_category
        LEFT JOIN brand_market_share other_ms ON other_ms.join_brand = other.join_competitor AND other_ms.join_city = other.join_city AND other_ms.join_platform = other.join_platform AND other_ms.join_category = other.join_category
        LEFT JOIN brand_market_share our_ms ON our_ms.join_brand = our.join_brand AND our_ms.join_city = other.join_city AND our_ms.join_platform = other.join_platform AND our_ms.join_category = other.join_category
        LEFT JOIN total_market_sales_prev tms_prev ON tms_prev.join_city = other.join_city AND tms_prev.join_platform = other.join_platform AND tms_prev.join_category = other.join_category
        LEFT JOIN brand_market_share_prev other_ms_prev ON other_ms_prev.join_brand = other.join_competitor AND other_ms_prev.join_city = other.join_city AND other_ms_prev.join_platform = other.join_platform AND other_ms_prev.join_category = other.join_category
        LEFT JOIN brand_market_share_prev our_ms_prev ON our_ms_prev.join_brand = our.join_brand AND our_ms_prev.join_city = other.join_city AND our_ms_prev.join_platform = other.join_platform AND our_ms_prev.join_category = other.join_category
        ` : ''}
        WHERE other.comp_osa > 3 AND other.comp_osa < 75 AND ifNull(our.kw_osa, 0) > 60 AND other.comp_osa IS NOT NULL
        ${rbMsOlapExists ? `AND (ifNull(other_ms.brand_sales, 0) / nullIf(tms.total_sales, 0)) * 100 > 1` : ''}
        AND (other.comp_osa - ifNull(other_prev.prev_comp_osa, other.comp_osa)) < 0
        ${rbMsOlapExists ? `HAVING otherBrandMkShareChange <= -0.1` : ''}
        ORDER BY ${rbMsOlapExists ? 'otherBrandMkShareChange ASC, ' : ''}otherBrandOsaChangePct ASC 
        LIMIT 5 BY city
        LIMIT 100
    `;

    // -------------------------------------------------------------------------
    // QUERY 6 — REMOVE AD LOW OSA (powers: Remove Ad Low OSA)
    // -------------------------------------------------------------------------
    const removeAdLowOSAQuery = `
        WITH curr_keyword_stats AS (
            SELECT 
                keyword,
                location_name,
                platform_name,
                DATE,
                sum(toFloat64OrZero(toString(spons))) AS total_kw_spons
            FROM rb_kw_olap
            WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
            GROUP BY keyword, location_name, platform_name, DATE
        ),
        curr_product_keyword_stats AS (
            SELECT 
                web_pid,
                keyword,
                location_name,
                platform_name,
                DATE,
                sum(toFloat64OrZero(toString(spons))) AS product_kw_spons
            FROM rb_kw_olap
            WHERE flag = 1
              AND DATE BETWEEN '${dateFrom}' AND '${dateTo}'
            GROUP BY web_pid, keyword, location_name, platform_name, DATE
        ),
        curr_product_daily_sov AS (
            SELECT
                pks.web_pid,
                pks.location_name,
                pks.platform_name,
                pks.DATE,
                SUM(pks.product_kw_spons) AS own_spons,
                SUM(ks.total_kw_spons) AS total_spons
            FROM curr_product_keyword_stats pks
            JOIN curr_keyword_stats ks
                ON pks.keyword = ks.keyword
               AND pks.location_name = ks.location_name
               AND pks.platform_name = ks.platform_name
               AND pks.DATE = ks.DATE
            GROUP BY pks.web_pid, pks.location_name, pks.platform_name, pks.DATE
        ),
        curr_main AS (
            SELECT
                ${CITY_NORM_EXPR('p.Location')}  AS city,
                p.Platform  AS platform,
                ${catField} AS category,
                p.Product   AS skuOrBrand,
                ROUND(
                    SUM(toFloat64OrZero(toString(p.neno_osa))) * 100.0 /
                    nullIf(SUM(toFloat64OrZero(toString(p.deno_osa))), 0),
                1) AS kwOsa,
                ROUND(
                    SUM(s.own_spons) * 100.0 / nullIf(SUM(s.total_spons), 0),
                2) AS adSov,
                ROUND(SUM(ifNull(p.Ad_Spend, 0)), 0) AS spendInr,
                ROUND(
                    SUM(toFloat64OrZero(toString(p.Sales))) *
                    (
                        (100.0 /
                        nullIf(
                            SUM(toFloat64OrZero(toString(p.neno_osa))) * 100.0 /
                            nullIf(SUM(toFloat64OrZero(toString(p.deno_osa))), 0),
                        0))
                        - 1
                    ),
                0) AS estLostSalesInr,
                argMax(p.Web_Pid, p.DATE) AS web_pid
            FROM rb_pdp_olap p
            LEFT JOIN curr_product_daily_sov s 
                ON p.Web_Pid = s.web_pid 
               AND p.Platform = s.platform_name 
               AND p.Location = s.location_name
               AND p.DATE = s.DATE
            WHERE p.DATE BETWEEN '${dateFrom}' AND '${dateTo}'
              AND p.Comp_flag IN (0, '0')
              AND p.Ad_Spend > 0
              AND p.Product IS NOT NULL
              AND p.Product != ''
              AND ${buildCHCondition(filters.platform, 'p.Platform', { isPdp: true })}
              AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('p.Location'), { isPdp: true })}
              AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
            GROUP BY city, platform, category, skuOrBrand
        ),
        prev_keyword_stats AS (
            SELECT 
                keyword,
                location_name,
                platform_name,
                DATE,
                sum(toFloat64OrZero(toString(spons))) AS total_kw_spons
            FROM rb_kw_olap
            WHERE DATE BETWEEN '${prevStartDate}' AND '${prevEndDate}'
            GROUP BY keyword, location_name, platform_name, DATE
        ),
        prev_product_keyword_stats AS (
            SELECT 
                web_pid,
                keyword,
                location_name,
                platform_name,
                DATE,
                sum(toFloat64OrZero(toString(spons))) AS product_kw_spons
            FROM rb_kw_olap
            WHERE flag = 1
              AND DATE BETWEEN '${prevStartDate}' AND '${prevEndDate}'
            GROUP BY web_pid, keyword, location_name, platform_name, DATE
        ),
        prev_product_daily_sov AS (
            SELECT
                pks.web_pid,
                pks.location_name,
                pks.platform_name,
                pks.DATE,
                SUM(pks.product_kw_spons) AS own_spons,
                SUM(ks.total_kw_spons) AS total_spons
            FROM prev_product_keyword_stats pks
            JOIN prev_keyword_stats ks
                ON pks.keyword = ks.keyword
               AND pks.location_name = ks.location_name
               AND pks.platform_name = ks.platform_name
               AND pks.DATE = ks.DATE
            GROUP BY pks.web_pid, pks.location_name, pks.platform_name, pks.DATE
        ),
        prev_main AS (
            SELECT
                ${CITY_NORM_EXPR('p.Location')}  AS city,
                p.Platform  AS platform,
                ${catField} AS category,
                p.Product   AS skuOrBrand,
                ROUND(
                    SUM(toFloat64OrZero(toString(p.neno_osa))) * 100.0 /
                    nullIf(SUM(toFloat64OrZero(toString(p.deno_osa))), 0),
                1) AS prevKwOsa,
                ROUND(
                    SUM(s.own_spons) * 100.0 / nullIf(SUM(s.total_spons), 0),
                2) AS prevAdSov
            FROM rb_pdp_olap p
            LEFT JOIN prev_product_daily_sov s 
                ON p.Web_Pid = s.web_pid 
               AND p.Platform = s.platform_name 
               AND p.Location = s.location_name
               AND p.DATE = s.DATE
            WHERE p.DATE BETWEEN '${prevStartDate}' AND '${prevEndDate}'
              AND p.Comp_flag IN (0, '0')
              AND p.Product IS NOT NULL
              AND p.Product != ''
              AND ${buildCHCondition(filters.platform, 'p.Platform', { isPdp: true })}
              AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('p.Location'), { isPdp: true })}
              AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
            GROUP BY city, platform, category, skuOrBrand
        )
        SELECT
            c.city, c.platform, c.category, c.skuOrBrand, c.kwOsa, c.adSov, c.spendInr, c.estLostSalesInr,
            ifNull(p.prevKwOsa, 0) AS prevKwOsa,
            ifNull(p.prevAdSov, 0) AS prevAdSov,
            (c.kwOsa - ifNull(p.prevKwOsa, 0)) AS kwOsaChangePct,
            (c.adSov - ifNull(p.prevAdSov, 0)) AS adSovChangePct,
            c.web_pid AS webPid
        FROM curr_main c
        LEFT JOIN prev_main p ON c.city = p.city AND c.platform = p.platform AND c.category = p.category AND c.skuOrBrand = p.skuOrBrand
        HAVING c.kwOsa < 60 AND kwOsaChangePct < 0 AND adSovChangePct > 0 AND c.spendInr > 500
        ORDER BY adSovChangePct DESC
        LIMIT 5 BY platform
        LIMIT 25
    `;

    // -------------------------------------------------------------------------
    // QUERY 7 — CHALLENGER LAUNCH WATCH (powers: Challenger Launch Watch)
    // -------------------------------------------------------------------------
        const challengerLaunchQuery = `
        WITH curr AS (
            SELECT
                ${CITY_NORM_EXPR('Location')}  AS city, Platform AS platform, ${catField} AS category, Brand AS skuOrBrand, Product AS productName,
                ROUND(SUM(toFloat64OrZero(if(Organic_SOS IS NULL OR Organic_SOS = '', '0', Organic_SOS))) * 100.0 / nullIf(COUNT(*), 0), 2) AS newItemShare,
                ROUND(AVG(ifNull(toFloat64OrZero(toString(PPU)), 0)), 2) AS ppu, MIN(DATE) AS firstSeen
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}' AND Comp_flag IN (1, '1') AND Brand IS NOT NULL AND Brand != '' AND Product IS NOT NULL AND Product != ''
              AND ${buildCHCondition(filters.platform, 'Platform', { isPdp: true })} AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })} AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
            GROUP BY city, platform, category, skuOrBrand, productName
            HAVING MIN(DATE) >= '${dateFrom}' AND newItemShare > 0
        ),
        prev AS (
            SELECT ${CITY_NORM_EXPR('Location')} AS city, Platform AS platform, ${catField} AS category, Brand AS skuOrBrand, Product AS productName,
                ROUND(SUM(toFloat64OrZero(if(Organic_SOS IS NULL OR Organic_SOS = '', '0', Organic_SOS))) * 100.0 / nullIf(COUNT(*), 0), 2) AS prevNewItemShare
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${prevStartDate}' AND '${prevEndDate}' AND Comp_flag IN (1, '1') AND Brand IS NOT NULL AND Brand != '' AND Product IS NOT NULL AND Product != ''
              AND ${buildCHCondition(filters.platform, 'Platform', { isPdp: true })} AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })} AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
            GROUP BY city, platform, category, skuOrBrand, productName
        )
        SELECT c.*, ifNull(p.prevNewItemShare, 0) AS prevNewItemShare, (c.newItemShare - ifNull(p.prevNewItemShare, 0)) AS newItemShareChangePct
        FROM curr c LEFT JOIN prev p ON c.city = p.city AND c.platform = p.platform AND c.category = p.category AND c.skuOrBrand = p.skuOrBrand AND c.productName = p.productName
        ORDER BY c.newItemShare DESC
        LIMIT 10
    `;

    // -------------------------------------------------------------------------
    // QUERY 9 — SURPLUS STOCK (powers: Surplus Stock)
    // Fetches from rb_po_olap: SKU name, platform, warehouse (city),
    // excess inventory (front_inventory), excess DOI (DIH),
    // open PO qty (units_remaining from open/scheduled POs).
    // Discount % is not available in rb_po_olap — hardcoded in frontend.
    // -------------------------------------------------------------------------
    const dayCount = Math.max(endDate.diff(startDate, 'day') + 1, 1);
    const surplusStockQuery = `
        SELECT
            po.web_pid AS webPid,
            LOWER(po.sku_name) AS skuName,
            LOWER(po.platform) AS platform,
            ${CITY_NORM_EXPR('po.city')} AS city,
            LOWER(po.category) AS category,
            LOWER(po.brand) AS brandName,
            ROUND(AVG(ifNull(toFloat64OrZero(toString(po.front_inventory)), 0)), 0) AS excessInventory,
            ROUND(AVG(ifNull(toFloat64OrZero(toString(po.DIH)), 0)), 1) AS excessDOI,
            SUM(
                CASE WHEN LOWER(po.po_status) IN ('scheduled', 'partially scheduled', 'open')
                     THEN ifNull(toFloat64OrZero(toString(po.units_remaining)), 0)
                     ELSE 0
                END
            ) AS openPOQty,
            ROUND(AVG(ifNull(toFloat64OrZero(toString(po.cost_per_unit)), 0)), 2) AS avgCostPerUnit,
            ROUND(
                AVG(ifNull(toFloat64OrZero(toString(po.front_inventory)), 0)) *
                AVG(ifNull(toFloat64OrZero(toString(po.cost_per_unit)), 0)),
            0) AS excessInventoryValue,
            ROUND(
                SUM(ifNull(toFloat64OrZero(toString(po.neno_osa)), 0)) * 100.0 /
                nullIf(SUM(ifNull(toFloat64OrZero(toString(po.deno_osa)), 0)), 0),
            1) AS osa
        FROM rb_po_olap po
        WHERE po.po_raised_date BETWEEN '${dateFrom}' AND '${dateTo}'
          AND po.sku_name IS NOT NULL AND po.sku_name != ''
          AND ${buildCHCondition(filters.platform, 'po.platform')}
          AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('po.city'))}
          AND ${buildCHCondition(filters.category, 'po.category', { isCategory: true })}
        GROUP BY webPid, skuName, platform, city, category, brandName
        HAVING excessDOI >= 100 AND openPOQty <= 25
        ORDER BY excessInventoryValue DESC
        LIMIT 15
    `;

    // -------------------------------------------------------------------------
    // QUERY 10 — PRIORITISE PO (powers: Prioritise PO)
    // Identifies SKUs with low OSA and high projected sales loss that need PO.
    // Projected Sales Loss = Sales * ((100/OSA) - 1)
    // -------------------------------------------------------------------------
    const prioritisePOQuery = `
        WITH curr_pdp AS (
            SELECT
                ${CITY_NORM_EXPR('Location')} AS city,
                LOWER(Platform) AS platform,
                ${catField} AS category,
                LOWER(Product) AS skuName,
                Brand AS brandName,
                Web_Pid AS webPid,
                ROUND(
                    SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) * 100.0 /
                    nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0),
                1) AS osa,
                (SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) / nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0)) AS osa_ratio,
                SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) AS totalSales,
                SUM(ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) AS totalQtySold,
                argMax(toFloat64OrZero(toString(MRP)), DATE) AS currentMrp
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
              AND Comp_flag IN (0, '0')
              AND Product IS NOT NULL AND Product != ''
              AND ${buildCHCondition(filters.platform, 'Platform', { isPdp: true })}
              AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })}
              AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
            GROUP BY city, platform, category, skuName, brandName, webPid
        ),
        curr_po AS (
            SELECT 
                ${CITY_NORM_EXPR('city')} AS city,
                LOWER(platform) AS platform,
                web_pid AS webPid,
                argMax(po_status, po_raised_date) AS poStatus,
                argMax(po_raised_date, po_raised_date) AS poRaisedDate,
                argMax(po_expiry_date, po_raised_date) AS poExpiryDate,
                argMax(toFloat64OrZero(toString(DIH)), po_raised_date) AS dih
            FROM rb_po_olap
            WHERE po_raised_date BETWEEN '${dateFrom}' AND '${dateTo}'
              AND sku_name IS NOT NULL AND sku_name != ''
              AND ${buildCHCondition(filters.platform, 'platform')}
              AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('city'))}
            GROUP BY city, platform, webPid
        ),
        curr_combined AS (
            SELECT 
                p.city, p.platform, p.category, p.skuName, p.brandName, p.webPid,
                p.osa, p.totalSales,
                po.poStatus AS actualPoStatus,
                po.poRaisedDate AS actualPoRaisedDate,
                po.poExpiryDate AS poExpiryDate,
                LOWER(po.poStatus) IN ('scheduled', 'unscheduled') AS isEligible,
                ROUND(
                    ((p.totalQtySold / greatest(1, dateDiff('day', toDate('${dateFrom}'), toDate('${dateTo}')) + 1)) * 7 * p.currentMrp) 
                    * (1 - ifNull(p.osa_ratio, 1)) 
                    * greatest(0, (7 - ifNull(po.dih, 0)) / 7.0),
                0) AS projectedSalesLoss
            FROM curr_pdp p
            LEFT JOIN curr_po po 
              ON p.city = po.city AND p.platform = po.platform AND p.webPid = po.webPid
        ),
        cohort_sales_risk AS (
            SELECT 
                city, actualPoStatus, actualPoRaisedDate, poExpiryDate,
                SUM(projectedSalesLoss) AS maxSalesRisk
            FROM curr_combined
            WHERE isEligible = 1
            GROUP BY city, actualPoStatus, actualPoRaisedDate, poExpiryDate
        ),
        curr_with_risk AS (
            SELECT 
                c.*,
                csr.maxSalesRisk,
                (c.projectedSalesLoss / nullIf(csr.maxSalesRisk, 0)) * 100 AS currentSalesRisk,
                dateDiff('day', today(), c.poExpiryDate) AS daysToExpiry
            FROM curr_combined c
            LEFT JOIN cohort_sales_risk csr 
              ON c.city = csr.city 
             AND c.actualPoStatus = csr.actualPoStatus 
             AND c.actualPoRaisedDate = csr.actualPoRaisedDate 
             AND c.poExpiryDate = csr.poExpiryDate
        ),
        prev AS (
            SELECT
                ${CITY_NORM_EXPR('Location')} AS city,
                LOWER(Platform) AS platform,
                ${catField} AS category,
                LOWER(Product) AS skuName,
                Web_Pid AS webPid,
                ROUND(
                    SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) * 100.0 /
                    nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0),
                1) AS prevOsa,
                SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) AS prevTotalSales
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${prevStartDate}' AND '${prevEndDate}'
              AND Comp_flag IN (0, '0')
              AND Product IS NOT NULL AND Product != ''
              AND ${buildCHCondition(filters.platform, 'Platform', { isPdp: true })}
              AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })}
              AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
            GROUP BY city, platform, category, skuName, webPid
        )
        SELECT
            c.city, c.platform, c.category, c.skuName, c.brandName,
            c.osa, c.totalSales,
            if(
                c.isEligible = 1 AND (c.currentSalesRisk >= 0 AND c.daysToExpiry >= 0 AND c.daysToExpiry <= 14),
                c.projectedSalesLoss,
                0
            ) AS projectedSalesLoss,
            c.actualPoRaisedDate AS poRaisedDate,
            ifNull(p.prevOsa, c.osa) AS prevOsa,
            (c.osa - ifNull(p.prevOsa, c.osa)) AS osaChange,
            ifNull(p.prevTotalSales, 0) AS prevTotalSales,
            multiIf(
                c.isEligible = 0, 'low',
                (c.currentSalesRisk >= 0 AND c.daysToExpiry >= 0 AND c.daysToExpiry <= 14), 'high',
                'low'
            ) AS poStatus
        FROM curr_with_risk c
        LEFT JOIN prev p ON c.city = p.city AND c.platform = p.platform AND c.webPid = p.webPid
        HAVING poStatus = 'high' AND projectedSalesLoss > 0
        ORDER BY projectedSalesLoss DESC
        LIMIT 15
    `;

    // -------------------------------------------------------------------------
    // QUERY 11 — TRANSFER ISSUE (powers: Transfer Issue)
    // Identifies cross-city supply-demand mismatches: SKUs with low inventory
    // in one city while selling well, suggesting inter-warehouse transfer need.
    // CPD = Consumption Per Day = Total Sold / days_in_period
    // Backed DOI = Avg Inventory / CPD
    // -------------------------------------------------------------------------
    const transferIssueQuery = `
        WITH curr AS (
            SELECT
                ${CITY_NORM_EXPR('Location')} AS city,
                Platform AS platform,
                ${catField} AS category,
                Product AS skuName,
                Brand AS brandName,
                SUM(ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) AS total_sold,
                AVG(ifNull(toFloat64OrZero(toString(Inventory)), 0)) AS avg_inventory,
                ROUND(
                    SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) * 100.0 /
                    nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0),
                1) AS osa,
                SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) AS totalSales,
                ROUND(SUM(ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) / ${dayCount}, 2) AS cpd,
                ROUND(
                    AVG(ifNull(toFloat64OrZero(toString(Inventory)), 0)) /
                    nullIf(SUM(ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) / ${dayCount}, 0),
                1) AS backedDOI,
                ROUND(
                    SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) *
                    ((100.0 / nullIf(
                        SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) * 100.0 /
                        nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0),
                    0)) - 1),
                0) AS projectedSalesLoss
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
              AND Comp_flag IN (0, '0')
              AND Product IS NOT NULL AND Product != ''
              AND ${buildCHCondition(filters.platform, 'Platform', { isPdp: true })}
              AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })}
              AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
            GROUP BY city, platform, category, skuName, brandName
            HAVING cpd > 0
        ),
        prev AS (
            SELECT
                ${CITY_NORM_EXPR('Location')} AS city,
                Platform AS platform,
                ${catField} AS category,
                Product AS skuName,
                AVG(ifNull(toFloat64OrZero(toString(Inventory)), 0)) AS prevAvgInventory,
                ROUND(SUM(ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) / ${dayCount}, 2) AS prevCpd
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${prevStartDate}' AND '${prevEndDate}'
              AND Comp_flag IN (0, '0')
              AND Product IS NOT NULL AND Product != ''
              AND ${buildCHCondition(filters.platform, 'Platform', { isPdp: true })}
              AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })}
              AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
            GROUP BY city, platform, category, skuName
        )
        SELECT
            c.city, c.platform, c.category, c.skuName, c.brandName,
            c.cpd, c.backedDOI, c.osa, c.projectedSalesLoss, c.totalSales,
            ROUND(ifNull(p.prevCpd, c.cpd), 2) AS prevCpd,
            ROUND(c.cpd - ifNull(p.prevCpd, c.cpd), 2) AS cpdChange,
            ROUND(
                ifNull(p.prevAvgInventory, 0) /
                nullIf(ifNull(p.prevCpd, c.cpd), 0),
            1) AS prevBackedDOI,
            ROUND(c.backedDOI - ifNull(
                ifNull(p.prevAvgInventory, 0) /
                nullIf(ifNull(p.prevCpd, c.cpd), 0),
            c.backedDOI), 1) AS backedDOIChange
        FROM curr c
        LEFT JOIN prev p ON c.city = p.city AND c.platform = p.platform AND c.category = p.category AND c.skuName = p.skuName
        HAVING c.backedDOI < 15 AND c.osa < 90 AND c.projectedSalesLoss > 0
        ORDER BY c.projectedSalesLoss DESC
        LIMIT 15
    `;

    // -------------------------------------------------------------------------
    // QUERY 12 — NEW MARKET ENTRY (powers: New Market Entry)
    // Detects competitor products entering new cities/markets for first time.
    // Tracks PFU (Price For User = avg selling price) and first appearance.
    // -------------------------------------------------------------------------
    const newMarketEntryQuery = `
        WITH curr AS (
            SELECT
                ${CITY_NORM_EXPR('Location')} AS city,
                Platform AS platform,
                ${catField} AS category,
                Product AS skuName,
                Brand AS competitorName,
                ROUND(AVG(toFloat64OrZero(toString(Selling_Price))), 0) AS pfu,
                MIN(DATE) AS firstSeenDate,
                COUNT(DISTINCT DATE) AS daysSeen,
                SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) AS totalSales
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
              AND Comp_flag IN (1, '1')
              AND Product IS NOT NULL AND Product != ''
              AND Brand IS NOT NULL AND Brand != ''
              AND ${buildCHCondition(filters.platform, 'Platform', { isPdp: true })}
              AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })}
              AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
            GROUP BY city, platform, category, skuName, competitorName
            HAVING MIN(DATE) >= '${dateFrom}'
        ),
        prev_check AS (
            SELECT DISTINCT
                ${CITY_NORM_EXPR('Location')} AS city,
                Platform AS platform,
                Product AS skuName
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${lookback60Date}' AND '${prevEndDate}'
              AND Comp_flag IN (1, '1')
              AND Product IS NOT NULL AND Product != ''
        )
        SELECT
            c.city, c.platform, c.category, c.skuName, c.competitorName,
            c.pfu, c.firstSeenDate, c.daysSeen, c.totalSales
        FROM curr c
        LEFT JOIN prev_check p ON c.city = p.city AND c.platform = p.platform AND c.skuName = p.skuName
        WHERE p.skuName IS NULL
        ORDER BY c.firstSeenDate DESC
        LIMIT 50
    `;

    // -------------------------------------------------------------------------
    // QUERY 7.5 — PERFORMANCE METRICS (Real Sales/OSA for Visibility mapping)
    // -------------------------------------------------------------------------
    const performanceQuery = `
        WITH 
            curr AS (
                SELECT 
                    ${CITY_NORM_EXPR('Location')} AS city, 
                    Platform AS platform, 
                    ${catField} AS category, 
                    SUM(toFloat64OrZero(toString(Sales))) AS s, 
                    SUM(toFloat64OrZero(toString(neno_osa))) as n, 
                    SUM(toFloat64OrZero(toString(deno_osa))) as d
                FROM rb_pdp_olap 
                WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}' 
                  AND Comp_flag IN (0, '0') 
                  AND ${buildCHCondition(filters.platform, 'Platform', { isPdp: true })}
                  AND ${buildCHCondition(filters.city, 'Location', { isPdp: true })}
                  AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
                GROUP BY city, platform, category
            ),
            prev AS (
                SELECT 
                    ${CITY_NORM_EXPR('Location')} AS city, 
                    Platform AS platform, 
                    ${catField} AS category, 
                    SUM(toFloat64OrZero(toString(Sales))) AS s,
                    SUM(toFloat64OrZero(toString(neno_osa))) as n, 
                    SUM(toFloat64OrZero(toString(deno_osa))) as d
                FROM rb_pdp_olap 
                WHERE DATE BETWEEN '${prevStartDate}' AND '${prevEndDate}' 
                  AND Comp_flag IN (0, '0') 
                  AND ${buildCHCondition(filters.platform, 'Platform', { isPdp: true })}
                  AND ${buildCHCondition(filters.city, 'Location', { isPdp: true })}
                  AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
                GROUP BY city, platform, category
            )
        SELECT 
            c.city, c.platform, c.category,
            c.s AS currSales,
            p.s AS prevSales,
            ROUND(c.n * 100.0 / nullIf(c.d, 0), 2) AS osa,
            ROUND(p.n * 100.0 / nullIf(p.d, 0), 2) AS prevOsa
        FROM curr c
        LEFT JOIN prev p ON c.city = p.city AND c.platform = p.platform AND c.category = p.category
    `;

    // -------------------------------------------------------------------------
    // QUERY 7.6 — SKU-LEVEL LOSS (powers: Share Headroom Hotspots Top SKU)
    // -------------------------------------------------------------------------
    // Normalize city names: Gurgaon/gurugram → Gurugram
    const locNorm = CITY_NORM_EXPR('location');

    const skuLossQuery = `
        SELECT
            ${locNorm} AS city,
            LOWER(platform) AS platform,
            category,
            item_name AS skuName,
            flag AS is_own_brand,
            SUM(CASE WHEN created_on BETWEEN '${dateFrom}' AND '${dateTo}' THEN toFloat64OrZero(toString(sales)) ELSE 0 END) AS curr_sales,
            SUM(CASE WHEN created_on BETWEEN '${prevStartDate}' AND '${prevEndDate}' THEN toFloat64OrZero(toString(sales)) ELSE 0 END) AS prev_sales,
            (curr_sales - prev_sales) AS sales_delta,
            if(is_own_brand = 1, 0, 1) AS comp_flag,
            NULL AS web_pid
        FROM rb_ms_olap
        WHERE (created_on BETWEEN '${dateFrom}' AND '${dateTo}' OR created_on BETWEEN '${prevStartDate}' AND '${prevEndDate}')
          AND group_brand IS NOT NULL AND group_brand != ''
          AND item_name IS NOT NULL AND item_name != ''
          AND ${buildCHCondition(filters.platform, 'platform')}
          AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('location'))}
          AND ${buildCHCondition(filters.category, 'category', { isCategory: true })}
        GROUP BY city, platform, category, skuName, is_own_brand
        HAVING (is_own_brand = 1 AND sales_delta < 0) OR (is_own_brand = 0 AND sales_delta > 0)
        ORDER BY city, platform, category, abs(sales_delta) DESC
    `;

    // -------------------------------------------------------------------------
    // QUERY 8 — COMPETITOR MARKET SHARE TREND (powers: AI Report for Headroom)
    // -------------------------------------------------------------------------

    const ownShareQuery = `
        WITH
            curr_items AS (
                SELECT group_brand AS brand_name,
                       category,
                       ${locNorm} AS location,
                       LOWER(platform) AS platform,
                       item_name,
                       SUM(toFloat64OrZero(toString(sales))) AS curr_sales
                FROM rb_ms_olap
                WHERE created_on BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND flag = 1
                  AND group_brand IS NOT NULL AND group_brand != ''
                  AND ${buildCHCondition(filters.platform, 'platform')}
                  AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('location'))}
                  AND ${buildCHCondition(filters.category, 'category', { isCategory: true })}
                GROUP BY brand_name, category, location, platform, item_name
            ),
            prev_items AS (
                SELECT group_brand AS brand_name,
                       category,
                       ${locNorm} AS location,
                       LOWER(platform) AS platform,
                       item_name,
                       SUM(toFloat64OrZero(toString(sales))) AS prev_sales
                FROM rb_ms_olap
                WHERE created_on BETWEEN '${prevStartDate}' AND '${prevEndDate}'
                  AND flag = 1
                  AND group_brand IS NOT NULL AND group_brand != ''
                  AND ${buildCHCondition(filters.platform, 'platform')}
                  AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('location'))}
                  AND ${buildCHCondition(filters.category, 'category', { isCategory: true })}
                GROUP BY brand_name, category, location, platform, item_name
            ),
            item_deltas AS (
                SELECT 
                    c.brand_name,
                    c.category,
                    c.location,
                    c.platform,
                    c.item_name,
                    c.curr_sales,
                    ifNull(p.prev_sales, 0) AS prev_sales,
                    (c.curr_sales - ifNull(p.prev_sales, 0)) AS sales_delta
                FROM curr_items c
                LEFT JOIN prev_items p ON c.brand_name = p.brand_name AND c.category = p.category AND c.item_name = p.item_name AND c.location = p.location AND c.platform = p.platform
            ),
            brand_totals AS (
                SELECT 
                    brand_name, 
                    category,
                    location,
                    platform,
                    SUM(curr_sales) AS brand_sales,
                    SUM(prev_sales) AS prev_brand_sales,
                    arrayStringConcat(arrayMap(x -> x.1, arraySlice(arraySort(x -> x.2, groupArray(tuple(item_name, sales_delta))), 1, 3)), ', ') AS top_loser_sku
                FROM item_deltas
                GROUP BY brand_name, category, location, platform
            ),
            total_curr AS (
                SELECT category, ${CITY_NORM_EXPR('location')} AS location, LOWER(platform) AS platform, SUM(toFloat64OrZero(toString(sales))) AS v
                FROM rb_ms_olap
                WHERE created_on BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND group_brand IS NOT NULL AND group_brand != ''
                  AND ${buildCHCondition(filters.platform, 'platform')}
                  AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('location'))}
                  AND ${buildCHCondition(filters.category, 'category', { isCategory: true })}
                GROUP BY category, location, platform
            ),
            total_prev AS (
                SELECT category, ${CITY_NORM_EXPR('location')} AS location, LOWER(platform) AS platform, SUM(toFloat64OrZero(toString(sales))) AS v
                FROM rb_ms_olap
                WHERE created_on BETWEEN '${prevStartDate}' AND '${prevEndDate}'
                  AND group_brand IS NOT NULL AND group_brand != ''
                  AND ${buildCHCondition(filters.platform, 'platform')}
                  AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('location'))}
                  AND ${buildCHCondition(filters.category, 'category', { isCategory: true })}
                GROUP BY category, location, platform
            )
        SELECT
            b.brand_name                                                          AS brandName,
            b.category                                                            AS category,
            b.location                                                            AS city,
            b.platform                                                            AS platform,
            b.top_loser_sku                                                       AS topSku,
            ROUND((b.brand_sales / nullIf(tc.v, 0)) * 100, 2)                      AS currSharePct,
            ROUND((ifNull(b.prev_brand_sales, 0) / nullIf(tp.v, 0)) * 100, 2)      AS prevSharePct,
            ROUND(
                ((b.brand_sales / nullIf(tc.v, 0)) - (ifNull(b.prev_brand_sales, 0) / nullIf(tp.v, 0))) * 100,
            2) AS shareChangePpt,
            b.brand_sales                                                         AS brandSales,
            ifNull(b.prev_brand_sales, 0)                                         AS prevBrandSales,
            tc.v                                                                  AS totalMarketSales,
            tp.v                                                                  AS prevTotalMarketSales
        FROM brand_totals b
        LEFT JOIN total_curr tc ON b.category = tc.category AND b.location = tc.location AND b.platform = tc.platform
        LEFT JOIN total_prev tp ON b.category = tp.category AND b.location = tp.location AND b.platform = tp.platform
        ORDER BY currSharePct DESC
    `;

    const compShareQuery = `
        WITH
            curr_items AS (
                SELECT group_brand        AS brand_name,
                       category,
                       ${locNorm}  AS location,
                       LOWER(platform)  AS platform,
                       item_name,
                       SUM(toFloat64OrZero(toString(sales))) AS item_sales
                FROM rb_ms_olap
                WHERE created_on BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND flag = 0
                  AND group_brand IS NOT NULL AND group_brand != ''
                  AND ${buildCHCondition(filters.platform, 'platform')}
                  AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('location'))}
                  AND ${buildCHCondition(filters.category, 'category', { isCategory: true })}
                GROUP BY brand_name, category, location, platform, item_name
            ),
            curr AS (
                SELECT brand_name, category, location, platform,
                       arrayStringConcat(arrayMap(x -> x.1, arraySlice(arrayReverseSort(x -> x.2, groupArray(tuple(item_name, item_sales))), 1, 3)), ', ') AS top_sku,
                       SUM(item_sales) AS brand_sales
                FROM curr_items
                GROUP BY brand_name, category, location, platform
            ),
            prev AS (
                SELECT group_brand AS brand_name,
                       category,
                       ${locNorm}  AS location,
                       LOWER(platform)  AS platform,
                       SUM(toFloat64OrZero(toString(sales))) AS brand_sales
                FROM rb_ms_olap
                WHERE created_on BETWEEN '${prevStartDate}' AND '${prevEndDate}'
                  AND flag = 0
                  AND group_brand IS NOT NULL AND group_brand != ''
                  AND ${buildCHCondition(filters.platform, 'platform')}
                  AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('location'))}
                  AND ${buildCHCondition(filters.category, 'category', { isCategory: true })}
                GROUP BY brand_name, category, location, platform
            ),
            total_curr AS (
                SELECT category, ${CITY_NORM_EXPR('location')} AS location, LOWER(platform) AS platform, SUM(toFloat64OrZero(toString(sales))) AS v
                FROM rb_ms_olap
                WHERE created_on BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND group_brand IS NOT NULL AND group_brand != ''
                  AND ${buildCHCondition(filters.platform, 'platform')}
                  AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('location'))}
                  AND ${buildCHCondition(filters.category, 'category', { isCategory: true })}
                GROUP BY category, location, platform
            ),
            total_prev AS (
                SELECT category, ${CITY_NORM_EXPR('location')} AS location, LOWER(platform) AS platform, SUM(toFloat64OrZero(toString(sales))) AS v
                FROM rb_ms_olap
                WHERE created_on BETWEEN '${prevStartDate}' AND '${prevEndDate}'
                  AND group_brand IS NOT NULL AND group_brand != ''
                  AND ${buildCHCondition(filters.platform, 'platform')}
                  AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('location'))}
                  AND ${buildCHCondition(filters.category, 'category', { isCategory: true })}
                GROUP BY category, location, platform
            )
        SELECT
            c.brand_name                                                                       AS brandName,
            c.category                                                                         AS category,
            c.location                                                                         AS city,
            c.platform                                                                         AS platform,
            c.top_sku                                                                          AS topSku,
            ROUND((c.brand_sales / nullIf(tc.v, 0)) * 100, 2)                                   AS currSharePct,
            ROUND((ifNull(p.brand_sales, 0) / nullIf(tp.v, 0)) * 100, 2)                        AS prevSharePct,
            ROUND(
                ((c.brand_sales / nullIf(tc.v, 0)) - (ifNull(p.brand_sales, 0) / nullIf(tp.v, 0))) * 100,
            2) AS shareChangePpt,
            c.brand_sales                                                                      AS brandSales,
            ifNull(p.brand_sales, 0)                                                           AS prevBrandSales,
            tc.v                                                                               AS totalMarketSales,
            tp.v                                                                               AS prevTotalMarketSales
        FROM curr c
        LEFT JOIN prev p       ON c.brand_name = p.brand_name AND c.category = p.category AND c.location = p.location AND c.platform = p.platform
        LEFT JOIN total_curr tc ON c.category = tc.category AND c.location = tc.location AND c.platform = tc.platform
        LEFT JOIN total_prev tp ON c.category = tp.category AND c.location = tp.location AND c.platform = tp.platform
        HAVING shareChangePpt > 0
        ORDER BY shareChangePpt DESC
    `;

    const sosTrendQuery = `
        WITH
            curr_kw AS (
                SELECT brand,
                       keyword_category,
                       SUM(toFloat64OrZero(toString(spons)))   AS ad_vol,
                       SUM(toFloat64OrZero(toString(organic))) AS org_vol,
                       SUM(toFloat64OrZero(toString(overall))) AS total_vol
                FROM rb_kw_olap
                WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND brand IS NOT NULL AND brand != ''
                  AND ${buildCHCondition(filters.platform, 'platform_name')}
                  AND ${buildCHCondition(filters.city, 'location_name')}
                  AND ${buildCHCondition(filters.category, 'keyword_category', { isCategory: true })}
                GROUP BY brand, keyword_category
            ),
            prev_kw AS (
                SELECT brand,
                       keyword_category,
                       SUM(toFloat64OrZero(toString(spons)))   AS ad_vol,
                       SUM(toFloat64OrZero(toString(organic))) AS org_vol,
                       SUM(toFloat64OrZero(toString(overall))) AS total_vol
                FROM rb_kw_olap
                WHERE DATE BETWEEN '${prevStartDate}' AND '${prevEndDate}'
                  AND brand IS NOT NULL AND brand != ''
                  AND ${buildCHCondition(filters.platform, 'platform_name')}
                  AND ${buildCHCondition(filters.city, 'location_name')}
                  AND ${buildCHCondition(filters.category, 'keyword_category', { isCategory: true })}
                GROUP BY brand, keyword_category
            )
        SELECT
            ck.brand                                                                    AS brandName,
            ck.keyword_category                                                         AS category,
            ROUND((ck.ad_vol  / nullIf(ck.total_vol, 0)) * 100, 2)                    AS currAdSos,
            ROUND((ck.org_vol / nullIf(ck.total_vol, 0)) * 100, 2)                    AS currOrgSos,
            ROUND((ifNull(pk.ad_vol, 0)  / nullIf(ifNull(pk.total_vol, 1), 0)) * 100, 2) AS prevAdSos,
            ROUND((ifNull(pk.org_vol, 0) / nullIf(ifNull(pk.total_vol, 1), 0)) * 100, 2) AS prevOrgSos
        FROM curr_kw ck
        LEFT JOIN prev_kw pk ON ck.brand = pk.brand AND ck.keyword_category = pk.keyword_category
    `;

    // -------------------------------------------------------------------------
    // QUERY DS1 — DARK STORE COVERAGE GAPS
    // Identifies cities/platforms with weak dark store listing coverage
    // -------------------------------------------------------------------------
    const darkStoreCoverageQuery = `
        WITH
            ds_stores AS (
                SELECT
                    LOWER(location) AS city,
                    LOWER(platform) AS platform,
                    COUNT(DISTINCT concat(toString(pincode), merchant_name)) AS total_stores
                FROM rb_location_darkstore
                WHERE pf_id IN (4, 6, 7)
                  AND status IN ('1', '2')
                  AND ${buildCHCondition(filters.platform, 'platform')}
                  AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('location'))}
                GROUP BY city, platform
            ),
            ds_listed AS (
                SELECT
                    ${CITY_NORM_EXPR('Location')} AS city,
                    LOWER(Platform) AS platform,
                    ${catField} AS category,
                    COUNT(DISTINCT LOWER(Web_Pid)) AS listed_skus,
                    SUM(neno_osa) AS neno_sum,
                    SUM(deno_osa) AS deno_sum,
                    SUM(toFloat64OrZero(toString(Sales))) AS total_sales
                FROM rb_pdp_olap
                WHERE toDate(DATE) BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND Comp_flag = 0
                  AND ${buildCHCondition(filters.platform, 'Platform')}
                  AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'))}
                  AND ${buildCHCondition(filters.category, catField, { isCategory: true })}
                GROUP BY city, platform, category
            ),
            ds_total_skus AS (
                SELECT
                    LOWER(Platform) AS platform,
                    ${catField} AS category,
                    COUNT(DISTINCT LOWER(Web_Pid)) AS total_platform_skus
                FROM rb_pdp_olap
                WHERE toDate(DATE) BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND Comp_flag = 0
                  AND ${buildCHCondition(filters.platform, 'Platform')}
                  AND ${buildCHCondition(filters.category, catField, { isCategory: true })}
                GROUP BY platform, category
            )
        SELECT
            s.city,
            s.platform,
            l.category,
            s.total_stores AS storeCount,
            ifNull(l.listed_skus, 0) AS listedSkus,
            ifNull(t.total_platform_skus, 0) AS totalPlatformSkus,
            ROUND(ifNull(l.listed_skus, 0) * 100.0 / nullIf(t.total_platform_skus, 0), 1) AS listingPct,
            ROUND(ifNull(l.neno_sum, 0) * 100.0 / nullIf(l.deno_sum, 0), 1) AS osa,
            ifNull(l.total_sales, 0) AS sales
        FROM ds_stores s
        LEFT JOIN ds_listed l ON s.city = l.city AND s.platform = l.platform
        LEFT JOIN ds_total_skus t ON l.platform = t.platform AND l.category = t.category
        WHERE s.total_stores > 0
        ORDER BY listingPct ASC, sales DESC
        LIMIT 50
    `;

    // -------------------------------------------------------------------------
    // QUERY DS2 — NEW DARK STORE EXPANSION
    // Identifies dark stores that appeared recently (within selected date range)
    // -------------------------------------------------------------------------
    const newDarkStoreQuery = `
        WITH
            new_stores AS (
                SELECT
                    LOWER(location) AS city,
                    LOWER(platform) AS platform,
                    region,
                    tier,
                    COUNT(DISTINCT concat(toString(pincode), merchant_name)) AS newStoreCount,
                    MIN(store_first_seen) AS earliestSeen
                FROM rb_location_darkstore
                WHERE pf_id IN (4, 6, 7)
                  AND status IN ('1', '2')
                  AND toDate(store_first_seen) BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND ${buildCHCondition(filters.platform, 'platform')}
                  AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('location'))}
                GROUP BY city, platform, region, tier
            ),
            city_listing AS (
                SELECT
                    ${CITY_NORM_EXPR('Location')} AS city,
                    LOWER(Platform) AS platform,
                    ${catField} AS category,
                    COUNT(DISTINCT LOWER(Web_Pid)) AS listed_skus,
                    SUM(neno_osa) AS neno_sum,
                    SUM(deno_osa) AS deno_sum,
                    SUM(toFloat64OrZero(toString(Sales))) AS total_sales
                FROM rb_pdp_olap
                WHERE toDate(DATE) BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND Comp_flag = 0
                  AND ${buildCHCondition(filters.platform, 'Platform')}
                  AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'))}
                  AND ${buildCHCondition(filters.category, catField, { isCategory: true })}
                GROUP BY city, platform, category
            ),
            total_skus AS (
                SELECT
                    LOWER(Platform) AS platform,
                    ${catField} AS category,
                    COUNT(DISTINCT LOWER(Web_Pid)) AS total_platform_skus
                FROM rb_pdp_olap
                WHERE toDate(DATE) BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND Comp_flag = 0
                  AND ${buildCHCondition(filters.platform, 'Platform')}
                  AND ${buildCHCondition(filters.category, catField, { isCategory: true })}
                GROUP BY platform, category
            ),
            comp_presence AS (
                SELECT
                    ${CITY_NORM_EXPR('Location')} AS city,
                    LOWER(Platform) AS platform,
                    arrayStringConcat(
                        groupUniqArray(Brand),
                        ', '
                    ) AS competitors
                FROM rb_pdp_olap
                WHERE toDate(DATE) BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND Comp_flag = 1
                  AND ${buildCHCondition(filters.platform, 'Platform')}
                  AND ${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'))}
                GROUP BY city, platform
            )
        SELECT
            ns.city,
            ns.platform,
            ns.region,
            ns.tier,
            cl.category,
            ns.newStoreCount,
            ns.earliestSeen,
            ifNull(cl.listed_skus, 0) AS listedSkus,
            ifNull(ts.total_platform_skus, 0) AS totalPlatformSkus,
            ROUND(ifNull(cl.listed_skus, 0) * 100.0 / nullIf(ts.total_platform_skus, 0), 1) AS listingPct,
            ROUND(ifNull(cl.neno_sum, 0) * 100.0 / nullIf(cl.deno_sum, 0), 1) AS osa,
            ifNull(cl.total_sales, 0) AS sales,
            ifNull(cp.competitors, '-') AS competitors
        FROM new_stores ns
        LEFT JOIN city_listing cl ON ns.city = cl.city AND ns.platform = cl.platform
        LEFT JOIN total_skus ts ON cl.platform = ts.platform AND cl.category = ts.category
        LEFT JOIN comp_presence cp ON ns.city = cp.city AND ns.platform = cp.platform
        ORDER BY ns.newStoreCount DESC, listingPct ASC
        LIMIT 50
    `;

    const safeQuery = async (query, label) => {
        try {
            return await queryClickHouse(query);
        } catch (err) {
            console.error(`[Insights] ${label} query failed:`, err.message);
            return [];
        }
    };

    try {
        // Check rb_ms_olap availability once before building the competitor OSA query
        const rbMsOlapExists = await checkRbMsOlapExists();
        const competitorOsaQuery = buildCompetitorOsaQuery(rbMsOlapExists);

        const [
            visData,
            visTotalsData,
            priceData,
            replData,
            adData,
            compData,
            removeAdLowOSAData,
            challengerData,
            perfData,
            ownShareRows,
            compShareRows,
            sosRows,
            surplusStockData,
            prioritisePOData,
            transferIssueData,
            newMarketEntryData,
            skuLossData,
            darkStoreCoverageData,
            newDarkStoreData
        ] = await Promise.all([
            safeQuery(visibilityQuery, 'Visibility'),
            safeQuery(visibilityTotalsQuery, 'VisibilityTotals'),
            safeQuery(buildPricingQuery(rbMsOlapExists), 'Pricing'),
            safeQuery(dsListingSummaryQuery, 'DSListingSummary'),
            safeQuery(adStockQuery, 'KeywordEfficiency'),
            safeQuery(competitorOsaQuery, 'CompetitorOSA'),
            safeQuery(removeAdLowOSAQuery, 'RemoveAdLowOSA'),
            // safeQuery(challengerLaunchQuery, 'ChallengerLaunch'),
            Promise.resolve([]),
            safeQuery(performanceQuery, 'Performance'),
            rbMsOlapExists ? safeQuery(ownShareQuery, 'OwnShare') : Promise.resolve([]),
            rbMsOlapExists ? safeQuery(compShareQuery, 'CompShare') : Promise.resolve([]),
            safeQuery(sosTrendQuery, 'SOSTrend'),
            safeQuery(surplusStockQuery, 'SurplusStock'),
            safeQuery(prioritisePOQuery, 'PrioritisePO'),
            safeQuery(transferIssueQuery, 'TransferIssue'),
            safeQuery(newMarketEntryQuery, 'NewMarketEntry'),
            rbMsOlapExists ? safeQuery(skuLossQuery, 'SkuLoss') : Promise.resolve([]),
            safeQuery(darkStoreCoverageQuery, 'DarkStoreCoverage'),
            safeQuery(newDarkStoreQuery, 'NewDarkStore')
        ]);

        // Build SKU loss maps from rb_pdp_olap for Share Headroom Hotspots
        // Key: city||platform||category → { skuName, webPid }
        // Built BEFORE image resolution so we can use web_pids directly
        const ownSkuLossMap = {};  // Our brand (comp_flag = 0)
        const compSkuLossMap = {}; // Competitor (comp_flag = 1)
        for (const r of (skuLossData || [])) {
            const cityKey = String(r.city || '').trim().toLowerCase();
            const platKey = String(r.platform || '').trim().toLowerCase();
            const catKey = String(r.category || '').trim().toLowerCase();
            const gKey = `${cityKey}||${platKey}||${catKey}`;
            const isComp = Number(r.comp_flag) === 1;
            const targetMap = isComp ? compSkuLossMap : ownSkuLossMap;
            // First row per key is the target SKU (own: most-losing via sales_delta ASC, comp: most-gaining via sales_delta DESC)
            const delta = Number(r.sales_delta) || 0;
            if (!targetMap[gKey]) {
                targetMap[gKey] = { skuName: r.skuName, webPid: r.web_pid ? String(r.web_pid) : null, delta };
            } else {
                // For competitors, we want the SKU with the HIGHEST positive growth
                if (isComp) {
                    if (delta > (targetMap[gKey].delta || 0)) {
                        targetMap[gKey] = { skuName: r.skuName, webPid: r.web_pid ? String(r.web_pid) : null, delta };
                    }
                } 
                // For our own brand, we want the SKU with the MOST negative impact (highest loss)
                else {
                    if (delta < (targetMap[gKey].delta || 0)) {
                        targetMap[gKey] = { skuName: r.skuName, webPid: r.web_pid ? String(r.web_pid) : null, delta };
                    }
                }
            }
        }

        // ── Parallelized image URL resolution for ALL signals ──
        // Optimized: Only mapping images from rb_sku_platform to improve performance.
        const pidImageMap = {};
        const productImageMap = {};

        try {
            const allKnownPids = new Set();
            const allProductNames = new Set();

            // ── Collect ALL directly-known web_pids and product names from signal data ──
            
            // From RemoveAdLowOSA
            for (const r of (removeAdLowOSAData || [])) {
                if (r.webPid) allKnownPids.add(String(r.webPid));
                if (r.skuOrBrand && r.skuOrBrand !== '-') allProductNames.add(r.skuOrBrand);
            }

            // From Share Headroom SKU loss maps
            for (const v of Object.values(ownSkuLossMap)) { 
                if (v.webPid) allKnownPids.add(String(v.webPid)); 
                if (v.skuName && v.skuName !== '-') allProductNames.add(v.skuName);
            }
            for (const v of Object.values(compSkuLossMap)) { 
                if (v.webPid) allKnownPids.add(String(v.webPid)); 
                if (v.skuName && v.skuName !== '-') allProductNames.add(v.skuName);
            }

            // From other signals
            for (const r of (surplusStockData || [])) { if (r.skuName && r.skuName !== '-') allProductNames.add(r.skuName); }
            for (const r of (prioritisePOData || [])) { if (r.skuName && r.skuName !== '-') allProductNames.add(r.skuName); }
            for (const r of (transferIssueData || [])) { if (r.skuName && r.skuName !== '-') allProductNames.add(r.skuName); }
            for (const r of (newMarketEntryData || [])) { if (r.skuName && r.skuName !== '-') allProductNames.add(r.skuName); }
            for (const r of (replData || [])) { if (r.skuName && r.skuName !== '-') allProductNames.add(r.skuName); }
            for (const r of (priceData || [])) {
                if (r.impactedSku && r.impactedSku !== '-') allProductNames.add(r.impactedSku);
                if (r.compSku && r.compSku !== '-') allProductNames.add(r.compSku);
            }

            const knownPidList = [...allKnownPids];
            const namesList = [...allProductNames].slice(0, 500); // Increased cap for direct metadata lookup

            const [pidImageRows, nameImageRows] = await Promise.all([
                // Query A: Fetch images by web_pid from rb_sku_platform
                knownPidList.length > 0
                    ? safeQuery(
                        `SELECT web_pid, image_url FROM rb_sku_platform WHERE web_pid IN (${knownPidList.map(p => `'${escapeCH(String(p))}'`).join(',')}) AND image_url IS NOT NULL AND image_url != ''`,
                        'ImageByPid'
                    )
                    : Promise.resolve([]),
                // Query B: Fetch images directly by sku_name from rb_sku_platform
                namesList.length > 0
                    ? safeQuery(
                        `SELECT sku_name, argMax(image_url, modified_on) AS image_url FROM rb_sku_platform WHERE sku_name IN (${namesList.map(n => `'${escapeCH(n)}'`).join(',')}) AND image_url IS NOT NULL AND image_url != '' GROUP BY sku_name`,
                        'ImageByName'
                    )
                    : Promise.resolve([])
            ]);

            // Populate maps
            for (const row of pidImageRows) {
                pidImageMap[String(row.web_pid)] = row.image_url;
            }
            const nameToImgMap = {};
            for (const row of nameImageRows) {
                nameToImgMap[row.sku_name] = row.image_url;
            }

            // Populate productImageMap (Priority: PID resolution if possible, else Name resolution)
            for (const name of allProductNames) {
                productImageMap[name] = nameToImgMap[name] || null;
            }

            // Final assignments for rows with explicit webPids
            for (const r of (removeAdLowOSAData || [])) {
                r.imageUrl = pidImageMap[String(r.webPid)] || null;
            }
        } catch (imgErr) {
            console.log('[Insights] Image resolution failed (non-critical):', imgErr.message);
        }

        // Build Performance Lookup (Sales & OSA)
        const perfMap = {};
        for (const r of perfData || []) {
            const key = `${String(r.city).toLowerCase()}||${String(r.platform).toLowerCase()}||${String(r.category).toLowerCase()}`;
            perfMap[key] = {
                sales: Number(r.currSales) || 0,
                prevSales: Number(r.prevSales) || 0,
                osa: Number(r.osa) || 100,
                salesDelta: (Number(r.currSales) || 0) - (Number(r.prevSales) || 0),
                salesDeltaPct: Number(r.prevSales) > 0 ? ((Number(r.currSales) - Number(r.prevSales)) / Number(r.prevSales) * 100) : 0
            };
        }

        // Build SOS lookup by brand and category
        const sosMap = {};
        for (const r of sosRows) {
            const key = `${String(r.brandName).toLowerCase()}||${String(r.category).toLowerCase()}`;
            sosMap[key] = {
                currAdSos: Number(r.currAdSos) || 0,
                currOrgSos: Number(r.currOrgSos) || 0,
                prevAdSos: Number(r.prevAdSos) || 0,
                prevOrgSos: Number(r.prevOrgSos) || 0,
                adSosChange: (Number(r.currAdSos) || 0) - (Number(r.prevAdSos) || 0),
                orgSosChange: (Number(r.currOrgSos) || 0) - (Number(r.prevOrgSos) || 0),
            };
        }

        // Granular maps for evidence table (City || Platform || Category)
        const granularMSMap = {};
        const categoryShareTotals = {};

        for (const r of ownShareRows) {
            const cityKey = String(r.city || "").toLowerCase();
            const platKey = String(r.platform || "").toLowerCase();
            const catKey = String(r.category || "").toLowerCase();
            const gKey = `${cityKey}||${platKey}||${catKey}`;
            const sosKey = `${String(r.brandName).toLowerCase()}||${catKey}`;
            const sos = sosMap[sosKey] || { currAdSos: 0, currOrgSos: 0, prevAdSos: 0, prevOrgSos: 0, adSosChange: 0, orgSosChange: 0 };

            granularMSMap[gKey] = {
                brandName: r.brandName,
                category: r.category,
                city: r.city,
                platform: r.platform,
                topSku: r.topSku,
                currSharePct: Number(r.currSharePct) || 0,
                prevSharePct: Number(r.prevSharePct) || 0,
                shareChangePpt: Number(r.shareChangePpt) || 0,
                ...sos
            };

            // Aggregate for category totals (Sum volumes first, then calculate share)
            if (!categoryShareTotals[catKey]) {
                categoryShareTotals[catKey] = {
                    brandName: r.brandName, category: r.category, topSku: r.topSku,
                    brandSales: 0, prevBrandSales: 0, totalMarketSales: 0, prevTotalMarketSales: 0
                };
            }
            categoryShareTotals[catKey].brandSales += (Number(r.brandSales) || 0);
            categoryShareTotals[catKey].prevBrandSales += (Number(r.prevBrandSales) || 0);
            categoryShareTotals[catKey].totalMarketSales += (Number(r.totalMarketSales) || 0);
            categoryShareTotals[catKey].prevTotalMarketSales += (Number(r.prevTotalMarketSales) || 0);
        }

        const categoryShareMap = {};
        Object.keys(categoryShareTotals).forEach(catKey => {
            const t = categoryShareTotals[catKey];
            const currShare = t.totalMarketSales > 0 ? (t.brandSales / t.totalMarketSales) * 100 : 0;
            const prevShare = t.prevTotalMarketSales > 0 ? (t.prevBrandSales / t.prevTotalMarketSales) * 100 : 0;

            categoryShareMap[catKey] = {
                ...t,
                currSharePct: Number(currShare.toFixed(2)),
                prevSharePct: Number(prevShare.toFixed(2)),
                shareChangePpt: Number((currShare - prevShare).toFixed(2))
            };
        });

        const granularThreatMap = {};
        for (const r of compShareRows) {
            const cityKey = String(r.city || "").toLowerCase();
            const platKey = String(r.platform || "").toLowerCase();
            const catKey = String(r.category || "").toLowerCase();
            const gKey = `${cityKey}||${platKey}||${catKey}`;

            if (granularThreatMap[gKey]) continue;

            const sosKey = `${String(r.brandName).toLowerCase()}||${catKey}`;
            const sos = sosMap[sosKey] || { currAdSos: 0, currOrgSos: 0, prevAdSos: 0, prevOrgSos: 0, adSosChange: 0, orgSosChange: 0 };

            let primaryDriver = 'organic';
            if (sos.adSosChange > 0 && sos.orgSosChange > 0) {
                primaryDriver = sos.adSosChange >= sos.orgSosChange ? 'ad' : 'organic';
            } else if (sos.adSosChange > 0) primaryDriver = 'ad';

            const ownMS = granularMSMap[gKey] || { currSharePct: 0 };

            granularThreatMap[gKey] = {
                brandName: r.brandName,
                category: r.category,
                topSku: r.topSku,
                currSharePct: Number(r.currSharePct) || 0,
                prevSharePct: Number(r.prevSharePct) || 0,
                shareChangePpt: Number(r.shareChangePpt) || 0,
                overtook: (Number(r.currSharePct) || 0) > ownMS.currSharePct,
                shareAheadBy: Number(((Number(r.currSharePct) || 0) - ownMS.currSharePct).toFixed(2)),
                ...sos,
                primaryDriver
            };
        }

        const categoryThreatTotals = {};
        for (const r of compShareRows) {
            // Group by brand + category to get total view of a competitor across filtered areas
            const bKey = `${String(r.brandName).toLowerCase()}||${String(r.category).toLowerCase()}`;
            if (!categoryThreatTotals[bKey]) {
                categoryThreatTotals[bKey] = {
                    brandName: r.brandName, category: r.category, topSku: r.topSku,
                    brandSales: 0, prevBrandSales: 0, totalMarketSales: 0, prevTotalMarketSales: 0
                };
            }
            categoryThreatTotals[bKey].brandSales += (Number(r.brandSales) || 0);
            categoryThreatTotals[bKey].prevBrandSales += (Number(r.prevBrandSales) || 0);
            categoryThreatTotals[bKey].totalMarketSales += (Number(r.totalMarketSales) || 0);
            categoryThreatTotals[bKey].prevTotalMarketSales += (Number(r.prevTotalMarketSales) || 0);
        }

        const categoryThreatMap = {};
        Object.keys(categoryThreatTotals).forEach(bKey => {
            const t = categoryThreatTotals[bKey];
            const currShare = t.totalMarketSales > 0 ? (t.brandSales / t.totalMarketSales) * 100 : 0;
            const prevShare = t.prevTotalMarketSales > 0 ? (t.prevBrandSales / t.prevTotalMarketSales) * 100 : 0;

            categoryThreatMap[bKey] = {
                ...t,
                currSharePct: Number(currShare.toFixed(2)),
                prevSharePct: Number(prevShare.toFixed(2)),
                shareChangePpt: Number((currShare - prevShare).toFixed(2))
            };
        });

        // Build the enriched trendData payload
        const trendData = {
            categoryShareMap,
            categoryThreatMap,
            granularMSMap,
            granularThreatMap,
            ownBrand: Object.values(categoryShareMap)[0] || null,
            competitors: Object.values(categoryThreatMap),
            topThreat: Object.values(categoryThreatMap)[0] || null,
        };


        // ---------------------------------------------------------------------
        // SIGNAL 1 — Share Headroom Hotspots
        // ---------------------------------------------------------------------
        if (!filters.signal || filters.signal === 'All signals' || filters.signal === 'Share Headroom Hotspots') {
            const hasData = perfData && perfData.length > 0;
            const vis = {
                overall_sos: Number(visTotalsData?.[0]?.overall_sos) || 0,
                ad_sos: Number(visTotalsData?.[0]?.ad_sos) || 0,
                org_sos: Number(visTotalsData?.[0]?.org_sos) || 0
            };

            // 1. Map over performance data to calculate PSL (Potential Sales Loss) and MoM gaps
            let lossRecords = (perfData || []).map(perf => {
                const cityKey = String(perf.city || "").trim().toLowerCase();
                const platKey = String(perf.platform || "").trim().toLowerCase();
                const catKey = String(perf.category || "").trim().toLowerCase();
                const gKey = `${cityKey}||${platKey}||${catKey}`;

                // Use granular share, fallback to category-wide average, then try partial key
                let catShare = trendData.granularMSMap[gKey] || trendData.categoryShareMap[catKey];
                let threat = trendData.granularThreatMap[gKey] || trendData.categoryThreatMap[catKey];

                // Fallback: if full key failed, try matching by city+platform (partial match)
                if (!catShare) {
                    const partialPrefix = `${cityKey}||${platKey}||`;
                    const matchKey = Object.keys(trendData.granularMSMap).find(k => k.startsWith(partialPrefix));
                    if (matchKey) catShare = trendData.granularMSMap[matchKey];
                }
                if (!threat) {
                    const partialPrefix = `${cityKey}||${platKey}||`;
                    const matchKey = Object.keys(trendData.granularThreatMap).find(k => k.startsWith(partialPrefix));
                    if (matchKey) threat = trendData.granularThreatMap[matchKey];
                }

                const headroomInr = Math.max(0, (Number(perf.currSales) / (Math.max(Number(perf.osa), 20) / 100)) - Number(perf.currSales));
                const prevSales = Number(perf.prevSales) || 0;
                const osaValue = Number(perf.osa) || 0;
                const prevOsaValue = Number(perf.prevOsa) || 0;
                const offtakeDelta = (Number(perf.currSales) || 0) - prevSales;
                const offtakeMoM = prevSales > 0 ? ((Number(perf.currSales) - prevSales) / prevSales) * 100 : 0;
                const osaChange = prevOsaValue > 0 ? osaValue - prevOsaValue : 0;
                const mkShareMoM = catShare ? catShare.shareChangePpt : 0;

                let possibleCause = "-";
                if (mkShareMoM < 0) {
                    possibleCause = "Market share under pressure from competing brands";
                } else if (osaChange < 0) {
                    possibleCause = "Low shelf availability impacting conversion and sales";
                }

                return {
                    category: perf.category,
                    city: perf.city,
                    platform: perf.platform,
                    brandOsa: osaValue,
                    brandOsaDelta: osaChange,
                    psl: headroomInr,
                    headroomInr: headroomInr,
                    marketShare: catShare ? catShare.currSharePct : 0,
                    marketShareMoM: mkShareMoM,
                    offtake: Number(perf.currSales) || 0,
                    offtakeMoM: offtakeMoM,
                    offtakeDelta: offtakeDelta,
                    appCategory: perf.category,
                    myTopSku: ownSkuLossMap[gKey]?.skuName || "-",
                    myTopSkuImageUrl: (ownSkuLossMap[gKey]?.webPid ? pidImageMap[ownSkuLossMap[gKey].webPid] : productImageMap[ownSkuLossMap[gKey]?.skuName]) || null,
                    competitorSku: compSkuLossMap[gKey]?.skuName || "-",
                    competitorSkuImageUrl: (compSkuLossMap[gKey]?.webPid ? pidImageMap[compSkuLossMap[gKey].webPid] : productImageMap[compSkuLossMap[gKey]?.skuName]) || null,
                    possibleCause: possibleCause,
                    topThreat: threat ? threat.brandName : 'N/A',
                    threatShare: threat ? threat.currSharePct : 0,
                    threatChange: threat ? threat.shareChangePpt : 0
                };
            });

            // 2. Filter allowed cities and sort globally
            let baseEvidence = lossRecords
                .filter(r => 
                    r.city !== '-' && 
                    String(r.city).toLowerCase() !== 'other' && 
                    isAllowedCity(r.city) && 
                    (r.headroomInr > 0 || r.offtake > 0) &&
                    r.offtakeDelta < 0 &&
                    r.offtakeMoM < 0 && 
                    r.brandOsa > 0
                )
                .sort((a, b) => b.psl - a.psl);
                
            // 3. Limit to top 5 per category
            const groupedByCategory = {};
            baseEvidence.forEach(r => {
                if (!groupedByCategory[r.category]) {
                    groupedByCategory[r.category] = [];
                }
                if (groupedByCategory[r.category].length < 5) {
                    groupedByCategory[r.category].push(r);
                }
            });
            
            let evidence = Object.values(groupedByCategory)
                .flat()
                .sort((a, b) => b.psl - a.psl);

            // Fallback if no relevant data found
            if (evidence.length === 0) {
                evidence = [{ city: '-', platform: '-', category: '-', lossValue: 0, brandOsa: 0, marketShare: 0, marketShareMoM: 0, psl: 0, offtake: 0, offtakeMoM: 0, offtakeDelta: 0, myTopSku: '-', competitorSku: '-', possibleCause: '-', headroomInr: 0 }];
            }

            const totalImpact = evidence.reduce((sum, e) => sum + (e.psl || 0), 0);

            let title1 = "No visibility anomalies detected";
            if (hasData && evidence.length > 0 && evidence[0].city !== '-') {
                if (vis.org_sos < 10 && vis.ad_sos > 30) {
                    title1 = `Critical visibility drop: Relying heavily on Paid (${vis.ad_sos}%) as Organic falls to ${vis.org_sos}%`;
                } else if (vis.overall_sos < 20 && vis.overall_sos > 0) {
                    title1 = `Deteriorating shelf visibility; overall SOS at ${vis.overall_sos}%`;
                } else if (totalImpact > 10000) {
                    title1 = `Significant headroom of ₹${Math.round(totalImpact).toLocaleString('en-IN')} across top cities`;
                } else {
                    title1 = "Deteriorating Organic & Sponsored shelf visibility across top categories";
                }
            }

            insights.push({
                id: "dyn_vis_1",
                type: "Share Headroom Hotspots",
                title: title1,
                family: "Market",
                platforms: hasData ? [...new Set(perfData.map(v => v.platform))] : ["-"],
                city: filters.city !== "All cities" ? filters.city : "Multi-city",
                category: filters.category !== "All categories" ? filters.category : "Overall",
                impactInr: totalImpact,
                impactLabel: "Headroom",
                brandName: brandLabel,
                dateRange: { from: dateFrom, to: dateTo },
                kpis: [],
                whatWeSee: [],
                evidence,
                aiTrendData: trendData,
            });
        }

        // ---------------------------------------------------------------------
        // SIGNAL 2 — Price Parity Radar
        // ---------------------------------------------------------------------
        if (!filters.signal || filters.signal === 'All signals' || filters.signal === 'Price Parity Radar') {
            // Filter to only allowed cities
            console.log(`[Insights] Price Parity raw rows: ${(priceData || []).length}, cities:`, (priceData || []).map(p => p.city));
            const cityFilteredPriceData = (priceData || []).filter(p => isAllowedCity(p.city));
            console.log(`[Insights] Price Parity after city filter: ${cityFilteredPriceData.length}`);
            const hasData = cityFilteredPriceData.length > 0;
            const topRow = hasData ? cityFilteredPriceData[0] : { gapPct: 0, ourPpu: 0, compPpu: 0 };

            const evidence = hasData ? cityFilteredPriceData.slice(0, 10).map(p => ({
                city: p.city,
                platform: p.platform,
                category: p.category,
                ourPpu: Number(p.ourPpu) || 0,
                compPpu: Number(p.compPpu) || 0,
                impactedSku: p.impactedSku || '-',
                impactedSkuImageUrl: productImageMap[p.impactedSku] || null,
                compSku: p.compSku || '-',
                compSkuImageUrl: productImageMap[p.compSku] || null,
                gapPct: Number(p.gapPct) || 0,
                gapPctChange: Number(p.gapPctChange) || 0,
                ourPpuChange: Number(p.ourPpuChange) || 0,
                compPpuChange: Number(p.compPpuChange) || 0,
                psl: Number(p.psl) || 0,
            })) : [{ city: '-', platform: '-', category: '-', ourPpu: 0, compPpu: 0, impactedSku: '-', compSku: '-', gapPct: 0, psl: 0 }];

            const totalImpact = hasData ? evidence.reduce((sum, e) => sum + Math.abs(e.psl || 0), 0) : 0;

            let title2 = "No pricing anomalies detected";
            if (hasData) {
                const maxGap = Number(topRow.gapPct) || 0;
                if (maxGap > 20) {
                    title2 = `Severe price gap: ${brandLabel} PPU is ${maxGap.toFixed(1)}% above competitor in ${topRow.city}`;
                } else if (maxGap > 10) {
                    title2 = `Price gap of ${maxGap.toFixed(1)}% above competitor PPU detected; conversion risk in ${cityFilteredPriceData.length} city-category combos`;
                } else if (maxGap < -10) {
                    title2 = `${brandLabel} is priced ${Math.abs(maxGap).toFixed(1)}% below competitor; potential margin leakage`;
                } else {
                    title2 = "Price parity variations detected across city-category combinations";
                }
            }

            insights.push({
                id: "dyn_price_1",
                type: "Price Parity Radar",
                title: title2,
                family: "Pricing",
                platforms: hasData ? [...new Set(cityFilteredPriceData.map(p => p.platform))] : ["-"],
                city: filters.city !== "All cities" ? filters.city : "Multi-city",
                category: filters.category !== "All categories" ? filters.category : "Overall",
                impactInr: totalImpact,
                impactLabel: "Headroom",
                brandName: brandLabel,
                dateRange: { from: dateFrom, to: dateTo },
                kpis: [],
                whatWeSee: hasData ? [
                    `${brandLabel} PPU differs from competitor PPU across ${cityFilteredPriceData.length} city-category combinations.`,
                ] : ["-", "-"],
                evidence,
            });
        }

        // ---------------------------------------------------------------------
        // SIGNAL 3 — DS Listing Summary
        // Identifies own-brand SKUs with weak dark store coverage. Shows
        // priority localities, estimated category sales, competitor presence,
        // and a possible cause for the listing gap.
        // ---------------------------------------------------------------------
        if (!filters.signal || filters.signal === 'All signals' || filters.signal === 'DS Listing Summary') {
            const filteredRepl = (replData || []).filter(r => isAllowedCity(r.city));
            const hasData = filteredRepl.length > 0;

            const totalPriorityLocalities = hasData
                ? filteredRepl.reduce((s, r) => s + Number(r.priorityLocalities || 0), 0)
                : 0;
            const avgOsa = hasData
                ? filteredRepl.reduce((s, r) => s + Number(r.osa || 0), 0) / filteredRepl.length
                : 0;
            const totalCatSales = hasData
                ? filteredRepl.reduce((s, r) => s + Number(r.categorySales || 0), 0)
                : 0;
            const uniqueCities = hasData ? new Set(filteredRepl.map(r => r.city)).size : 0;
            const uniqueSkus = hasData ? new Set(filteredRepl.map(r => r.skuName)).size : 0;

            // Impact estimate: lost sales from missing localities
            const impact = hasData
                ? filteredRepl.reduce((s, r) => {
                    const pLoc = Number(r.priorityLocalities || 0);
                    const tDS = Number(r.totalDarkStores || 1);
                    const sales = Number(r.skuSales || 0);
                    // Estimate: if we were listed in priority localities, we'd proportionally get more sales
                    return s + (pLoc > 0 && tDS > 0 ? (sales / Math.max(tDS - pLoc, 1)) * pLoc : 0);
                }, 0)
                : 0;

            let title3 = "No dark store listing issues detected";
            if (hasData) {
                if (avgOsa < 50) {
                    title3 = `Critical DS listing gap: ${uniqueSkus} SKUs missing from ${totalPriorityLocalities} priority localities across ${uniqueCities} cities`;
                } else if (avgOsa < 80) {
                    title3 = `${uniqueSkus} SKUs under-listed across ${totalPriorityLocalities} dark store localities — ${avgOsa.toFixed(1)}% avg OSA`;
                } else {
                    title3 = `${uniqueSkus} SKUs have listing coverage gaps in ${uniqueCities} cities`;
                }
            }

            // Infer possible cause for each row
            const inferCause = (r) => {
                const osa = Number(r.osa || 0);
                const inv = Number(r.avgInventory || 0);
                const pLoc = Number(r.priorityLocalities || 0);
                const tLoc = Number(r.totalLocalities || 0);
                if (inv < 5 && osa < 40) return 'Fix transfer issue';
                if (tLoc === 0 || pLoc >= Number(r.totalDarkStores || 1) * 0.8) return 'New market - no listing';
                if (osa < 60) return 'Low availability';
                return 'Fix transfer issue';
            };

            insights.push({
                id: "dyn_ds_listing_1",
                type: "DS Listing Summary",
                title: title3,
                family: "Dark Store",
                platforms: hasData ? [...new Set(filteredRepl.map(r => r.platform))] : ["-"],
                city: filters.city !== "All cities" ? filters.city : "Multi-city",
                category: filters.category !== "All categories" ? filters.category : "Overall",
                impactInr: Math.round(impact),
                impactLabel: "Potential Sales Loss",
                brandName: brandLabel,
                dateRange: { from: dateFrom, to: dateTo },
                kpis: [
                    { label: "Priority Localities", value: `${totalPriorityLocalities}` },
                    { label: "Affected SKUs", value: `${uniqueSkus}` },
                    { label: "Avg OSA", value: `${avgOsa.toFixed(1)}%` },
                ],
                whatWeSee: hasData ? [
                    `${uniqueSkus} SKUs are missing from ${totalPriorityLocalities} priority dark store localities across ${uniqueCities} cities.`,
                    `Estimated category sales in these localities: ₹${Math.round(totalCatSales).toLocaleString('en-IN')}.`,
                ] : ["-", "-"],
                evidence: hasData ? filteredRepl.map(r => ({
                    skuName: r.skuName || '-',
                    city: r.city || '-',
                    platform: r.platform || '-',
                    category: r.category || '-',
                    imageUrl: productImageMap[r.skuName] || null,
                    priorityLocalities: Number(r.priorityLocalities) || 0,
                    categorySales: Number(r.categorySales) || 0,
                    competitors: r.competitors || '-',
                    osa: Number(r.osa) || 0,
                    possibleCause: inferCause(r),
                    totalDarkStores: Number(r.totalDarkStores) || 0,
                    totalLocalities: Number(r.totalLocalities) || 0,
                    skuSales: Number(r.skuSales) || 0,
                })) : [{ skuName: '-', city: '-', platform: '-', category: '-', priorityLocalities: 0, categorySales: 0, competitors: '-', osa: 0, possibleCause: '-' }],
            });
        }

        // ---------------------------------------------------------------------
        // SIGNAL 4 — Keyword Efficiency and Budget Caps
        // ---------------------------------------------------------------------
        if (false && (!filters.signal || filters.signal === 'All signals' || filters.signal === 'Keyword Efficiency and Budget Caps')) {
            const hasData = adData.length > 0;
            const avgRoas = hasData
                ? (adData.reduce((sum, a) => sum + Number(a.roas), 0) / adData.length).toFixed(2)
                : "0";
            const impact = hasData
                ? adData.reduce((sum, a) => sum + Number(a.total_spend), 0)
                : 0;

            let title4 = "No keyword efficiency issues detected";
            if (hasData) {
                if (Number(avgRoas) < 1.0 && impact > 5000) {
                    title4 = `Critical Ad Waste: ₹${impact.toLocaleString('en-IN')} spend leaking on ${adData.length} keywords with poor ROAS (${avgRoas})`;
                } else {
                    title4 = `Spend is leaking on ${adData.length} keywords with poor ROAS (${avgRoas}) and low OSA`;
                }
            }

            insights.push({
                id: "dyn_ad_1",
                type: "Keyword Efficiency and Budget Caps",
                title: title4,
                family: "Performance",
                platforms: hasData ? [...new Set(adData.map(a => a.platform))] : ["-"],
                city: filters.city !== "All cities" ? filters.city : "Multi-city",
                category: filters.category !== "All categories" ? filters.category : "Overall",
                impactInr: impact,
                impactLabel: "Ad Waste",
                brandName: brandLabel,
                dateRange: { from: dateFrom, to: dateTo },
                kpis: [
                    { label: "Waste keywords", value: hasData ? adData.length.toString() : "0" },
                    { label: "Avg ROAS", value: avgRoas },
                ],
                whatWeSee: hasData ? [
                    "Performance marketing is driving traffic to keywords with critically low availability.",
                    "Ad waste is accumulating due to poor conversion on these terms.",
                ] : ["-", "-"],
                evidence: hasData ? adData.map(a => ({
                    keyword: a.keyword,
                    platform: a.platform,
                    city: a.city,
                    category: a.category,
                    campaign: `Primary | ${a.platform} | Target`,
                    bid: Number(a.total_spend) / (Number(a.total_sales) || 1),
                    dailyBudget: Number(a.total_spend) * 1.5,
                    spend: Number(a.total_spend),
                    sales: Number(a.total_sales),
                    acos: a.acos != null ? Number(a.acos) : (a.roas > 0 ? (1 / a.roas) * 100 : 0),
                    acosChangePct: Number(a.acosChangePct) || 0,
                    budgetCapped: Number(a.roas) < 2.0,
                })) : [{ keyword: '-', platform: '-', city: '-', category: '-', campaign: '-', bid: 0, dailyBudget: 0, spend: 0, sales: 0, acos: 0, budgetCapped: false }],
            });
        }

        // ---------------------------------------------------------------------
        // SIGNAL 5 — Competitor OSA Weak Spots
        // ---------------------------------------------------------------------
        if (!filters.signal || filters.signal === 'All signals' || filters.signal === 'Competitor OSA Weak Spots') {
            const hasData = compData && compData.length > 0;

            const uniqueCities = hasData ? new Set(compData.map(c => c.city)).size : 0;
            const uniquePlatforms = hasData ? [...new Set(compData.map(c => c.platform))] : ["-"];
            const avgKwOsa = hasData ? compData.reduce((sum, c) => sum + Number(c.kwOsa), 0) / compData.length : 0;
            const avgOtherOsa = hasData ? compData.reduce((sum, c) => sum + Number(c.otherBrandOsa), 0) / compData.length : 0;
            const totalPsl = hasData ? compData.reduce((sum, c) => sum + Number(c.psl || 0), 0) : 0;

            const worstRow = hasData ? compData[0] : { skuOrBrand: '-', category: '-', otherBrandOsa: 0 };
            const worstCompetitor = worstRow.skuOrBrand || '-';
            const dominantCat = worstRow.category || '-';

            let title5 = "No competitor OSA weak spots detected";
            if (hasData) {
                if (Number(worstRow.otherBrandOsa) < 50) {
                    title5 = `Major vulnerability: ${worstCompetitor} is severely out of stock (${Number(worstRow.otherBrandOsa).toFixed(1)}%), ${brandLabel} can capture share quickly`;
                } else {
                    title5 = `${worstCompetitor} is frequently out of stock (${Number(worstRow.otherBrandOsa).toFixed(1)}%), ${brandLabel} can capture share quickly`;
                }
            }

            insights.push({
                id: "dyn_comp_osa_1",
                type: "Competitor OSA Weak Spots",
                title: title5,
                family: "Performance",
                platforms: uniquePlatforms,
                city: filters.city !== "All cities" ? filters.city : (hasData ? `${uniqueCities} Cities` : "-"),
                category: filters.category !== "All categories" ? filters.category : dominantCat,
                impactInr: Math.round(totalPsl),
                impactLabel: "Headroom",
                brandName: brandLabel,
                dateRange: { from: dateFrom, to: dateTo },
                kpis: [
                    { label: "Other brand OSA", value: `${avgOtherOsa.toFixed(1)}%` },
                    { label: `${brandLabel} OSA`, value: `${avgKwOsa.toFixed(1)}%` },
                    { label: "Cities", value: uniqueCities.toString() },
                ],
                whatWeSee: hasData ? [
                    `${worstCompetitor} is missing on key ${dominantCat} searches (${Number(worstRow.otherBrandOsa).toFixed(0)}% OSA), creating an easy share-grab window.`,
                    `${brandLabel} is in stock (${avgKwOsa.toFixed(0)}% OSA), so conversion is mostly limited by visibility, not supply.`,
                ] : ["-", "-"],
                evidence: hasData ? compData.map(c => ({
                    category: c.category,
                    city: c.city,
                    platform: c.platform,
                    skuOrBrand: c.skuOrBrand,
                    imageUrl: productImageMap[c.skuOrBrand] || null,
                    otherBrandOsa: Number(c.otherBrandOsa),
                    otherBrandOsaChangePct: Number(c.otherBrandOsaChangePct) || 0,
                    otherBrandMkShare: c.otherBrandMkShare != null ? Number(c.otherBrandMkShare) : null,
                    otherBrandMkShareChange: c.otherBrandMkShareChange != null ? Number(c.otherBrandMkShareChange) : null,
                    kwOsa: Number(c.kwOsa),
                    kwOsaChangePct: Number(c.kwOsaChangePct) || 0,
                    ourBrandMkShare: c.ourBrandMkShare != null ? Number(c.ourBrandMkShare) : null,
                    ourBrandMkShareChange: c.ourBrandMkShareChange != null ? Number(c.ourBrandMkShareChange) : null,
                    gapPct: Number(c.gapPct) || 0,
                    headroomInr: Number(c.psl || 0),
                })) : [{ category: '-', city: '-', platform: '-', skuOrBrand: '-', otherBrandOsa: 0, otherBrandMkShare: null, kwOsa: 0, ourBrandMkShare: null, gapPct: 0, headroomInr: 0 }],
            });
        }


        // ---------------------------------------------------------------------
        // SIGNAL 6 — Remove Ad Low OSA
        // ---------------------------------------------------------------------
        if (!filters.signal || filters.signal === 'All signals' || filters.signal === 'Remove Ad Low OSA') {
            const hasData = removeAdLowOSAData.length > 0;
            const totalSpend = hasData ? removeAdLowOSAData.reduce((s, r) => s + Number(r.spendInr), 0) : 0;
            const totalLost = hasData ? removeAdLowOSAData.reduce((s, r) => s + Number(r.estLostSalesInr || 0), 0) : 0;
            const avgOsa = hasData ? removeAdLowOSAData.reduce((s, r) => s + Number(r.kwOsa), 0) / removeAdLowOSAData.length : 0;
            const avgSov = hasData ? removeAdLowOSAData.reduce((s, r) => s + Number(r.adSov), 0) / removeAdLowOSAData.length : 0;

            let title6 = "No Low OSA Ad hotspots detected";
            if (hasData) {
                if (avgOsa < 50 && totalSpend > 5000) {
                    title6 = `Critical Ad Waste: ₹${Math.round(totalSpend).toLocaleString('en-IN')} spend driving traffic to SKUs with severe low availability (${avgOsa.toFixed(1)}%)`;
                } else {
                    title6 = `Ad spend (₹${Math.round(totalSpend).toLocaleString('en-IN')}) is driving traffic to SKUs with low on-shelf availability (${avgOsa.toFixed(1)}%)`;
                }
            }

            insights.push({
                id: "dyn_adstock_1",
                type: "Remove Ad Low OSA",
                title: title6,
                family: "Performance",
                platforms: hasData ? [...new Set(removeAdLowOSAData.map(r => r.platform))] : ["-"],
                city: filters.city !== "All cities" ? filters.city : "Multi-city",
                category: filters.category !== "All categories" ? filters.category : "Overall",
                impactInr: Math.round(totalLost),
                impactLabel: "Est. Lost Sales",
                brandName: brandLabel,
                dateRange: { from: dateFrom, to: dateTo },
                kpis: [
                    { label: `${brandLabel} OSA (avg)`, value: `${avgOsa.toFixed(1)}%` },
                    { label: "Ad SOV", value: `${avgSov.toFixed(1)}%` },
                    { label: "Spend", value: `₹${totalSpend.toLocaleString('en-IN')}` },
                ],
                whatWeSee: hasData ? [
                    "Ad budget is actively sending shoppers to listings that frequently show out-of-stock.",
                    "Fixing OSA before increasing bids would convert the existing spend far more efficiently.",
                ] : ["-", "-"],
                evidence: hasData ? removeAdLowOSAData.filter(r => isAllowedCity(r.city)).map(r => ({
                    city: r.city,
                    platform: r.platform,
                    category: r.category,
                    skuOrBrand: r.skuOrBrand,
                    kwOsa: Number(r.kwOsa),
                    adSov: Number(r.adSov),
                    kwOsaChangePct: Number(r.kwOsaChangePct),
                    adSovChangePct: Number(r.adSovChangePct),
                    spendInr: Number(r.spendInr),
                    estLostSalesInr: Number(r.estLostSalesInr || 0),
                    imageUrl: r.imageUrl || null,
                })) : [{ city: '-', platform: '-', category: '-', skuOrBrand: '-', kwOsa: 0, adSov: 0, spendInr: 0, estLostSalesInr: 0, imageUrl: null }],
            });
        }

        // ---------------------------------------------------------------------
        // SIGNAL 7 — Challenger Launch Watch
        // ---------------------------------------------------------------------
        /*
        if (!filters.signal || filters.signal === 'All signals' || filters.signal === 'Challenger Launch Watch') {
            const hasData = challengerData.length > 0;
            const top = hasData ? challengerData[0] : {};

            let title7 = "No new challenger launches detected";
            if (hasData) {
                if (challengerData.length > 3) {
                    title7 = `High threat: ${challengerData.length} new challenger SKUs detected, led by ${top.skuOrBrand} (${Number(top.newItemShare).toFixed(1)}% share)`;
                } else {
                    title7 = `New challenger ${top.skuOrBrand} detected capturing ${Number(top.newItemShare).toFixed(1)}% organic share`;
                }
            }

            insights.push({
                id: "dyn_challenger_1",
                type: "Challenger Launch Watch",
                title: title7,
                family: "Competitive",
                platforms: hasData ? [...new Set(challengerData.map(r => r.platform))] : ["-"],
                city: filters.city !== "All cities" ? filters.city : "Multi-city",
                category: filters.category !== "All categories" ? filters.category : (top.category || "Overall"),
                impactInr: 0,
                impactLabel: "Watch",
                brandName: brandLabel,
                kpis: [
                    { label: "Share", value: hasData ? `${Number(top.newItemShare).toFixed(1)}%` : "0%" },
                    { label: "First seen", value: hasData ? String(top.firstSeen) : "-" },
                    { label: "PPU", value: hasData ? `₹${top.ppu}` : "0" },
                ],
                whatWeSee: hasData ? [
                    `${challengerData.length} new competitor SKU(s) entered your category within the selected window.`,
                    `The fastest-growing challenger (${top.skuOrBrand}) is already capturing ${Number(top.newItemShare).toFixed(1)}% organic share.`,
                ] : ["-", "-"],
                evidence: hasData ? challengerData.filter(r => isAllowedCity(r.city)).map(r => ({
                    city: r.city,
                    platform: r.platform,
                    category: r.category,
                    skuOrBrand: r.skuOrBrand,
                    productName: r.productName || r.skuOrBrand,
                    newItemShare: Number(r.newItemShare),
                    newItemShareChangePct: Number(r.newItemShareChangePct) || 0,
                    ppu: Number(r.ppu),
                    firstSeen: String(r.firstSeen),
                })) : [{ city: '-', platform: '-', category: '-', skuOrBrand: '-', newItemShare: 0, ppu: 0, firstSeen: '-' }],
            });
        }
        */

        // ---------------------------------------------------------------------
        // SIGNAL 8 — Surplus Stock (from rb_po_olap)
        // ---------------------------------------------------------------------
        if (!filters.signal || filters.signal === 'All signals' || filters.signal === 'Surplus Stock') {
            const filteredData = (surplusStockData || []).filter(r => isAllowedCity(r.city));
            const hasData = filteredData.length > 0;
            const totalExcessValue = hasData ? filteredData.reduce((s, r) => s + Number(r.excessInventoryValue || 0), 0) : 0;
            const avgDOI = hasData ? filteredData.reduce((s, r) => s + Number(r.excessDOI || 0), 0) / filteredData.length : 0;
            const totalOpenPO = hasData ? filteredData.reduce((s, r) => s + Number(r.openPOQty || 0), 0) : 0;

            let title8 = "No surplus stock detected";
            if (hasData) {
                if (totalExcessValue > 100000) {
                    title8 = `₹${Math.round(totalExcessValue).toLocaleString('en-IN')} excess inventory value across ${filteredData.length} SKUs with avg ${avgDOI.toFixed(0)} days DOI`;
                } else {
                    title8 = `${filteredData.length} SKU(s) carrying surplus stock with DOI exceeding 100 days`;
                }
            }

            insights.push({
                id: "dyn_surplus_1",
                type: "Surplus Stock",
                title: title8,
                family: "Supply",
                platforms: hasData ? [...new Set(filteredData.map(r => r.platform))] : ["-"],
                city: filters.city !== "All cities" ? filters.city : "Multi-city",
                category: filters.category !== "All categories" ? filters.category : "Overall",
                impactInr: Math.round(totalExcessValue),
                impactLabel: "Excess Inventory",
                brandName: brandLabel,
                dateRange: { from: dateFrom, to: dateTo },
                kpis: [
                    { label: "Avg DOI", value: `${avgDOI.toFixed(0)} days` },
                    { label: "Affected SKUs", value: hasData ? `${filteredData.length}` : "0" },
                    { label: "Open PO Qty", value: hasData ? `${Math.round(totalOpenPO).toLocaleString('en-IN')}` : "0" },
                ],
                whatWeSee: hasData ? [
                    `${filteredData.length} SKUs show median excess inventory days ranging from 37 to 118.`,
                    `Current open PO quantities suggest slow-moving stock with ongoing replenishment.`,
                ] : ["-", "-"],
                evidence: hasData ? filteredData.map(r => ({
                    skuName: r.skuName || '-',
                    imageUrl: productImageMap[r.skuName] || null,
                    city: r.city,
                    platform: r.platform,
                    category: r.category,
                    brandName: r.brandName || brandLabel,
                    excessInventory: Number(r.excessInventory) || 0,
                    excessDOI: Number(r.excessDOI) || 0,
                    currentDiscount: 0, // Discount not in rb_po_olap — hardcoded in frontend
                    excessInventoryValue: Number(r.excessInventoryValue) || 0,
                    osa: Number(r.osa) || 0,
                    openPOQty: Number(r.openPOQty) || 0,
                })) : [{ skuName: '-', city: '-', platform: '-', category: '-', excessInventory: 0, excessDOI: 0, currentDiscount: 0, excessInventoryValue: 0, openPOQty: 0 }],
            });
        }

        // ---------------------------------------------------------------------
        // SIGNAL 9 — Prioritise PO
        // ---------------------------------------------------------------------
        if (!filters.signal || filters.signal === 'All signals' || filters.signal === 'Prioritise PO') {
            const filteredData = (prioritisePOData || []).filter(r => isAllowedCity(r.city));
            const hasData = filteredData.length > 0;
            const totalPSL = hasData ? filteredData.reduce((s, r) => s + Number(r.projectedSalesLoss || 0), 0) : 0;
            const avgOsa = hasData ? filteredData.reduce((s, r) => s + Number(r.osa || 0), 0) / filteredData.length : 0;
            const criticalCount = filteredData.filter(r => r.poStatus === 'Critical' || r.poStatus === 'High').length;

            let title9 = "No PO prioritisation required";
            if (hasData) {
                if (criticalCount > 3) {
                    title9 = `${criticalCount} high priority SKUs need urgent PO — combined weekly PSL of ₹${Math.round(totalPSL).toLocaleString('en-IN')}`;
                } else {
                    title9 = `${filteredData.length} SKU(s) with low availability need PO prioritisation (avg OSA: ${avgOsa.toFixed(1)}%)`;
                }
            }

            const absPSL = Math.abs(totalPSL);
            let formattedPSL = "";
            if (absPSL >= 10000000) {
                formattedPSL = "₹ " + (totalPSL / 10000000).toFixed(1) + " Cr";
            } else if (absPSL >= 100000) {
                formattedPSL = "₹ " + (totalPSL / 100000).toFixed(1) + " L";
            } else {
                formattedPSL = "₹ " + totalPSL.toFixed(1);
            }

            insights.push({
                id: "dyn_po_1",
                type: "Prioritise PO",
                title: title9,
                family: "Supply",
                platforms: hasData ? [...new Set(filteredData.map(r => r.platform))] : ["-"],
                city: filters.city !== "All cities" ? filters.city : "Multi-city",
                category: filters.category !== "All categories" ? filters.category : "Overall",
                impactInr: Math.round(totalPSL),
                impactLabel: "Projected Sales Loss",
                brandName: brandLabel,
                dateRange: { from: dateFrom, to: dateTo },
                kpis: [
                    { label: "PSL", value: formattedPSL },
                    { label: "Avg OSA", value: `${avgOsa.toFixed(1)}%` },
                    { label: "High Priority SKUs", value: `${criticalCount}` },
                ],
                whatWeSee: hasData ? [
                    `${filteredData.length} SKU(s) at ${filteredData[0]?.city || 'warehouse'} have combined weekly Potential Sales Loss of ₹${Math.round(totalPSL).toLocaleString('en-IN')}.`,
                    `PO status indicates ${criticalCount} critical and high-priority replenishment needs.`,
                ] : ["-", "-"],
                evidence: hasData ? filteredData.map(r => ({
                    skuName: r.skuName || '-',
                    imageUrl: productImageMap[r.skuName] || null,
                    city: r.city,
                    platform: r.platform,
                    category: r.category,
                    brandName: r.brandName || brandLabel,
                    osa: Number(r.osa) || 0,
                    osaChange: Number(r.osaChange) || 0,
                    totalSales: Number(r.totalSales) || 0,
                    projectedSalesLoss: Number(r.projectedSalesLoss) || 0,
                    poRaisedDate: String(r.poRaisedDate || '-'),
                    poStatus: r.poStatus || 'Low',
                    prevTotalSales: Number(r.prevTotalSales) || 0,
                })) : [{ skuName: '-', city: '-', platform: '-', category: '-', osa: 0, projectedSalesLoss: 0, poRaisedDate: '-', poStatus: '-' }],
            });
        }

        // ---------------------------------------------------------------------
        // SIGNAL 10 — Transfer Issue
        // ---------------------------------------------------------------------
        if (!filters.signal || filters.signal === 'All signals' || filters.signal === 'Transfer Issue') {
            const filteredData = (transferIssueData || []).filter(r => isAllowedCity(r.city));
            const hasData = filteredData.length > 0;
            const totalPSL = hasData ? filteredData.reduce((s, r) => s + Number(r.projectedSalesLoss || 0), 0) : 0;
            const avgBackedDOI = hasData ? filteredData.reduce((s, r) => s + Number(r.backedDOI || 0), 0) / filteredData.length : 0;
            const uniqueCities = hasData ? new Set(filteredData.map(r => r.city)).size : 0;

            let title10 = "No transfer issues detected";
            if (hasData) {
                if (totalPSL > 50000) {
                    title10 = `Supply-demand mismatch across ${uniqueCities} cities — ₹${Math.round(totalPSL).toLocaleString('en-IN')} PSL from low backed DOI`;
                } else {
                    title10 = `${filteredData.length} SKU-city combinations with critically low backed DOI (avg ${avgBackedDOI.toFixed(1)} days)`;
                }
            }

            insights.push({
                id: "dyn_transfer_1",
                type: "Transfer Issue",
                title: title10,
                family: "Supply",
                platforms: hasData ? [...new Set(filteredData.map(r => r.platform))] : ["-"],
                city: filters.city !== "All cities" ? filters.city : "Multi-city",
                category: filters.category !== "All categories" ? filters.category : "Overall",
                impactInr: Math.round(totalPSL),
                impactLabel: "Projected Sales Loss",
                brandName: brandLabel,
                dateRange: { from: dateFrom, to: dateTo },
                kpis: [
                    { label: "PSL", value: `₹${Math.round(totalPSL).toLocaleString('en-IN')}` },
                    { label: "Avg Backed DOI", value: `${avgBackedDOI.toFixed(1)} days` },
                    { label: "Cities", value: `${uniqueCities}` },
                ],
                whatWeSee: hasData ? [
                    `${filteredData.length} SKU-city combos have backed DOI below 15 days, indicating transfer/replenishment urgency.`,
                    `Cross-warehouse transfers could recover ₹${Math.round(totalPSL).toLocaleString('en-IN')} projected sales loss.`,
                ] : ["-", "-"],
                evidence: hasData ? filteredData.map(r => ({
                    skuName: r.skuName || '-',
                    imageUrl: productImageMap[r.skuName] || null,
                    city: r.city,
                    platform: r.platform,
                    category: r.category,
                    brandName: r.brandName || brandLabel,
                    cpd: Number(r.cpd) || 0,
                    backedDOI: Number(r.backedDOI) || 0,
                    osa: Number(r.osa) || 0,
                    projectedSalesLoss: Number(r.projectedSalesLoss) || 0,
                    totalSales: Number(r.totalSales) || 0,
                    cpdChange: Number(r.cpdChange) || 0,
                    backedDOIChange: Number(r.backedDOIChange) || 0,
                })) : [{ skuName: '-', city: '-', platform: '-', category: '-', cpd: 0, backedDOI: 0, osa: 0, projectedSalesLoss: 0 }],
            });
        }

        // ---------------------------------------------------------------------
        // SIGNAL 11 — New Market Entry
        // ---------------------------------------------------------------------
        if (!filters.signal || filters.signal === 'All signals' || filters.signal === 'New Market Entry') {
            const filteredData = (newMarketEntryData || []).filter(r => isAllowedCity(r.city));
            const hasData = filteredData.length > 0;
            const top = hasData ? filteredData[0] : {};
            const uniqueCompetitors = hasData ? new Set(filteredData.map(r => r.competitorName)).size : 0;
            const uniqueCities = hasData ? new Set(filteredData.map(r => r.city)).size : 0;
            const totalSales = hasData ? filteredData.reduce((s, r) => s + Number(r.totalSales || 0), 0) : 0;

            let title11 = "No new market entries detected";
            if (hasData) {
                if (filteredData.length > 5) {
                    title11 = `${filteredData.length} new competitor SKUs detected across ${uniqueCities} cities — ${uniqueCompetitors} competitor(s) expanding`;
                } else {
                    title11 = `${top.competitorName || 'Competitor'} entered ${top.city || 'new market'} with "${top.skuName || 'new product'}" at ₹${top.pfu || 0}`;
                }
            }

            insights.push({
                id: "dyn_newmarket_1",
                type: "New Market Entry",
                title: title11,
                family: "Competitive",
                platforms: hasData ? [...new Set(filteredData.map(r => r.platform))] : ["-"],
                city: filters.city !== "All cities" ? filters.city : "Multi-city",
                category: filters.category !== "All categories" ? filters.category : (top.category || "Overall"),
                impactInr: Math.round(totalSales),
                impactLabel: "Competitor Revenue",
                brandName: brandLabel,
                dateRange: { from: dateFrom, to: dateTo },
                kpis: [
                    { label: "New SKUs", value: hasData ? `${filteredData.length}` : "0" },
                    { label: "Competitors", value: `${uniqueCompetitors}` },
                    { label: "Cities", value: `${uniqueCities}` },
                ],
                whatWeSee: hasData ? [
                    `${uniqueCompetitors} competitor(s) launched ${filteredData.length} new SKU(s) across ${uniqueCities} cities in this period.`,
                    `Top mover: ${top.competitorName || 'competitor'} in ${top.category || 'category'} with PFU of ₹${top.pfu || 0}.`,
                ] : ["-", "-"],
                evidence: hasData ? filteredData.map(r => ({
                    skuName: r.skuName || '-',
                    imageUrl: productImageMap[r.skuName] || null,
                    city: r.city,
                    platform: r.platform,
                    category: r.category,
                    competitorName: r.competitorName || '-',
                    pfu: Number(r.pfu) || 0,
                    firstSeenDate: String(r.firstSeenDate || '-'),
                    daysSeen: Number(r.daysSeen) || 0,
                    totalSales: Number(r.totalSales) || 0,
                })) : [{ skuName: '-', city: '-', platform: '-', category: '-', competitorName: '-', pfu: 0, firstSeenDate: '-', daysSeen: 0 }],
            });
        }

        // ---------------------------------------------------------------------
        // SIGNAL 12 — Dark Store Coverage Gaps
        // ---------------------------------------------------------------------
        if (!filters.signal || filters.signal === 'All signals' || filters.signal === 'Dark Store Coverage Gaps') {
            const filteredData = (darkStoreCoverageData || []).filter(r => isAllowedCity(r.city));
            const hasData = filteredData.length > 0;
            const avgListingPct = hasData ? filteredData.reduce((s, r) => s + Number(r.listingPct || 0), 0) / filteredData.length : 0;
            const totalStores = hasData ? filteredData.reduce((s, r) => s + Number(r.storeCount || 0), 0) : 0;
            const avgOsa = hasData ? filteredData.reduce((s, r) => s + Number(r.osa || 0), 0) / filteredData.length : 0;
            const totalSalesImpact = hasData ? filteredData.reduce((s, r) => {
                // PSL estimate: if listing is low, missing SKUs would have brought proportional sales
                const listPct = Number(r.listingPct || 0);
                const sales = Number(r.sales || 0);
                if (listPct > 0 && listPct < 100) {
                    return s + (sales / (listPct / 100) - sales);
                }
                return s;
            }, 0) : 0;
            const uniqueCities = hasData ? new Set(filteredData.map(r => r.city)).size : 0;

            let title12 = "No dark store coverage gaps detected";
            if (hasData) {
                if (avgListingPct < 50) {
                    title12 = `Critical listing gap: Only ${avgListingPct.toFixed(1)}% SKUs listed across ${totalStores} dark stores in ${uniqueCities} cities`;
                } else if (avgListingPct < 80) {
                    title12 = `Listing coverage at ${avgListingPct.toFixed(1)}% — ${totalStores} dark stores across ${uniqueCities} cities need SKU expansion`;
                } else {
                    title12 = `${uniqueCities} cities with ${totalStores} dark stores have listing coverage gaps to address`;
                }
            }

            insights.push({
                id: "dyn_ds_coverage_1",
                type: "Dark Store Coverage Gaps",
                title: title12,
                family: "Dark Store",
                platforms: hasData ? [...new Set(filteredData.map(r => r.platform))] : ["-"],
                city: filters.city !== "All cities" ? filters.city : "Multi-city",
                category: filters.category !== "All categories" ? filters.category : "Overall",
                impactInr: Math.round(totalSalesImpact),
                impactLabel: "Potential Sales Loss",
                brandName: brandLabel,
                dateRange: { from: dateFrom, to: dateTo },
                kpis: [
                    { label: "Avg Listing %", value: `${avgListingPct.toFixed(1)}%` },
                    { label: "Dark Stores", value: `${totalStores}` },
                    { label: "Avg OSA", value: `${avgOsa.toFixed(1)}%` },
                ],
                whatWeSee: hasData ? [
                    `Listing coverage averages ${avgListingPct.toFixed(1)}% across ${totalStores} dark stores, leaving significant untapped shelf space.`,
                    `Expanding SKU listings in underserved cities could unlock ₹${Math.round(totalSalesImpact).toLocaleString('en-IN')} in additional revenue.`,
                ] : ["-", "-"],
                evidence: hasData ? filteredData.map(r => ({
                    category: r.category || '-',
                    city: r.city || '-',
                    platform: r.platform || '-',
                    storeCount: Number(r.storeCount) || 0,
                    listedSkus: Number(r.listedSkus) || 0,
                    totalPlatformSkus: Number(r.totalPlatformSkus) || 0,
                    listingPct: Number(r.listingPct) || 0,
                    osa: Number(r.osa) || 0,
                    sales: Number(r.sales) || 0,
                    psl: (() => {
                        const lp = Number(r.listingPct || 0);
                        const s = Number(r.sales || 0);
                        return lp > 0 && lp < 100 ? Math.round(s / (lp / 100) - s) : 0;
                    })(),
                })) : [{ category: '-', city: '-', platform: '-', storeCount: 0, listedSkus: 0, totalPlatformSkus: 0, listingPct: 0, osa: 0, sales: 0, psl: 0 }],
            });
        }

        // ---------------------------------------------------------------------
        // SIGNAL 13 — New Dark Store Expansion
        // ---------------------------------------------------------------------
        if (!filters.signal || filters.signal === 'All signals' || filters.signal === 'New Dark Store Expansion') {
            const filteredData = (newDarkStoreData || []).filter(r => isAllowedCity(r.city));
            const hasData = filteredData.length > 0;
            const totalNewStores = hasData ? filteredData.reduce((s, r) => s + Number(r.newStoreCount || 0), 0) : 0;
            const avgListingPct = hasData ? filteredData.reduce((s, r) => s + Number(r.listingPct || 0), 0) / filteredData.length : 0;
            const uniqueCities = hasData ? new Set(filteredData.map(r => r.city)).size : 0;
            const totalSalesImpact = hasData ? filteredData.reduce((s, r) => {
                const listPct = Number(r.listingPct || 0);
                const sales = Number(r.sales || 0);
                if (listPct > 0 && listPct < 100) {
                    return s + (sales / (listPct / 100) - sales);
                }
                return s;
            }, 0) : 0;

            let title13 = "No new dark stores detected";
            if (hasData) {
                if (totalNewStores > 10) {
                    title13 = `${totalNewStores} new dark stores across ${uniqueCities} cities — listing coverage at ${avgListingPct.toFixed(1)}%, revenue loss risk ₹${Math.round(totalSalesImpact).toLocaleString('en-IN')}`;
                } else {
                    title13 = `${totalNewStores} new dark store(s) appeared in ${uniqueCities} cities with ${avgListingPct.toFixed(1)}% listing coverage`;
                }
            }

            insights.push({
                id: "dyn_ds_new_1",
                type: "New Dark Store Expansion",
                title: title13,
                family: "Dark Store",
                platforms: hasData ? [...new Set(filteredData.map(r => r.platform))] : ["-"],
                city: filters.city !== "All cities" ? filters.city : "Multi-city",
                category: filters.category !== "All categories" ? filters.category : "Overall",
                impactInr: Math.round(totalSalesImpact),
                impactLabel: "Potential Sales Loss",
                brandName: brandLabel,
                dateRange: { from: dateFrom, to: dateTo },
                kpis: [
                    { label: "New Stores", value: `${totalNewStores}` },
                    { label: "Cities", value: `${uniqueCities}` },
                    { label: "Avg Listing %", value: `${avgListingPct.toFixed(1)}%` },
                ],
                whatWeSee: hasData ? [
                    `${totalNewStores} new dark stores appeared across ${uniqueCities} cities with average listing coverage of ${avgListingPct.toFixed(1)}%.`,
                    `Missing SKU listings in new stores represent ₹${Math.round(totalSalesImpact).toLocaleString('en-IN')} potential revenue leakage.`,
                ] : ["-", "-"],
                evidence: hasData ? filteredData.map(r => ({
                    category: r.category || '-',
                    city: r.city || '-',
                    platform: r.platform || '-',
                    region: r.region || '-',
                    tier: r.tier || '-',
                    newStoreCount: Number(r.newStoreCount) || 0,
                    listingPct: Number(r.listingPct) || 0,
                    sobNewDs: Number(r.osa) || 0,
                    sales: Number(r.sales) || 0,
                    competitors: r.competitors || '-',
                    psl: (() => {
                        const lp = Number(r.listingPct || 0);
                        const s = Number(r.sales || 0);
                        return lp > 0 && lp < 100 ? Math.round(s / (lp / 100) - s) : 0;
                    })(),
                })) : [{ category: '-', city: '-', platform: '-', region: '-', tier: '-', newStoreCount: 0, listingPct: 0, sobNewDs: 0, sales: 0, competitors: '-', psl: 0 }],
            });
        }

        return insights;

    } catch (error) {
        console.error('Error in getInsightsData:', error);
        return [];
    }
};

export const getInsightsFilterOptions = async () => {
    try {
        const [catData, prodData] = await Promise.all([
            queryClickHouse("SELECT DISTINCT category FROM rca_sku_dim WHERE category != '' AND category IS NOT NULL ORDER BY category"),
            queryClickHouse("SELECT DISTINCT Product FROM rb_pdp_olap WHERE Product != '' AND Product IS NOT NULL ORDER BY Product LIMIT 200"),
        ]);

        return {
            categories: catData.map(r => r.category),
            productLines: prodData.map(r => r.Product),
            geographies: ALLOWED_CITIES,
        };
    } catch (e) {
        console.error("Error fetching insights filter options:", e);
        return { categories: [], productLines: [], geographies: [] };
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPETITOR MARKET SHARE TREND
// ─────────────────────────────────────────────────────────────────────────────
export const getCompetitorMarketShareTrend = async (filters = {}) => {
    const prevEndDate = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    const prevStartDate = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
    const curr_end = dayjs().format('YYYY-MM-DD');
    const curr_start = dayjs().subtract(30, 'day').format('YYYY-MM-DD');

    // Use filters if provided, fall back to no restriction
    const platformCond = filters.platform
        ? buildCHCondition(filters.platform, 'platform')
        : '1=1';
    const locationCond = filters.city
        ? buildCHCondition(filters.city, CITY_NORM_EXPR('location'))
        : '1=1';
    const categoryCond = filters.category
        ? buildCHCondition(filters.category, 'category', { isCategory: true })
        : '1=1';

    const kw_platformCond = filters.platform
        ? buildCHCondition(filters.platform, 'platform_name')
        : '1=1';
    const kw_locationCond = filters.city
        ? buildCHCondition(filters.city, CITY_NORM_EXPR('location_name'))
        : '1=1';
    const kw_categoryCond = filters.category
        ? buildCHCondition(filters.category, 'keyword_category', { isCategory: true })
        : '1=1';

    const shareQuery = `
        WITH
            curr_all AS (
                SELECT group_brand AS brand, flag,
                       argMax(item_name, sales)      AS top_sku,
                       SUM(toFloat64OrZero(toString(sales))) AS brand_sales
                FROM rb_ms_olap
                WHERE created_on BETWEEN '${curr_start}' AND '${curr_end}'
                  AND group_brand IS NOT NULL AND group_brand != ''
                  AND ${platformCond}
                  AND ${locationCond}
                  AND ${categoryCond}
                GROUP BY brand, flag
            ),
            prev_all AS (
                SELECT group_brand AS brand,
                       SUM(toFloat64OrZero(toString(sales))) AS brand_sales
                FROM rb_ms_olap
                WHERE created_on BETWEEN '${prevStartDate}' AND '${prevEndDate}'
                  AND group_brand IS NOT NULL AND group_brand != ''
                  AND ${platformCond}
                  AND ${locationCond}
                  AND ${categoryCond}
                GROUP BY brand
            ),
            total_curr AS (SELECT SUM(brand_sales) AS v FROM curr_all),
            total_prev AS (SELECT SUM(brand_sales) AS v FROM prev_all)

        SELECT
            c.brand                                                                       AS brandName,
            c.flag,
            c.top_sku                                                                     AS topSku,
            ROUND((c.brand_sales / nullIf((SELECT v FROM total_curr), 0)) * 100, 2)      AS currSharePct,
            ROUND((ifNull(p.brand_sales, 0) / nullIf((SELECT v FROM total_prev), 0)) * 100, 2) AS prevSharePct,
            ROUND(
                ((c.brand_sales / nullIf((SELECT v FROM total_curr), 0)) -
                 (ifNull(p.brand_sales, 0) / nullIf((SELECT v FROM total_prev), 0))) * 100,
            2) AS shareChangePpt
        FROM curr_all c
        LEFT JOIN prev_all p ON c.brand = p.brand
        ORDER BY currSharePct DESC
    `;

    const sosQuery = `
        WITH
            curr_kw AS (
                SELECT brand,
                       SUM(toFloat64OrZero(toString(spons)))   AS ad_vol,
                       SUM(toFloat64OrZero(toString(organic))) AS org_vol,
                       SUM(toFloat64OrZero(toString(overall))) AS total_vol
                FROM rb_kw_olap
                WHERE DATE BETWEEN '${curr_start}' AND '${curr_end}'
                  AND brand IS NOT NULL AND brand != ''
                  AND ${kw_platformCond}
                  AND ${kw_locationCond}
                  AND ${kw_categoryCond}
                GROUP BY brand
            ),
            prev_kw AS (
                SELECT brand,
                       SUM(toFloat64OrZero(toString(spons)))   AS ad_vol,
                       SUM(toFloat64OrZero(toString(organic))) AS org_vol,
                       SUM(toFloat64OrZero(toString(overall))) AS total_vol
                FROM rb_kw_olap
                WHERE DATE BETWEEN '${prevStartDate}' AND '${prevEndDate}'
                  AND brand IS NOT NULL AND brand != ''
                  AND ${kw_platformCond}
                  AND ${kw_locationCond}
                  AND ${kw_categoryCond}
                GROUP BY brand
            )
        SELECT
            ck.brand                                                                AS brandName,
            ROUND((ck.ad_vol  / nullIf(ck.total_vol, 0)) * 100, 2)                AS currAdSos,
            ROUND((ck.org_vol / nullIf(ck.total_vol, 0)) * 100, 2)                AS currOrgSos,
            ROUND((ifNull(pk.ad_vol,  0) / nullIf(ifNull(pk.total_vol, ck.total_vol), 0)) * 100, 2) AS prevAdSos,
            ROUND((ifNull(pk.org_vol, 0) / nullIf(ifNull(pk.total_vol, ck.total_vol), 0)) * 100, 2) AS prevOrgSos
        FROM curr_kw ck
        LEFT JOIN prev_kw pk ON ck.brand = pk.brand
    `;

    try {
        const [shareRows, sosRows] = await Promise.all([
            queryClickHouse(shareQuery),
            queryClickHouse(sosQuery),
        ]);

        const sosMap = {};
        for (const r of sosRows) {
            sosMap[r.brandName] = {
                currAdSos: Number(r.currAdSos) || 0,
                currOrgSos: Number(r.currOrgSos) || 0,
                prevAdSos: Number(r.prevAdSos) || 0,
                prevOrgSos: Number(r.prevOrgSos) || 0,
                adSosChange: Number(r.currAdSos) - Number(r.prevAdSos),
                orgSosChange: Number(r.currOrgSos) - Number(r.prevOrgSos),
            };
        }

        const ownBrandRow = shareRows.find(r => Number(r.flag) === 1);
        const competitorRows = shareRows.filter(r => Number(r.flag) === 0);

        const ownShare = ownBrandRow ? {
            brandName: ownBrandRow.brandName,
            topSku: ownBrandRow.topSku,
            currSharePct: Number(ownBrandRow.currSharePct),
            prevSharePct: Number(ownBrandRow.prevSharePct),
            shareChangePpt: Number(ownBrandRow.shareChangePpt),
            ...(sosMap[ownBrandRow.brandName] || { currAdSos: 0, currOrgSos: 0, prevAdSos: 0, prevOrgSos: 0, adSosChange: 0, orgSosChange: 0 }),
        } : null;

        const competitors = competitorRows.map(r => {
            const sos = sosMap[r.brandName] || { currAdSos: 0, currOrgSos: 0, prevAdSos: 0, prevOrgSos: 0, adSosChange: 0, orgSosChange: 0 };

            let primaryDriver = 'organic';
            if (sos.adSosChange > 0 && sos.orgSosChange > 0) {
                primaryDriver = sos.adSosChange >= sos.orgSosChange ? 'ad' : 'organic';
            } else if (sos.adSosChange > 0) {
                primaryDriver = 'ad';
            } else if (sos.orgSosChange > 0) {
                primaryDriver = 'organic';
            }

            return {
                brandName: r.brandName,
                topSku: r.topSku,
                currSharePct: Number(r.currSharePct),
                prevSharePct: Number(r.prevSharePct),
                shareChangePpt: Number(r.shareChangePpt),
                overtook: ownShare ? Number(r.currSharePct) > ownShare.currSharePct : false,
                shareAheadBy: ownShare ? Number((Number(r.currSharePct) - ownShare.currSharePct).toFixed(2)) : null,
                currAdSos: sos.currAdSos,
                currOrgSos: sos.currOrgSos,
                adSosChange: sos.adSosChange,
                orgSosChange: sos.orgSosChange,
                primaryDriver,
            };
        });

        competitors.sort((a, b) => b.shareChangePpt - a.shareChangePpt);

        return {
            ownBrand: ownShare,
            competitors,
            topThreat: competitors[0] || null,
            dateRange: { from: curr_start, to: curr_end },
            prevRange: { from: prevStartDate, to: prevEndDate },
        };

    } catch (err) {
        console.error('[InsightsService] getCompetitorMarketShareTrend failed:', err.message);
        return { ownBrand: null, competitors: [], topThreat: null };
    }
};