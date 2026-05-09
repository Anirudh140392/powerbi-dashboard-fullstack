import { queryClickHouse } from '../backend/src/config/clickhouse.js';

async function checkColumns() {
    try {
        const res = await queryClickHouse("DESCRIBE TABLE rb_kw_olap");
        console.log(res.map(r => r.name));
    } catch (e) {
        console.error(e);
    }
}

checkColumns();
