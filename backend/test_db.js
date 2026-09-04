import { queryAdminDB } from './src/config/adminClickhouse.js';
async function test() {
    try {
        const rows = await queryAdminDB("SELECT order_qty, confirmed_qty, nv, gsv, net_price, unit_of_measure, units_in_case FROM mars.po_primary_sales WHERE order_qty > confirmed_qty AND confirmed_qty > 0 LIMIT 2");
        console.log(rows);
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
test();
