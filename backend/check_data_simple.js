import { queryClickHouse } from './src/config/clickhouse.js';

async function checkDataSimple() {
    try {
        const count = await queryClickHouse(`SELECT count() as c FROM rb_kw`);
        console.log('Total rows in rb_kw:', count[0].c);

        const head = await queryClickHouse(`SELECT created_on, keyword, brand_crawl FROM rb_kw LIMIT 5`);
        console.log('Sample data:');
        head.forEach(r => console.log(JSON.stringify(r)));

        const structure = await queryClickHouse(`DESCRIBE rb_kw`);
        console.log('Table structure:');
        structure.slice(0, 10).forEach(r => console.log(`${r.name}: ${r.type}`));
    } catch (error) {
        console.error('Error checking data:', error);
    }
}

checkDataSimple();
