import { createClient } from '@clickhouse/client';
import 'dotenv/config';

const client = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'mamaearth',
});

async function main() {
    try {
        const query = `
            WITH brand_counts AS (
                SELECT
                    platform_name,
                    brand_name_th,
                    SUM(toFloat64(overall)) AS brand_overall,
                    SUM(toFloat64(spons)) AS brand_sponsored,
                    SUM(toFloat64(organic)) AS brand_organic,
                    count(*) as impressions,
                    0 as search_volume,
                    arrayElement(topKIf(1)(toInt32(POSITION), toInt32(spons) = 1), 1) AS ad_position,
                    arrayElement(topKIf(1)(toInt32(POSITION), toInt32(organic) = 1), 1) AS organic_position
                FROM rb_kw_olap
                WHERE DATE BETWEEN '2026-06-01' AND '2026-06-30'
                  AND platform_name = 'blinkit'
                  AND brand_name_th IS NOT NULL AND brand_name_th != ''
                GROUP BY platform_name, brand_name_th
            )
            SELECT
                brand_name_th as name,
                brand_name_th as brand_name,
                '' as web_pid,
                sum(brand_overall) as num_overall,
                any(total_visible_rows) as den_overall,
                ROUND(sum(brand_overall) * 100.0 / nullIf(any(total_visible_rows), 0), 2) AS overall_sos,
                
                sum(brand_organic) as num_organic,
                any(total_organic_rows) as den_organic,
                ROUND(sum(brand_organic) * 100.0 / nullIf(any(total_organic_rows), 0), 2) AS organic_sos,
                
                sum(brand_sponsored) as num_spons,
                any(total_ad_rows) as den_spons,
                ROUND(sum(brand_sponsored) * 100.0 / nullIf(any(total_ad_rows), 0), 2) AS paid_sos,
                
                sum(impressions) as impressions,
                any(search_volume) as search_volume,
                arrayElement(topK(1)(ad_position), 1) as ad_position,
                arrayElement(topK(1)(organic_position), 1) as organic_position
            FROM (
                SELECT
                    *,
                    SUM(brand_overall) OVER (PARTITION BY platform_name) AS total_visible_rows,
                    SUM(brand_sponsored) OVER (PARTITION BY platform_name) AS total_ad_rows,
                    SUM(brand_organic) OVER (PARTITION BY platform_name) AS total_organic_rows
                FROM brand_counts
            )
            GROUP BY brand_name_th
            ORDER BY overall_sos DESC
            LIMIT 10
        `;
        const res = await client.query({ query, format: 'JSONEachRow' });
        console.table(await res.json());
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

main();
