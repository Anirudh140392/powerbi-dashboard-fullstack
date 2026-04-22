import clickhouse, { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
  const query = `
        SELECT item_name, count(*), sum(toFloat64OrZero(toString(sales)))
        FROM rb_ms_olap
        WHERE toDate(created_on) BETWEEN '2026-03-21' AND '2026-04-20'
        AND item_name IS NOT NULL AND item_name != ''
        GROUP BY item_name LIMIT 10;
  `;
  try {
      const res = await queryClickHouse(query);
      console.log(res);
  } catch (e) { console.error(e); }
  process.exit(0);
}
test();
