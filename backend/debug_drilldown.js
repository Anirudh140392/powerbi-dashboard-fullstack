import { queryClickHouse } from './src/config/clickhouse.js';
const q = `SELECT 
             location_name,
             brand,
             sum(toInt32(overall)) as total_overall
           FROM rb_kw_olap 
           WHERE brand = 'Galaxy'
           AND platform_name ILIKE '%Zepto%'
           AND DATE BETWEEN '2026-03-01' AND '2026-03-17'
           GROUP BY location_name, brand
           LIMIT 20`;
queryClickHouse(q).then(rows => console.log(JSON.stringify(rows, null, 2))).catch(console.error);
