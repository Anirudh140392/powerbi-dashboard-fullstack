const fs = require('fs');

const servicePath = '/home/yash04/trailytics/powerbi-dashboard-fullstack/backend/src/services/insightsService.js';
let serviceSource = fs.readFileSync(servicePath, 'utf8');

// 1. Rewrite pricingQuery
const newPricingQuery = `    const pricingQuery = \`
        WITH our_brand AS (
            SELECT 
                \${CITY_NORM_EXPR('Location')} AS city,
                Platform AS platform,
                \${catField} AS category,
                ROUND(
                    AVG(
                        toFloat64OrZero(toString(Selling_Price)) /
                        nullIf(\${weightExpr}, 0) * 10
                    ),
                2) AS our_ppu,
                argMax(Product, toFloat64OrZero(toString(Sales))) AS impacted_sku,
                SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) AS our_sales,
                SUM(toFloat64OrZero(toString(neno_osa))) AS our_neno,
                SUM(toFloat64OrZero(toString(deno_osa))) AS our_deno
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '\${dateFrom}' AND '\${dateTo}'
              AND Comp_flag IN (0, '0')
              AND \${weightExpr} > 0
              AND toFloat64OrZero(toString(Selling_Price)) > 0
              AND \${buildCHCondition(filters.platform, 'Platform', { isPdp: true })}
              AND \${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })}
              AND \${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
            GROUP BY city, platform, category
        ),
        comp_brand AS (
            SELECT 
                \${CITY_NORM_EXPR('Location')} AS city,
                Platform AS platform,
                \${catField} AS category,
                ROUND(
                    AVG(
                        toFloat64OrZero(toString(Selling_Price)) /
                        nullIf(\${weightExpr}, 0) * 10
                    ),
                2) AS comp_ppu,
                argMax(toString(Product), toFloat64OrZero(toString(Selling_Price))) AS comp_sku
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '\${dateFrom}' AND '\${dateTo}'
              AND Comp_flag IN (1, '1')
              AND \${weightExpr} > 0
              AND toFloat64OrZero(toString(Selling_Price)) > 0
              AND \${buildCHCondition(filters.platform, 'Platform', { isPdp: true })}
              AND \${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })}
              AND \${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
            GROUP BY city, platform, category
        ),
        curr_gap AS (
            SELECT o.city, o.platform, o.category, o.our_ppu, c.comp_ppu, o.impacted_sku, c.comp_sku,
                   ROUND((o.our_ppu - c.comp_ppu) / nullIf(c.comp_ppu, 0) * 100, 2) AS gapPct,
                   ROUND(o.our_sales * ((100.0 / nullIf(ROUND(o.our_neno * 100.0 / nullIf(o.our_deno, 0), 2), 0)) - 1), 0) AS psl,
                   o.our_sales AS totalSales
            FROM our_brand o JOIN comp_brand c ON o.city = c.city AND o.platform = c.platform AND o.category = c.category
            WHERE c.comp_ppu > 0
        ),
        our_brand_prev AS (
            SELECT \${CITY_NORM_EXPR('Location')} AS city, Platform AS platform, \${catField} AS category,
                   ROUND(AVG(toFloat64OrZero(toString(Selling_Price)) / nullIf(\${weightExpr}, 0) * 10), 2) AS our_ppu
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '\${prevStartDate}' AND '\${prevEndDate}'
              AND Comp_flag IN (0, '0') AND \${weightExpr} > 0 AND toFloat64OrZero(toString(Selling_Price)) > 0
              AND \${buildCHCondition(filters.platform, 'Platform', { isPdp: true })}
              AND \${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })}
              AND \${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
            GROUP BY city, platform, category
        ),
        comp_brand_prev AS (
            SELECT \${CITY_NORM_EXPR('Location')} AS city, Platform AS platform, \${catField} AS category,
                   ROUND(AVG(toFloat64OrZero(toString(Selling_Price)) / nullIf(\${weightExpr}, 0) * 10), 2) AS comp_ppu
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '\${prevStartDate}' AND '\${prevEndDate}'
              AND Comp_flag IN (1, '1') AND \${weightExpr} > 0 AND toFloat64OrZero(toString(Selling_Price)) > 0
              AND \${buildCHCondition(filters.platform, 'Platform', { isPdp: true })}
              AND \${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })}
              AND \${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
            GROUP BY city, platform, category
        ),
        prev_gap AS (
            SELECT o.city, o.platform, o.category,
                   ROUND((o.our_ppu - c.comp_ppu) / nullIf(c.comp_ppu, 0) * 100, 2) AS prevGapPct,
                   o.our_ppu AS prevOurPpu,
                   c.comp_ppu AS prevCompPpu
            FROM our_brand_prev o JOIN comp_brand_prev c ON o.city = c.city AND o.platform = c.platform AND o.category = c.category
            WHERE c.comp_ppu > 0
        )
        SELECT curr.city AS city, curr.platform AS platform, curr.category AS category,
               curr.our_ppu AS ourPpu, curr.comp_ppu AS compPpu,
               curr.impacted_sku AS impactedSku, curr.comp_sku AS compSku,
               curr.gapPct AS gapPct, curr.psl AS psl, curr.totalSales AS totalSales,
               ifNull(prev.prevGapPct, 0) AS prevGapPct,
               (curr.gapPct - ifNull(prev.prevGapPct, curr.gapPct)) AS gapPctChange,
               (curr.our_ppu - ifNull(prev.prevOurPpu, curr.our_ppu)) AS ourPpuChange,
               (curr.comp_ppu - ifNull(prev.prevCompPpu, curr.comp_ppu)) AS compPpuChange
        FROM curr_gap curr
        LEFT JOIN prev_gap prev ON curr.city = prev.city AND curr.platform = prev.platform AND curr.category = prev.category
        ORDER BY curr.gapPct DESC
    \`;`;

