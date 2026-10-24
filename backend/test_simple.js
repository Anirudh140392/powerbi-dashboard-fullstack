import { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
    try {
        console.log('Testing general access to rb_brand_ms...');
        const countRes = await queryClickHouse('SELECT COUNT(*) as count FROM rb_brand_ms');
        console.log('Count:', countRes[0].count);

        console.log('Testing created_on column...');
        const colRes = await queryClickHouse('SELECT toDate(created_on) as d FROM rb_brand_ms LIMIT 5');
        console.log('Sample dates:', colRes.map(r => r.d));

        console.log('Testing brand column...');
        const brandRes = await queryClickHouse('SELECT DISTINCT brand FROM rb_brand_ms LIMIT 5');
        console.log('Sample brands:', brandRes.map(r => r.brand));

    } catch (error) {
        console.error('Test error:', error);
    }
}

test();
