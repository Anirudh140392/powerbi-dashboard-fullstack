import { queryAdminDB } from '../src/config/adminClickhouse.js';
async function test() {
    const dbId = '256044896700991019';
    const updatedKamStr = '{"all_platforms":{"overall":[{"email":"saqib.h@trailytics.com","last_low_osa_alert_mail_sent":"2026-08-10 16:50:00","last_performance_summary_mail_sent":"2026-08-10 16:50:00","last_sharp_promo_alert_mail_sent":"2026-08-09","last_category_health_alert_mail_sent":"2026-08-09"},{"email":"kenil.k@trailytics.com","last_low_osa_alert_mail_sent":"2026-08-09","last_performance_summary_mail_sent":"2026-08-09","last_sharp_promo_alert_mail_sent":"2026-08-09","last_category_health_alert_mail_sent":"2026-08-09"}],"blinkit":[{"email":"yash.g@trailytics.com","last_low_osa_alert_mail_sent":"2026-08-09","last_performance_summary_mail_sent":"2026-08-09","last_sharp_promo_alert_mail_sent":"2026-08-09","last_category_health_alert_mail_sent":"2026-08-09"}],"zepto":[],"instamart":[]}}';

    const updateQuery = `
        ALTER TABLE admin_master.tb_database
        UPDATE Internal_kam = '${updatedKamStr.replace(/'/g, "\\'")}'
        WHERE db_id = ${dbId}
        SETTINGS mutations_sync = 1
    `;
    console.log("Running query:", updateQuery);
    try {
        await queryAdminDB(updateQuery);
        console.log("Success");
    } catch(e) {
        console.error("Error:", e.message);
    }
}
test();
