import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const query1 = `
            SELECT keyword as name, sum(toInt32(overall)) as brand_kws
            FROM rb_kw_olap
            WHERE toDate(DATE) BETWEEN '2026-03-01' AND '2026-03-29' 
              AND lower(brand_name_th) = 'boat' 
              AND flag = 1 
              AND keyword IS NOT NULL AND keyword != ''
            GROUP BY name
            ORDER BY brand_kws DESC
            LIMIT 10
        `;
        const query2 = `
            SELECT keyword as name, sum(toInt32(overall)) as total_kws
            FROM rb_kw_olap
            WHERE toDate(DATE) BETWEEN '2026-03-01' AND '2026-03-29' 
              AND keyword IS NOT NULL AND keyword != ''
            GROUP BY name
            ORDER BY total_kws DESC
            LIMIT 10
        `;

        const res1 = await queryClickHouse(query1);
        console.log("Numerator (boat) results:", res1);
        const res2 = await queryClickHouse(query2);
        console.log("Denominator (all) results:", res2.slice(0, 3));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
