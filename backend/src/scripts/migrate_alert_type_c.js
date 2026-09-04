/**
 * migrate_alert_type_c.js
 * One-shot migration: renames the whatsapp_test_3 alert row in ClickHouse.
 */

import { queryAdminDB } from '../config/adminClickhouse.js';

const OLD_TYPE = 'whatsapp_test_3';
const NEW_TYPE = 'low_offtake_product';
const NEW_NAME = 'Low Offtake – Product Level | vs L30 Days AVG';

async function migrate() {
    const rows = await queryAdminDB(`
        SELECT toString(id) AS id, alert_name, alert_type
        FROM admin_master.tb_alert
        WHERE alert_type = '${OLD_TYPE}'
    `);

    if (rows.length === 0) {
        console.log(`[Migrate] No rows with alert_type='${OLD_TYPE}'. Nothing to do.`);
        return;
    }

    console.log(`[Migrate] Found ${rows.length} row(s):`);
    rows.forEach(r => console.log(`  id=${r.id}  name="${r.alert_name}"  type="${r.alert_type}"`));

    await queryAdminDB(`
        ALTER TABLE admin_master.tb_alert
        UPDATE
            alert_type = '${NEW_TYPE}',
            alert_name = '${NEW_NAME}'
        WHERE alert_type = '${OLD_TYPE}'
    `);

    console.log(`[Migrate] Done: '${OLD_TYPE}' → '${NEW_TYPE}', name → '${NEW_NAME}'`);
    console.log('[Migrate] ClickHouse mutations are async — allow a few seconds to propagate.');
}

migrate().catch(err => {
    console.error('[Migrate] Error:', err.message);
    process.exit(1);
});
