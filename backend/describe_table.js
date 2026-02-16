
import dotenv from 'dotenv';
dotenv.config();
import { queryClickHouse } from './src/config/clickhouse.js';

async function describeTable() {
    try {
        const result = await queryClickHouse('DESCRIBE rb_pdp_olap');
        console.log('Columns in rb_pdp_olap:');
        result.forEach(row => {
            if (row.name.toLowerCase().includes('listing')) {
                console.log(row.name);
            }
        });
        console.log('--- End of listing columns ---');

    } catch (error) {
        console.error('Error:', error);
    }
}

describeTable();
