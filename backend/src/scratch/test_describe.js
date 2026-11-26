import { queryClickHouse } from '../config/clickhouse.js';

async function testDescribe() {
    try {
        const pdpCols = await queryClickHouse(`DESCRIBE TABLE emami.rb_pdp`);
        console.log("emami.rb_pdp columns:", pdpCols.map(c => c.name));
    } catch (err) {
        console.error(err);
    }
}

testDescribe();
