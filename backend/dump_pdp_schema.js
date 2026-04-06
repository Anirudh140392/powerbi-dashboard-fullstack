import { getTableColumns } from './src/utils/schemaHelper.js';
import { queryClickHouse } from './src/config/clickhouse.js';

async function dumpSchema() {
    try {
        const table = 'rb_pdp_olap';
        const cols = await getTableColumns(table);
        console.log(`Columns in ${table}:`, JSON.stringify(cols, null, 2));

        // Let's also check for specific identifiers like Weight or Selling_Price
        const sampleQuery = `SELECT * FROM ${table} LIMIT 1`;
        const sampleRows = await queryClickHouse(sampleQuery);
        if (sampleRows.length > 0) {
            console.log("Sample Row Keys:", Object.keys(sampleRows[0]));
        }
    } catch (err) {
        console.error(err);
    }
}

dumpSchema();
