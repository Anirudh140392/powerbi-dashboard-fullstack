import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    const query = `
        SELECT 
            city, 
            brand_name, 
            sum(clicks) as raw_clicks, 
            sum(impressions) as raw_impressions,
            sum(qty_sold) as raw_qty_sold
        FROM rbpdp.rb_pdp_olap 
        WHERE web_pid = '5a632153-3cb1-4996-9d19-5b6f3f8b115e' AND city = 'Guntur' 
        GROUP BY city, brand_name
    `;
    
    try {
        const res = await queryClickHouse(query);
        console.log("Raw Data:", JSON.stringify(res, null, 2));
    } catch (err) {
        console.error("Error:", err);
    }
}

run();