serviceSource = serviceSource.replace(/const pricingQuery = `[\s\S]*?ORDER BY gapPct DESC\n    `;/, newPricingQuery);

// 2. Rewrite replenishmentQuery
const newReplQuery = `    const replenishmentQuery = \`
        WITH curr AS (
            SELECT 
                \${CITY_NORM_EXPR('Location')} AS city,
                Platform AS platform,
                \${catField} AS category,
                Brand AS skuOrBrand,
                SUM(ifNull(toFloat64OrZero(toString(Qty_Sold)),   0)) AS total_sold,
                AVG(ifNull(toFloat64OrZero(toString(Inventory)),  0)) AS avg_inventory,
                ROUND(
                    SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) * 100.0 /
                    nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0),
                1) AS fillRate
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '\${dateFrom}' AND '\${dateTo}'
              AND Comp_flag IN (0, '0')
              AND \${buildCHCondition(filters.platform, 'Platform', { isPdp: true })}
              AND \${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })}
              AND \${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
            GROUP BY city, platform, category, skuOrBrand
        ),
        prev AS (
            SELECT 
                \${CITY_NORM_EXPR('Location')} AS city,
                Platform AS platform,
                \${catField} AS category,
                Brand AS skuOrBrand,
                ROUND(
                    SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) * 100.0 /
                    nullIf(SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0),
                1) AS prevFillRate
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '\${prevStartDate}' AND '\${prevEndDate}'
              AND Comp_flag IN (0, '0')
              AND \${buildCHCondition(filters.platform, 'Platform', { isPdp: true })}
              AND \${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })}
              AND \${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
            GROUP BY city, platform, category, skuOrBrand
        )
        SELECT c.city AS city, c.platform AS platform, c.category AS category, c.skuOrBrand AS skuOrBrand,
               c.total_sold AS total_sold, c.avg_inventory AS avg_inventory, c.fillRate AS fillRate,
               ifNull(p.prevFillRate, c.fillRate) AS prevFillRate,
               (c.fillRate - ifNull(p.prevFillRate, c.fillRate)) AS fillRateChangePct
        FROM curr c LEFT JOIN prev p ON c.city = p.city AND c.platform = p.platform AND c.category = p.category AND c.skuOrBrand = p.skuOrBrand
        HAVING c.fillRate < 80 OR c.avg_inventory < 10
        ORDER BY c.total_sold DESC
        LIMIT 10
    \`;`;
serviceSource = serviceSource.replace(/const replenishmentQuery = `[\s\S]*?LIMIT 10\n    `;/, newReplQuery);

