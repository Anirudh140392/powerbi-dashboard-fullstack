import clickhouse, { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
  const brandLabel = 'Mars';
  const query = `
        WITH ms_curr AS (
            SELECT 
                multiIf(LOWER(location) IN ('gurgaon','gurugram'), 'Gurugram', LOWER(location) IN ('bangalore','bengaluru'), 'Bengaluru', initCap(location)) AS city, 
                platform, category, group_brand, item_name,
                SUM(ifNull(toFloat64OrZero(toString(sales)), 0)) AS sku_sales
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '2026-03-21' AND '2026-04-20' AND item_name IS NOT NULL AND item_name != ''
            GROUP BY city, platform, category, group_brand, item_name
        ),
        ms_cat_curr AS (
            SELECT city, platform, category, SUM(sku_sales) AS cat_sales FROM ms_curr GROUP BY city, platform, category
        ),
        ms_sku_curr AS (
            SELECT m.city, m.platform, m.category, m.group_brand, m.item_name,
                   (m.sku_sales / nullIf(c.cat_sales, 0)) AS sku_ms
            FROM ms_curr m JOIN ms_cat_curr c ON m.city = c.city AND m.platform = c.platform AND m.category = c.category
        ),
        ms_prev AS (
            SELECT 
                multiIf(LOWER(location) IN ('gurgaon','gurugram'), 'Gurugram', LOWER(location) IN ('bangalore','bengaluru'), 'Bengaluru', initCap(location)) AS city, 
                platform, category, group_brand, item_name,
                SUM(ifNull(toFloat64OrZero(toString(sales)), 0)) AS sku_sales
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '2026-02-19' AND '2026-03-20' AND item_name IS NOT NULL AND item_name != ''
            GROUP BY city, platform, category, group_brand, item_name
        ),
        ms_cat_prev AS (
            SELECT city, platform, category, SUM(sku_sales) AS cat_sales FROM ms_prev GROUP BY city, platform, category
        ),
        ms_sku_prev AS (
            SELECT m.city, m.platform, m.category, m.group_brand, m.item_name,
                   (m.sku_sales / nullIf(c.cat_sales, 0)) AS sku_ms
            FROM ms_prev m JOIN ms_cat_prev c ON m.city = c.city AND m.platform = c.platform AND m.category = c.category
        ),
        ms_gap AS (
            SELECT c.city, c.platform, c.category, c.group_brand, c.item_name,
                   ifNull(c.sku_ms, 0) - ifNull(p.sku_ms, 0) AS gap
            FROM ms_sku_curr c
            LEFT JOIN ms_sku_prev p ON c.city = p.city AND c.platform = p.platform AND c.category = p.category AND c.item_name = p.item_name
        ),
        our_impacted AS (
            SELECT city, platform, category, argMin(item_name, gap) AS impacted_sku, MIN(gap) AS min_gap
            FROM ms_gap
            WHERE LOWER(trim(replaceRegexpAll(group_brand, '[^a-zA-Z0-9 ]', ''))) = '${brandLabel.toLowerCase()}' AND gap < 0
            GROUP BY city, platform, category
        ),
        comp_gainer AS (
            SELECT city, platform, category, argMax(item_name, gap) AS comp_sku, MAX(gap) AS max_gap
            FROM ms_gap
            WHERE LOWER(trim(replaceRegexpAll(group_brand, '[^a-zA-Z0-9 ]', ''))) != '${brandLabel.toLowerCase()}' AND gap > 0
            GROUP BY city, platform, category
        )
        SELECT * FROM our_impacted LIMIT 5;
  `;
  try {
      const res = await queryClickHouse(query);
      console.log('our_impacted', res);
  } catch (e) { console.error(e); }

  const query2 = query.replace('SELECT * FROM our_impacted LIMIT 5;', 'SELECT * FROM comp_gainer LIMIT 5;');
  try {
      const res = await queryClickHouse(query2);
      console.log('comp_gainer', res);
  } catch (e) { console.error(e); }

  process.exit(0);
}
test();
