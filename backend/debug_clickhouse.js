import 'dotenv/config';
import { queryClickHouse } from './src/config/clickhouse.js';

async function debug() {
    try {
        console.log('--- Platform Distribution ---');
        const platforms = await queryClickHouse('SELECT Platform, COUNT(*) FROM rb_pdp_olap GROUP BY Platform');
        console.table(platforms);

        console.log('\n--- Date Range ---');
        const dates = await queryClickHouse('SELECT MIN(DATE), MAX(DATE) FROM rb_pdp_olap');
        console.table(dates);

        console.log('\n--- Brand Presence in Agra (Nov 2025) ---');
        const agra = await queryClickHouse("SELECT Brand, COUNT(*) FROM rb_pdp_olap WHERE Location = 'Agra' AND DATE BETWEEN '2025-11-01' AND '2025-11-30' GROUP BY Brand LIMIT 10");
        console.table(agra);

    } catch (e) {
        console.error(e);
    }
}

debug();
