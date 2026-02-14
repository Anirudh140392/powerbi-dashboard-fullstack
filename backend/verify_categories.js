
import { createClient } from '@clickhouse/client';

const clickhouse = createClient({
    url: 'http://13.200.55.131:8123',
    username: 'readonly_user',
    password: 'Readonly@123',
    database: 'colpal',
    request_timeout: 60000,
});

async function main() {
    try {
        console.log('--- Verifying Categories ---');

        console.log('\nFetching from rca_sku_dim...');
        const rcaResultSet = await clickhouse.query({
            query: `SELECT DISTINCT category FROM rca_sku_dim WHERE category IS NOT NULL ORDER BY category`,
            format: 'JSONEachRow'
        });
        const rcaData = await rcaResultSet.json();
        const rcaCats = rcaData.map(r => r.category);
        console.log('RCA Categories:', JSON.stringify(rcaCats, null, 2));

        console.log('\nFetching from rb_pdp_olap...');
        const olapResultSet = await clickhouse.query({
            query: `SELECT DISTINCT Category FROM rb_pdp_olap WHERE Category IS NOT NULL ORDER BY Category`,
            format: 'JSONEachRow'
        });
        const olapData = await olapResultSet.json();
        const olapCats = olapData.map(r => r.Category);
        console.log('OLAP Categories:', JSON.stringify(olapCats, null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await clickhouse.close();
    }
}

main();
