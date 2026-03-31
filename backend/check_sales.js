import { queryClickHouse } from './src/config/clickhouse.js';

async function checkSales() {
    try {
        const query = `SELECT count(*) as cnt FROM rb_pdp_olap WHERE Sales IS NOT NULL OR Qty_Sold IS NOT NULL`;
        const results = await queryClickHouse(query);
        console.log('Non-null Sales/Qty count:', JSON.stringify(results, null, 2));
    } catch (err) {
        console.error('Error:', err);
    }
}

checkSales();