// 3. Rewrite adStockQuery
const newAdStockQuery = `    const adStockQuery = \`
        WITH kw_products AS (
            SELECT DISTINCT
                keyword,
                platform_name AS platform,
                \${CITY_NORM_EXPR('location_name')} AS city,
                keyword_category AS category,
                web_pid
            FROM rb_kw_olap
            WHERE DATE BETWEEN '\${dateFrom}' AND '\${dateTo}'
              AND flag = 1
              AND web_pid IS NOT NULL AND web_pid != ''
              AND \${buildCHCondition(filters.platform, 'platform_name')}
              AND \${buildCHCondition(filters.city, CITY_NORM_EXPR('location_name'))}
              AND \${buildCHCondition(filters.category, 'keyword_category', { isCategory: true })}
        ),
        curr AS (
            SELECT
                kp.platform, kp.city, kp.category, kp.keyword,
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
            JOIN rb_pdp_olap p ON kp.web_pid = p.Web_Pid AND kp.platform = p.Platform
            WHERE p.DATE BETWEEN '\${dateFrom}' AND '\${dateTo}' AND p.Comp_flag IN (0, '0')
            GROUP BY kp.platform, kp.city, kp.category, kp.keyword
        ),
        prev_kw_products AS (
            SELECT DISTINCT keyword, platform_name AS platform, \${CITY_NORM_EXPR('location_name')} AS city, keyword_category AS category, web_pid
            FROM rb_kw_olap
            WHERE DATE BETWEEN '\${prevStartDate}' AND '\${prevEndDate}' AND flag = 1 AND web_pid IS NOT NULL AND web_pid != ''
              AND \${buildCHCondition(filters.platform, 'platform_name')}
              AND \${buildCHCondition(filters.city, CITY_NORM_EXPR('location_name'))}
              AND \${buildCHCondition(filters.category, 'keyword_category', { isCategory: true })}
        ),
        prev AS (
            SELECT
                kp.platform, kp.city, kp.category, kp.keyword,
                ROUND(SUM(toFloat64OrZero(toString(p.Ad_Spend))) / nullIf(SUM(toFloat64OrZero(toString(p.Sales))), 0) * 100, 1) AS prevAcos
            FROM prev_kw_products kp
            JOIN rb_pdp_olap p ON kp.web_pid = p.Web_Pid AND kp.platform = p.Platform
            WHERE p.DATE BETWEEN '\${prevStartDate}' AND '\${prevEndDate}' AND p.Comp_flag IN (0, '0')
            GROUP BY kp.platform, kp.city, kp.category, kp.keyword
        )
        SELECT c.*, ifNull(p.prevAcos, c.acos) AS prevAcos, (c.acos - ifNull(p.prevAcos, c.acos)) AS acosChangePct
        FROM curr c LEFT JOIN prev p ON c.platform = p.platform AND c.city = p.city AND c.category = p.category AND c.keyword = p.keyword
        HAVING c.total_spend > 500 AND c.roas < 2.0
        ORDER BY c.total_spend DESC
        LIMIT 10
    \`;`;
serviceSource = serviceSource.replace(/const adStockQuery = `[\s\S]*?LIMIT 10\n    `;/, newAdStockQuery);


