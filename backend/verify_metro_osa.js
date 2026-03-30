
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory
dotenv.config({ path: path.join(__dirname, '.env') });

import { queryClickHouse } from './src/config/clickhouse.js';
import dayjs from 'dayjs';

async function calculateOSA(platform, compFlag, currentStartDate, currentEndDate, prevStartDate, prevEndDate, metroCitiesStr) {
    let where = `Location IN (${metroCitiesStr})`;
    if (platform !== 'All') where += ` AND Platform = '${platform}'`;
    if (compFlag !== null) where += ` AND toString(comp_flag) = '${compFlag}'`;

    const currentQuery = `
        SELECT 
            SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) as sumNeno,
            SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as sumDeno
        FROM rb_pdp_olap
        WHERE ${where}
          AND DATE BETWEEN '${currentStartDate.format('YYYY-MM-DD')}' AND '${currentEndDate.format('YYYY-MM-DD')}'
    `;
    const currentResult = await queryClickHouse(currentQuery);
    const currNeno = parseFloat(currentResult[0].sumNeno) || 0;
    const currDeno = parseFloat(currentResult[0].sumDeno) || 0;
    const currentOsa = currDeno > 0 ? (currNeno / currDeno) * 100 : 0;

    const prevQuery = `
        SELECT 
            SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) as sumNeno,
            SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as sumDeno
        FROM rb_pdp_olap
        WHERE ${where}
          AND DATE BETWEEN '${prevStartDate.format('YYYY-MM-DD')}' AND '${prevEndDate.format('YYYY-MM-DD')}'
    `;
    const prevResult = await queryClickHouse(prevQuery);
    const prevNeno = parseFloat(prevResult[0].sumNeno) || 0;
    const prevDeno = parseFloat(prevResult[0].sumDeno) || 0;
    const prevOsa = prevDeno > 0 ? (prevNeno / prevDeno) * 100 : 0;

    return { currentOsa, prevOsa };
}

async function verify() {
    try {
        console.log('--- METRO CITY STOCK AVAILABILITY EXHAUSTIVE CHECK ---');
        
        const latestResult = await queryClickHouse('SELECT MAX(DATE) as maxDate FROM rb_pdp_olap');
        const latestDate = dayjs(latestResult[0].maxDate);
        
        const currentEndDate = latestDate;
        const currentStartDate = latestDate.startOf('month');
        const periodDays = currentEndDate.diff(currentStartDate, 'day') + 1;
        const prevEndDate = currentStartDate.subtract(1, 'day');
        const prevStartDate = prevEndDate.subtract(periodDays - 1, 'day');

        const metroResult = await queryClickHouse("SELECT DISTINCT location FROM rb_location_darkstore WHERE tier = 'Tier 1'");
        const metroCities = metroResult.map(r => r.location).filter(Boolean);
        const metroCitiesStr = metroCities.map(c => `'${c.replace(/'/g, "''")}'`).join(',');

        const platforms = ['All', 'Blinkit', 'Zepto', 'Instamart'];
        const compFlags = [0, null]; // 0 = Own Brands, null = All Brands

        console.log(`Periods: ${currentStartDate.format('YYYY-MM-DD')} to ${currentEndDate.format('YYYY-MM-DD')} vs Previous`);

        for (const p of platforms) {
            for (const cf of compFlags) {
                const { currentOsa, prevOsa } = await calculateOSA(p, cf, currentStartDate, currentEndDate, prevStartDate, prevEndDate, metroCitiesStr);
                const change = currentOsa - prevOsa;
                console.log(`Platform: ${p.padEnd(10)} | CompFlag: ${cf === 0 ? '0 (Own)' : 'All'.padEnd(7)} | OSA: ${currentOsa.toFixed(2)}% | Prev: ${prevOsa.toFixed(2)}% | Change: ${change.toFixed(2)}%`);
                
                if (Math.abs(currentOsa - 41.35) < 0.1) {
                    console.log('>>> MATCH FOUND! <<<');
                }
            }
        }

    } catch (e) {
        console.error('Verification failed:', e);
    }
}

verify().then(() => process.exit());
