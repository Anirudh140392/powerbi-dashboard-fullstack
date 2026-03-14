import { queryClickHouse } from './src/config/clickhouse.js';

async function findCols() {
    try {
        const query = `
            SELECT name 
            FROM system.columns 
            WHERE table = 'rb_pdp_olap' 
              AND (name ILIKE '%sold%' OR name ILIKE '%order%' OR name ILIKE '%quant%' OR name ILIKE '%list%')
        `;
        const res = await queryClickHouse(query);
        console.log('Matching columns:', res.map(r => r.name).join(', '));
    } catch (e) {
        console.error('Error:', e.message);
    }
}
findCols();