// 4. Rewrite buildCompetitorOsaQuery
const newCompOsaQuery = `    const buildCompetitorOsaQuery = (rbMsOlapExists) => \`
        WITH 
            \${rbMsOlapExists ? \`
            total_market_sales AS (
                SELECT LOWER(trim(\${CITY_NORM_EXPR('location')})) AS join_city, LOWER(trim(platform)) AS join_platform, LOWER(trim(category)) AS join_category, SUM(toFloat64OrZero(toString(sales))) AS total_sales
                FROM rb_ms_olap WHERE created_on BETWEEN '\${dateFrom}' AND '\${dateTo}'
                  AND \${buildCHCondition(filters.platform, 'platform')} AND \${buildCHCondition(filters.city, CITY_NORM_EXPR('location'))} AND \${buildCHCondition(filters.category, 'category', { isCategory: true })}
                GROUP BY join_city, join_platform, join_category HAVING total_sales > 0
            ),
            brand_market_share AS (
                SELECT LOWER(trim(replaceRegexpAll(group_brand, '[^a-zA-Z0-9 ]', ''))) AS join_brand, LOWER(trim(\${CITY_NORM_EXPR('location')})) AS join_city, LOWER(trim(platform)) AS join_platform, LOWER(trim(category)) AS join_category, SUM(toFloat64OrZero(toString(sales))) AS brand_sales
                FROM rb_ms_olap WHERE created_on BETWEEN '\${dateFrom}' AND '\${dateTo}'
                  AND \${buildCHCondition(filters.platform, 'platform')} AND \${buildCHCondition(filters.city, CITY_NORM_EXPR('location'))} AND \${buildCHCondition(filters.category, 'category', { isCategory: true })}
                GROUP BY join_brand, join_city, join_platform, join_category
            ),\` : ''}
            our_brand_osa AS (
                SELECT if(empty(trim(Location)), '-', Location) AS raw_city, if(empty(trim(Platform)), '-', Platform) AS raw_platform, if(empty(trim(\${catField})), '-', \${catField}) AS raw_category,
                    LOWER(trim(\${CITY_NORM_EXPR('Location')})) AS join_city, LOWER(trim(Platform)) AS join_platform, LOWER(trim(\${catField})) AS join_category, LOWER(trim(replaceRegexpAll(Brand, '[^a-zA-Z0-9 ]', ''))) AS join_brand,
                    round((sum(toFloat64OrZero(toString(neno_osa))) / nullIf(sum(toFloat64OrZero(toString(deno_osa))), 0)) * 100, 2) AS kw_osa
                FROM rb_pdp_olap WHERE DATE BETWEEN '\${dateFrom}' AND '\${dateTo}' AND Comp_flag IN (0, '0') AND LOWER(trim(replaceRegexpAll(Brand, '[^a-zA-Z0-9 ]', ''))) = '\${brandLabel.toLowerCase()}'
                  AND \${CITY_NORM_EXPR('Location')} IN (\${ALLOWED_CITIES_SQL}) AND \${buildCHCondition(filters.platform, 'Platform', { isPdp: true })} AND \${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })} AND \${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
                GROUP BY raw_city, raw_platform, raw_category, join_city, join_platform, join_category, join_brand HAVING kw_osa IS NOT NULL
            ),
            other_brand_osa AS (
                SELECT if(empty(trim(Location)), '-', Location) AS raw_city, if(empty(trim(Platform)), '-', Platform) AS raw_platform, if(empty(trim(\${catField})), '-', \${catField}) AS raw_category,
                    LOWER(trim(\${CITY_NORM_EXPR('Location')})) AS join_city, LOWER(trim(Platform)) AS join_platform, LOWER(trim(\${catField})) AS join_category, Brand AS raw_competitor, LOWER(trim(replaceRegexpAll(Brand, '[^a-zA-Z0-9 ]', ''))) AS join_competitor,
                    round((sum(toFloat64OrZero(toString(neno_osa))) / nullIf(sum(toFloat64OrZero(toString(deno_osa))), 0)) * 100, 2) AS comp_osa
                FROM rb_pdp_olap WHERE DATE BETWEEN '\${dateFrom}' AND '\${dateTo}' AND Comp_flag IN (1, '1') AND Brand IS NOT NULL AND Brand != '' AND \${CITY_NORM_EXPR('Location')} IN (\${ALLOWED_CITIES_SQL}) AND \${buildCHCondition(filters.platform, 'Platform', { isPdp: true })} AND \${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })} AND \${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
                GROUP BY raw_city, raw_platform, raw_category, join_city, join_platform, join_category, raw_competitor, join_competitor
            ),
            our_brand_osa_prev AS (
                SELECT LOWER(trim(\${CITY_NORM_EXPR('Location')})) AS join_city, LOWER(trim(Platform)) AS join_platform, LOWER(trim(\${catField})) AS join_category, LOWER(trim(replaceRegexpAll(Brand, '[^a-zA-Z0-9 ]', ''))) AS join_brand,
                    round((sum(toFloat64OrZero(toString(neno_osa))) / nullIf(sum(toFloat64OrZero(toString(deno_osa))), 0)) * 100, 2) AS prev_kw_osa
                FROM rb_pdp_olap WHERE DATE BETWEEN '\${prevStartDate}' AND '\${prevEndDate}' AND Comp_flag IN (0, '0') AND LOWER(trim(replaceRegexpAll(Brand, '[^a-zA-Z0-9 ]', ''))) = '\${brandLabel.toLowerCase()}'
                  AND \${CITY_NORM_EXPR('Location')} IN (\${ALLOWED_CITIES_SQL}) AND \${buildCHCondition(filters.platform, 'Platform', { isPdp: true })} AND \${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })} AND \${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
                GROUP BY join_city, join_platform, join_category, join_brand
            ),
            other_brand_osa_prev AS (
                SELECT LOWER(trim(\${CITY_NORM_EXPR('Location')})) AS join_city, LOWER(trim(Platform)) AS join_platform, LOWER(trim(\${catField})) AS join_category, LOWER(trim(replaceRegexpAll(Brand, '[^a-zA-Z0-9 ]', ''))) AS join_competitor,
                    round((sum(toFloat64OrZero(toString(neno_osa))) / nullIf(sum(toFloat64OrZero(toString(deno_osa))), 0)) * 100, 2) AS prev_comp_osa
                FROM rb_pdp_olap WHERE DATE BETWEEN '\${prevStartDate}' AND '\${prevEndDate}' AND Comp_flag IN (1, '1') AND Brand IS NOT NULL AND Brand != '' AND \${CITY_NORM_EXPR('Location')} IN (\${ALLOWED_CITIES_SQL}) AND \${buildCHCondition(filters.platform, 'Platform', { isPdp: true })} AND \${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })} AND \${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
                GROUP BY join_city, join_platform, join_category, join_competitor
            )
        SELECT 
            other.raw_city AS city, other.raw_platform AS platform, other.raw_category AS category, other.raw_competitor AS skuOrBrand, 
            other.comp_osa  AS otherBrandOsa, ifNull(our.kw_osa, 0) AS kwOsa,
            (other.comp_osa - ifNull(other_prev.prev_comp_osa, other.comp_osa)) AS otherBrandOsaChangePct,
            (ifNull(our.kw_osa, 0) - ifNull(our_prev.prev_kw_osa, ifNull(our.kw_osa, 0))) AS kwOsaChangePct,
            \${rbMsOlapExists ? \`
            ROUND((ifNull(other_ms.brand_sales, 0) / nullIf(tms.total_sales, 0)) * 100, 2) AS otherBrandMkShare,
            ROUND((ifNull(our_ms.brand_sales, 0) / nullIf(tms.total_sales, 0)) * 100, 2) AS ourBrandMkShare,
            round((ifNull(other_ms.brand_sales, 0) / nullIf(greatest(other.comp_osa, 10) / 100.0, 0)) - ifNull(other_ms.brand_sales, 0), 0) AS psl
            \` : \`
            NULL AS otherBrandMkShare, NULL AS ourBrandMkShare, 0 AS psl
            \`}
        FROM other_brand_osa other
        LEFT JOIN our_brand_osa our ON our.join_city = other.join_city AND our.join_platform = other.join_platform AND our.join_category = other.join_category
        LEFT JOIN our_brand_osa_prev our_prev ON our_prev.join_city = other.join_city AND our_prev.join_platform = other.join_platform AND our_prev.join_category = other.join_category
        LEFT JOIN other_brand_osa_prev other_prev ON other_prev.join_city = other.join_city AND other_prev.join_platform = other.join_platform AND other_prev.join_category = other.join_category AND other_prev.join_competitor = other.join_competitor
        \${rbMsOlapExists ? \`
        LEFT JOIN total_market_sales tms ON tms.join_city = other.join_city AND tms.join_platform = other.join_platform AND tms.join_category = other.join_category
        LEFT JOIN brand_market_share other_ms ON other_ms.join_brand = other.join_competitor AND other_ms.join_city = other.join_city AND other_ms.join_platform = other.join_platform AND other_ms.join_category = other.join_category
        LEFT JOIN brand_market_share our_ms ON our_ms.join_brand = our.join_brand AND our_ms.join_city = other.join_city AND our_ms.join_platform = other.join_platform AND our_ms.join_category = other.join_category
        \` : ''}
        WHERE other.comp_osa < 60 AND ifNull(our.kw_osa, 0) > 60 AND other.comp_osa IS NOT NULL
        ORDER BY (ifNull(our.kw_osa, 0) - other.comp_osa) DESC 
        LIMIT 20
    \`;`;
