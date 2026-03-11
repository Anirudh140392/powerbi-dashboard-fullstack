
import "dotenv/config";
import { queryClickHouse } from './src/config/clickhouse.js';
import dayjs from 'dayjs';

async function testSignalLab() {
    const end = dayjs().format('YYYY-MM-DD');
    const start = dayjs(end).subtract(30, 'day').format('YYYY-MM-DD');
    const compEnd = dayjs(start).subtract(1, 'day').format('YYYY-MM-DD');
    const compStart = dayjs(compEnd).subtract(dayjs(end).diff(dayjs(start), 'day'), 'day').format('YYYY-MM-DD');

    const threshold = 2;

    const buildWhereClause = (includeCompDates = false) => {
        const conditions = [];
        if (includeCompDates) {
            conditions.push(`(toDate(DATE) BETWEEN '${start}' AND '${end}' OR toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}')`);
        } else {
            conditions.push(`toDate(DATE) BETWEEN '${start}' AND '${end}'`);
        }
        conditions.push(`(Comp_flag = 0 OR Comp_flag = '0')`);
        return conditions.join(' AND ');
    };

    const mainOsaExpr = `(sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', ifNull(toFloat64OrZero(toString(neno_osa)), 0.0), 0.0)) / nullIf(sum(if(toDate(DATE) BETWEEN '${start}' AND '${end}', ifNull(toFloat64OrZero(toString(deno_osa)), 0.0), 0.0)), 0)) * 100`;
    const compOsaExpr = `(sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', ifNull(toFloat64OrZero(toString(neno_osa)), 0.0), 0.0)) / nullIf(sum(if(toDate(DATE) BETWEEN '${compStart}' AND '${compEnd}', ifNull(toFloat64OrZero(toString(deno_osa)), 0.0), 0.0)), 0)) * 100`;
    const osaMetricExpr = `(ifNull(${mainOsaExpr}, 0) - ifNull(${compOsaExpr}, 0))`;
    const sortMetric = osaMetricExpr;

    for (let signalType of ['gainer', 'drainer']) {
        const direction = signalType === 'gainer' ? 'DESC' : 'ASC';
        const havingClause = signalType === 'gainer'
            ? `HAVING ${sortMetric} > ${threshold}`
            : `HAVING ${sortMetric} < -${threshold}`;

        const skuQuery = `
            SELECT Web_Pid, ${sortMetric} as sortMetric
            FROM rb_pdp_olap
            WHERE ${buildWhereClause(true)}
            GROUP BY Web_Pid
            ${havingClause}
            ORDER BY sortMetric ${direction}
            LIMIT 4 OFFSET 0
        `;

        console.log(`\n--- Testing ${signalType} ---`);
        console.log('Query:', skuQuery);
        try {
            const rows = await queryClickHouse(skuQuery);
            console.log(`Results (${signalType}):`, rows.length);
            if (rows.length > 0) {
                console.log('First result:', rows[0]);
            }
        } catch (err) {
            console.error(`Error fetching ${signalType}:`, err.message);
        }
    }
}

testSignalLab();
