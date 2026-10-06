import { queryClickHouse } from './src/config/clickhouse.js';

async function describe() {
    try {
        const schema = await queryClickHouse('DESCRIBE rb_kw_olap');
        console.log(JSON.stringify(schema, null, 2));
    } catch (err) {
        console.error(err);
    }
}

describe();
