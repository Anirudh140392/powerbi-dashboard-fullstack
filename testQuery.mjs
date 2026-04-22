import clickhousePkg from './backend/src/config/clickhouse.js';
const { clickhouse } = clickhousePkg;

async function test() {
    try {
        const result = await clickhouse.query({ query: "DESCRIBE TABLE mars.rb_pdp_olap", format: 'JSONEachRow' });
        const json = await result.json();
        console.log(json.map(r => r.name).join(', '));
    } catch (e) {
        console.error("SQL Error:", e.message);
    }
}
test();
