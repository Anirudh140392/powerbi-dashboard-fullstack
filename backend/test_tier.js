import { queryClickHouse } from './src/config/clickhouse.js';

async function checkTier() {
    try {
        const query = `SELECT DISTINCT Tier FROM rb_pdp_olap LIMIT 10`;
        const res = await queryClickHouse(query);
        console.log('Tier values:', res);
    } catch (e) {
        console.error('Error with Tier column:', e.message);
    }
    
    try {
        const query2 = `SELECT name, type FROM system.columns WHERE table = 'rb_pdp_olap' AND name ILIKE '%tier%' OR name ILIKE '%city%'`;
        const res2 = await queryClickHouse(query2);
        console.log('Columns matching tier/city:', res2);
    } catch (e) {
        console.error('Error getting columns:', e.message);
    }
}
checkTier();
