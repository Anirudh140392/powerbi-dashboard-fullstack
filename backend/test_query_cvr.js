import { queryClickHouse } from './src/config/clickhouse.js';

async function main() {
    try {
        const query = `
            SELECT 
                Brand, 
                SUM(toInt32OrZero(toString(Qty_Sold))) as qty, 
                SUM(toInt32OrZero(toString(Ad_Quantity_sold))) as ad_qty,
                SUM(toInt32OrZero(toString(Ad_Impressions))) as ad_imp, 
                SUM(toInt32OrZero(toString(Organic_Impressions))) as org_imp 
            FROM rb_pdp_olap 
            WHERE Platform = 'Amazon' AND toDate(DATE) > today() - 30 
            GROUP BY Brand 
            HAVING qty > 0 
            ORDER BY qty DESC 
            LIMIT 5
        `;
        const res = await queryClickHouse(query);
        console.dir(res, { depth: null });
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
main();
