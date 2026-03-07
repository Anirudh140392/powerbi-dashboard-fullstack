import { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
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
    console.log("Fetching keywords...");
    const results = await queryClickHouse(query);

    // Calculate medians/averages
    let totalSpend = 0;
    let totalRoas = 0;
    results.forEach(r => {
        totalSpend += Number(r.spend);
        totalRoas += Number(r.roas);
    });

    const avgSpend = totalSpend / results.length;
    const avgRoas = totalRoas / results.length;

    console.log(`Total keywords: ${results.length}`);
    console.log(`Avg Spend: ${avgSpend.toFixed(2)}`);
    console.log(`Avg ROAS: ${avgRoas.toFixed(2)}`);

    let q1 = 0, q2 = 0, q3 = 0, q4 = 0;

    // Q1 (Performing Well): High Spend, High ROAS
    // Q2 (Need Attention): High Spend, Low ROAS
    // Q3 (Experiment): Low Spend, Low ROAS
    // Q4 (Opportunity): Low Spend, High ROAS
    results.forEach(r => {
        const s = Number(r.spend);
        const ro = Number(r.roas);

        if (s >= avgSpend && ro >= avgRoas) q1++;
        else if (s >= avgSpend && ro < avgRoas) q2++;
        else if (s < avgSpend && ro < avgRoas) q3++;
        else if (s < avgSpend && ro >= avgRoas) q4++;
    });

    console.log({
        total: results.length,
        Q1: q1,
        Q2: q2,
        Q3: q3,
        Q4: q4
    });
}

test().catch(console.error).finally(() => process.exit(0));
