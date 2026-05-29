import { getTableColumns } from './src/utils/clickhouse.js';

async function main() {
    try {
        const pdp = await getTableColumns('boat.rb_pdp_olap');
        const pm = await getTableColumns('boat.rb_pm_olap');
        const agg = await getTableColumns('boat.rca_sku_dim');

        console.log("PDP cols:", pdp.map(c => c.name).filter(n => n.toLowerCase().includes('channel')));
        console.log("PM cols:", pm.map(c => c.name).filter(n => n.toLowerCase().includes('channel')));
        console.log("AGG cols:", agg.map(c => c.name).filter(n => n.toLowerCase().includes('channel')));
    } catch (e) {
        console.log(e);
    }
}
main();