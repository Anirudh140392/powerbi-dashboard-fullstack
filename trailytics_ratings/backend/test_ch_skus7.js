import clickhouse from './src/config/clickhouse.js';
async function test() {
    let res = await clickhouse.query({ query: "SELECT web_pid, product_name, platform, rating FROM product_snapshots WHERE lower(product_name) LIKE '%ogo 500w%' LIMIT 5", format: 'JSONEachRow' });
    console.log("OGO in snapshots:");
    let rows = await res.json();
    console.log(rows);
    
    if (rows.length > 0) {
        let pid = rows[0].web_pid;
        let res2 = await clickhouse.query({ query: `SELECT count() FROM ml_reviews WHERE web_pid = '${pid}'`, format: 'JSONEachRow' });
        console.log(`ML Reviews for OGO (${pid}):`, await res2.json());

        let res3 = await clickhouse.query({ query: `SELECT count() FROM ml_reviews WHERE web_pid = '${pid}' AND is_competitor = 0`, format: 'JSONEachRow' });
        console.log(`ML Reviews for OGO with is_competitor=0:`, await res3.json());
        
        let res4 = await clickhouse.query({ query: `SELECT sentiment_subcategory, count() FROM ml_reviews WHERE web_pid = '${pid}' AND sentiment_subcategory != '' GROUP BY sentiment_subcategory`, format: 'JSONEachRow' });
        console.log(`Classified Issues for OGO:`, await res4.json());
    }

    process.exit(0);
}
test();
