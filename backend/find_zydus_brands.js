import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const patterns = ['sugar', 'glucon', 'everyuth', 'complan', 'nycil', 'nical'];
        for (const p of patterns) {
            const result = await queryClickHouse(`SELECT DISTINCT group_brand FROM zydus.rb_ms_olap WHERE lower(group_brand) LIKE '%${p}%'`);
            console.log(`Pattern ${p}:`, result);
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
