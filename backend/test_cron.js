import { runEmailAlertsJob } from './src/services/alertCronService.js';
runEmailAlertsJob().then(() => console.log("Done")).catch(console.error);
