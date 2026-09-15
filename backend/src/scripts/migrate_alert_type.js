/**
 * migrate_alert_type.js
 * One-shot migration: renames the whatsapp_test_1 alert row in ClickHouse.
 *
 * Run from the backend directory:
 *   node src/scripts/migrate_alert_type.js
 */

import { queryAdminDB } from '../config/adminClickhouse.js';

const OLD_TYPE = 'whatsapp_test_1';
const NEW_TYPE = 'low_osa_product';
const NEW_NAME = 'Low OSA – Product Level | vs Previous Day';

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
