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
            WHERE Web_Pid IN ('563497', '5634970', '10109337', '32121')
            GROUP BY Web_Pid
        `;
        const result = await queryClickHouse(query);
        console.table(result);
    } catch (e) {
        console.error(e);
    }
}
testSkus();
