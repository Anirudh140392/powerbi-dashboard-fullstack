import { queryClickHouse } from './src/config/clickhouse.js';

async function testExactQuery() {
    try {
        const currConditions = `
            toDate(DATE) BETWEEN '2026-03-01' AND '2026-03-23' 
            AND if(Category IS NOT NULL AND Category != '' AND Category != '0', 
                Category, 
                multiIf(LOWER(Brand) IN ('orbit', 'doublemint', 'boomer', 'skittles'), 'GMFC', 
                        LOWER(Brand) IN ('snickers', 'galaxy', 'bounty', 'twix', 'mars', 'm&m'), 
                            if(LOWER(toString(Product)) LIKE '%gift%' OR LOWER(toString(Product)) LIKE '%tin pack%', 
                               'Chocolates (Gifting)', 
                               'Chocolates (Non Gifting)'), 
                        'Others')
            ) IN ('Sunscreen')
        `;
        
        const q = `
            SELECT 
                SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) as total_sales
            FROM mamaearth.rb_pdp_olap
            WHERE ${currConditions}
        `;
        console.log("Query:", q);
        const res = await queryClickHouse(q);
        console.log("Result:", res);
    } catch (e) {
        console.error(e);
    }
    process.exit();
}

testExactQuery();
