import pkg from '@clickhouse/client';
const { createClient } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
    url: process.env.CLICKHOUSE_URL,
    password: process.env.CLICKHOUSE_PASSWORD,
    username: process.env.CLICKHOUSE_USER,
    database: process.env.CLICKHOUSE_DB
});

async function main() {
    try {
        const query = `
            SELECT 
                keyword,
                location_name,
                SUM(ifNull(toInt32(organic), 0)) as total,
                sumIf(ifNull(toInt32(organic), 0), lower(brand) = lower('Mars')) as brand_total
            FROM rb_kw_olap
            WHERE organic > '0'
            GROUP BY keyword, location_name
            HAVING brand_total > 0
            LIMIT 10
        `;
        const rs = await client.query({ query, format: 'JSONEachRow' });
        const data = await rs.json();
        console.log("Samples where Mars has organic impressions:");
        data.forEach(r => {
            const sos = (r.brand_total / r.total * 100).toFixed(2);
            console.log(`Keyword: ${r.keyword}, Location: ${r.location_name}, SOS: ${sos}% (${r.brand_total}/${r.total})`);
        });
    } catch (e) {
        console.error("Error:", e);
    }
}
main();
