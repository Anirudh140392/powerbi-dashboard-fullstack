import { queryClickHouse } from './src/config/clickhouse.js';

async function checkFullStructure() {
    try {
        const structure = await queryClickHouse(`DESCRIBE rb_kw`);
        console.log('Full Table structure:');
        structure.forEach(r => console.log(`${r.name}: ${r.type}`));

        const maxDates = await queryClickHouse(`
            SELECT 
                MAX(kw_crawl_date) as max_crawl,
                MAX(created_on) as max_created
            FROM rb_kw
        `);
        console.log('Max Dates:');
        console.log(JSON.stringify(maxDates[0]));
    } catch (error) {
        console.error('Error checking structure:', error);
    }
}

checkFullStructure();
