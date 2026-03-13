process.env.CLICKHOUSE_URL = 'http://13.200.55.131:8123';
process.env.CLICKHOUSE_USER = 'readonly_user';
process.env.CLICKHOUSE_PASSWORD = 'Readonly@123';
process.env.CLICKHOUSE_DB = 'mars';

const { queryClickHouse } = require('./backend/src/config/clickhouse.js');

async function test() {
    try {
        // Test with correct uppercase DATE
        const q = `SELECT count() as total, SUM(ad_spend) as spend, SUM(Ad_sales) as sales FROM mars.rca_pm_olap WHERE DATE BETWEEN '2026-02-09' AND '2026-02-18'`;
        const result = await queryClickHouse(q);
        console.log("Feb 2026 data:", JSON.stringify(result, null, 2));

        // Test quadrant query
        const q2 = `SELECT keyword, SUM(ad_spend) as spend, SUM(Ad_sales) as revenue, if(SUM(ad_spend) > 0, SUM(Ad_sales)/SUM(ad_spend), 0) as roas FROM mars.rca_pm_olap WHERE DATE BETWEEN '2026-02-09' AND '2026-02-18' AND (ad_spend > 0 OR Ad_sales > 0) GROUP BY keyword HAVING spend > 0 LIMIT 5`;
        const r2 = await queryClickHouse(q2);
        console.log("Keywords with spend:", JSON.stringify(r2, null, 2));

    } catch (e) {
        console.error("Error:", e.message);
    }
}
test();
