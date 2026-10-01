import { queryClickHouse, dbStorage } from '../config/clickhouse.js';

const checkTableExists = async (tableName) => {
    try {
        const result = await queryClickHouse(`EXISTS TABLE ${tableName}`);
        const exists = result?.[0]?.result === 1 || result?.[0]?.result === '1' || result?.[0]?.['result'] === 1;
        return exists;
    } catch {
        return false;
    }
};

async function testTableResolution() {
    const dbsToTest = ['boat', 'emami', 'drl', 'pidilite', 'godrej'];

    for (const db of dbsToTest) {
        await dbStorage.run(db, async () => {
            console.log(`\n--- Testing active DB: ${db} ---`);

            const hasRbPdp = await checkTableExists('rb_pdp');
            const hasEmamiRbPdp = await checkTableExists('emami.rb_pdp');
            const hasRbPdpWeek = await checkTableExists('rb_pdp_week');

            console.log(`checkTableExists('rb_pdp'): ${hasRbPdp}`);
            console.log(`checkTableExists('emami.rb_pdp'): ${hasEmamiRbPdp}`);
            console.log(`checkTableExists('rb_pdp_week'): ${hasRbPdpWeek}`);

            const resolvedPdpTable = hasRbPdp ? 'rb_pdp'
                : hasEmamiRbPdp ? 'emami.rb_pdp'
                : hasRbPdpWeek ? 'rb_pdp_week'
                : 'rb_pdp';

            console.log(`Resolved pdpTable for ${db}: '${resolvedPdpTable}'`);

            try {
                const dates = await queryClickHouse(`SELECT min(created_on) as minC, max(created_on) as maxC FROM ${resolvedPdpTable}`);
                console.log(`Min/Max dates for resolved '${resolvedPdpTable}':`, dates);
            } catch (err) {
                console.log(`Error getting dates for ${resolvedPdpTable}:`, err.message);
            }
        });
    }
}

testTableResolution();
