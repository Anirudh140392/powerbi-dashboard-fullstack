import { config } from 'dotenv';
config({ path: '/home/asus/Music/powerbi-dashboard-fullstack/backend/.env' });
import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const q = `
            SELECT
                DATE(created_on) AS created_on,
                location,
                SUM(market_share) AS mars_city_ms
            FROM \`Ocean_test_tb_blinkit_Mars_sku_breakdown_1\`
            WHERE platform LIKE '%Blinkit%'
            AND brand IN (
                'Snickers', 'Galaxy', 'Bounty', 'Twix', 'Mars', "M&M's",
                'Orbit', 'Skittles', 'Boomer', "Wrigley's Doublemint"
            )
            AND location IN (
                'Delhi', 'Ahmedabad', 'Bengaluru', 'Chandigarh', 'Chennai',
                'Faridabad', 'Gurugram', 'Hyderabad', 'Kolkata', 'Lucknow',
                'Mumbai', 'Pune'
            )
            GROUP BY DATE(created_on), location
            ORDER BY DATE(created_on), location
            LIMIT 10
        `;
        console.log("Running query...");
        const res = await queryClickHouse(q);
        console.log("Query Result:", JSON.stringify(res, null, 2));
    } catch (e) {
        console.error("Query failed:", e);
    }
    process.exit(0);
}
run();
