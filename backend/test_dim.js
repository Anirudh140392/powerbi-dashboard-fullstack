import { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
    try {
        const q1 = await queryClickHouse(`SELECT DISTINCT Web_Pid, Product FROM rb_pdp_olap WHERE Brand='Colgate' LIMIT 5`);
        console.log("rb_pdp_olap:", q1);

        const q2 = await queryClickHouse(`SELECT DISTINCT web_pid, keyword_search_product FROM rb_kw_olap WHERE brand_name='Colgate' AND keyword_is_rb_product='1' LIMIT 5`);
        console.log("rb_kw_olap:", q2);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

test();
