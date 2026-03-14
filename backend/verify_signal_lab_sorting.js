import { queryClickHouse } from './src/config/clickhouse.js';
import dayjs from 'dayjs';

async function verifySignalLabSorting() {
    try {
        console.log('--- START VERIFICATION ---');
        const end = dayjs().format('YYYY-MM-DD');
        const start = dayjs(end).subtract(30, 'day').format('YYYY-MM-DD');
        const compEnd = dayjs(start).subtract(1, 'day').format('YYYY-MM-DD');
        const compStart = dayjs(compEnd).subtract(30, 'day').format('YYYY-MM-DD');

        const mainOsaExpr = `(sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', ifNull(toFloat64OrZero(toString(neno_osa)), 0.0), 0.0)) / nullIf(sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', ifNull(toFloat64OrZero(toString(deno_osa)), 0.0), 0.0)), 0)) * 100`;
        const compOsaExpr = `(sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', ifNull(toFloat64OrZero(toString(neno_osa)), 0.0), 0.0)) / nullIf(sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', ifNull(toFloat64OrZero(toString(deno_osa)), 0.0), 0.0)), 0)) * 100`;
        const osaMetricExpr = `(ifNull(${mainOsaExpr}, 0) - ifNull(${compOsaExpr}, 0))`;
        
        async function test(signalType) {
            const direction = signalType === 'gainer' ? 'DESC' : 'ASC';
            const threshold = 2;
            const havingClause = signalType === 'gainer'
                ? `HAVING osaChange > ${threshold}`
                : `HAVING osaChange < -${threshold}`;

            const query = `
                SELECT 
                    Web_Pid, 
                    any(Brand) as brand,
                    ${mainOsaExpr} as absoluteOsa,
                    ${osaMetricExpr} as osaChange
                FROM rb_pdp_olap
                WHERE (Comp_flag = 0 OR Comp_flag = '0')
                GROUP BY Web_Pid
                ${havingClause}
                ORDER BY absoluteOsa ${direction}
                LIMIT 10
            `;

            const results = await queryClickHouse(query);
            console.log(`\n${signalType.toUpperCase()} (Order: ${direction})`);
            results.forEach((r, i) => {
                console.log(`${i+1}. PID: ${r.Web_Pid} | OSA: ${Number(r.absoluteOsa).toFixed(1)}% | Change: ${Number(r.osaChange).toFixed(1)}% | Brand: ${r.brand}`);
            });
        }

        await test('drainer');
        await test('gainer');
        console.log('\n--- END VERIFICATION ---');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

verifySignalLabSorting();