serviceSource = serviceSource.replace(/const buildCompetitorOsaQuery = \(rbMsOlapExists\) => `[\s\S]*?LIMIT 20\n    `;/, newCompOsaQuery);

// 5. Rewrite challengerLaunchQuery
const newChallengerQuery = `    const challengerLaunchQuery = \`
        WITH curr AS (
            SELECT
                \${CITY_NORM_EXPR('Location')}  AS city, Platform AS platform, \${catField} AS category, Brand AS skuOrBrand, Product AS productName,
                ROUND(SUM(toFloat64OrZero(if(Organic_SOS IS NULL OR Organic_SOS = '', '0', Organic_SOS))) * 100.0 / nullIf(COUNT(*), 0), 2) AS newItemShare,
                ROUND(AVG(toFloat64OrZero(toString(Selling_Price))), 0) AS ppu, MIN(DATE) AS firstSeen
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '\${dateFrom}' AND '\${dateTo}' AND Comp_flag IN (1, '1') AND Brand IS NOT NULL AND Brand != '' AND Product IS NOT NULL AND Product != ''
              AND \${buildCHCondition(filters.platform, 'Platform', { isPdp: true })} AND \${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })} AND \${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
            GROUP BY city, platform, category, skuOrBrand, productName
            HAVING MIN(DATE) >= '\${dateFrom}' AND newItemShare > 0
        ),
        prev AS (
            SELECT \${CITY_NORM_EXPR('Location')} AS city, Platform AS platform, \${catField} AS category, Brand AS skuOrBrand, Product AS productName,
                ROUND(SUM(toFloat64OrZero(if(Organic_SOS IS NULL OR Organic_SOS = '', '0', Organic_SOS))) * 100.0 / nullIf(COUNT(*), 0), 2) AS prevNewItemShare
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '\${prevStartDate}' AND '\${prevEndDate}' AND Comp_flag IN (1, '1') AND Brand IS NOT NULL AND Brand != '' AND Product IS NOT NULL AND Product != ''
              AND \${buildCHCondition(filters.platform, 'Platform', { isPdp: true })} AND \${buildCHCondition(filters.city, CITY_NORM_EXPR('Location'), { isPdp: true })} AND \${buildCHCondition(filters.category, catField, { isCategory: true, isPdp: true })}
            GROUP BY city, platform, category, skuOrBrand, productName
        )
        SELECT c.*, ifNull(p.prevNewItemShare, 0) AS prevNewItemShare, (c.newItemShare - ifNull(p.prevNewItemShare, 0)) AS newItemShareChangePct
        FROM curr c LEFT JOIN prev p ON c.city = p.city AND c.platform = p.platform AND c.category = p.category AND c.skuOrBrand = p.skuOrBrand AND c.productName = p.productName
        ORDER BY c.newItemShare DESC
        LIMIT 10
    \`;`;
