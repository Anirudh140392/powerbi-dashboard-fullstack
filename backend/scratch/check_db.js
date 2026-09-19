import dotenv from 'dotenv';
dotenv.config();
import { queryAdminDB } from '../src/config/adminClickhouse.js';

(async () => {
    try {
        const query = `SELECT alert_name, alert_type, threshold_value FROM admin_master.tb_alert WHERE alert_type = 'keyword_delta_sos'`;
        const res = await queryAdminDB(query);
        console.log("Keyword Delta Alerts:", res);
    } catch(e) { console.error(e); }
    process.exit(0);
})();
