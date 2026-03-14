import { queryClickHouse } from './src/config/clickhouse.js';

async function checkCols() {
    try {
        const query2 = `SELECT name, type FROM system.columns WHERE table = 'rb_pdp_olap'`;
        const res2 = await queryClickHouse(query2);
        console.log('Columns:', res2.map(r => r.name).join(', '));
    } catch (e) {
        console.error('Error getting columns:', e.message);
    }
}
checkCols();
