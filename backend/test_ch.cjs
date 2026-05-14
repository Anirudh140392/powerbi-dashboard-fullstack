const { ClickHouse } = require('clickhouse');
const clickhouse = new ClickHouse({
    url: 'http://localhost',
    port: 8123,
    debug: false,
    basicAuth: null,
    isUseGzip: false,
    trimQuery: false,
    usePost: false,
    format: "json",
    raw: false,
    config: {
        database: 'default',
    }
});

async function run() {
    const query = `
        SELECT brand, sum(toFloat64OrZero(toString(impressions))) as imp 
        FROM rb_pm_olap 
        WHERE DATE BETWEEN '2026-04-29' AND '2026-05-14' 
        AND lower(Platform) IN ('blinkit') 
        AND lower(keyword_type) IN ('competition', 'competitor') 
        AND lower(brand) LIKE '%boat%'
        GROUP BY brand
    `;
    const rows = await clickhouse.query(query).toPromise();
    console.log(rows);
}
run();
