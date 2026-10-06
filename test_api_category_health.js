import { getCategoryHealth } from './trailytics_ratings/backend/src/controllers/overview/overview.controller.js';
import clickhouse from './trailytics_ratings/backend/src/config/clickhouse.js';

async function test() {
    const req = {
        query: {
            sentiment_category: 'Brand',
            date_from: '2026-01-21',
            date_to: '2026-07-21'
        },
        headers: {},
        companyId: '297e37ea-a5ac-47df-bebd-ac44e52b7979' // Prestige
    };
    
    const res = {
        json: (data) => console.log(JSON.stringify(data).substring(0, 500) + '...'),
        status: (code) => ({
            json: (err) => console.error(`Error ${code}:`, err)
        })
    };
    
    await getCategoryHealth(req, res);
    process.exit(0);
}
test();
