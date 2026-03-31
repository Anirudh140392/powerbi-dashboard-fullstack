import { queryClickHouse } from './src/config/clickhouse.js';

async function verifySunscreenMoM() {
    try {
        const currStart = '2026-03-01';
        const currEnd = '2026-03-23';
        const prevStart = '2026-02-06';
        const prevEnd = '2026-02-28';

        const query = (start, end) => `
            SELECT 
                SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) as offtake,
                SUM(ifNull(toFloat64OrZero(toString(Ad_sales)), 0)) as inorg_sales
            FROM mamaearth.rb_pdp_olap
            WHERE toDate(DATE) BETWEEN '${start}' AND '${end}'
            AND Category = 'Sunscreen'
            AND Comp_flag = '0'
        `;

        const [curr, prev] = await Promise.all([
            queryClickHouse(query(currStart, currEnd)),
            queryClickHouse(query(prevStart, prevEnd))
        ]);

        console.log("Current Period (Mar 01 - Mar 23):");
        console.log(curr[0]);
        console.log("Expected Offtake: ~5.39 Cr");

        console.log("\nPrevious Period (Feb 06 - Feb 28):");
        console.log(prev[0]);

        // Check if rb_pm_olap matches for ad_sales
        const pmQuery = (start, end) => `
            SELECT SUM(ifNull(toFloat64OrZero(toString(ad_sales)), 0)) as ad_sales
            FROM mamaearth.rb_pm_olap
            WHERE toDate(DATE) BETWEEN '${start}' AND '${end}'
            AND category = 'Sunscreen'
        `;
        const [currPm, prevPm] = await Promise.all([
            queryClickHouse(pmQuery(currStart, currEnd)),
            queryClickHouse(pmQuery(prevStart, prevEnd))
        ]);
        console.log("\nInorganic Sales from rb_pm_olap:");
        console.log("Current:", currPm[0]?.ad_sales);
        console.log("Previous:", prevPm[0]?.ad_sales);

    } catch (e) {
        console.error(e);
    }
    process.exit();
}

verifySunscreenMoM();
