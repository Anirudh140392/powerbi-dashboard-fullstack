import dotenv from 'dotenv';
dotenv.config();
import { runEmailAlertsJob } from '../src/services/alertCronService.js';

(async () => {
    try {
        console.log("Starting cron job manually...");
        await runEmailAlertsJob();
        console.log("Cron job finished.");
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
})();
