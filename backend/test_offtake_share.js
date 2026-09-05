import { queryClickHouse } from './src/config/clickhouse.js';

async function testSignalLab() {
    try {
        const query = `
            SELECT 
                Web_Pid,
                any(Product) as Product,
                sum(toFloat64(Sales)) as currSales
            FROM rb_pdp_olap
            WHERE toDate(DATE) BETWEEN '2025-12-01' AND '2025-12-31'
            GROUP BY Web_Pid
            ORDER BY currSales DESC
            LIMIT 10
        `;
        const result = await queryClickHouse(query);
        console.log('Top SKUs by Sales:', Math.round(result[0]?.currSales));
        console.table(result);

        const totalQuery = `
            SELECT sum(toFloat64OrZero(toString(Sales))) as totalSales
            FROM rb_pdp_olap
            WHERE toDate(DATE) BETWEEN '2025-12-01' AND '2025-12-31'
        `;
        const totalResult = await queryClickHouse(totalQuery);
        console.log('Total Context Sales:', totalResult);
    } catch (e) {
        console.error(e);
    }
}
testSignalLab();
