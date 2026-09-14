
import { createClient } from '@clickhouse/client';

const client = createClient({
    url: 'http://13.200.55.131:8123',
    username: 'readonly_user',
    password: 'Readonly@123',
    database: 'mars',
});

async function testQuery() {
    const query = `
        SELECT 
            count(*) as total,
            countIf(overall = 1) as overall_count,
            countIf(spons = 1) as spons_count,
            countIf(organic = 1) as organic_count,
            countIf(flag = '1') as rb_count
        FROM rb_kw_olap
    `;
    
    try {
        const result = await client.query({
            query,
            format: 'JSONEachRow',
        });
        const data = await result.json();
        console.log('Query result:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.close();
    }
}

testQuery();
