import { queryClickHouse, dbStorage, getCurrentDbName } from '../config/clickhouse.js';
import { getTableColumns } from '../utils/schemaHelper.js';

const checkTableExists = async (tableName) => {
    try {
        const result = await queryClickHouse(`EXISTS TABLE ${tableName}`);
        const exists = result && result[0] && result[0].result === 1;
        return exists;
    } catch {
        return false;
    }
};

async function testBoatContext() {
    await dbStorage.run('boat', async () => {
        console.log("Current DB in storage:", getCurrentDbName());

        const hasBoatPdp = await checkTableExists('boat.rb_pdp');
        const hasPdp = await checkTableExists('rb_pdp');
        const hasEmamiPdp = await checkTableExists('emami.rb_pdp');
        const hasPdpWeek = await checkTableExists('rb_pdp_week');

        console.log("checkTableExists('boat.rb_pdp'):", hasBoatPdp);
        console.log("checkTableExists('rb_pdp'):", hasPdp);
        console.log("checkTableExists('emami.rb_pdp'):", hasEmamiPdp);
        console.log("checkTableExists('rb_pdp_week'):", hasPdpWeek);

        const pdpTable = hasBoatPdp ? 'boat.rb_pdp'
            : hasPdp ? 'rb_pdp'
            : hasEmamiPdp ? 'emami.rb_pdp'
            : hasPdpWeek ? 'rb_pdp_week'
            : 'rb_pdp';

        console.log("Resolved pdpTable for boat:", pdpTable);

        const res = await queryClickHouse(`SELECT min(created_on) as minC, max(created_on) as maxC FROM ${pdpTable}`);
        console.log(`Min/Max for ${pdpTable}:`, res);
    });
}

testBoatContext();
