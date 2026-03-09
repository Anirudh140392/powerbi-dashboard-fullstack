import { ClickHouse } from 'clickhouse';

const clickhouse = new ClickHouse({
    url: process.env.CLICKHOUSE_URL || 'http://localhost',
    port: process.env.CLICKHOUSE_PORT || 8123,
    debug: false,
    basicAuth: null,
    isUseGzip: false,
    format: "json",
    raw: false,
    config: {
        database: 'trailytics',
    }
});

async function run() {
    const query = `
        SELECT 
            SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) as total_sales
        FROM rb_pdp_olap
        WHERE toDate(DATE) BETWEEN '2026-02-01' AND '2026-02-21' AND Comp_flag = 0
    `;
    console.log("Running Query:", query);
    const result = await clickhouse.query(query).toPromise();
    console.log("Result:", result);
}
run().catch(console.error);
