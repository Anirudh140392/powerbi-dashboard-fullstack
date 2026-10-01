import { queryClickHouse, getCurrentDbName } from '../config/clickhouse.js';
import { getTableColumns } from '../utils/schemaHelper.js';

const checkTableExists = async (tableName) => {
    try {
        const result = await queryClickHouse(`EXISTS TABLE ${tableName}`);
        const exists = result?.[0]?.result === 1 || result?.[0]?.result === '1' || result?.[0]?.['result'] === 1;
        return exists;
    } catch {
        return false;
    }
};

async function resolvePdpTable() {
    const currentDb = getCurrentDbName() || 'emami';

    if (await checkTableExists(`${currentDb}.rb_pdp`)) return `${currentDb}.rb_pdp`;
    if (await checkTableExists('rb_pdp')) return 'rb_pdp';
    if (await checkTableExists('emami.rb_pdp')) return 'emami.rb_pdp';

    if (await checkTableExists(`${currentDb}.rb_pdp_olap`)) return `${currentDb}.rb_pdp_olap`;
    if (await checkTableExists('rb_pdp_olap')) return 'rb_pdp_olap';

    if (await checkTableExists(`${currentDb}.rb_pdp_week`)) return `${currentDb}.rb_pdp_week`;
    if (await checkTableExists('rb_pdp_week')) return 'rb_pdp_week';

    return 'rb_pdp';
}

async function testAllFunctions() {
    try {
        const pdpTable = await resolvePdpTable();
        console.log("Resolved pdpTable:", pdpTable);

        const pdpCols = await getTableColumns(pdpTable).catch(() => new Map());
        const dateCol = pdpCols.has('created_on') ? 'created_on' : 'pdp_crawl_date';
        console.log("Resolved dateCol:", dateCol);

        const minMaxQuery = `SELECT formatDateTime(min(${dateCol}), '%Y-%m-%d') AS minDate, formatDateTime(max(${dateCol}), '%Y-%m-%d') AS maxDate FROM ${pdpTable} WHERE ${dateCol} IS NOT NULL`;
        const res = await queryClickHouse(minMaxQuery);
        console.log("MinMax result:", res);

        const datesQuery = `SELECT DISTINCT toDate(${dateCol}) as DateStr FROM ${pdpTable} WHERE ${dateCol} IS NOT NULL ORDER BY DateStr DESC LIMIT 10`;
        const datesRes = await queryClickHouse(datesQuery);
        console.log("Top 10 dates:", datesRes.map(d => String(d.DateStr)));

    } catch (err) {
        console.error(err);
    }
}

testAllFunctions();
