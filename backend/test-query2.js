import { ClickHouse } from 'clickhouse';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const clickhouse = new ClickHouse({
  url: process.env.CLICKHOUSE_URL || 'http://localhost',
  port: process.env.CLICKHOUSE_PORT || 8123,
  debug: false,
  basicAuth: {
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
  },
  format: 'json',
});

const q = `
WITH curr_keyword_stats AS (
            SELECT 
                keyword,
                location_name,
                platform_name,
                DATE,
                sum(toFloat64OrZero(toString(spons))) AS total_kw_spons
            FROM mars.rb_kw_olap
            WHERE DATE BETWEEN '2024-01-01' AND '2024-01-31'
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
            FROM mars.rb_kw_olap
            WHERE flag = 1
              AND DATE BETWEEN '2024-01-01' AND '2024-01-31'
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
                p.Location  AS city,
                p.Platform  AS platform,
                category AS category,
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
            FROM mars.rb_pdp_olap p
            LEFT JOIN curr_product_daily_sov s 
                ON p.Web_Pid = s.web_pid 
               AND p.Platform = s.platform_name 
               AND p.Location = s.location_name
               AND p.DATE = s.DATE
            WHERE p.DATE BETWEEN '2024-01-01' AND '2024-01-31'
              AND p.Comp_flag IN (0, '0')
              AND p.Ad_Spend > 0
              AND p.Product IS NOT NULL
              AND p.Product != ''
            GROUP BY city, platform, category, skuOrBrand
        ),
        prev_keyword_stats AS (
            SELECT 
                keyword,
                location_name,
                platform_name,
                DATE,
                sum(toFloat64OrZero(toString(spons))) AS total_kw_spons
            FROM mars.rb_kw_olap
            WHERE DATE BETWEEN '2023-12-01' AND '2023-12-31'
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
            FROM mars.rb_kw_olap
            WHERE flag = 1
              AND DATE BETWEEN '2023-12-01' AND '2023-12-31'
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
                p.Location  AS city,
                p.Platform  AS platform,
                category AS category,
                p.Product   AS skuOrBrand,
                ROUND(
                    SUM(toFloat64OrZero(toString(p.neno_osa))) * 100.0 /
                    nullIf(SUM(toFloat64OrZero(toString(p.deno_osa))), 0),
                1) AS prevKwOsa,
                ROUND(
                    SUM(s.own_spons) * 100.0 / nullIf(SUM(s.total_spons), 0),
                2) AS prevAdSov
            FROM mars.rb_pdp_olap p
            LEFT JOIN prev_product_daily_sov s 
                ON p.Web_Pid = s.web_pid 
               AND p.Platform = s.platform_name 
               AND p.Location = s.location_name
               AND p.DATE = s.DATE
            WHERE p.DATE BETWEEN '2023-12-01' AND '2023-12-31'
              AND p.Comp_flag IN (0, '0')
              AND p.Product IS NOT NULL
              AND p.Product != ''
            GROUP BY city, platform, category, skuOrBrand
        )
        SELECT
            c.city, c.platform, c.category, c.skuOrBrand, c.kwOsa, c.adSov, c.spendInr, c.estLostSalesInr,
            ifNull(p.prevKwOsa, 0) AS prevKwOsa,
            ifNull(p.prevAdSov, 0) AS prevAdSov,
            (c.kwOsa - ifNull(p.prevKwOsa, 0)) AS kwOsaChangePct,
            (c.adSov - ifNull(p.prevAdSov, 0)) AS adSovChangePct,
            sp.image_url AS imageUrl
        FROM curr_main c
        LEFT JOIN prev_main p ON c.city = p.city AND c.platform = p.platform AND c.category = p.category AND c.skuOrBrand = p.skuOrBrand
        LEFT JOIN mars.rb_sku_platform sp ON c.web_pid = sp.web_pid
        HAVING c.kwOsa < 60 AND kwOsaChangePct < 0 AND adSovChangePct > 0 AND c.spendInr > 500
        ORDER BY adSovChangePct DESC
        LIMIT 3 BY platform
        LIMIT 15
`;

clickhouse.query(q).exec(function (err, rows) {
    if (err) console.error("ERR:", err.message);
    else console.log("ROWS:", rows.length);
});
