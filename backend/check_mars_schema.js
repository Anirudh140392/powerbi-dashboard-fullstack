import { queryClickHouse } from './src/config/clickhouse.js';

async function checkSchema() {
    try {
        const columns = await queryClickHouse('DESCRIBE rca_pm_olap');
        console.log('Columns in rca_pm_olap:');
        columns.forEach(col => {
            console.log(`${col.name} (${col.type})`);
        });

        // Let's also get a sample row
        const sample = await queryClickHouse('SELECT * FROM rca_pm_olap LIMIT 1');
        console.log('\nSample row:', JSON.stringify(sample, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('Error fetching schema:', error);
        process.exit(1);
    }
}

checkSchema();
