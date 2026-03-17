import { queryClickHouse } from './src/config/clickhouse.js';

async function checkData() {
    try {
        console.log("Checking for records with flag='1' or flag=1");
        
        const q1 = `SELECT count(*) as count FROM rb_kw_olap WHERE flag = '1' LIMIT 1`;
        const res1 = await queryClickHouse(q1);
        console.log("Count with flag='1':", res1[0]);

        const q2 = `SELECT count(*) as count FROM rb_kw_olap WHERE flag = 1 LIMIT 1`;
        const res2 = await queryClickHouse(q2);
        console.log("Count with flag=1:", res2[0]);

        const q3 = `SELECT flag, count(*) as count FROM rb_kw_olap GROUP BY flag LIMIT 10`;
        const res3 = await queryClickHouse(q3);
        console.log("Values for flag:", res3);

        const q4 = `
            SELECT 
                ROUND(sumIf(toInt32(overall), flag = '1') * 100.0 / nullIf(sum(toInt32(overall)), 0), 2) AS overall_sos,
                ROUND(sumIf(toInt32(spons), flag = '1') * 100.0 / nullIf(sum(toInt32(spons)), 0), 2) AS sponsored_sos,
                ROUND(sumIf(toInt32(organic), flag = '1') * 100.0 / nullIf(sum(toInt32(organic)), 0), 2) AS organic_sos
            FROM rb_kw_olap
            WHERE DATE >= subtractDays(now(), 30)
        `;
        const res4 = await queryClickHouse(q4);
        console.log("SOS calculation for last 30 days:", res4[0]);

    } catch (err) {
        console.error("Error:", err);
    }
}

checkData();
