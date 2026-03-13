import { queryClickHouse } from './src/config/clickhouse.js';
import dayjs from 'dayjs';

async function testKeywordBaseline() {
    // 1. Define Selected Period
    const startDate = dayjs('2026-02-01');
    const endDate = dayjs('2026-02-28');
    const duration = endDate.diff(startDate, 'day') + 1; // 28 days

    // 2. Define L2M Period (Strictly previous 2 months)
    const endDateL2M = startDate.subtract(1, 'day'); // Jan 31
    const startDateL2M = endDateL2M.subtract(60, 'days'); // ~ Dec 2

    console.log(`Selected Range: ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')} (${duration} days)`);
    console.log(`L2M Baseline Range: ${startDateL2M.format('YYYY-MM-DD')} to ${endDateL2M.format('YYYY-MM-DD')}`);

    // 3. Get Current Keyword Performance
    const currentQuery = `
        SELECT 
            keyword,
            SUM(ad_spend) as spend,
            if(SUM(ad_spend) > 0, SUM(Ad_sales)/SUM(ad_spend), 0) as roas
        FROM mars.rca_pm_olap
        WHERE Date BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'
          AND (ad_spend > 0 OR Ad_sales > 0)
        GROUP BY keyword
        HAVING spend > 0
    `;
    const currentResults = await queryClickHouse(currentQuery);

    // 4. Get L2M Baseline PER KEYWORD
    const l2mQuery = `
        SELECT 
            keyword,
            SUM(ad_spend) as spend,
            if(SUM(ad_spend) > 0, SUM(Ad_sales)/SUM(ad_spend), 0) as roas
        FROM mars.rca_pm_olap
        WHERE Date BETWEEN '${startDateL2M.format('YYYY-MM-DD')}' AND '${endDateL2M.format('YYYY-MM-DD')}'
          AND (ad_spend > 0 OR Ad_sales > 0)
        GROUP BY keyword
        HAVING spend > 0
    `;
    const l2mResults = await queryClickHouse(l2mQuery);

    // Create Lookup Map
    const l2mMap = {};
    l2mResults.forEach(r => {
        l2mMap[r.keyword] = {
            spend: Number(r.spend),
            roas: Number(r.roas)
        };
    });

    let q1 = 0, q2 = 0, q3 = 0, q4 = 0;

    // Need a fallback for keywords without L2M data. We can either:
    // a) skip them entirely
    // b) compare them against 0 (which means they'll always be exceeding spend, so Q1 or Q2)
    // The user's Python logic implies a pandas merge. Usually in pandas, missing = NaN, which evaluates to False.
    let missingL2m = 0;

    currentResults.forEach(r => {
        const keyword = r.keyword;
        const currentSpend = Number(r.spend);
        const currentRoas = Number(r.roas);

        const l2mData = l2mMap[keyword];

        let avg_ad_spend_l2m = 0;
        let avg_total_roas_l2m = 0;

        if (l2mData) {
            // Scale historical spend window (60 days) to match current duration (28 days)
            avg_ad_spend_l2m = (l2mData.spend / 60) * duration;
            avg_total_roas_l2m = l2mData.roas;
        } else {
            missingL2m++;
            // If we have no history, treat it as entirely incremental (beats historical average of 0)
            avg_ad_spend_l2m = 0;
            avg_total_roas_l2m = 0;
        }

        if (currentRoas >= avg_total_roas_l2m && currentSpend >= avg_ad_spend_l2m) q1++;
        else if (currentRoas < avg_total_roas_l2m && currentSpend >= avg_ad_spend_l2m) q2++;
        else if (currentRoas < avg_total_roas_l2m && currentSpend < avg_ad_spend_l2m) q3++;
        else q4++;
    });

    console.log(`Total Current Keywords: ${currentResults.length}`);
    console.log(`Keywords without L2M history: ${missingL2m}`);
    console.log(`Distribution: Q1: ${q1}, Q2: ${q2}, Q3: ${q3}, Q4: ${q4}`);
}

testKeywordBaseline().catch(console.error).finally(() => process.exit(0));
