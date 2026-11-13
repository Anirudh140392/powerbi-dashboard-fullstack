import { queryClickHouse, dbStorage } from '../src/config/clickhouse.js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function checkTables() {
    await dbStorage.run({ dbName: 'pidilite' }, async () => {
        try {
            console.log("=== 1. CHECK EXISTS TABLE rb_pdp_trend_all ===");
            const aggCheck = await queryClickHouse("EXISTS TABLE rb_pdp_trend_all");
            console.log("rb_pdp_trend_all exists:", aggCheck);

            if (aggCheck[0]?.result === 1) {
                console.log("\n=== 2. QUERY rb_pdp_trend_all FOR FEVICOL + ZEPTO ON 2026-09-08 ===");
                const aggQuery = `
                    SELECT 
                        brand,
                        platform,
                        date,
                        total_neno_osa,
                        total_deno_osa,
                        (total_neno_osa / total_deno_osa) * 100 as osa_pct
                    FROM rb_pdp_trend_all
                    WHERE lower(platform) = 'zepto' AND date = '2026-09-08' AND lower(brand) = 'fevicol'
                `;
                const aggRes = await queryClickHouse(aggQuery);
                console.log("rb_pdp_trend_all Fevicol result:", aggRes);

                console.log("\n=== 3. QUERY rb_pdp_trend_all FOR ALL BRANDS ON ZEPTO ON 2026-09-08 ===");
                const aggAllQuery = `
                    SELECT 
                        brand,
                        total_neno_osa,
                        total_deno_osa,
                        (total_neno_osa / total_deno_osa) * 100 as osa_pct
                    FROM rb_pdp_trend_all
                    WHERE lower(platform) = 'zepto' AND date = '2026-09-08'
                `;
                const aggAllRes = await queryClickHouse(aggAllQuery);
                console.log("rb_pdp_trend_all All Brands result:", aggAllRes);
            }

        } catch (err) {
            console.error("Error checking tables:", err);
        }
    });
    process.exit(0);
}

checkTables();
