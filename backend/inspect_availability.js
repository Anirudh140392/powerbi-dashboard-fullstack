import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';

dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DB,
});

async function run() {
    try {
        const query = `
            SELECT 
                MAX(DATE) as max_date,
                MIN(DATE) as min_date,
                count() as total_rows
            FROM rb_pdp_olap
            WHERE Product = 'Snickers MT DCOM AY Gift Pack'
        `;
        const resultSet = await clickhouse.query({ query, format: 'JSONEachRow' });
        const rows = await resultSet.json();
        console.log(JSON.stringify(rows, null, 2));

        const dataQuery = `
            SELECT 
                Location,
                DATE,
                neno_osa,
                deno_osa,
                listing_percent
            FROM rb_pdp_olap
            WHERE Product = 'Snickers MT DCOM AY Gift Pack'
            ORDER BY DATE DESC
            LIMIT 10
        `;
        const dataResultSet = await clickhouse.query({ query: dataQuery, format: 'JSONEachRow' });
        const dataRows = await dataResultSet.json();
        console.log("\nRecent data rows:");
        console.log(JSON.stringify(dataRows, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await clickhouse.close();
    }
}

run();
