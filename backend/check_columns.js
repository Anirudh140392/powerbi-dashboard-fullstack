
import { ClickHouse } from 'clickhouse';

const clickhouse = new ClickHouse({
    url: 'http://localhost',
    port: 8123,
    debug: false,
    basicAuth: null,
    isResponseJSON: true,
    format: "json",
});

async function check() {
    try {
        const query = "DESCRIBE TABLE rb_pdp_olap";
        const rows = await clickhouse.query(query).toPromise();
        console.log("COLUMNS IN rb_pdp_olap:");
        rows.forEach(r => console.log(` - ${r.name}: ${r.type}`));
        
        const sampleQuery = "SELECT * FROM rb_pdp_olap LIMIT 1";
        const sampleRows = await clickhouse.query(sampleQuery).toPromise();
        console.log("\nSAMPLE ROW KEYS:");
        if (sampleRows.length > 0) {
            console.log(Object.keys(sampleRows[0]));
        } else {
            console.log("No data in table!");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

check();
