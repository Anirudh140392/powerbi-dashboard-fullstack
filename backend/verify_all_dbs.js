
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

async function verifyAllDbs() {
    const databases = ['mars', 'petcare', 'zydus', 'testing'];
    const startDate = '2025-03-01';
    const endDate = '2025-03-28';
    
    for (const db of databases) {
        try {
            console.log(`\n--- Querying DB: ${db} ---`);
            const client = createClient({ url, username, password, database: db });

            const query = `
                SELECT 
                  (SUM(neno_osa) / NULLIF(SUM(deno_osa), 0)) * 100 AS metro_stock_availability
                FROM rb_pdp_olap
                WHERE Location IN (
                  SELECT location 
                  FROM rb_location_darkstore 
                  WHERE tier = 'Tier 1'
                )
                AND DATE BETWEEN '${startDate}' AND '${endDate}'
            `;

            const result = await client.query({ query, format: 'JSONEachRow' });
            const data = await result.json();
            const val = parseFloat(data[0]?.metro_stock_availability || 0).toFixed(2);
            console.log(`OSA: ${val}%`);

            if (val === "41.35") {
                console.log(`>>> MATCH! DB: ${db} <<<`);
            }

            // Also check with Comp_flag = 0
            const queryOwn = `
                SELECT 
                  (SUM(neno_osa) / NULLIF(SUM(deno_osa), 0)) * 100 AS metro_stock_availability
                FROM rb_pdp_olap
                WHERE Location IN (
                  SELECT location 
                  FROM rb_location_darkstore 
                  WHERE tier = 'Tier 1'
                )
                AND Comp_flag = 0
                AND DATE BETWEEN '${startDate}' AND '${endDate}'
            `;

            const resultOwn = await client.query({ query: queryOwn, format: 'JSONEachRow' });
            const dataOwn = await resultOwn.json();
            const valOwn = parseFloat(dataOwn[0]?.metro_stock_availability || 0).toFixed(2);
            console.log(`OSA (Own): ${valOwn}%`);
            
            if (valOwn === "41.35") {
                console.log(`>>> MATCH (Own)! DB: ${db} <<<`);
            }

        } catch (e) {
            console.log(`Error in DB ${db}: ${e.message}`);
        }
    }
}

verifyAllDbs().then(() => process.exit());
