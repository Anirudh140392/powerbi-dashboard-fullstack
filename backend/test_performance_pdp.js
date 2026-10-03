import { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
    const webPid = '5a632153-3cb1-4996-9d19-5b6f3f8b115e';
    const query = `
        SELECT 
            Location, 
            avg(toFloat64(Ad_sales) / nullIf(toFloat64(Ad_Spend), 0)) as roas,
            avg(toFloat64(Ad_Clicks) / nullIf(toFloat64(Ad_Impressions), 0)) as ctr,
            sum(toFloat64(Ad_Clicks)) as clicks,
            sum(toFloat64(Ad_Impressions)) as impressions,
            sum(toFloat64(Ad_sales)) as sales,
            sum(toFloat64(Ad_Spend) ) as spend,
            DATE
        FROM rb_pdp_olap 
        WHERE Web_Pid = '${webPid}'
        AND toFloat64(Ad_Clicks) > 0
        GROUP BY Location, DATE
        LIMIT 20
    `;
    const results = await queryClickHouse(query);
    console.log(JSON.stringify(results, null, 2));
}

test();
