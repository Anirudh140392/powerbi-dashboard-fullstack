import { queryAdminDB } from '../src/config/adminClickhouse.js';

const exactJson = {
  "all_platforms": {
    "overall": [
      {
        "email": "saqib.h@trailytics.com",
        "last_low_osa_alert_mail_sent": "2026-08-09",
        "last_performance_summary_mail_sent": "2026-08-09",
        "last_sharp_promo_alert_mail_sent": "2026-08-09",
        "last_category_health_alert_mail_sent": "2026-08-09"
      },
      {
        "email": "kenil.k@trailytics.com",
        "last_low_osa_alert_mail_sent": "2026-08-09",
        "last_performance_summary_mail_sent": "2026-08-09",
        "last_sharp_promo_alert_mail_sent": "2026-08-09",
        "last_category_health_alert_mail_sent": "2026-08-09"
      }
    ],
    "blinkit": [
      {
        "email": "yash.g@trailytics.com",
        "last_low_osa_alert_mail_sent": "2026-08-09",
        "last_performance_summary_mail_sent": "2026-08-09",
        "last_sharp_promo_alert_mail_sent": "2026-08-09",
        "last_category_health_alert_mail_sent": "2026-08-09"
      }
    ],
    "zepto": [],
    "instamart": []
  }
};

async function test() {
    const dbs = await queryAdminDB(`SELECT toString(db_id) as db_id, Internal_kam FROM admin_master.tb_database WHERE Internal_kam != ''`);
    for (const db of dbs) {
        if (!db.Internal_kam || db.Internal_kam === '{}') continue;
        const str = JSON.stringify(exactJson).replace(/'/g, "\\'");
        const q = `ALTER TABLE admin_master.tb_database UPDATE Internal_kam = '${str}' WHERE db_id = ${db.db_id}`;
        await queryAdminDB(q);
        console.log("Updated db_id:", db.db_id);
    }
}
test().catch(console.error);
