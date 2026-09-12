import availabilityService from './src/services/availabilityService.js';
import { dbStorage, queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    dbStorage.run({ dbName: 'drl' }, async () => {
        try {
            const periods = ['1M', '3M', '6M', '1Y'];
            
            for (const period of periods) {
                console.log(`\n================== PERIOD: ${period} ==================`);
                
                // 1. API query with resellerName = 'buy more'
                const resBuyMore = await availabilityService.getAvailabilityKpiTrends({
                    platform: 'amazon',
                    period,
                    timeStep: 'Daily',
                    dimension: 'platform',
                    ownBrandsOnly: 'true',
                    resellerName: 'buy more'
                });
                
                // 2. API query with resellerName = 'All' (only platform = 'amazon')
                const resAll = await availabilityService.getAvailabilityKpiTrends({
                    platform: 'amazon',
                    period,
                    timeStep: 'Daily',
                    dimension: 'platform',
                    ownBrandsOnly: 'true',
                    resellerName: 'All'
                });

                console.log(`[resellerName=buy more] Date Range: ${resBuyMore.dateRange.start} to ${resBuyMore.dateRange.end}`);
                console.log(`[resellerName=buy more] Non-zero points count: ${resBuyMore.timeSeries.filter(t => t.Osa > 0).length} / ${resBuyMore.timeSeries.length}`);
                if (resBuyMore.timeSeries.filter(t => t.Osa > 0).length > 0) {
                    console.log('Sample points with Osa > 0:', resBuyMore.timeSeries.filter(t => t.Osa > 0).slice(0, 5));
                }

                console.log(`[resellerName=All] Date Range: ${resAll.dateRange.start} to ${resAll.dateRange.end}`);
                console.log(`[resellerName=All] Non-zero points count: ${resAll.timeSeries.filter(t => t.Osa > 0).length} / ${resAll.timeSeries.length}`);
                if (resAll.timeSeries.filter(t => t.Osa > 0).length > 0) {
                    console.log('Sample points with Osa > 0:', resAll.timeSeries.filter(t => t.Osa > 0).slice(0, 5));
                }
                
                // Run manual ClickHouse query for the same date range to compare
                const start = resAll.dateRange.start;
                const end = resAll.dateRange.end;
                
                console.log(`\n--- Manual ClickHouse Queries for range: ${start} to ${end} ---`);
                
                // Manual for buy more
                const dbBuyMore = await queryClickHouse(`
                    SELECT DATE, SUM(toFloat64OrZero(toString(neno_osa))) as neno, SUM(toFloat64OrZero(toString(deno_osa))) as deno
                    FROM rb_pdp_olap
                    WHERE lower(Platform) = 'amazon' AND lower(Reseller_Name) = 'buy more' AND DATE BETWEEN '${start}' AND '${end}'
                    GROUP BY DATE ORDER BY DATE ASC
                `);
                console.log(`[Manual buy more] DB rows count: ${dbBuyMore.length}`);
                if (dbBuyMore.length > 0) {
                    console.log('Sample DB rows (first 5):', dbBuyMore.slice(0, 5).map(r => `${r.DATE}: Osa=${((r.neno/r.deno)*100).toFixed(1)}% (${r.neno}/${r.deno})`));
                }
                
                // Manual for All
                const dbAll = await queryClickHouse(`
                    SELECT DATE, SUM(toFloat64OrZero(toString(neno_osa))) as neno, SUM(toFloat64OrZero(toString(deno_osa))) as deno
                    FROM rb_pdp_olap
                    WHERE lower(Platform) = 'amazon' AND DATE BETWEEN '${start}' AND '${end}'
                    GROUP BY DATE ORDER BY DATE ASC
                `);
                console.log(`[Manual All] DB rows count: ${dbAll.length}`);
                if (dbAll.length > 0) {
                    console.log('Sample DB rows (first 5):', dbAll.slice(0, 5).map(r => `${r.DATE}: Osa=${((r.neno/r.deno)*100).toFixed(1)}% (${r.neno}/${r.deno})`));
                }
            }

        } catch (e) {
            console.error('Error:', e);
        }
    });
}
run();
