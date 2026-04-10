import './src/config/clickhouse.js';
import { queryClickHouse } from './src/config/clickhouse.js';

async function fetch() {
    try {
        const res = await queryClickHouse("SHOW TABLES FROM mars");
        console.log(res);
    } catch (e) {
        console.error(e);
    }
}
fetch()
