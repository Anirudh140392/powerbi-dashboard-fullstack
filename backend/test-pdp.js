import 'dotenv/config';
import { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
    const pdpQuery = `
WITH our_impacted AS (
    SELECT 
        multiIf(LOWER(Location) IN ('gurgaon','gurugram'), 'Gurugram', LOWER(Location) IN ('bangalore','bengaluru'), 'Bengaluru', initCap(Location)) AS city, 
        Platform AS platform, 
        if(Category IS NOT NULL AND Category != '' AND Category != '0' AND Category != '-', initCap(toString(Category)), multiIf(LOWER(Brand) IN ('orbit', 'doublemint', 'boomer', 'skittles'), 'GMFC', LOWER(Brand) IN ('snickers', 'galaxy', 'bounty', 'twix', 'mars', 'm&m', 'm&m''s'), if(LOWER(toString(Product)) LIKE '%gift%' OR LOWER(toString(Product)) LIKE '%tin pack%', 'Chocolates (Gifting)', 'Chocolates (Non Gifting)'), 'Others')) AS category,
        argMax(Product, toFloat64OrZero(toString(Sales))) AS impacted_sku
    FROM rb_pdp_olap
    WHERE DATE BETWEEN '2026-04-01' AND '2026-04-25' AND Comp_flag IN (0, '0')
      AND LOWER(Platform) IN ('instamart')
      AND multiIf(LOWER(Location) IN ('gurgaon','gurugram'), 'Gurugram', LOWER(Location) IN ('bangalore','bengaluru'), 'Bengaluru', initCap(Location)) IN ('Gurugram')
      AND LOWER(if(Category IS NOT NULL AND Category != '' AND Category != '0' AND Category != '-', initCap(toString(Category)), multiIf(LOWER(Brand) IN ('orbit', 'doublemint', 'boomer', 'skittles'), 'GMFC', LOWER(Brand) IN ('snickers', 'galaxy', 'bounty', 'twix', 'mars', 'm&m', 'm&m''s'), if(LOWER(toString(Product)) LIKE '%gift%' OR LOWER(toString(Product)) LIKE '%tin pack%', 'Chocolates (Gifting)', 'Chocolates (Non Gifting)'), 'Others'))) IN ('chocolates (non gifting)')
    GROUP BY city, platform, category
)
SELECT * FROM our_impacted;
    `;

    console.log("Running PDP Query...");
    try {
        const pdpData = await queryClickHouse(pdpQuery);
        console.log("PDP Data:", pdpData);
    } catch (e) {
        console.error(e.message);
    }
    process.exit(0);
}

test();
