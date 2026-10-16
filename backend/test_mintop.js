import { ClickHouse } from 'clickhouse';
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/2004yashgautamgmail.com/Documents/trailytics/trailytics_ds/powerbi-dashboard-fullstack/backend/.env' });

const clickhouse = new ClickHouse({
    url: process.env.CLICKHOUSE_URL,
    port: process.env.CLICKHOUSE_PORT,
    basicAuth: {
        username: process.env.CLICKHOUSE_USER,
        password: process.env.CLICKHOUSE_PASSWORD,
    },
});

async function run() {
    try {
        const res = await clickhouse.query("SELECT count(DISTINCT product_external_id) as count FROM prestige.products WHERE ilike(brand_name, 'mintop')").toPromise();
        console.log("Mintop SKUs:", res);
        
        const resAll = await clickhouse.query("SELECT count(DISTINCT product_external_id) as count FROM prestige.products").toPromise();
        console.log("All SKUs:", resAll);
    } catch(e) {
        console.error(e);
    }
}
run();
