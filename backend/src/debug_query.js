import { createClient } from '@clickhouse/client';
import 'dotenv/config';

const client = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'mars',
});

const PRODUCT_CATEGORY_SQL = `if(Product_Category IS NOT NULL AND Product_Category != '' AND Product_Category != '0', 
    Product_Category, 
    multiIf(LOWER(Brand) IN ('orbit', 'doublemint', 'boomer', 'skittles'), 'GMFC', 
            LOWER(Brand) IN ('snickers', 'galaxy', 'bounty', 'twix', 'mars', 'm&m'), 
                if(LOWER(toString(Product)) LIKE '%gift%' OR LOWER(toString(Product)) LIKE '%tin pack%', 
                   'Chocolates (Gifting)', 
                   'Chocolates (Non Gifting)'), 
            'Others')
)`;

const src = {
    table: 'rb_pdp_olap',
    f: {
        sales: 'ifNull(toFloat64OrZero(toString(Sales)), 0)',
        spend: 'ifNull(toFloat64OrZero(toString(Ad_Spend)), 0)',
        adSales: 'ifNull(toFloat64OrZero(toString(Ad_sales)), 0)',
        clicks: 'ifNull(toFloat64OrZero(toString(Ad_Clicks)), 0)',
        impressions: 'ifNull(toFloat64OrZero(toString(Ad_Impressions)), 0)',
        neno: 'ifNull(toFloat64OrZero(toString(neno_osa)), 0)',
        deno: 'ifNull(toFloat64OrZero(toString(deno_osa)), 0)',
        qty: 'ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)',
        orders: 'ifNull(toFloat64OrZero(toString(Ad_Quanity_sold)), 0)',
        mrpVal: 'ifNull(toFloat64OrZero(toString(MRP)), 0)',
        actualSales: 'ifNull(toFloat64OrZero(toString(Sales)), 0)',
        date: 'DATE',
        platform: 'Platform',
        brand: 'Brand',
        location: 'Location',
        category: PRODUCT_CATEGORY_SQL,
        compFlag: 'Comp_flag',
        quantitySold: 'Qty_Sold',
    }
};

async function testQuery() {
    try {
        const platformClause = "AND Platform = 'Blinkit'";
        const dateClause = "AND DATE >= '2026-02-10' AND DATE <= '2026-03-12'"; // Mocked dates
        const groupByCol = PRODUCT_CATEGORY_SQL;

        console.log('--- Testing totalSpendsQuery ---');
        const totalSpendsQuery = `
            SELECT SUM(${src.f.spend}) as total
            FROM ${src.table} 
            WHERE ${src.f.compFlag} = 0 ${platformClause} ${dateClause}
        `;
        console.log(totalSpendsQuery);
        const result1 = await client.query({ query: totalSpendsQuery, format: 'JSONEachRow' });
        const data1 = await result1.json();
        console.log('Result:', data1);
        const total_spends = parseFloat(data1[0]?.total || 0);

        console.log('\n--- Testing Main Query ---');
        const query = `
        SELECT
                ${groupByCol} AS tag,
            SUM(${src.f.impressions}) AS group_impressions,
                SUM(${src.f.clicks}) AS group_clicks,
                if (group_impressions > 0, (group_clicks / group_impressions) * 100, 0) AS ctr,
            SUM(${src.f.spend}) AS group_spends,
                if (${total_spends} > 0, (group_spends / ${total_spends}) * 100, 0) AS spend_percent_share,
                if (group_clicks > 0, group_spends / group_clicks, 0) AS cpc,
            SUM(${src.f.quantitySold}) AS group_orders,
                if (group_clicks > 0, (group_orders / group_clicks) * 100, 0) AS cvr,
            SUM(${src.f.sales}) AS group_sales
            FROM ${src.table}
            WHERE ${src.f.compFlag} = 0
            ${platformClause}
            ${dateClause}
            GROUP BY ${groupByCol}
            ORDER BY group_spends DESC
            LIMIT 5
        `;
        console.log(query);
        const result2 = await client.query({ query: query, format: 'JSONEachRow' });
        const data2 = await result2.json();
        console.log('Result count:', data2.length);
        if (data2.length > 0) console.log('First row:', data2[0]);

    } catch (err) {
        console.error('Error:', err.message);
        console.error('Stack:', err.stack);
    } finally {
        await client.close();
    }
}

testQuery();
