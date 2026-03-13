import { queryClickHouse } from './src/config/clickhouse.js';
import dayjs from 'dayjs';

async function testDecQuadrants() {
    try {
        const startDate = dayjs('2025-12-01');
        const endDate = dayjs('2025-12-31');
        // Calculate duration exactly
        const duration = endDate.diff(startDate, 'day') + 1;

        console.log(`Testing Date Range: ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')} (${duration} days)`);

        // Strict L2M Range (60 days prior to Dec 1)
        const endDateL2M = startDate.subtract(1, 'day').endOf('day').format('YYYY-MM-DD');
        const startDateL2M = dayjs(endDateL2M).subtract(60, 'day').startOf('day').format('YYYY-MM-DD');

        console.log(`L2M Baseline Range: ${startDateL2M} to ${endDateL2M}`);

        const l2mWhereSql = `Date BETWEEN '${startDateL2M}' AND '${endDateL2M}' AND Platform IN ('Blinkit')`;

        const l2mQuery = `
            SELECT 
                keyword,
                SUM(ad_spend) as spend, 
                SUM(Ad_sales) as revenue, 
                if(SUM(ad_spend) > 0, SUM(Ad_sales)/SUM(ad_spend), 0) as roas
            FROM mars.rca_pm_olap
            WHERE ${l2mWhereSql} AND (ad_spend > 0 OR Ad_sales > 0)
            GROUP BY keyword
            HAVING spend > 0
        `;
        const l2mResults = await queryClickHouse(l2mQuery);

        const kwHistoryMap = {};
        l2mResults.forEach(r => {
            kwHistoryMap[r.keyword] = {
                spend: Number(r.spend),
                roas: Number(r.roas)
            };
        });

        const currentWhereSql = `Date BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}' AND Platform IN ('Blinkit')`;
        const kwQuery = `
            SELECT keyword, SUM(ad_spend) as spend, if(SUM(ad_spend) > 0, SUM(Ad_sales)/SUM(ad_spend), 0) as roas
            FROM mars.rca_pm_olap
            WHERE ${currentWhereSql} AND (ad_spend > 0 OR Ad_sales > 0)
            GROUP BY keyword HAVING spend > 0
        `;
        const currentKws = await queryClickHouse(kwQuery);

        console.log(`Total Current Keywords Found (Blinkit): ${currentKws.length}`);

        let q1 = 0, q2 = 0, q3 = 0, q4 = 0;
        let newCount = 0;

        currentKws.forEach(r => {
            const kw = r.keyword;
            const currentSpend = Number(r.spend);
            const currentRoas = Number(r.roas);

            let kw_avg_spend_l2m = 0;
            let kw_avg_roas_l2m = 0;

            if (kwHistoryMap[kw]) {
                kw_avg_spend_l2m = (kwHistoryMap[kw].spend / 60) * duration;
                kw_avg_roas_l2m = kwHistoryMap[kw].roas;
            } else {
                newCount++;
            }

            if (currentRoas >= kw_avg_roas_l2m && currentSpend >= kw_avg_spend_l2m) q1++;
            else if (currentRoas < kw_avg_roas_l2m && currentSpend >= kw_avg_spend_l2m) q2++;
            else if (currentRoas < kw_avg_roas_l2m && currentSpend < kw_avg_spend_l2m) q3++;
            else if (currentRoas >= kw_avg_roas_l2m && currentSpend < kw_avg_spend_l2m) q4++;
        });

        console.log(`Brand New Keywords (No L2M History): ${newCount}`);
        console.log(`Distribution: Q1: ${q1}, Q2: ${q2}, Q3: ${q3}, Q4: ${q4}`);

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

testDecQuadrants();
