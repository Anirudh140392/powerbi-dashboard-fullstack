
import { queryClickHouse } from './src/config/clickhouse.js';
import dotenv from 'dotenv';
dotenv.config();

const PRODUCT_CATEGORY_SQL = `if(Product_Category IS NOT NULL AND Product_Category != '' AND Product_Category != '0', 
    Product_Category, 
    multiIf(LOWER(Brand) IN ('orbit', 'doublemint', 'boomer', 'skittles'), 'GMFC', 
            LOWER(Brand) IN ('snickers', 'galaxy', 'bounty', 'twix', 'mars', 'm&m'), 
                if(LOWER(toString(Product)) LIKE '%gift%' OR LOWER(toString(Product)) LIKE '%tin pack%' OR LOWER(toString(Product)) LIKE '%minis%', 
                   'Chocolates (Gifting)', 
                   'Chocolates (Non Gifting)'), 
            'Others')
)`;

async function check() {
    const query = `
        SELECT ${PRODUCT_CATEGORY_SQL} as cat, count(*) as count
        FROM rb_pdp_olap
        WHERE DATE BETWEEN '2026-03-01' AND '2026-03-10'
        GROUP BY cat
    `;
    const results = await queryClickHouse(query);
    console.log(JSON.stringify(results, null, 2));
}

check().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
