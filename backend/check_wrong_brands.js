
import { queryClickHouse } from './src/config/clickhouse.js';

async function checkBrands() {
    try {
        const query = `
            SELECT 
                brand,
                COUNT(*) as cnt
            FROM rb_kw_olap
            WHERE brand != '1' AND brand != ''
            GROUP BY brand
            ORDER BY cnt DESC
            LIMIT 100
        `;
        const results = await queryClickHouse(query);
        results.forEach(r => console.log(JSON.stringify(r)));
    } catch (err) {
        console.error(err);
    }
}

checkBrands();
