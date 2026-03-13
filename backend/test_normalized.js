import { queryClickHouse } from './src/config/clickhouse.js';
import dayjs from 'dayjs';

async function testNormalized() {
    const selectedDays = 30; // pretend user selected 30 days

    // Simulate current period (Last 30 Days)
    const q1 = `
    SELECT 
        keyword,
        SUM(ad_spend) as spend,
        SUM(Ad_sales) as revenue,
        if(SUM(ad_spend) > 0, SUM(Ad_sales)/SUM(ad_spend), 0) as roas
    FROM mars.rca_pm_olap
    WHERE Date >= subtractDays(now(), ${selectedDays})
    GROUP BY keyword
    HAVING spend > 0
    `;
    const results = await queryClickHouse(q1);

    // Simulate L2M Period
    const q2 = `
    SELECT 
        keyword,
        SUM(ad_spend) as spend,
        SUM(Ad_sales) as revenue,
        if(SUM(ad_spend) > 0, SUM(Ad_sales)/SUM(ad_spend), 0) as roas
    FROM mars.rca_pm_olap
    WHERE Date >= subtractDays(now(), 60)
    GROUP BY keyword
    HAVING spend > 0
    `;
    const l2mResults = await queryClickHouse(q2);

    let totalSpendL2M = 0;
    let totalRoasL2M = 0;
    l2mResults.forEach(r => {
        totalSpendL2M += Number(r.spend);
        totalRoasL2M += Number(r.roas);
    });

    const raw_avg_ad_spend_l2m = totalSpendL2M / l2mResults.length;
    const avg_total_roas_l2m = totalRoasL2M / l2mResults.length;

    // Normalize spend threshold
    const avg_ad_spend_l2m = (raw_avg_ad_spend_l2m / 60) * selectedDays;

    let cnt_q1 = 0, cnt_q2 = 0, cnt_q3 = 0, cnt_q4 = 0;
    results.forEach(r => {
        const s = Number(r.spend);
        const ro = Number(r.roas);

        if (ro >= avg_total_roas_l2m && s >= avg_ad_spend_l2m) cnt_q1++;
        else if (ro < avg_total_roas_l2m && s >= avg_ad_spend_l2m) cnt_q2++;
        else if (ro < avg_total_roas_l2m && s < avg_ad_spend_l2m) cnt_q3++;
        else cnt_q4++;
    });

    console.log(`L2M Raw Avg Spend: ${raw_avg_ad_spend_l2m.toFixed(2)} (60 days)`);
    console.log(`L2M Normalized Avg Spend: ${avg_ad_spend_l2m.toFixed(2)} (for ${selectedDays} days)`);
    console.log(`L2M Avg ROAS: ${avg_total_roas_l2m.toFixed(2)}`);
    console.log(`Distribution: Q1: ${cnt_q1}, Q2: ${cnt_q2}, Q3: ${cnt_q3}, Q4: ${cnt_q4}`);
}

testNormalized().catch(console.error).finally(() => process.exit(0));
