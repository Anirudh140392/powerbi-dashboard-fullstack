import { queryClickHouse } from './src/config/clickhouse.js';

const r = await queryClickHouse(`
  SELECT 
    Platform,
    keyword,
    count() as row_count,
    SUM(ad_spend) as total_spend, 
    SUM(ad_sales) as total_sales
  FROM rb_pm_olap 
  WHERE DATE BETWEEN '2026-02-24' AND '2026-03-26'
    AND ad_spend > 0
  GROUP BY Platform, keyword
  ORDER BY total_spend DESC
  LIMIT 10
`);
console.log(JSON.stringify(r, null, 2));

process.exit(0);