serviceSource = serviceSource.replace(/const challengerLaunchQuery = `[\s\S]*?LIMIT 10\n    `;/, newChallengerQuery);

// Update maps logic slightly for properties
serviceSource = serviceSource.replace(
    /gapPct: Number\(p\.gapPct\) \|\| 0,/g,
    "gapPct: Number(p.gapPct) || 0,\n                gapPctChange: Number(p.gapPctChange) || 0,\n                ourPpuChange: Number(p.ourPpuChange) || 0,\n                compPpuChange: Number(p.compPpuChange) || 0,"
);
serviceSource = serviceSource.replace(
    /fillRate: r\.fillRate,/g,
    "fillRate: r.fillRate,\n                    fillRateChangePct: Number(r.fillRateChangePct) || 0,"
);
serviceSource = serviceSource.replace(
    /acos: a\.acos != null \? Number\(a\.acos\) : \(a\.roas > 0 \? \(1 \/ a\.roas\) \* 100 : 0\),/g,
    "acos: a.acos != null ? Number(a.acos) : (a.roas > 0 ? (1 / a.roas) * 100 : 0),\n                    acosChangePct: Number(a.acosChangePct) || 0," 
);
serviceSource = serviceSource.replace(
    /otherBrandOsa: Number\(c\.otherBrandOsa\),/g,
    "otherBrandOsa: Number(c.otherBrandOsa),\n                    otherBrandOsaChangePct: Number(c.otherBrandOsaChangePct) || 0,"
);
serviceSource = serviceSource.replace(
    /kwOsa: Number\(c\.kwOsa\),/g,
    "kwOsa: Number(c.kwOsa),\n                    kwOsaChangePct: Number(c.kwOsaChangePct) || 0,"
);
serviceSource = serviceSource.replace(
    /newItemShare: Number\(r\.newItemShare\),/g,
    "newItemShare: Number(r.newItemShare),\n                    newItemShareChangePct: Number(r.newItemShareChangePct) || 0,"
);

