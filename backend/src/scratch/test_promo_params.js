import { queryClickHouse } from '../config/clickhouse.js';
import { getTableColumns } from '../utils/schemaHelper.js';

async function testPromoFilterParams() {
    try {
        const pdpTable = 'emami.rb_pdp';
        const kamTable = 'emami.emami_kam_master';
        const pdpCols = await getTableColumns(pdpTable).catch(() => new Map());
        const dateCol = pdpCols.has('created_on') ? 'created_on' : 'pdp_crawl_date';

        console.log("dateCol resolved to:", dateCol);

        // Test with platform filter
        const platform = 'dmart,metro,reliance retail,walmart';
        const items = platform.split(',').map(v => `'${v.trim().replace(/'/g, "''").toLowerCase()}'`).join(', ');

        const minMaxUnfiltered = `SELECT formatDateTime(min(${dateCol}), '%Y-%m-%d') AS minDate, formatDateTime(max(${dateCol}), '%Y-%m-%d') AS maxDate FROM ${pdpTable} WHERE ${dateCol} IS NOT NULL`;
        console.log("Unfiltered minMax:", await queryClickHouse(minMaxUnfiltered));

        const minMaxFiltered = `
            SELECT 
                formatDateTime(min(p.${dateCol}), '%Y-%m-%d') AS minDate, 
                formatDateTime(max(p.${dateCol}), '%Y-%m-%d') AS maxDate 
            FROM ${pdpTable} AS p 
            INNER JOIN ${kamTable} AS k 
                ON lower(trim(p.platform_name)) = lower(trim(k.platform_name)) 
                AND lower(trim(p.location_name)) = lower(trim(k.location_name))
            WHERE lower(trim(p.platform_name)) IN (${items}) AND p.price_rp > 0 AND p.price_sp > 0
        `;
        console.log("Filtered minMax for platforms:", await queryClickHouse(minMaxFiltered));

    } catch (err) {
        console.error(err);
    }
}

testPromoFilterParams();
