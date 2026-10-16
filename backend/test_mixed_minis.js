import { queryClickHouse } from './src/config/clickhouse.js';

async function testSkus() {
    try {
        const query = `
            SELECT 
                Web_Pid,
                any(Product) as Product,
                sum(toFloat64(Sales)) as currSales,
                sum(toFloat64(Qty_Sold)) as qtySold
            FROM rb_pdp_olap
            WHERE Product LIKE '%Minis%' OR Product LIKE '%Mixed%'
            GROUP BY Web_Pid
            ORDER BY currSales DESC
            LIMIT 10
        `;
        const result = await queryClickHouse(query);
        console.table(result);
    } catch (e) {
        console.error(e);
    }
}
testSkus();
