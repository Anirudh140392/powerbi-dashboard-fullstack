import { queryClickHouse } from '../src/config/clickhouse.js';

async function debug() {
    try {
        const tables = ['rb_pdp_olap', 'rca_sku_dim'];

        for (const table of tables) {
            console.log(`\n--- Columns in ${table} ---`);
            const columns = await queryClickHouse(`DESCRIBE TABLE ${table}`);
            columns.forEach(c => {
                if (['category', 'format', 'platform', 'location', 'brand'].includes(c.name.toLowerCase())) {
                    console.log(`FOUND: ${table}.${c.name} (${c.type})`);
                }
            });
        }

        console.log('\n--- Checking row counts with data ---');
        const catCheck = await queryClickHouse(`SELECT count() as cnt FROM rb_pdp_olap WHERE Category IS NOT NULL AND Category != ''`);
        console.log('rb_pdp_olap with Category:', catCheck[0].cnt);

        const rcaCatCheck = await queryClickHouse(`SELECT count() as cnt FROM rca_sku_dim WHERE category IS NOT NULL AND category != ''`);
        console.log('rca_sku_dim with category:', rcaCatCheck[0].cnt);

        const headOLAP = await queryClickHouse(`SELECT Category FROM rb_pdp_olap WHERE Category != '' LIMIT 5`);
        console.log('RB_PDP_OLAP Categories:', headOLAP);

    } catch (err) {
        console.error('Debug Error:', err);
    }
}

debug();
