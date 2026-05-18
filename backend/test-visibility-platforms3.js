import { queryClickHouse } from './src/utils/clickhouseUtils.js';

async function test() {
    const res = await queryClickHouse(`SELECT DISTINCT platform_name as platform FROM rb_kw_olap WHERE platform_name IS NOT NULL AND platform_name != ''`);
    console.log(res);
}

test().catch(console.error);
