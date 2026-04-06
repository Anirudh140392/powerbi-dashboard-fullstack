import { queryClickHouse } from './src/config/clickhouse.js';

async function test() {
    try {
        const result = await queryClickHouse("SELECT Product, Ad_SOS FROM rb_pdp_olap WHERE Product LIKE '%Snickers%' AND Ad_SOS IS NOT NULL AND Ad_SOS != '0' LIMIT 5");
        console.log("NOT ZERO:", result);
    } catch(err) {
        console.error("ERR", err);
    }
    
    try {
        const result2 = await queryClickHouse("SELECT Product, toFloat64OrZero(toString(Ad_SOS)) as ad_sos_num FROM rb_pdp_olap WHERE Product LIKE '%Snickers%' LIMIT 5");
        console.log("ALL:", result2);
    } catch(err) {
        console.error("ERR", err);
    }
    process.exit(0);
}

test();
