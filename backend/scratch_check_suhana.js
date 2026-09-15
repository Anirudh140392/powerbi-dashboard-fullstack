import { createClient } from '@clickhouse/client';
import 'dotenv/config';

const CH_URL = process.env.CLICKHOUSE_URL || 'http://13.203.251.97:8123';
const CH_USER = process.env.CLICKHOUSE_USER || 'default';
const CH_PASS = process.env.CLICKHOUSE_PASSWORD || '';

const client = createClient({
    url: CH_URL,
    username: CH_USER,
    password: CH_PASS,
    database: 'suhana_masala',
    request_timeout: 30000,
});

async function main() {
    try {
        console.log("Checking tables in suhana_masala DB...");
        const tablesRes = await client.query({
            query: "SHOW TABLES",
            format: "JSONEachRow"
        });
        const tables = await tablesRes.json();
        console.log("Tables in suhana_masala DB:", tables.map(t => t.name));

        const candidates = ['rb_pdp_olap', 'rb_pdp', 'rb_pdp_week', 'rca_sku_dim', 'rb_sales_olap', 'rb_kw_olap', 'rb_brand_ms', 'rb_ms_olap', 'tb_content_score_data'];
        for (const c of candidates) {
            const res = await client.query({ query: `EXISTS TABLE ${c}`, format: 'JSONEachRow' });
            const data = await res.json();
            console.log(`  Table ${c}: exists = ${data[0]?.result === 1}`);
        }

    } catch (e) {
        console.error("Error checking suhana_masala:", e);
    }
    process.exit(0);
}
main();
