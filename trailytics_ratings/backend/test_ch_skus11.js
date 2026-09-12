import clickhouse from './src/config/clickhouse.js';
async function test() {
    let pid = 'EKTERZGCZJ7ZCCHG'; // Prestige PKOSS 1.8
    let res = await clickhouse.query({ query: `SELECT count() FROM ml_reviews WHERE web_pid = '${pid}' AND is_competitor = 0`, format: 'JSONEachRow' });
    console.log("ml_reviews count:", await res.json());

    let res2 = await clickhouse.query({ query: `SELECT sentiment_subcategory, count() FROM ml_reviews WHERE web_pid = '${pid}' AND is_competitor = 0 AND sentiment_subcategory != '' GROUP BY sentiment_subcategory`, format: 'JSONEachRow' });
    console.log("Classified Issues:", await res2.json());

    process.exit(0);
}
test();
