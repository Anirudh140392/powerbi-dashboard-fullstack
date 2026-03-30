
import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dayjs from 'dayjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

async function verify() {
    const databases = ['mars', 'gcpl', 'cinthol', 'godrej']; // Common DB names
    const platforms = ['All', 'Blinkit', 'Zepto'];
    
    for (const db of databases) {
        try {
            const client = createClient({
                url: process.env.CLICKHOUSE_URL,
                username: process.env.CLICKHOUSE_USER,
                password: process.env.CLICKHOUSE_PASSWORD,
                database: db
            });

            // 1. Check if DB exists and has data
            const latestResult = await client.query({ query: 'SELECT MAX(DATE) as maxDate FROM rb_pdp_olap', format: 'JSONEachRow' });
            const latestData = await latestResult.json();
            if (!latestData[0]?.maxDate) continue;

            const latestDate = dayjs(latestData[0].maxDate);
            const currentEndDate = latestDate;
            const currentStartDate = latestDate.startOf('month');

            // 2. Get Metro Cities
            const metroResult = await client.query({ query: "SELECT DISTINCT location FROM rb_location_darkstore WHERE tier = 'Tier 1'", format: 'JSONEachRow' });
            const metroCities = await metroResult.json();
            if(!metroCities.length) continue;
            const metroCitiesList = metroCities.map(r => r.location).filter(Boolean);
            if (metroCitiesList.length === 0) continue;
            const metroCitiesStr = metroCitiesList.map(c => `'${c.replace(/'/g, "''")}'`).join(',');

            console.log(`\n--- Checking Database: ${db} ---`);

            for (const p of platforms) {
                let where = `Location IN (${metroCitiesStr})`;
                if (p !== 'All') where += ` AND Platform = '${p}'`;
                
                // Usually metrics are filtered for Own Brand (Comp_flag = 0)
                const query = `
                    SELECT 
                        SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) as sumNeno,
                        SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as sumDeno
                    FROM rb_pdp_olap
                    WHERE ${where}
                      AND toString(Comp_flag) = '0'
                      AND DATE BETWEEN '${currentStartDate.format('YYYY-MM-DD')}' AND '${currentEndDate.format('YYYY-MM-DD')}'
                `;
                
                const result = await client.query({ query, format: 'JSONEachRow' });
                const row = await result.json();
                const currNeno = parseFloat(row[0].sumNeno) || 0;
                const currDeno = parseFloat(row[0].sumDeno) || 0;
                const currentOsa = currDeno > 0 ? (currNeno / currDeno) * 100 : 0;

                console.log(`Platform: ${p.padEnd(10)} | OSA: ${currentOsa.toFixed(2)}% | Neno: ${currNeno} | Deno: ${currDeno}`);
                
                if (Math.abs(currentOsa - 41.35) < 0.05) {
                    console.log(`>>> SUCCESS! Found 41.35% in DB: ${db}, Platform: ${p} <<<`);
                }
            }
        } catch (e) {
            // console.log(`DB ${db} check failed: ${e.message}`);
        }
    }
}

verify().then(() => process.exit());
