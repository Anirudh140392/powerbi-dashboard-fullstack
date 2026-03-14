
import { queryClickHouse } from './src/config/clickhouse.js';
import dayjs from 'dayjs';

async function run() {
    console.log('--- Diagnostic for Blinkit 2026-03-11 ---');

    const query = `
    SELECT 
      Brand,
      SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) as sales,
      SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) as neno,
      SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as deno
    FROM rb_pdp_olap
    WHERE DATE = '2026-03-11' AND Platform = 'Blinkit'
    GROUP BY Brand
  `;

    try {
        const res = await queryClickHouse(query);
        const results = res.map(r => {
            const s = parseFloat(r.sales);
            const n = parseFloat(r.neno);
            const d = parseFloat(r.deno);
            const osa = d > 0 ? (n / d) * 100 : 0;

            // Candidate 1: Sales / (OSA/100) - Sales
            const psl_frac = osa > 0 ? (s / (osa / 100)) - s : 0;

            // Candidate 2: Sales / OSA - Sales
            const psl_raw = osa > 0 ? (s / osa) - s : 0;

            return {
                brand: r.Brand,
                sales: s,
                osa: osa.toFixed(2),
                psl_frac: psl_frac.toFixed(2),
                psl_raw: psl_raw.toFixed(2)
            };
        });

        console.table(results);

        // Also check total
        const totalSales = results.reduce((acc, r) => acc + r.sales, 0);
        const totalNeno = res.reduce((acc, r) => acc + parseFloat(r.neno), 0);
        const totalDeno = res.reduce((acc, r) => acc + parseFloat(r.deno), 0);
        const totalOsa = totalDeno > 0 ? (totalNeno / totalDeno) * 100 : 0;
        const totalPslFrac = totalOsa > 0 ? (totalSales / (totalOsa / 100)) - totalSales : 0;

        console.log('TOTAL Blinkit:', {
            sales: totalSales,
            osa: totalOsa.toFixed(2),
            psl_frac: totalPslFrac.toFixed(2)
        });

    } catch (err) {
        console.error(err);
    }
}

run();
