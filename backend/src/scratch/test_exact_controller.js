import { queryClickHouse, getCurrentDbName } from '../config/clickhouse.js';
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

async function testExactFilterController(reqQuery = {}) {
    const pdpTable = await resolvePdpTable();
    const kamTable = (await checkTableExists('emami_kam_master')) ? 'emami_kam_master' : 'emami.emami_kam_master';
    const pdpCols = await getTableColumns(pdpTable).catch(() => new Map());
    const dateCol = pdpCols.has('created_on') ? 'created_on' : 'pdp_crawl_date';
    const { kam, asm, platform, sku, startDate, endDate } = reqQuery;

    const buildWhere = (excludeField) => {
        const conds = ['p.price_rp > 0', 'p.price_sp > 0'];

        const addIn = (field, col, val) => {
            if (excludeField === field || !val || val === 'All' || val.startsWith('All ') || val.trim() === '') return;
            const items = val.split(',').map(v => `'${v.trim().replace(/'/g, "''").toLowerCase()}'`).join(', ');
            conds.push(`lower(trim(${col})) IN (${items})`);
        };

        addIn('kam', 'k.kam', kam);
        addIn('asm', 'k.asm', asm);
        addIn('platform', 'p.platform_name', platform);
        addIn('sku', 'p.sku_name', sku);

        if (startDate && endDate) {
            conds.push(`toDate(p.${dateCol}) >= '${startDate}' AND toDate(p.${dateCol}) <= '${endDate}'`);
        }

        return conds.length > 0 ? 'WHERE ' + conds.join(' AND ') : '';
    };

    const minMaxQuery = `
        SELECT 
            formatDateTime(min(p.${dateCol}), '%Y-%m-%d') AS minDate, 
            formatDateTime(max(p.${dateCol}), '%Y-%m-%d') AS maxDate 
        FROM ${pdpTable} AS p 
        INNER JOIN ${kamTable} AS k 
            ON lower(trim(p.platform_name)) = lower(trim(k.platform_name)) 
            AND lower(trim(p.location_name)) = lower(trim(k.location_name))
        ${buildWhere('date')}
    `;

    const fallbackMinMaxQuery = `SELECT formatDateTime(min(${dateCol}), '%Y-%m-%d') AS minDate, formatDateTime(max(${dateCol}), '%Y-%m-%d') AS maxDate FROM ${pdpTable} WHERE ${dateCol} IS NOT NULL`;

    console.log("pdpTable:", pdpTable);
    console.log("kamTable:", kamTable);
    console.log("dateCol:", dateCol);

    const minMaxRes = await queryClickHouse(minMaxQuery).catch(async (e) => {
        console.log("minMaxQuery error:", e.message);
        return await queryClickHouse(fallbackMinMaxQuery).catch(() => []);
    });

    console.log("minMaxRes:", minMaxRes);
    const minDate = minMaxRes?.[0]?.minDate || null;
    const maxDate = minMaxRes?.[0]?.maxDate || null;
    console.log("Returned minDate & maxDate:", { minDate, maxDate });
}

testExactFilterController();
