import { queryClickHouse, dbStorage, connectClickHouse } from './src/config/clickhouse.js';
import fs from 'fs';

async function checkSchema() {
    await connectClickHouse();
    await dbStorage.run({ dbName: 'mars' }, async () => {
        try {
            const res = await queryClickHouse('DESCRIBE rb_pdp_olap');
            fs.writeFileSync('schema_results.json', JSON.stringify(res, null, 2));
            console.log("Schema written to schema_results.json");
            process.exit(0);
        } catch (err) {
            fs.writeFileSync('schema_error.txt', err.stack);
            console.error(err);
            process.exit(1);
        }
    });
}
checkSchema();
