import { queryClickHouse, dbStorage } from '../src/config/clickhouse.js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function verifyBreakdown() {
    await dbStorage.run({ dbName: 'pidilite' }, async () => {
        try {
            console.log("=== BREAKDOWN OF ALL BRANDS MATCHING '%fevicol%' ON ZEPTO (2026-09-08) ===");
            const query = `
                SELECT 
                    Brand,
                    SUM(toFloat64OrZero(toString(neno_osa))) as sum_neno,
                    SUM(toFloat64OrZero(toString(deno_osa))) as sum_deno,
                    (SUM(toFloat64OrZero(toString(neno_osa))) / NULLIF(SUM(toFloat64OrZero(toString(deno_osa))), 0)) * 100 as osa_pct
                FROM pidilite.rb_pdp_olap
                WHERE lower(Platform) = 'zepto' 
                  AND DATE = '2026-09-08' 
                  AND lower(Brand) LIKE '%fevicol%'
                GROUP BY Brand
                ORDER BY Brand
            `;
            const rows = await queryClickHouse(query);
            console.log(rows);

            const totalQuery = `
                SELECT 
                    SUM(toFloat64OrZero(toString(neno_osa))) as total_neno,
                    SUM(toFloat64OrZero(toString(deno_osa))) as total_deno,
                    (SUM(toFloat64OrZero(toString(neno_osa))) / NULLIF(SUM(toFloat64OrZero(toString(deno_osa))), 0)) * 100 as combined_osa_pct
                FROM pidilite.rb_pdp_olap
                WHERE lower(Platform) = 'zepto' 
                  AND DATE = '2026-09-08' 
                  AND lower(Brand) LIKE '%fevicol%'
            `;
            const totalRows = await queryClickHouse(totalQuery);
            console.log("\n=== COMBINED TOTAL FOR ALL '%fevicol%' BRANDS ===");
            console.log(totalRows);

        } catch (err) {
            console.error("Error:", err);
        }
    });
    process.exit(0);
}

verifyBreakdown();
