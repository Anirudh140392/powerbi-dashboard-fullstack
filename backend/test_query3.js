import clickhouse, { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
  const query = `
        SELECT Comp_flag, sum(toFloat64OrZero(toString(Sales)))
        FROM rb_pdp_olap
        WHERE DATE BETWEEN '2026-03-21' AND '2026-04-20'
        GROUP BY Comp_flag;
  `;
  try {
      const res = await queryClickHouse(query);
      console.log(res);
  } catch (e) { console.error(e); }
  process.exit(0);
}
test();
