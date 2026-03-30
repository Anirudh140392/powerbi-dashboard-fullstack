
import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const url = "http://13.200.55.131:8123";
const username = "readonly_user";
const password = "Readonly@123";

async function verifyQuery() {
    try {
        const client = createClient({ url, username, password, database: 'mars' });
        const query = `
            SELECT 
              SUM(neno_osa) / NULLIF(SUM(deno_osa), 0) * 100 AS metro_stock_availability,
              SUM(neno_osa) as sumNeno,
              SUM(deno_osa) as sumDeno
            FROM rb_pdp_olap
            WHERE Location IN (
              SELECT location 
              FROM rb_location_darkstore 
              WHERE tier = 'Tier 1'
            )
            AND DATE BETWEEN '2025-03-01' AND '2025-03-28'
        `;
        const result = await client.query({ query, format: 'JSONEachRow' });
        const data = await result.json();
        console.log(JSON.stringify(data, null, 2));
    } catch(e) {
        console.error(e);
    }
}

verifyQuery().then(() => process.exit());
