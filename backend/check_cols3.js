import { queryClickHouse } from './src/config/clickhouse.js';
async function test() {
    try {
        let res = await queryClickHouse("SELECT name FROM system.columns WHERE table = 'rb_pdp_olap' AND database = 'mars'");
        console.log("rb_pdp_olap: ", res.map(r => r.name).filter(n => n.toLowerCase().includes('url') || n.toLowerCase().includes('image') || n.toLowerCase().includes('img') || n.toLowerCase().includes('pic') || n.toLowerCase().includes('photo')));
        res = await queryClickHouse("SELECT name FROM system.columns WHERE table = 'rca_sku_dim' AND database = 'mars'");
        console.log("rca_sku_dim: ", res.map(r => r.name).filter(n => n.toLowerCase().includes('url') || n.toLowerCase().includes('image') || n.toLowerCase().includes('img') || n.toLowerCase().includes('pic') || n.toLowerCase().includes('photo')));
        res = await queryClickHouse("SELECT name FROM system.columns WHERE table = 'rb_sku_platform' AND database = 'mars'");
        console.log("rb_sku_platform: ", res.map(r => r.name).filter(n => n.toLowerCase().includes('url') || n.toLowerCase().includes('image') || n.toLowerCase().includes('img') || n.toLowerCase().includes('pic') || n.toLowerCase().includes('photo')));
    } catch(e) { console.error(e.message); }
}
test();
