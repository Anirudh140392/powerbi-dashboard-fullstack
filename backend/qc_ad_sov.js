import 'dotenv/config';
import { queryClickHouse } from './src/config/clickhouse.js';

const dateFrom = '2026-03-07';
const dateTo = '2026-04-06';

const prevStartDate = '2026-02-04';
const prevEndDate = '2026-03-06';

async function run() {
    const query = `
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
            multiIf(LOWER(p.Location) IN ('gurgaon','gurugram'), 'Gurugram', LOWER(p.Location) IN ('bangalore','bengaluru'), 'Bengaluru', initCap(p.Location))  AS city,
            p.Platform  AS platform,
            p.Product   AS skuOrBrand,
            ROUND(
                SUM(toFloat64OrZero(toString(p.neno_osa))) * 100.0 /
                nullIf(SUM(toFloat64OrZero(toString(p.deno_osa))), 0),
            1) AS kwOsa,
            ROUND(
                SUM(s.own_spons) * 100.0 / nullIf(SUM(s.total_spons), 0),
            2) AS adSov,
            ROUND(SUM(ifNull(p.Ad_Spend, 0)), 0) AS spendInr
        FROM rb_pdp_olap p
        LEFT JOIN product_daily_sov s 
            ON p.Web_Pid = s.web_pid 
           AND p.Platform = s.platform_name 
           AND p.Location = s.location_name
           AND p.DATE = s.DATE
        WHERE p.DATE BETWEEN '${dateFrom}' AND '${dateTo}'
          AND p.Comp_flag IN (0, '0')
          AND p.Product = 'Snickers Nuts Brownie Bar'
          AND LOWER(p.Location) = 'chennai'
        GROUP BY city, platform, skuOrBrand
    `;

    try {
        const res = await queryClickHouse(query);
        console.log("Current Period Results:");
        console.table(res);
    } catch (e) {
        console.error(e);
    }
}

run();
