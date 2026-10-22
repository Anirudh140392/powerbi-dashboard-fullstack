import { queryClickHouse, getCurrentDbName } from '../config/clickhouse.js';

const checkTableExists = async (tableName) => {
    try {
        const result = await queryClickHouse(`EXISTS TABLE ${tableName}`);
        const exists = result?.[0]?.result === 1 || result?.[0]?.result === '1' || result?.[0]?.['result'] === 1;
        return exists;
    } catch {
        return false;
    }
};

async function getPdpTable() {
    const currentDb = getCurrentDbName() || 'emami';

    // 1. Try table in current database context
    if (await checkTableExists(`${currentDb}.rb_pdp`)) return `${currentDb}.rb_pdp`;
    if (await checkTableExists('rb_pdp')) return 'rb_pdp';
    
    // 2. Try explicit database qualifiers for main raw data tables
    if (await checkTableExists('emami.rb_pdp')) return 'emami.rb_pdp';

    // 3. Try rb_pdp_olap
    if (await checkTableExists(`${currentDb}.rb_pdp_olap`)) return `${currentDb}.rb_pdp_olap`;
    if (await checkTableExists('rb_pdp_olap')) return 'rb_pdp_olap';

    // 4. Last fallback only if full table not present
    if (await checkTableExists('rb_pdp_week')) return 'rb_pdp_week';

    return 'rb_pdp';
}

async function testResolution() {
    try {
        console.log("Current DB:", getCurrentDbName());
        const resolved = await getPdpTable();
        console.log("Resolved PDP table:", resolved);

        const minMax = await queryClickHouse(`SELECT min(created_on) as minC, max(created_on) as maxC FROM ${resolved}`);
        console.log(`Min/Max dates for '${resolved}':`, minMax);
    } catch (err) {
        console.error(err);
    }
}

testResolution();
