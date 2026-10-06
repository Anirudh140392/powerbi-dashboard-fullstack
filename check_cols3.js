import { queryClickHouse } from './src/config/clickhouse.js';
async function test() {
    try {
        let res = await queryClickHouse("SELECT name FROM system.columns WHERE table = 'rb_pdp_olap' AND database = 'mars'");
        console.log("rb_pdp_olap: ", res.map(r => r.name).filter(n => n.includes('url') || n.includes('image') || n.includes('img')));
        res = await queryClickHouse("SELECT name FROM system.columns WHERE table = 'rca_sku_dim' AND database = 'mars'");
        console.log("rca_sku_dim: ", res.map(r => r.name).filter(n => n.includes('url') || n.includes('image') || n.includes('img')));
    } catch(e) { console.error(e.message); }
}
test();
