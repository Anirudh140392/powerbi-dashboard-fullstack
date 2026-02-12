import { queryClickHouse } from './backend/src/config/clickhouse.js';
import dayjs from 'dayjs';

async function testQuery() {
    const startDate = dayjs('2024-11-01');
    const endDate = dayjs('2024-11-30');

    const query = `
        SELECT 
            brand_name, 
            count() as brand_count
        FROM rb_kw
        WHERE toDate(created_on) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'
          AND keyword_search_rank < 11
        GROUP BY brand_name
        LIMIT 5
    `;

    try {
        console.log('Running test query...');
        const results = await queryClickHouse(query);
        console.log('Results:', JSON.stringify(results, null, 2));
    } catch (error) {
        console.error('Query Failed!');
        console.error('Error Message:', error.message);
        if (error.stack) console.error('Stack Trace:', error.stack);
    }
}

testQuery();
