import clickhouse, { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
  const query = `
        SELECT group_brand, count(*), sum(toFloat64OrZero(toString(sales))), max(web_pid)
        FROM rb_ms_olap
        WHERE toDate(created_on) BETWEEN '2026-03-21' AND '2026-04-20'
        GROUP BY group_brand LIMIT 10;
  `;
  try {
      const res = await queryClickHouse(query);
      console.log(res);
  } catch (e) { console.error(e); }
  process.exit(0);
}
test();
