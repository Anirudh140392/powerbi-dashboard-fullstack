import { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
    const res = await queryClickHouse(`DESCRIBE TABLE rb_pm_olap`);
    console.log(res.filter(r => r.name.toLowerCase().includes('chan') || r.name.toLowerCase().includes('plat')));
    
    const countChannel = await queryClickHouse(`SELECT DISTINCT Platform as ch FROM rb_pm_olap LIMIT 10`);
    console.log("distinct platforms:", countChannel);
}
test().catch(console.error).finally(() => process.exit(0));
