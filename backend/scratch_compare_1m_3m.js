import availabilityService from './src/services/availabilityService.js';
import { dbStorage, queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    dbStorage.run({ dbName: 'drl' }, async () => {
        try {
            // ===== 1M =====
            console.log('==================== 1M ====================');
            const res1M = await availabilityService.getAvailabilityKpiTrends({
                platform: 'amazon',
                period: '1M',
                timeStep: 'Daily',
                dimension: 'platform',
                ownBrandsOnly: 'true',
                resellerName: 'buy more'
            });
            console.log('1M Date Range:', res1M.dateRange);
            const nonZero1M = res1M.timeSeries.filter(t => t.Osa > 0);
            console.log('1M Non-zero OSA points:', nonZero1M.length, '/', res1M.timeSeries.length);
            nonZero1M.forEach(t => console.log(`  ${t.date} -> Osa: ${t.Osa}%`));

            // ===== 3M =====
            console.log('\n==================== 3M ====================');
            const res3M = await availabilityService.getAvailabilityKpiTrends({
                platform: 'amazon',
                period: '3M',
                timeStep: 'Daily',
                dimension: 'platform',
                ownBrandsOnly: 'true',
                resellerName: 'buy more'
            });
            console.log('3M Date Range:', res3M.dateRange);
            const nonZero3M = res3M.timeSeries.filter(t => t.Osa > 0);
            console.log('3M Non-zero OSA points:', nonZero3M.length, '/', res3M.timeSeries.length);
            nonZero3M.forEach(t => console.log(`  ${t.date} -> Osa: ${t.Osa}%`));

            // ===== User's manual SQL (no Comp_flag, no Reseller filter) =====
            console.log('\n==================== User Manual SQL ====================');
            const manualSQL = await queryClickHouse(`
                SELECT DATE, 
                       SUM(neno_osa) as neno, SUM(deno_osa) as deno,
                       IF(SUM(deno_osa) > 0, SUM(neno_osa) / SUM(deno_osa) * 100, 0) as osa_pct
                FROM rb_pdp_olap 
                WHERE Platform='amazon' 
                GROUP BY DATE 
                ORDER BY DATE DESC
                LIMIT 20
            `);
            console.log('Manual SQL results (no Comp_flag, no Reseller filter):');
            manualSQL.forEach(r => console.log(`  ${r.DATE} -> Osa: ${r.osa_pct ? parseFloat(r.osa_pct).toFixed(1) : 'null'}% (${r.neno}/${r.deno})`));

            // ===== Same but WITH Comp_flag = 0 (what API does with ownBrandsOnly=true) =====
            console.log('\n==================== With Comp_flag=0 ====================');
            const withCompFlag = await queryClickHouse(`
                SELECT DATE, 
                       SUM(neno_osa) as neno, SUM(deno_osa) as deno,
                       IF(SUM(deno_osa) > 0, SUM(neno_osa) / SUM(deno_osa) * 100, 0) as osa_pct
                FROM rb_pdp_olap 
                WHERE Platform='amazon' AND Comp_flag = 0
                GROUP BY DATE 
                ORDER BY DATE DESC
                LIMIT 20
            `);
            console.log('With Comp_flag=0:');
            withCompFlag.forEach(r => console.log(`  ${r.DATE} -> Osa: ${r.osa_pct ? parseFloat(r.osa_pct).toFixed(1) : 'null'}% (${r.neno}/${r.deno})`));

            // ===== With Comp_flag=0 AND Reseller =====
            console.log('\n==================== With Comp_flag=0 AND Reseller=buy more ====================');
            const withAll = await queryClickHouse(`
                SELECT DATE, 
                       SUM(neno_osa) as neno, SUM(deno_osa) as deno,
                       IF(SUM(deno_osa) > 0, SUM(neno_osa) / SUM(deno_osa) * 100, 0) as osa_pct
                FROM rb_pdp_olap 
                WHERE Platform='amazon' AND Comp_flag = 0 AND Reseller_Name = 'buy more'
                GROUP BY DATE 
                ORDER BY DATE DESC
                LIMIT 20
            `);
            console.log('With Comp_flag=0 AND Reseller=buy more:');
            withAll.forEach(r => console.log(`  ${r.DATE} -> Osa: ${r.osa_pct ? parseFloat(r.osa_pct).toFixed(1) : 'null'}% (${r.neno}/${r.deno})`));

            // ===== Check: what does the API WHERE clause look like? =====
            console.log('\n==================== Platform filter check ====================');
            // The API uses: lower(replace(Platform, ' ', '_')) IN ('amazon')
            // vs the user uses: Platform='amazon'
            const platformCheck = await queryClickHouse(`
                SELECT DISTINCT Platform, lower(replace(Platform, ' ', '_')) as normalized 
                FROM rb_pdp_olap 
                WHERE lower(Platform) = 'amazon' OR lower(replace(Platform, ' ', '_')) = 'amazon'
            `);
            console.log('Platform normalization check:', platformCheck);

        } catch (e) {
            console.error('Error:', e.message, e.stack);
        }
    });
}
run();
