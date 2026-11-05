import 'dotenv/config';
import { createClient } from '@clickhouse/client';
import dayjs from 'dayjs';

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'default',
    request_timeout: 60000,
});

async function run() {
    try {
        const start = dayjs('2026-02-01');
        const end = dayjs('2026-03-30');
        const daysCount = end.diff(start, 'day') + 1;

        console.log(`Testing Case 1 (No location filter, All platforms) - Days: ${daysCount}`);
        const q1 = `
            SELECT SUM(brand_daily_avg) / ${daysCount} as avg_market_share
            FROM (
                SELECT dt, brand, AVG(ms_val) as brand_daily_avg
                FROM (
                    SELECT toDate(created_on) as dt, platform, category, brand, MAX(nation_level_market_share) as ms_val
                    FROM rb_brand_ms
                    WHERE toDate(created_on) BETWEEN '2026-02-01' AND '2026-03-30'
                    AND brand IN ('Snickers', 'Galaxy', 'Bounty', 'Twix', 'Mars', 'M&M''s', 'Orbit', 'Skittles', 'Boomer', 'Doublemint')
                    GROUP BY dt, platform, category, brand
                )
                GROUP BY dt, brand
            )
        `;
        let res = await clickhouse.query({ query: q1, format: 'JSONEachRow' });
        let data = await res.json();
        console.log('Result All (User Logic):', data);

        console.log('Testing Case 1 (Platform filtered to Blinkit):');
        const q2 = `
            SELECT SUM(brand_daily_avg) / ${daysCount} as avg_market_share
            FROM (
                SELECT dt, brand, AVG(ms_val) as brand_daily_avg
                FROM (
                    SELECT toDate(created_on) as dt, platform, category, brand, MAX(nation_level_market_share) as ms_val
                    FROM rb_brand_ms
                    WHERE toDate(created_on) BETWEEN '2026-02-01' AND '2026-03-30'
                    AND platform LIKE '%Blinkit%'
                    AND brand IN ('Snickers', 'Galaxy', 'Bounty', 'Twix', 'Mars', 'M&M''s', 'Orbit', 'Skittles', 'Boomer', 'Doublemint')
                    GROUP BY dt, platform, category, brand
                )
                GROUP BY dt, brand
            )
        `;
        res = await clickhouse.query({ query: q2, format: 'JSONEachRow' });
        data = await res.json();
        console.log('Result Blinkit (User Logic):', data);

    } catch (err) {
        console.error('Error:', err);
    }
}

run();
