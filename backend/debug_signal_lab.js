import { queryClickHouse } from './src/config/clickhouse.js';
import dayjs from 'dayjs';

async function debugSignalLab() {
    const brand = 'Colgate'; // Based on proxy logs
    const start = '2026-03-01';
    const end = '2026-03-09';

    console.log(`--- Debugging Signal Lab for Brand: ${brand}, Dates: ${start} to ${end} ---`);

    try {
        // 1. Check if any records exist for this brand
        const basicCount = await queryClickHouse(`
            SELECT count() as count 
            FROM rb_pdp_olap 
            WHERE Brand LIKE '%${brand}%' 
            AND toDate(DATE) BETWEEN '${start}' AND '${end}'
        `);
        console.log("Basic Record Count:", basicCount[0].count);

        if (basicCount[0].count > 0) {
            // 2. Check neno_osa and deno_osa
            const osaStats = await queryClickHouse(`
                SELECT 
                    sum(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) as total_neno,
                    sum(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as total_deno
                FROM rb_pdp_olap 
                WHERE Brand LIKE '%${brand}%' 
                AND toDate(DATE) BETWEEN '${start}' AND '${end}'
            `);
            console.log("OSA Stats:", osaStats[0]);

            // 3. Try to run a simplified gainer/drainer query
            const skus = await queryClickHouse(`
                SELECT 
                    SKU_Code,
                    argMax(SKU_Name, DATE) as sku_name,
                    (sum(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) / nullIf(sum(ifNull(toFloat64OrZero(toString(deno_osa)), 0)), 0)) * 100 as osa
                FROM rb_pdp_olap
                WHERE Brand LIKE '%${brand}%'
                AND toDate(DATE) BETWEEN '${start}' AND '${end}'
                GROUP BY SKU_Code
                HAVING osa IS NOT NULL
                LIMIT 5
            `);
            console.log("Sample SKUs with OSA:", skus);
        }

        // 4. Check if Comp_flag = '0' is the issue
        const compFlagCount = await queryClickHouse(`
            SELECT count() as count 
            FROM rb_pdp_olap 
            WHERE Brand LIKE '%${brand}%' 
            AND toString(Comp_flag) = '0'
            AND toDate(DATE) BETWEEN '${start}' AND '${end}'
        `);
        console.log("Record Count with Comp_flag='0':", compFlagCount[0].count);

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

debugSignalLab();
