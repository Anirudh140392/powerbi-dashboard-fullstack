import { queryClickHouse } from './src/config/clickhouse.js';
import dayjs from 'dayjs';

async function testL2M() {
    // 1. Get total keywords for "All" filters
    const query = `
        SELECT 
            keyword,
            SUM(ad_spend) as spend,
            SUM(ad_sales) as revenue,
            if(SUM(ad_spend) > 0, SUM(ad_sales)/SUM(ad_spend), 0) as roas
        FROM mars.rca_pm_olap
        WHERE ad_spend > 0 OR ad_sales > 0
        GROUP BY keyword
        HAVING spend > 0
    `;
    const results = await queryClickHouse(query);

    // We want to test different L2M baseline calculations
    const l2mQuery = `
        SELECT 
            SUM(ad_spend) / COUNT(DISTINCT keyword) as avg_spend_l2m,
            SUM(ad_sales) / SUM(ad_spend) as overall_roas_l2m,
            AVG(total_roas) as avg_total_roas_col
        FROM mars.rca_pm_olap
        WHERE Date >= subtractDays(now(), 60)
    `;
    const l2mRes = await queryClickHouse(l2mQuery);
    console.log("L2M Baselines:", l2mRes[0]);

    // Compute Quadrants using old logic
    let old_q1 = 0, old_q2 = 0, old_q3 = 0, old_q4 = 0;
    let oldSpend = 0, oldRoas = 0;
    results.forEach(r => { oldSpend += Number(r.spend); oldRoas += Number(r.roas); });
    const avgS = oldSpend / results.length;
    const avgR = oldRoas / results.length;

    results.forEach(r => {
        const s = Number(r.spend);
        const ro = Number(r.roas);
        if (s >= avgS && ro >= avgR) old_q1++;
        else if (s >= avgS && ro < avgR) old_q2++;
        else if (s < avgS && ro < avgR) old_q3++;
        else if (s < avgS && ro >= avgR) old_q4++;
    });
    console.log("OLD LOGIC:", { total: results.length, Q1: old_q1, Q2: old_q2, Q3: old_q3, Q4: old_q4 });

    // Compute Quadrants using overall L2M logic
    // We treat avg_ad_spend_l2m as avg_spend_l2m, avg_total_roas_l2m as overall_roas_l2m
    let q1 = 0, q2 = 0, q3 = 0, q4 = 0;
    const l2mSpend = Number(l2mRes[0].avg_spend_l2m);
    const l2mRoas = Number(l2mRes[0].overall_roas_l2m); // or maybe avg_total_roas_col?

    results.forEach(r => {
        const s = Number(r.spend);
        const ro = Number(r.roas);
        if (s >= l2mSpend && ro >= l2mRoas) q1++;
        else if (s >= l2mSpend && ro < l2mRoas) q2++;
        else if (s < l2mSpend && ro < l2mRoas) q3++;
        else if (s < l2mSpend && ro >= l2mRoas) q4++;
    });
    console.log(`NEW LOGIC (L2M Baselines ${l2mSpend.toFixed(2)}, ${l2mRoas.toFixed(2)}):`, { Q1: q1, Q2: q2, Q3: q3, Q4: q4 });
}

testL2M().catch(console.error).finally(() => process.exit(0));
