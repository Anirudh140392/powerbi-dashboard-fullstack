
import { createClient } from '@clickhouse/client';
import dayjs from 'dayjs';
import dotenv from 'dotenv';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://13.200.55.131:8123',
    username: process.env.CLICKHOUSE_USER || 'readonly_user',
    password: process.env.CLICKHOUSE_PASSWORD || 'Readonly@123',
    database: process.env.CLICKHOUSE_DB || 'colpal',
    request_timeout: 30000,
});

async function verifyMarketShareQuery() {
    console.log('Starting Market Share verification...');
    try {
        const endDate = dayjs().format('YYYY-MM-DD');
        const startDate = dayjs().subtract(30, 'day').format('YYYY-MM-DD');

        const query = `
            SELECT
                toDate(created_on) as DATE, brand as Brand, category as Category, sub_category as Sub_Category, Location as City,
                ROUND(SUM(sales) / nullIf(SUM(SUM(sales)) OVER(PARTITION BY DATE, category, Location), 0) * 100, 2) as Market_Share_Percentage
            FROM test_brand_MS
            WHERE toDate(created_on) BETWEEN '${startDate}' AND '${endDate}'
            GROUP BY DATE, brand, category, sub_category, Location
            ORDER BY DATE DESC
            LIMIT 5
        `;

        console.log('Sending query...');
        const result = await clickhouse.query({
            query: query,
            format: 'JSONEachRow',
        });
        const data = await result.json();
        console.log('--- SUCCESS ---');
        console.log('Returned ' + data.length + ' rows.');
        if (data.length > 0) {
            console.log(JSON.stringify(data[0], null, 2));
        } else {
            console.log('No data returned (expected if table is empty). Query syntax is valid.');
        }

    } catch (err) {
        console.error('--- FAILURE ---');
        console.error(err.message);
    }
}

verifyMarketShareQuery();
