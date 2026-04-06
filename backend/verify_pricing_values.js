import { queryClickHouse } from './src/config/clickhouse.js';

async function verifyPricing() {
    try {
        const query = `
            SELECT 
                Product_Title,
                Selling_Price,
                PPU,
                Weight,
                (Selling_Price / toFloat64OrZero(Weight)) * 100 as calculated_ppu_100,
                PPU * 100 as db_ppu_100
            FROM rb_pdp_olap
            WHERE Product_Title LIKE '%Galaxy%' AND Weight != '' AND Weight IS NOT NULL
            LIMIT 10
        `;
        const results = await queryClickHouse(query);
        console.table(results);
    } catch (e) {
        console.error(e);
    }
}

verifyPricing();
