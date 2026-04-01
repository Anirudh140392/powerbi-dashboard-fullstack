import { queryClickHouse, getCurrentDbName } from '../config/clickhouse.js';
import dayjs from 'dayjs';

const ALLOWED_CITIES = ['Chandigarh', 'Delhi', 'Gurugram', 'Faridabad', 'Lucknow', 'Kolkata', 'Ahmedabad', 'Mumbai', 'Pune', 'Hyderabad', 'Bengaluru', 'Chennai'];
const ALLOWED_CITIES_LOWER = ALLOWED_CITIES.map(c => c.toLowerCase());
const ALLOWED_CITIES_SQL = ALLOWED_CITIES.map(c => `'${c}'`).join(', ');

const isAllowedCity = (city) => {
    if (!city || city === '-') return false;
    return ALLOWED_CITIES_LOWER.includes(String(city).toLowerCase());
};

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

    if (isCategory) {
        return `LOWER(${column}) IN (${list.map(v => `'${escapeCH(String(v).toLowerCase())}'`).join(', ')})`;
    }
    return `${column} IN (${list.map(v => `'${escapeCH(v)}'`).join(', ')})`;
};

export const getInsightsData = async (filters) => {
    const rawDbName = getCurrentDbName();
    const brandLabel = rawDbName ? rawDbName.charAt(0).toUpperCase() + rawDbName.slice(1).toLowerCase() : "Mars";

    // Fallback logic for missing categories in the database.
    // If Category is null/empty/zero, we infer it from the Brand name.
    const catField = `if(Category IS NOT NULL AND Category != '' AND Category != '0', ` +
        `Category, multiIf(LOWER(Brand) IN ('orbit', 'doublemint', 'boomer', 'skittles'), 'GMFC', ` +
        `LOWER(Brand) IN ('snickers', 'galaxy', 'bounty', 'twix', 'mars', 'm&m', 'm&m''s'), ` +
        `if(LOWER(toString(Product)) LIKE '%gift%' OR LOWER(toString(Product)) LIKE '%tin pack%', ` +
        `'Chocolates (Gifting)', 'Chocolates (Non Gifting)'), 'Others'))`;

    let endDate = filters.endDate ? dayjs(filters.endDate) : dayjs();
    let startDate = filters.startDate ? dayjs(filters.startDate) : endDate.subtract(30, 'day');

    const dateFrom = startDate.format('YYYY-MM-DD');
    const dateTo = endDate.format('YYYY-MM-DD');

    const prevStartDate = startDate.subtract(30, 'day').format('YYYY-MM-DD');
    const prevEndDate = startDate.subtract(1, 'day').format('YYYY-MM-DD');

    const insights = [];

    // -------------------------------------------------------------------------
    // QUERY 1 — VISIBILITY (powers: Share Headroom Hotspots)
    // -------------------------------------------------------------------------
    const visibilityQuery = `
        SELECT 
            location_name AS city,
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
          AND ${buildCHCondition(filters.city, 'location_name')}
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
    // QUERY 2 — PRICING (powers: Price Parity Radar)
    // PPU = Selling_Price / Weight * 10  for both our brand and competitor
    // GAP % = (our PPU - comp PPU) / comp PPU * 100
    // Weight column contains strings like "30 g", "200 g" — strip non-numeric chars
    // -------------------------------------------------------------------------
    const weightExpr = "toFloat64OrZero(replaceRegexpAll(toString(Weight), '[^0-9.]', ''))";
    const pricingQuery = `
        WITH our_brand AS (
            SELECT 
                Location AS city,
                ${catField} AS category,
                ROUND(
                    AVG(
                        toFloat64OrZero(toString(Selling_Price)) /
                        nullIf(${weightExpr}, 0) * 10
                    ),
                2) AS our_ppu,
                argMax(Product, toFloat64OrZero(toString(Sales))) AS impacted_sku,
                SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) AS our_sales,
                SUM(toFloat64OrZero(toString(neno_osa))) AS our_neno,
                SUM(toFloat64OrZero(toString(deno_osa))) AS our_deno
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
              AND Comp_flag IN (0, '0')
              AND ${weightExpr} > 0
              AND toFloat64OrZero(toString(Selling_Price)) > 0
              AND ${buildCHCondition(filters.platform, 'Platform', { isPdp: true })}
              AND ${buildCHCondition(filters.city, 'Location', { isPdp: true })}
              AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
            GROUP BY city, category
        ),
        comp_brand AS (
            SELECT 
                Location AS city,
                ${catField} AS category,
                ROUND(
                    AVG(
                        toFloat64OrZero(toString(Selling_Price)) /
                        nullIf(${weightExpr}, 0) * 10
                    ),
                2) AS comp_ppu,
                argMax(toString(Product), toFloat64OrZero(toString(Selling_Price))) AS comp_sku
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
              AND Comp_flag IN (1, '1')
              AND ${weightExpr} > 0
              AND toFloat64OrZero(toString(Selling_Price)) > 0
              AND ${buildCHCondition(filters.platform, 'Platform', { isPdp: true })}
              AND ${buildCHCondition(filters.city, 'Location', { isPdp: true })}
              AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
            GROUP BY city, category
        )
        SELECT 
            o.city,
            o.category,
            o.our_ppu       AS ourPpu,
            c.comp_ppu      AS compPpu,
            o.impacted_sku  AS impactedSku,
            c.comp_sku      AS compSku,
            ROUND(
                (o.our_ppu - c.comp_ppu) / nullIf(c.comp_ppu, 0) * 100,
            2) AS gapPct,
            ROUND(
                o.our_sales * (
                    (100.0 / nullIf(ROUND(o.our_neno * 100.0 / nullIf(o.our_deno, 0), 2), 0)) - 1
                ),
            0) AS psl,
            o.our_sales     AS totalSales
        FROM our_brand o
        JOIN comp_brand c ON o.city = c.city AND o.category = c.category
        WHERE c.comp_ppu > 0
        ORDER BY gapPct DESC
    `;

    // -------------------------------------------------------------------------
    // QUERY 3 — REPLENISHMENT (powers: Replenishment Breaks)
    // -------------------------------------------------------------------------
    const replenishmentQuery = `
        SELECT 
            Location AS city,
            Platform AS platform,
            Brand AS skuOrBrand,
            SUM(ifNull(toFloat64OrZero(toString(Qty_Sold)),   0)) AS total_sold,
            AVG(ifNull(toFloat64OrZero(toString(Inventory)),  0)) AS avg_inventory,
            ROUND(
                SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) * 100.0 /
                nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0),
            1) AS fillRate
        FROM rb_pdp_olap
        WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
          AND Comp_flag IN (0, '0')
          AND ${buildCHCondition(filters.platform, 'Platform', { isPdp: true })}
          AND ${buildCHCondition(filters.city, 'Location', { isPdp: true })}
          AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
        GROUP BY city, platform, skuOrBrand
        HAVING fillRate < 80 OR avg_inventory < 10
        ORDER BY total_sold DESC
        LIMIT 10
    `;

    // -------------------------------------------------------------------------
    // QUERY 4 — KEYWORD EFFICIENCY (powers: Keyword Efficiency and Budget Caps)
    // -------------------------------------------------------------------------
    const adStockQuery = `
        WITH kw_products AS (
            SELECT DISTINCT
                keyword,
                platform_name AS platform,
                web_pid
            FROM rb_kw_olap
            WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
              AND flag = 1
              AND web_pid IS NOT NULL AND web_pid != ''
              AND ${buildCHCondition(filters.platform, 'platform_name')}
              AND ${buildCHCondition(filters.category, 'keyword_category', { isCategory: true })}
        )
        SELECT
            kp.platform,
            kp.keyword,
            ROUND(SUM(toFloat64OrZero(toString(p.Ad_Spend))), 0)  AS total_spend,
            ROUND(SUM(toFloat64OrZero(toString(p.Sales))), 0)     AS total_sales,
            ROUND(
                SUM(toFloat64OrZero(toString(p.Sales))) /
                nullIf(SUM(toFloat64OrZero(toString(p.Ad_Spend))), 0),
            2) AS roas,
            ROUND(
                SUM(toFloat64OrZero(toString(p.Ad_Spend))) /
                nullIf(SUM(toFloat64OrZero(toString(p.Sales))), 0) * 100,
            1) AS acos,
            ROUND(
                SUM(toFloat64OrZero(toString(p.neno_osa))) * 100.0 /
                nullIf(SUM(toFloat64OrZero(toString(p.deno_osa))), 0),
            1) AS osa
        FROM kw_products kp
        JOIN rb_pdp_olap p
            ON kp.web_pid = p.Web_Pid
            AND kp.platform = p.Platform
        WHERE p.DATE BETWEEN '${dateFrom}' AND '${dateTo}'
          AND p.Comp_flag IN (0, '0')
        GROUP BY kp.platform, kp.keyword
        HAVING total_spend > 500 AND roas < 2.0
        ORDER BY total_spend DESC
        LIMIT 10
    `;

    // -------------------------------------------------------------------------
    // QUERY 5 — COMPETITOR OSA (powers: Competitor OSA Weak Spots)
    // -------------------------------------------------------------------------
    const competitorOsaQuery = `
        WITH our_brand_osa AS (
            SELECT 
                Location AS city, 
                Platform AS platform, 
                ${catField} AS category,
                round(
                    (sum(toFloat64OrZero(toString(neno_osa))) /
                    nullIf(sum(toFloat64OrZero(toString(deno_osa))), 0)) * 100,
                2) AS kw_osa,
                sum(toFloat64OrZero(toString(Sales))) AS kw_sales
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}' 
              AND Comp_flag IN (0, '0') 
              AND Location IS NOT NULL
              AND ${buildCHCondition(filters.platform, 'Platform', { isPdp: true })}
              AND ${buildCHCondition(filters.city, 'Location', { isPdp: true })}
              AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
            GROUP BY city, platform, category 
            HAVING kw_osa > 0
        ),
        other_brand_osa AS (
            SELECT 
                Location AS city, 
                Platform AS platform, 
                ${catField} AS category, 
                Brand AS competitor,
                round(
                    (sum(toFloat64OrZero(toString(neno_osa))) /
                    nullIf(sum(toFloat64OrZero(toString(deno_osa))), 0)) * 100,
                2) AS comp_osa
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}' 
              AND Comp_flag IN (1, '1') 
              AND Brand IS NOT NULL 
              AND Brand != '' 
              AND Location IS NOT NULL
              AND ${buildCHCondition(filters.platform, 'Platform', { isPdp: true })}
              AND ${buildCHCondition(filters.city, 'Location', { isPdp: true })}
              AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
            GROUP BY city, platform, category, competitor
        )
        SELECT 
            our.city, 
            our.platform, 
            our.category, 
            other.competitor, 
            other.comp_osa  AS otherBrandOsa, 
            our.kw_osa      AS kwOsa,
            round(
                (our.kw_sales / nullIf(our.kw_osa / 100.0, 0)) - our.kw_sales,
            0) AS psl
        FROM our_brand_osa our 
        JOIN other_brand_osa other 
          ON our.city     = other.city
         AND our.platform = other.platform
         AND our.category = other.category
        WHERE other.comp_osa < 80 
          AND our.kw_osa >= other.comp_osa 
        ORDER BY psl DESC 
        LIMIT 20
    `;

    // -------------------------------------------------------------------------
    // QUERY 6 — AD STOCK MISMATCH (powers: Ad Stock Mismatch)
    // -------------------------------------------------------------------------
    const adStockMismatchQuery = `
        WITH keyword_stats AS (
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
        product_keyword_stats AS (
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
        product_daily_sov AS (
            SELECT
                pks.web_pid,
                pks.location_name,
                pks.platform_name,
                pks.DATE,
                SUM(pks.product_kw_spons) AS own_spons,
                SUM(ks.total_kw_spons) AS total_spons
            FROM product_keyword_stats pks
            JOIN keyword_stats ks
                ON pks.keyword = ks.keyword
               AND pks.location_name = ks.location_name
               AND pks.platform_name = ks.platform_name
               AND pks.DATE = ks.DATE
            GROUP BY pks.web_pid, pks.location_name, pks.platform_name, pks.DATE
        )
        SELECT
            p.Location  AS city,
            p.Platform  AS platform,
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
            0) AS estLostSalesInr
        FROM rb_pdp_olap p
        LEFT JOIN product_daily_sov s 
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
          AND ${buildCHCondition(filters.city, 'p.Location', { isPdp: true })}
          AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
        GROUP BY city, platform, skuOrBrand
        HAVING kwOsa < 75 AND spendInr > 500
        ORDER BY spendInr DESC
        LIMIT 10
    `;

    // -------------------------------------------------------------------------
    // QUERY 7 — CHALLENGER LAUNCH WATCH (powers: Challenger Launch Watch)
    // -------------------------------------------------------------------------
    const challengerLaunchQuery = `
        SELECT
            Location  AS city,
            Platform  AS platform,
            ${catField} AS category,
            Brand     AS skuOrBrand,
            Product   AS productName,
            ROUND(
                SUM(toFloat64OrZero(if(Organic_SOS IS NULL OR Organic_SOS = '', '0', Organic_SOS))) * 100.0 /
                nullIf(COUNT(*), 0),
            2) AS newItemShare,
            ROUND(AVG(toFloat64OrZero(toString(Selling_Price))), 0) AS ppu,
            MIN(DATE) AS firstSeen
        FROM rb_pdp_olap
        WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
          AND Comp_flag IN (1, '1')
          AND Brand   IS NOT NULL AND Brand   != ''
          AND Product IS NOT NULL AND Product != ''
          AND ${buildCHCondition(filters.platform, 'Platform', { isPdp: true })}
          AND ${buildCHCondition(filters.city, 'Location', { isPdp: true })}
          AND ${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
        GROUP BY city, platform, category, skuOrBrand, productName
        HAVING MIN(DATE) >= '${dateFrom}'
           AND newItemShare > 0
        ORDER BY newItemShare DESC
        LIMIT 10
    `;

    // -------------------------------------------------------------------------
    // QUERY 7.5 — PERFORMANCE METRICS (Real Sales/OSA for Visibility mapping)
    // -------------------------------------------------------------------------
    const performanceQuery = `
        WITH 
            curr AS (
                SELECT 
                    Location AS city, 
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
                    Location AS city, 
                    Platform AS platform, 
                    ${catField} AS category, 
                    SUM(toFloat64OrZero(toString(Sales))) AS s
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
            ROUND(c.n * 100.0 / nullIf(c.d, 0), 2) AS osa
        FROM curr c
        LEFT JOIN prev p ON c.city = p.city AND c.platform = p.platform AND c.category = p.category
    `;

    // -------------------------------------------------------------------------
    // QUERY 8 — COMPETITOR MARKET SHARE TREND (powers: AI Report for Headroom)
    // -------------------------------------------------------------------------
    // Normalize city names: Gurgaon/gurugram → Gurugram
    const locNorm = `if(LOWER(location) IN ('gurgaon','gurugram'), 'Gurugram', initCap(location))`;

    const ownShareQuery = `
        WITH
            curr_items AS (
                SELECT group_brand AS brand_name,
                       category,
                       ${locNorm} AS location,
                       initCap(platform) AS platform,
                       item_name,
                       SUM(toFloat64OrZero(toString(sales))) AS curr_sales
                FROM rb_ms_olap
                WHERE created_on BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND flag = 1
                  AND group_brand IS NOT NULL AND group_brand != ''
                  AND ${buildCHCondition(filters.platform, 'platform')}
                  AND ${buildCHCondition(filters.city, 'location')}
                  AND ${buildCHCondition(filters.category, 'category', { isCategory: true })}
                GROUP BY brand_name, category, location, platform, item_name
            ),
            prev_items AS (
                SELECT group_brand AS brand_name,
                       category,
                       ${locNorm} AS location,
                       initCap(platform) AS platform,
                       item_name,
                       SUM(toFloat64OrZero(toString(sales))) AS prev_sales
                FROM rb_ms_olap
                WHERE created_on BETWEEN '${prevStartDate}' AND '${prevEndDate}'
                  AND flag = 1
                  AND group_brand IS NOT NULL AND group_brand != ''
                  AND ${buildCHCondition(filters.platform, 'platform')}
                  AND ${buildCHCondition(filters.city, 'location')}
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
                    argMin(item_name, sales_delta) AS top_loser_sku
                FROM item_deltas
                GROUP BY brand_name, category, location, platform
            ),
            total_curr AS (
                SELECT category, initCap(location) AS location, initCap(platform) AS platform, SUM(toFloat64OrZero(toString(sales))) AS v
                FROM rb_ms_olap
                WHERE created_on BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND group_brand IS NOT NULL AND group_brand != ''
                  AND ${buildCHCondition(filters.platform, 'platform')}
                  AND ${buildCHCondition(filters.city, 'location')}
                  AND ${buildCHCondition(filters.category, 'category', { isCategory: true })}
                GROUP BY category, location, platform
            ),
            total_prev AS (
                SELECT category, initCap(location) AS location, initCap(platform) AS platform, SUM(toFloat64OrZero(toString(sales))) AS v
                FROM rb_ms_olap
                WHERE created_on BETWEEN '${prevStartDate}' AND '${prevEndDate}'
                  AND group_brand IS NOT NULL AND group_brand != ''
                  AND ${buildCHCondition(filters.platform, 'platform')}
                  AND ${buildCHCondition(filters.city, 'location')}
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
            curr AS (
                SELECT group_brand        AS brand_name,
                       category,
                       ${locNorm}  AS location,
                       initCap(platform)  AS platform,
                       argMax(item_name, sales) AS top_sku,
                       SUM(toFloat64OrZero(toString(sales))) AS brand_sales
                FROM rb_ms_olap
                WHERE created_on BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND flag = 0
                  AND group_brand IS NOT NULL AND group_brand != ''
                  AND ${buildCHCondition(filters.platform, 'platform')}
                  AND ${buildCHCondition(filters.city, 'location')}
                  AND ${buildCHCondition(filters.category, 'category', { isCategory: true })}
                GROUP BY brand_name, category, location, platform
            ),
            prev AS (
                SELECT group_brand AS brand_name,
                       category,
                       ${locNorm}  AS location,
                       initCap(platform)  AS platform,
                       SUM(toFloat64OrZero(toString(sales))) AS brand_sales
                FROM rb_ms_olap
                WHERE created_on BETWEEN '${prevStartDate}' AND '${prevEndDate}'
                  AND flag = 0
                  AND group_brand IS NOT NULL AND group_brand != ''
                  AND ${buildCHCondition(filters.platform, 'platform')}
                  AND ${buildCHCondition(filters.city, 'location')}
                  AND ${buildCHCondition(filters.category, 'category', { isCategory: true })}
                GROUP BY brand_name, category, location, platform
            ),
            total_curr AS (
                SELECT category, initCap(location) AS location, initCap(platform) AS platform, SUM(toFloat64OrZero(toString(sales))) AS v
                FROM rb_ms_olap
                WHERE created_on BETWEEN '${dateFrom}' AND '${dateTo}'
                  AND group_brand IS NOT NULL AND group_brand != ''
                  AND ${buildCHCondition(filters.platform, 'platform')}
                  AND ${buildCHCondition(filters.city, 'location')}
                  AND ${buildCHCondition(filters.category, 'category', { isCategory: true })}
                GROUP BY category, location, platform
            ),
            total_prev AS (
                SELECT category, initCap(location) AS location, initCap(platform) AS platform, SUM(toFloat64OrZero(toString(sales))) AS v
                FROM rb_ms_olap
                WHERE created_on BETWEEN '${prevStartDate}' AND '${prevEndDate}'
                  AND group_brand IS NOT NULL AND group_brand != ''
                  AND ${buildCHCondition(filters.platform, 'platform')}
                  AND ${buildCHCondition(filters.city, 'location')}
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

    const safeQuery = async (query, label) => {
        try {
            return await queryClickHouse(query);
        } catch (err) {
            console.error(`[Insights] ${label} query failed:`, err.message);
            return [];
        }
    };

    try {
        const [
            visData,
            visTotalsData,
            priceData,
            replData,
            adData,
            compData,
            adStockData,
            challengerData,
            perfData,
            ownShareRows,
            compShareRows,
            sosRows
        ] = await Promise.all([
            safeQuery(visibilityQuery, 'Visibility'),
            safeQuery(visibilityTotalsQuery, 'VisibilityTotals'),
            safeQuery(pricingQuery, 'Pricing'),
            safeQuery(replenishmentQuery, 'Replenishment'),
            safeQuery(adStockQuery, 'KeywordEfficiency'),
            safeQuery(competitorOsaQuery, 'CompetitorOSA'),
            safeQuery(adStockMismatchQuery, 'AdStockMismatch'),
            safeQuery(challengerLaunchQuery, 'ChallengerLaunch'),
            safeQuery(performanceQuery, 'Performance'),
            safeQuery(ownShareQuery, 'OwnShare'),
            safeQuery(compShareQuery, 'CompShare'),
            safeQuery(sosTrendQuery, 'SOSTrend')
        ]);

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
            const catKey  = String(r.category || "").toLowerCase();
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
            const catKey  = String(r.category || "").toLowerCase();
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
                const cityKey = String(perf.city || "").toLowerCase();
                const platKey = String(perf.platform || "").toLowerCase();
                const catKey  = String(perf.category || "").toLowerCase();
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
                const offtakeDelta = (Number(perf.currSales) || 0) - prevSales;
                const offtakeMoM = prevSales > 0 ? ((Number(perf.currSales) - prevSales) / prevSales) * 100 : 0;

                return {
                    category: perf.category,
                    city: perf.city,
                    platform: perf.platform,
                    brandOsa: Number(perf.osa) || 0,
                    psl: headroomInr,
                    headroomInr: headroomInr,
                    marketShare: catShare ? catShare.currSharePct : 0,
                    marketShareMoM: catShare ? catShare.shareChangePpt : 0,
                    offtake: Number(perf.currSales) || 0,
                    offtakeMoM: offtakeMoM,
                    offtakeDelta: offtakeDelta,
                    appCategory: perf.category,
                    myTopSku: catShare?.topSku || "-",
                    competitorSku: threat?.topSku || "-",
                    possibleCause: threat 
                        ? `Competitor share↑ (${threat.brandName})` 
                        : (headroomInr > 1000 ? "On-Shelf Availability Lacuna" : "Visibility/OSA Sync Issue"),
                    topThreat: threat ? threat.brandName : 'N/A',
                    threatShare: threat ? threat.currSharePct : 0,
                    threatChange: threat ? threat.shareChangePpt : 0
                };
            });

            // 2. Sort by most negative offtakeDelta (highest money loss) and slice top 3
            // Also filter to only allowed cities
            let evidence = lossRecords
                .filter(r => r.city !== '-' && String(r.city).toLowerCase() !== 'other' && isAllowedCity(r.city) && (r.headroomInr > 0 || r.offtake > 0))
                .sort((a, b) => a.offtakeDelta - b.offtakeDelta)
                .slice(0, 3);

            // Fallback if no relevant data found
            if (evidence.length === 0) {
                evidence = [{ city: '-', platform: '-', category: '-', lossValue: 0, brandOsa: 0, marketShare: 0, marketShareMoM: 0, psl: 0, offtake: 0, offtakeMoM: 0, offtakeDelta: 0, myTopSku: '-', competitorSku: '-', possibleCause: '-', headroomInr: 0 }];
            }

            const totalImpact = evidence.reduce((sum, e) => sum + Math.abs(Math.min(0, e.offtakeDelta || 0)), 0);

            let title1 = "No visibility anomalies detected";
            if (hasData && evidence.length > 0 && evidence[0].city !== '-') {
                if (vis.org_sos < 10 && vis.ad_sos > 30) {
                    title1 = `Critical visibility drop: Relying heavily on Paid (${vis.ad_sos}%) as Organic falls to ${vis.org_sos}%`;
                } else if (vis.overall_sos < 20 && vis.overall_sos > 0) {
                    title1 = `Deteriorating shelf visibility; overall SOS at ${vis.overall_sos}%`;
                } else if (totalImpact > 10000) {
                    title1 = `Significant Offtake decline of ₹${Math.round(totalImpact).toLocaleString('en-IN')} across top cities`;
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
                impactLabel: "Offtake Loss",
                brandName: brandLabel,
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
            const cityFilteredPriceData = (priceData || []).filter(p => isAllowedCity(p.city));
            const hasData = cityFilteredPriceData.length > 0;
            const topRow = hasData ? cityFilteredPriceData[0] : { gapPct: 0, ourPpu: 0, compPpu: 0 };

            const evidence = hasData ? cityFilteredPriceData.slice(0, 5).map(p => ({
                city: p.city,
                category: p.category,
                ourPpu: Number(p.ourPpu) || 0,
                compPpu: Number(p.compPpu) || 0,
                impactedSku: p.impactedSku || '-',
                compSku: p.compSku || '-',
                gapPct: Number(p.gapPct) || 0,
                psl: Number(p.psl) || 0,
            })) : [{ city: '-', category: '-', ourPpu: 0, compPpu: 0, impactedSku: '-', compSku: '-', gapPct: 0, psl: 0 }];

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
                platforms: ["-"],
                city: filters.city !== "All cities" ? filters.city : "Multi-city",
                category: filters.category !== "All categories" ? filters.category : "Overall",
                impactInr: totalImpact,
                impactLabel: "Headroom",
                brandName: brandLabel,
                kpis: [
                    { label: "Max GAP %", value: `${(Number(topRow.gapPct) || 0).toFixed(1)}%` },
                    { label: `Avg ${brandLabel} PPU`, value: `₹${(Number(topRow.ourPpu) || 0).toFixed(1)}` },
                ],
                whatWeSee: hasData ? [
                    `${brandLabel} PPU differs from competitor PPU across ${cityFilteredPriceData.length} city-category combinations.`,
                    "Highest GAP % indicates where pricing intervention may be required.",
                ] : ["-", "-"],
                evidence,
            });
        }

        // ---------------------------------------------------------------------
        // SIGNAL 3 — Replenishment Breaks
        // ---------------------------------------------------------------------
        if (!filters.signal || filters.signal === 'All signals' || filters.signal === 'Replenishment Breaks') {
            const hasData = replData.length > 0;
            const avgFillRate = hasData
                ? replData.reduce((sum, r) => sum + Number(r.fillRate), 0) / replData.length
                : 0;
            const impact = hasData
                ? replData.reduce((sum, r) => sum + (Number(r.total_sold) * 0.2 * 150), 0)
                : 0;

            let title3 = "No replenishment breaks detected";
            if (hasData) {
                if (avgFillRate < 50) {
                    title3 = `Critical stockout risk: ${replData.length} SKUs running extremely low (Avg Fill Rate: ${avgFillRate.toFixed(1)}%)`;
                } else if (avgFillRate < 80) {
                    title3 = `Low on-shelf availability (${avgFillRate.toFixed(1)}%) and inventory limits sales velocity`;
                } else {
                    title3 = `Inventory constraint on ${replData.length} SKUs limits optimal sales velocity`;
                }
            }

            insights.push({
                id: "dyn_repl_1",
                type: "Replenishment Breaks",
                title: title3,
                family: "Supply",
                platforms: hasData ? [...new Set(replData.map(r => r.platform))] : ["-"],
                city: filters.city !== "All cities" ? filters.city : "Multi-city",
                category: filters.category !== "All categories" ? filters.category : "Overall",
                impactInr: impact,
                impactLabel: "Loss",
                brandName: brandLabel,
                kpis: [
                    { label: "Avg Fill rate", value: `${avgFillRate.toFixed(1)}%` },
                    { label: "Affected SKUs", value: hasData ? `${replData.length}` : "0" },
                ],
                whatWeSee: hasData ? [
                    "Current inventory levels are insufficient for the current sales velocity.",
                    "On-Shelf Availability (OSA) is falling below the acceptable 80% threshold.",
                ] : ["-", "-"],
                evidence: hasData ? replData.filter(r => isAllowedCity(r.city)).map(r => ({
                    depotOrDb: "Local DC",
                    city: r.city,
                    platform: r.platform,
                    skuOrBrand: r.skuOrBrand,
                    plannedQty: Math.floor(r.total_sold * 1.5),
                    dispatchedQty: Math.floor(r.avg_inventory),
                    fillRate: r.fillRate,
                    poCreated: r.fillRate > 50,
                    poNo: r.fillRate > 50 ? "PO-GEN" : null,
                })) : [{ depotOrDb: '-', city: '-', platform: '-', skuOrBrand: '-', plannedQty: 0, dispatchedQty: 0, fillRate: 0, poCreated: false, poNo: '-' }],
            });
        }

        // ---------------------------------------------------------------------
        // SIGNAL 4 — Keyword Efficiency and Budget Caps
        // ---------------------------------------------------------------------
        if (!filters.signal || filters.signal === 'All signals' || filters.signal === 'Keyword Efficiency and Budget Caps') {
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
                    campaign: `Primary | ${a.platform} | Target`,
                    bid: Number(a.total_spend) / (Number(a.total_sales) || 1),
                    dailyBudget: Number(a.total_spend) * 1.5,
                    spend: Number(a.total_spend),
                    sales: Number(a.total_sales),
                    acos: a.acos != null ? Number(a.acos) : (a.roas > 0 ? (1 / a.roas) * 100 : 0),
                    budgetCapped: Number(a.roas) < 2.0,
                })) : [{ keyword: '-', platform: '-', campaign: '-', bid: 0, dailyBudget: 0, spend: 0, sales: 0, acos: 0, budgetCapped: false }],
            });
        }

        // ---------------------------------------------------------------------
        // SIGNAL 5 — Competitor OSA Weak Spots
        // ---------------------------------------------------------------------
        if (!filters.signal || filters.signal === 'All signals' || filters.signal === 'Competitor OSA Weak Spots') {
            const hasData = compData.length > 0;

            const uniqueCities = hasData ? new Set(compData.map(c => c.city)).size : 0;
            const uniquePlatforms = hasData ? [...new Set(compData.map(c => c.platform))] : ["-"];
            const avgKwOsa = hasData ? compData.reduce((sum, c) => sum + Number(c.kwOsa), 0) / compData.length : 0;
            const avgOtherOsa = hasData ? compData.reduce((sum, c) => sum + Number(c.otherBrandOsa), 0) / compData.length : 0;
            const totalPsl = hasData ? compData.reduce((sum, c) => sum + Number(c.psl || 0), 0) : 0;

            const worstRow = hasData ? compData[0] : { competitor: '-', category: '-', otherBrandOsa: 0 };
            const worstCompetitor = worstRow.competitor || '-';
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
                kpis: [
                    { label: "Other brand OSA", value: `${avgOtherOsa.toFixed(1)}%` },
                    { label: `${brandLabel} OSA`, value: `${avgKwOsa.toFixed(1)}%` },
                    { label: "Cities", value: uniqueCities.toString() },
                ],
                whatWeSee: hasData ? [
                    `${worstCompetitor} is missing on key ${dominantCat} searches (${Number(worstRow.otherBrandOsa).toFixed(0)}% OSA), creating an easy share-grab window.`,
                    `${brandLabel} is in stock (${avgKwOsa.toFixed(0)}% OSA), so conversion is mostly limited by visibility, not supply.`,
                ] : ["-", "-"],
                evidence: hasData ? compData.filter(c => isAllowedCity(c.city)).map(c => ({
                    category: c.category,
                    city: c.city,
                    platform: c.platform,
                    skuOrBrand: c.competitor,
                    otherBrandOsa: Number(c.otherBrandOsa),
                    kwOsa: Number(c.kwOsa),
                    headroomInr: Number(c.psl || 0),
                })) : [{ category: '-', city: '-', platform: '-', skuOrBrand: '-', otherBrandOsa: 0, kwOsa: 0, headroomInr: 0 }],
            });
        }

        // ---------------------------------------------------------------------
        // SIGNAL 6 — Ad Stock Mismatch
        // ---------------------------------------------------------------------
        if (!filters.signal || filters.signal === 'All signals' || filters.signal === 'Ad Stock Mismatch') {
            const hasData = adStockData.length > 0;
            const totalSpend = hasData ? adStockData.reduce((s, r) => s + Number(r.spendInr), 0) : 0;
            const totalLost = hasData ? adStockData.reduce((s, r) => s + Number(r.estLostSalesInr || 0), 0) : 0;
            const avgOsa = hasData ? adStockData.reduce((s, r) => s + Number(r.kwOsa), 0) / adStockData.length : 0;
            const avgSov = hasData ? adStockData.reduce((s, r) => s + Number(r.adSov), 0) / adStockData.length : 0;

            let title6 = "No ad stock mismatches detected";
            if (hasData) {
                if (avgOsa < 50 && totalSpend > 5000) {
                    title6 = `Critical Ad Waste: ₹${Math.round(totalSpend).toLocaleString('en-IN')} spend driving traffic to SKUs with severe low availability (${avgOsa.toFixed(1)}%)`;
                } else {
                    title6 = `Ad spend (₹${Math.round(totalSpend).toLocaleString('en-IN')}) is driving traffic to SKUs with low on-shelf availability (${avgOsa.toFixed(1)}%)`;
                }
            }

            insights.push({
                id: "dyn_adstock_1",
                type: "Ad Stock Mismatch",
                title: title6,
                family: "Performance",
                platforms: hasData ? [...new Set(adStockData.map(r => r.platform))] : ["-"],
                city: filters.city !== "All cities" ? filters.city : "Multi-city",
                category: filters.category !== "All categories" ? filters.category : "Overall",
                impactInr: Math.round(totalLost),
                impactLabel: "Est. Lost Sales",
                brandName: brandLabel,
                kpis: [
                    { label: `${brandLabel} OSA (avg)`, value: `${avgOsa.toFixed(1)}%` },
                    { label: "Ad SOV", value: `${avgSov.toFixed(1)}%` },
                    { label: "Spend", value: `₹${totalSpend.toLocaleString('en-IN')}` },
                ],
                whatWeSee: hasData ? [
                    "Ad budget is actively sending shoppers to listings that frequently show out-of-stock.",
                    "Fixing OSA before increasing bids would convert the existing spend far more efficiently.",
                ] : ["-", "-"],
                evidence: hasData ? adStockData.filter(r => isAllowedCity(r.city)).map(r => ({
                    city: r.city,
                    platform: r.platform,
                    skuOrBrand: r.skuOrBrand,
                    kwOsa: Number(r.kwOsa),
                    adSov: Number(r.adSov),
                    spendInr: Number(r.spendInr),
                    estLostSalesInr: Number(r.estLostSalesInr || 0),
                })) : [{ city: '-', platform: '-', skuOrBrand: '-', kwOsa: 0, adSov: 0, spendInr: 0, estLostSalesInr: 0 }],
            });
        }

        // ---------------------------------------------------------------------
        // SIGNAL 7 — Challenger Launch Watch
        // ---------------------------------------------------------------------
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
                    ppu: Number(r.ppu),
                    firstSeen: String(r.firstSeen),
                })) : [{ city: '-', platform: '-', category: '-', skuOrBrand: '-', newItemShare: 0, ppu: 0, firstSeen: '-' }],
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
        ? buildCHCondition(filters.city, 'location')
        : '1=1';
    const categoryCond = filters.category
        ? buildCHCondition(filters.category, 'category', { isCategory: true })
        : '1=1';

    const kw_platformCond = filters.platform
        ? buildCHCondition(filters.platform, 'platform_name')
        : '1=1';
    const kw_locationCond = filters.city
        ? buildCHCondition(filters.city, 'location_name')
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