import { config } from 'dotenv';
config({ path: '/home/asus/Music/powerbi-dashboard-fullstack/backend/.env' });
import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const brands = [
            'Snickers', 'Galaxy', 'Bounty', 'Twix', 'Mars', "M&M's",
            'Orbit', 'Skittles', 'Boomer', "Wrigley's Doublemint"
        ];
        const brandsStr = brands.map(b => `'${b.replace(/'/g, "''")}'`).join(', ');

        const q = `
            SELECT
                Location,
                brand,
                Platform,
                market_share,
                toDate(created_on) as date
            FROM rb_brand_ms
            WHERE Platform LIKE '%Blinkit%'
            AND brand IN (${brandsStr})
            AND Location = 'Mumbai'
            LIMIT 20
        `;
        console.log("Running Query:", q);
        const res = await queryClickHouse(q);
        console.log("Query Results:", JSON.stringify(res, null, 2));

        if (res.length > 0) {
            const sumQuery = `
                SELECT
                    SUM(market_share) as total_ms
                FROM rb_brand_ms
                WHERE Platform LIKE '%Blinkit%'
                AND brand IN (${brandsStr})
                AND Location = 'Mumbai'
            `;
            const sumRes = await queryClickHouse(sumQuery);
            console.log("Sum Results for Mumbai:", sumRes[0]);
        }
    } catch (e) {
        console.error("Diagnostic failed:", e);
    }
    process.exit(0);
}
run();
