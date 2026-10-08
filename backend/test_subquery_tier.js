import { queryClickHouse } from './src/config/clickhouse.js';

async function testSubquery() {
    try {
        const query = `
            SELECT DISTINCT Location 
            FROM rb_pdp_olap 
            WHERE Location IN (SELECT location FROM rb_location_darkstore WHERE tier = 'Tier 1')
            LIMIT 5
        `;
        const res = await queryClickHouse(query);
        console.log('Tier 1 cities from subquery:', res);
    } catch (e) {
        console.error('Error with subquery:', e.message);
    }
}
testSubquery();
