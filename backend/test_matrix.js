import { queryClickHouse } from './src/config/clickhouse.js';
import dayjs from 'dayjs';

async function test() {
    try {
        const periodDays = 30;
        const sqlWhere = `toDate(DATE) BETWEEN '2024-01-01' AND '2024-01-31' AND Comp_flag = 0`;
        const catCol = 'Category';
        const THRESHOLD_DOH = 8;
        const matrixQuery = `
            SELECT 
                Product as sku,
                Location as city,
                Brand as brand,
                ${catCol} as category,
                ifNull(sum(drr), 0) as drr_qty,
                ifNull(sum(latestStock), 0) as current_inventory,
                ifNull(sum(poQty), 0) as req_po_qty
            FROM (
                SELECT 
                    Product, Location, Brand, ${catCol}, Platform,
                    ifNull(argMax(ifNull(toFloat64OrZero(toString(Inventory)), 0), DATE), 0) as latestStock,
                    if(isNaN(sum(ifNull(Qty_Sold, 0)) / ${periodDays}), 0, sum(ifNull(Qty_Sold, 0)) / ${periodDays}) as drr,
                    if(isNaN(if(drr > 0, latestStock / drr, 0)), 0, if(drr > 0, latestStock / drr, 0)) as doh,
                    if(isNaN(if(${THRESHOLD_DOH} > doh, (${THRESHOLD_DOH} - doh) * drr, 0)), 0, if(${THRESHOLD_DOH} > doh, (${THRESHOLD_DOH} - doh) * drr, 0)) as poQty
                FROM rb_pdp_olap
                WHERE ${sqlWhere}
                GROUP BY Product, Location, Brand, ${catCol}, Platform
            )
            GROUP BY Product, Location, Brand, ${catCol}
            LIMIT 5
        `;
        console.log("Querying...");
        const res = await queryClickHouse(matrixQuery);
        console.log("Success");
        process.exit(0);
    } catch (e) {
        console.error("ClickHouse Error:", e);
        process.exit(1);
    }
}
test();
