import { queryClickHouse } from './src/config/clickhouse.js';

async function fetchBrands() {
    try {
        const schemaPdp = await queryClickHouse(`DESCRIBE rb_pdp_olap`);
        console.log('rb_pdp_olap columns:', schemaPdp.map(c => c.name));

        const sample = await queryClickHouse(`SELECT Offtakes, Offtakes_Units, DATE, Brand, Platform, Category FROM rb_pdp_olap LIMIT 5`);
        console.log('rb_pdp_olap sample:', sample);

    } catch (err) {
        console.error('Error fetching data:', err);
    }
}

fetchBrands();
