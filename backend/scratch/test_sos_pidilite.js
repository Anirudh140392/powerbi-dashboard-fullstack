process.env.CLICKHOUSE_DB = 'pidilite';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function run() {
    const { queryClickHouse } = await import('../src/config/clickhouse.js');
    const query = `
        Select location_name AS city,
            COUNTIf(flag = 1) AS num_overall,
            COUNTIf(
                flag = 1
                AND spons = 0
            ) AS num_organic,
            COUNTIf(
                flag = 1
                AND spons = 1
            ) AS num_spons,
            COUNT(*) AS den_overall,
            COUNTIf(spons = 0) AS den_organic,
            COUNTIf(spons = 1) AS den_spons,
            ROUND(
                num_overall * 100.0 / NULLIF(den_overall, 0),
                2
            ) AS overallSos,
            ROUND(
                num_organic * 100.0 / NULLIF(den_organic, 0),
                2
            ) AS organicSos,
            ROUND(
                num_spons * 100.0 / NULLIF(den_spons, 0),
                2
            ) AS paidSos
        FROM rb_kw_olap
        WHERE DATE BETWEEN '2026-06-15' AND '2026-06-15'
          AND lower(keyword) = lower('super glue')
          AND lower(platform_name) = 'blinkit'
          AND lower(location_name) NOT IN (
                'nation',
                'national',
                'all india',
                'india',
                'total',
                'pan india'
          )
        GROUP BY city
        HAVING den_overall > 0
        ORDER BY overallSos DESC
    `;

    console.log("Running query for pidilite...");
    const res = await queryClickHouse(query);
    console.log("Results:", JSON.stringify(res, null, 2));
    process.exit(0);
}
run();
