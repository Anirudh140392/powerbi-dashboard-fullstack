import { runEmailAlertsJob } from './src/services/alertCronService.js';
import dotenv from 'dotenv';
dotenv.config();

console.log("Starting manual runEmailAlertsJob execution...");
runEmailAlertsJob()
    .then(() => {
        console.log("Finished execution");
        process.exit(0);
    })
    .catch(err => {
        console.error("Error running job:", err);
        process.exit(1);
    });
