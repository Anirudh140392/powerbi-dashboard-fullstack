import dotenv from 'dotenv';
dotenv.config();
import { runEmailAlertsJob } from '../src/services/alertCronService.js';

(async () => {
    try {
        console.log("Starting test run...");
        await runEmailAlertsJob();
        console.log("Finished test run.");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
