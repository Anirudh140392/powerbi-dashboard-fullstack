import { queryClickHouse } from '../src/config/clickhouse.js';

async function checkSchema() {
    try {
        const tables = await queryClickHouse('SHOW TABLES LIKE \'%rca_pm%\'');
        console.log('Tables matching %rca_pm%:');
        console.log(tables);

        const tables2 = await queryClickHouse('SHOW TABLES LIKE \'%pm%\'');
        console.log('Tables matching %pm%:');
        console.log(tables2);

        process.exit(0);
    } catch (error) {
        console.error('Error fetching schema:', error);
        process.exit(1);
    }
}

checkSchema();
