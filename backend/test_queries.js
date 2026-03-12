
import { queryClickHouse } from './src/config/clickhouse.js';

const PRODUCT_CATEGORY_SQL = `if(Product_Category IS NOT NULL AND Product_Category != '' AND Product_Category != '0', 
    Product_Category, 
    multiIf(LOWER(Brand) IN ('orbit', 'doublemint', 'boomer', 'skittles'), 'GMFC', 
            LOWER(Brand) IN ('snickers', 'galaxy', 'bounty', 'twix', 'mars', 'm&m'), 
                if(LOWER(toString(Product)) LIKE '%gift%' OR LOWER(toString(Product)) LIKE '%tin pack%', 
                   'Chocolates (Gifting)', 
                   'Chocolates (Non Gifting)'), 
            'Others')
)`;

const f = {
    sales: 'ifNull(toFloat64OrZero(toString(Sales)), 0)',
    spend: 'ifNull(toFloat64OrZero(toString(Ad_Spend)), 0)',
    adSales: 'ifNull(toFloat64OrZero(toString(Ad_sales)), 0)',
    clicks: 'ifNull(toFloat64OrZero(toString(Ad_Clicks)), 0)',
    impressions: 'ifNull(toFloat64OrZero(toString(Ad_Impressions)), 0)',
    qty: 'ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)',
    quantitySold: 'Qty_Sold',
    date: 'DATE',
    platform: 'Platform',
    brand: 'Brand',
    location: 'Location',
    category: PRODUCT_CATEGORY_SQL,
    compFlag: 'Comp_flag'
};

const table = 'rb_pdp_olap';

async function testQuery() {
    console.log("Testing Performance Breakdown Queries...");
    
    // Test 1: total_spends Query
    const totalSpendsQuery = `
        SELECT SUM(${f.spend}) as total
        FROM ${table} 
        WHERE ${f.compFlag} = 0 AND ${f.date} >= '2026-03-01' AND ${f.date} <= '2026-03-11'
    `;
    console.log("Total Spends Query:", totalSpendsQuery);
    try {
        const res = await queryClickHouse(totalSpendsQuery);
        console.log("Total Spends Result:", res);
        const total_spends = parseFloat(res[0]?.total || 0);

        // Test 2: Main Breakdown Query
        const query = `
        SELECT
                ${f.category} AS tag,
            SUM(${f.impressions}) AS group_impressions,
                SUM(${f.clicks}) AS group_clicks,
                if (group_impressions > 0, (group_clicks / group_impressions) * 100, 0) AS ctr,
            SUM(${f.spend}) AS group_spends,
                if (${total_spends} > 0, (group_spends / ${total_spends}) * 100, 0) AS spend_percent_share,
                if (group_clicks > 0, group_spends / group_clicks, 0) AS cpc,
            SUM(${f.quantitySold}) AS group_orders,
                if (group_clicks > 0, (group_orders / group_clicks) * 100, 0) AS cvr,
            SUM(${f.sales}) AS group_sales
            FROM ${table}
            WHERE ${f.compFlag} = 0
            AND ${f.date} >= '2026-03-01' AND ${f.date} <= '2026-03-11'
            GROUP BY tag
            ORDER BY group_spends DESC
        `;
        console.log("Main Query:", query);
        const data = await queryClickHouse(query);
        console.log(`Success! Fetched ${data.length} rows.`);
    } catch (e) {
        console.error("QUERY FAILED:", e.message);
    }
}

testQuery();
