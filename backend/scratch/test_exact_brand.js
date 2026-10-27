import { queryClickHouse, dbStorage } from '../src/config/clickhouse.js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function testExactBrandQuery() {
    await dbStorage.run({ dbName: 'pidilite' }, async () => {
        try {
            console.log("=== EXACT BRAND QUERY FOR 'fevicol' ONLY ON ZEPTO (2026-09-08) ===");
            const query = `
                SELECT 
                    formatDateTime(toDate(DATE), '%Y-%m-%d') as date_group,
                    SUM(CASE WHEN toString(Comp_flag) = '0' THEN ifNull(toFloat64OrZero(toString(neno_osa)), 0) ELSE 0 END) as total_neno_osa,
                    SUM(CASE WHEN toString(Comp_flag) = '0' THEN ifNull(toFloat64OrZero(toString(deno_osa)), 0) ELSE 0 END) as total_deno_osa,
                    (toFloat64(SUM(CASE WHEN toString(Comp_flag) = '0' THEN ifNull(toFloat64OrZero(toString(neno_osa)), 0) ELSE 0 END)) / NULLIF(toFloat64(SUM(CASE WHEN toString(Comp_flag) = '0' THEN ifNull(toFloat64OrZero(toString(deno_osa)), 0) ELSE 0 END)), 0)) * 100 as total_availability
                FROM pidilite.rb_pdp_olap 
                WHERE toDate(DATE) BETWEEN '2026-09-08' AND '2026-09-08' 
                  AND toString(Comp_flag) = '0' 
                  AND lower(trim(Brand)) IN ('fevicol')
                  AND lower(Platform) IN ('zepto') 
                GROUP BY date_group
            `;
            const rows = await queryClickHouse(query);
            console.log("Exact Brand Result:", rows);

        } catch (err) {
            console.error("Error:", err);
        }
    });
    process.exit(0);
}

testExactBrandQuery();
