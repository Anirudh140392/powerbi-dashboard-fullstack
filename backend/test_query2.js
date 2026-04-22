import clickhouse, { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
  const query = `
        WITH sku_sales_curr AS (
            SELECT 
                multiIf(LOWER(Location) IN ('gurgaon','gurugram'), 'Gurugram', LOWER(Location) IN ('bangalore','bengaluru'), 'Bengaluru', initCap(Location)) AS city, 
                Platform AS platform, 
                Category AS category, Product, Comp_flag,
                SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) AS sku_sales
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '2026-03-21' AND '2026-04-20' AND Product IS NOT NULL AND Product != ''
            GROUP BY city, platform, category, Product, Comp_flag
        ),
        cat_sales_curr AS (
            SELECT city, platform, category, SUM(sku_sales) AS cat_sales FROM sku_sales_curr GROUP BY city, platform, category
        ),
        sku_ms_curr AS (
            SELECT s.city, s.platform, s.category, s.Product, s.Comp_flag,
                   (s.sku_sales / nullIf(c.cat_sales, 0)) AS sku_ms
            FROM sku_sales_curr s JOIN cat_sales_curr c ON s.city = c.city AND s.platform = c.platform AND s.category = c.category
        ),
        sku_sales_prev AS (
            SELECT 
                multiIf(LOWER(Location) IN ('gurgaon','gurugram'), 'Gurugram', LOWER(Location) IN ('bangalore','bengaluru'), 'Bengaluru', initCap(Location)) AS city, 
                Platform AS platform, 
                Category AS category, Product, Comp_flag,
                SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) AS sku_sales
            FROM rb_pdp_olap
            WHERE DATE BETWEEN '2026-02-19' AND '2026-03-20' AND Product IS NOT NULL AND Product != ''
            GROUP BY city, platform, category, Product, Comp_flag
        ),
        cat_sales_prev AS (
            SELECT city, platform, category, SUM(sku_sales) AS cat_sales FROM sku_sales_prev GROUP BY city, platform, category
        ),
        sku_ms_prev AS (
            SELECT s.city, s.platform, s.category, s.Product, s.Comp_flag,
                   (s.sku_sales / nullIf(c.cat_sales, 0)) AS sku_ms
            FROM sku_sales_prev s JOIN cat_sales_prev c ON s.city = c.city AND s.platform = c.platform AND s.category = c.category
        ),
        sku_ms_gap AS (
            SELECT c.city, c.platform, c.category, c.Product, c.Comp_flag,
                   ifNull(c.sku_ms, 0) - ifNull(p.sku_ms, 0) AS ms_gap
            FROM sku_ms_curr c
            LEFT JOIN sku_ms_prev p ON c.city = p.city AND c.platform = p.platform AND c.category = p.category AND c.Product = p.Product AND c.Comp_flag = p.Comp_flag
        )
        SELECT Comp_flag, count(*), MIN(ms_gap), MAX(ms_gap) FROM sku_ms_gap GROUP BY Comp_flag;
  `;
  try {
      const res = await queryClickHouse(query);
      console.log(res);
  } catch (e) { console.error(e); }
  process.exit(0);
}
test();
