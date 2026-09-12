
import { queryClickHouse } from './src/config/clickhouse.js';

async function exhaustiveCheck() {
    try {
        console.log('--- Blinkit Data Check (Mar 1-11, 2026) ---');
        
        // 1. All unique Category + Product_type for Blinkit in window
        const query1 = `
            SELECT Category, Product_type, count() as count
            FROM rb_pdp_olap
            WHERE Platform = 'Blinkit'
              AND DATE BETWEEN '2026-03-01' AND '2026-03-11'
            GROUP BY Category, Product_type
            ORDER BY count DESC
        `;
        const res1 = await queryClickHouse(query1);
        console.log('Combinations on Blinkit:', JSON.stringify(res1, null, 2));

        // 2. Check for "Gold" appearing in any category on Blinkit
        const query2 = `
            SELECT Category, Product_type, count() as count
            FROM rb_pdp_olap
            WHERE Platform = 'Blinkit'
              AND DATE BETWEEN '2026-03-01' AND '2026-03-11'
              AND (lower(Category) LIKE '%gmfc%' OR lower(Product_type) LIKE '%gold%')
            GROUP BY Category, Product_type
        `;
        const res2 = await queryClickHouse(query2);
        console.log('GMFC/Gold search on Blinkit:', JSON.stringify(res2, null, 2));
        
        // 3. Check if there are ANY rows regardless of platform for this combo
        const query3 = `
            SELECT Platform, DATE, count() as count
            FROM rb_pdp_olap
            WHERE Category = 'GMFC'
              AND Product_type = 'Gold'
              AND DATE BETWEEN '2026-03-01' AND '2026-03-11'
            GROUP BY Platform, DATE
        `;
        const res3 = await queryClickHouse(query3);
        console.log('GMFC + Gold combo across all platforms:', JSON.stringify(res3, null, 2));

    } catch (err) {
        console.error('Error:', err);
    }
}

exhaustiveCheck();
