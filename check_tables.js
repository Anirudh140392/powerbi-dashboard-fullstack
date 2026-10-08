import { queryClickHouse, getCurrentDbName } from './backend/src/config/clickhouse.js';

async function check() {
    try {
        const dbName = getCurrentDbName();
        console.log('Current DB:', dbName);

        const tables = await queryClickHouse('SHOW TABLES');
        console.log('Tables:', tables);

        for (const tableRow of tables) {
            const tableName = tableRow.name;
            console.log(`\nColumns for ${tableName}:`);
            const columns = await queryClickHouse(`DESCRIBE TABLE ${tableName}`);
            console.log(columns.map(c => `${c.name} (${c.type})`).join(', '));
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

check();
