import { queryClickHouse, dbStorage, connectClickHouse } from './src/config/clickhouse.js';
import fs from 'fs';

async function checkSchema() {
    await connectClickHouse();
    await dbStorage.run({ dbName: 'mars' }, async () => {
        try {
            const res = await queryClickHouse('DESCRIBE rb_kw');
            fs.writeFileSync('mars_kw_schema.json', JSON.stringify(res, null, 2));
            console.log("Mars rb_kw schema written to mars_kw_schema.json");
            process.exit(0);
        } catch (err) {
            console.error(err);
            process.exit(1);
        }
    });
}
checkSchema();
