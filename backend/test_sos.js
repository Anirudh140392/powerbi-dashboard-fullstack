import { createClient } from '@clickhouse/client';
const client = createClient({ url: 'http://13.200.55.131:8123', username: 'readonly_user', password: 'Readonly@123', database: 'mars' });

async function run() {
    try {
        const queryDirect = `
            SELECT 
                (SUM(IF(keyword_search_product = 'Tresemme Hair Fall Defense Shampoo', toInt32(overall), 0)) / SUM(toInt32(overall))) * 100 AS hair_fall_sos,
                (SUM(IF(keyword_search_product = 'Tresemme Keratin Smooth Shampoo', toInt32(overall), 0)) / SUM(toInt32(overall))) * 100 AS keratin_smooth_sos
            FROM rb_kw_olap
            WHERE DATE BETWEEN '2026-03-01' AND '2026-03-31'
              AND POSITION < 11
              AND platform_name = 'Blinkit'
        `;
        const resDirect = await client.query({ query: queryDirect, format: 'JSONEachRow' });
        console.log("Direct query result:", await resDirect.json());

    } catch(e) { console.error(e); }
    client.close();
}
run();
