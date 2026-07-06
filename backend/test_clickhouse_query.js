import dotenv from 'dotenv';
import { createClient } from '@clickhouse/client';

dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DB,
});

async function testQuery() {
    try {
        console.log(`Connecting to Clickhouse URL: ${process.env.CLICKHOUSE_URL} (DB: ${process.env.CLICKHOUSE_DB})`);
        
        const dateFrom = '2026-06-01';
        const dateTo = '2026-06-30';
        const platformCondition = "LOWER(platform_name) IN ('blinkit')";
        const channelCondition = "1=1";
        const keywordWhereCondition = "LOWER(keyword) IN ('noise')";
        const rankCondition = "1=1";
        const locationTypeFilter = "lower(location_name) NOT IN ('nation', 'national', 'all india', 'india', 'total', 'pan india')";
        
        // Brand condition as built by buildCHCondition('noise', 'brand', { isBrand: false })
        const numCondition = "LOWER(brand) IN ('noise')";

        const query = `
            SELECT
                location_name AS city,
                COUNTIf(${numCondition}) AS num_overall,
                COUNTIf(${numCondition} AND toInt32(spons) = 0) AS num_organic,
                COUNTIf(${numCondition} AND toInt32(spons) = 1) AS num_spons,
                COUNT(*) AS den_overall,
                COUNTIf(toInt32(spons) = 0) AS den_organic,
                COUNTIf(toInt32(spons) = 1) AS den_spons,
                ROUND(num_overall * 100.0 / NULLIF(den_overall, 0), 2) AS overall_sos,
                ROUND(num_organic * 100.0 / NULLIF(den_organic, 0), 2) AS organic_sos,
                ROUND(num_spons * 100.0 / NULLIF(den_spons, 0), 2) AS paid_sos,
                ROUND(avgIf(toFloat64(POSITION), ${numCondition} AND toInt32(POSITION) > 0), 1) AS overallRank,
                ROUND(avgIf(toFloat64(POSITION), ${numCondition} AND toInt32(spons) = 1 AND toInt32(POSITION) > 0), 1) AS paidRank,
                ROUND(avgIf(toFloat64(POSITION), ${numCondition} AND toInt32(spons) = 0 AND toInt32(POSITION) > 0), 1) AS organicRank
            FROM rb_kw_olap
            WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
              AND ${platformCondition}
              AND ${channelCondition}
              AND ${keywordWhereCondition}
              AND ${rankCondition}
              AND ${locationTypeFilter}
              AND location_name IS NOT NULL AND location_name != '' AND lower(location_name) NOT IN ('other', 'others')
            GROUP BY city
            HAVING den_overall > 0
            ORDER BY overall_sos DESC
        `;

        const queryResult = await clickhouse.query({
            query: query,
            format: 'JSONEachRow',
        });
        const results = await queryResult.json();
        console.log('--- Query Results ---');
        console.table(results.slice(0, 10));

    } catch (err) {
        console.error('FAILED:', err.message);
    }
}

testQuery();