fs.writeFileSync(servicePath, serviceSource);

// Modify Insights.jsx to display these things
const uiPath = '/home/yash04/trailytics/powerbi-dashboard-fullstack/frontend/src/pages/Insights/Insights.jsx';
let uiSource = fs.readFileSync(uiPath, 'utf8');

uiSource = uiSource.replace(
    `{ key: "gapPct", label: "GAP %", fmt: safePct, isNum: true },`,
    `{ key: "gapPct", label: "GAP % (Change)", fmt: (v, r) => \\\`\\\${safePct(v)} (\\\${r.gapPctChange > 0 ? '+' : ''}\\\${safePct(r.gapPctChange)})\\\` },`
);

uiSource = uiSource.replace(
    `{ key: "ourPpu", label: \`\${insight.brandName || "Our"} PPU\`, fmt: (v) => v != null ? \`₹\${Number(v).toFixed(1)}\` : "-" },`,
    `{ key: "ourPpu", label: \`\${insight.brandName || "Our"} PPU\`, fmt: (v, r) => v != null ? \`₹\${Number(v).toFixed(1)} (\${r.ourPpuChange > 0 ? '+' : ''}\${Number(r.ourPpuChange).toFixed(1)})\` : "-" },`
);

uiSource = uiSource.replace(
    `{ key: "compPpu", label: "Comp PPU", fmt: (v) => v != null ? \`₹\${Number(v).toFixed(1)}\` : "-" },`,
    `{ key: "compPpu", label: "Comp PPU", fmt: (v, r) => v != null ? \`₹\${Number(v).toFixed(1)} (\${r.compPpuChange > 0 ? '+' : ''}\${Number(r.compPpuChange).toFixed(1)})\` : "-" },`
);

uiSource = uiSource.replace(
    `{ key: "fillRate", label: "Fill Rate", fmt: safePct },`,
    `{ key: "fillRate", label: "Fill Rate", fmt: (v, r) => \\\`\\\${safePct(v)} (\\\${r.fillRateChangePct > 0 ? '+' : ''}\\\${safePct(r.fillRateChangePct)})\\\` },`
);

uiSource = uiSource.replace(
    `{ key: "acos", label: "ACOS", fmt: safePct },`,
    `{ key: "acos", label: "ACOS", fmt: (v, r) => \\\`\\\${safePct(v)} (\\\${r.acosChangePct > 0 ? '+' : ''}\\\${safePct(r.acosChangePct)})\\\` },`
);

uiSource = uiSource.replace(
    `{ key: "otherBrandOsa", label: "Comp OSA", fmt: safePct },`,
    `{ key: "otherBrandOsa", label: "Comp OSA", fmt: (v, r) => \\\`\\\${safePct(v)} (\\\${r.otherBrandOsaChangePct > 0 ? '+' : ''}\\\${safePct(r.otherBrandOsaChangePct)})\\\` },`
);

uiSource = uiSource.replace(
    `{ key: "kwOsa", label: \`\${insight.brandName || "Brand"} OSA\`, fmt: safePct },`,
    `{ key: "kwOsa", label: \`\${insight.brandName || "Brand"} OSA\`, fmt: (v, r) => \\\`\\\${safePct(v)} (\\\${r.kwOsaChangePct > 0 ? '+' : ''}\\\${safePct(r.kwOsaChangePct)})\\\` },`
);

uiSource = uiSource.replace(
    `{ key: "newItemShare", label: "Share", fmt: safePct },`,
    `{ key: "newItemShare", label: "Share", fmt: (v, r) => \\\`\\\${safePct(v)} (\\\${r.newItemShareChangePct > 0 ? '+' : ''}\\\${safePct(r.newItemShareChangePct)})\\\` },`
);

fs.writeFileSync(uiPath, uiSource);
console.log("Done");
