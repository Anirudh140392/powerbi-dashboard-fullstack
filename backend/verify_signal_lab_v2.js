import { queryClickHouse } from './src/config/clickhouse.js';
import dayjs from 'dayjs';

async function verifyAll() {
    try {
        console.log('--- FINAL VERIFICATION ---');
        const end = dayjs().format('YYYY-MM-DD');
        const start = dayjs(end).subtract(30, 'day').format('YYYY-MM-DD');
        const mainOsaExpr = `(sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', ifNull(toFloat64OrZero(toString(neno_osa)), 0.0), 0.0)) / nullIf(sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', ifNull(toFloat64OrZero(toString(deno_osa)), 0.0), 0.0)), 0)) * 100`;

        // 1. Verify Sorting
        async function testSorting(signalType) {
            const direction = signalType === 'gainer' ? 'DESC' : 'ASC';
            const query = `
                SELECT 
                    Web_Pid, 
                    ${mainOsaExpr} as absoluteOsa
                FROM rb_pdp_olap
                WHERE (Comp_flag = 0 OR Comp_flag = '0')
                GROUP BY Web_Pid
                ORDER BY absoluteOsa ${direction}
                LIMIT 3
            `;
            const results = await queryClickHouse(query);
            console.log(`${signalType.toUpperCase()} (Order ${direction}):`, results.map(r => Number(r.absoluteOsa).toFixed(1) + '%').join(', '));
        }

        await testSorting('drainer');
        await testSorting('gainer');

        // 2. Verify T1/T2 Cities
        console.log('\nVerifying T1/T2 Cities for a random SKU...');
        const randomSkuQuery = `SELECT Web_Pid FROM rb_pdp_olap LIMIT 1`;
        const skuRes = await queryClickHouse(randomSkuQuery);
        if (skuRes.length > 0) {
            const webPid = skuRes[0].Web_Pid;
            const cityQuery = `
                SELECT 
                    Location,
                    tier
                FROM rb_pdp_olap as p
                JOIN (SELECT location, tier FROM rb_location_darkstore) as l ON p.Location = l.location
                WHERE Web_Pid = '${webPid}'
                  AND tier IN ('Tier 1', 'Tier 2')
                GROUP BY Location, tier
                LIMIT 10
            `;
            const cityResults = await queryClickHouse(cityQuery);
            console.log(`Cities found for ${webPid}:`, cityResults.map(c => `${c.Location} (${c.tier})`).join(', '));
            
            const hasT1 = cityResults.some(c => c.tier === 'Tier 1');
            const hasT2 = cityResults.some(c => c.tier === 'Tier 2');
            console.log(`Contains Tier 1: ${hasT1}`);
            console.log(`Contains Tier 2: ${hasT2}`);
        }

        console.log('\n--- END VERIFICATION ---');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

verifyAll();
